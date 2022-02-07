// deno-lint-ignore-file no-explicit-any
import { assertEquals } from '../../deps/std.ts';
import { DB, PreparedQuery } from '../../deps/sqlite.ts';
import { cloneDeep, isEqual } from '../../deps/lodash.ts';

import SQLiteClient from './clients/wasm-sqlite-client.ts';

import DynTableStore, { TableSchema, ColumnType } from '../../common/dyn-table-store.ts';
import SQLiteDynTable from './sqlite-dyn-table.ts';

export class SQLiteDynTableStore extends DynTableStore {

  public readonly separator = '_';
  protected readonly client: SQLiteClient<{ name: string; columns: string; indexes: string; version: string }>;
  public readonly schemaTable: string;

  constructor(protected readonly db: DB, protected readonly prefix: string) {
    super();

    this.client = new SQLiteClient(db, 'dyn-tbl-store');
    this.schemaTable = [this.prefix, 'dyn', 'schema', 'table'].join(this.separator)
  }

  #inited = false;

  public async init(): Promise<void> {
    if(this.#inited)
      return;

    this.#inited = true;

    await this.client.exec(`CREATE TABLE IF NOT EXISTS "${this.schemaTable}" (
      name TEXT PRIMARY KEY,
      columns TEXT NOT NULL,
      indexes TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 0
    )`);
  }

  #mapColumns(columns: TableSchema['columns']): Record<string, string> {
    const def = { } as Record<string, string>;

    for(const col in columns) {
      const colDef = columns[col];

      if(col === 'id') {
        def[col] = 'TEXT PRIMARY KEY';
        continue;
      } else if(colDef.type === ColumnType.Int)
        def[col] = 'INTEGER';
      else if(colDef.type === ColumnType.Float)
        def[col] = 'REAL';
      else
        def[col] = 'TEXT';

      if(!colDef.nullable)
        def[col] += ' NOT NULL';
    }

    return def;
  }

  #flattenColumns(columns: Record<string, string>): string {
    return Object.entries(columns).map(([k, v]) => `${k} ${v}`).join(',\n  ')
  }

  public async create<T = Record<string, unknown>>(table: string, schema: TableSchema<T>): Promise<void> {
    schema.columns.id = { type: ColumnType.ID, nullable: false, meta: 'ID!' };

    await this.client.exec(`INSERT INTO "${this.schemaTable}" (name, columns, indexes) VALUES ($1, $2, $3)`,
      table,
      JSON.stringify(schema.columns),
      JSON.stringify(schema.indexes));

    const tbl = [this.prefix, table].join(this.separator);

    if(!schema.indexes)
      await this.client.exec(`CREATE TABLE IF NOT EXISTS "${tbl}" (\n  `
      + `${this.#flattenColumns(this.#mapColumns(schema.columns))}\n)`);
    else {
      this.db.transaction(() => {
        let stmt: PreparedQuery | undefined;
        try {
          stmt = this.db.prepareQuery(`CREATE TABLE "${tbl}" (\n  `
            + `${this.#flattenColumns(this.#mapColumns(schema.columns))}\n);`);

          stmt.execute();
          stmt.finalize();

          for(const index of schema.indexes) {
            stmt = this.db.prepareQuery(`CREATE${index.unique ? ' UNIQUE' : ''} INDEX "${tbl}_${index.fields.join(this.separator)}" ON "${tbl}" (${index.fields.join(', ')});`);
            stmt.execute();
            stmt.finalize();
          }
        } finally {
          if(stmt)
            stmt.finalize();
        }
      });
    }
  }

  public async define<T = Record<string, unknown>>(table: string): Promise<TableSchema<T> | null> {
    const row = await this.client.one(`SELECT * FROM "${this.schemaTable}" WHERE name = $1`, table);
    if(!row)
      return null;
    return {
      name: row.name,
      columns: JSON.parse(row.columns),
      indexes: JSON.parse(row.indexes),
      version: Number(row.version)
    } as TableSchema<T>;
  }

  public async list(prefix?: string): Promise<TableSchema[]> {
    const query = `SELECT * FROM "${this.schemaTable}"`;

    let rows: { name: string; columns: string; indexes: string; version: string }[];
    if(prefix)
      rows = await this.client.all(query + ' WHERE name LIKE $1', prefix + '%');
    else
      rows = await this.client.all(query);

    return rows.map(({ name, columns, indexes, version }) => ({
      name,
      columns: JSON.parse(columns),
      indexes: JSON.parse(indexes),
      version: Number(version)
    }));
  }

  public async redefine<T = Record<string, unknown>>(table: string, schema: TableSchema<T>): Promise<void> {
    const old = await this.define(table);
    if(!old)
      return await this.create(table, schema);

    schema.columns.id = { type: ColumnType.ID, nullable: false, meta: 'ID' };

    if(isEqual({ columns: old.columns, indexes: old.indexes }, { columns: schema.columns, indexes: schema.indexes })) {
      // console.warn('Will not re-define to same definition:', table);
      return;
    }

    const tbl = [this.prefix, table].join(this.separator);
    const version = (old.version || 0) + 1;

    this.db.transaction(() => {
      let stmt: PreparedQuery | undefined;
      try {

        /*
        stmt = this.db.prepareQuery(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = $1`);
        const indexes = stmt.all([ tbl ]).flat();
        stmt.finalize();

        for(const idx of indexes) {
          stmt = this.db.prepareQuery(`DROP INDEX "${idx}";`);
          stmt.execute();
          stmt.finalize();
        } */

        stmt = this.db.prepareQuery(`CREATE TABLE "_${tbl}" (\n  `
          + `${this.#flattenColumns(this.#mapColumns(schema.columns))}\n);`);
        stmt.execute();
        stmt.finalize();

        for(const index of schema.indexes) {
          stmt = this.db.prepareQuery(`CREATE${index.unique ? ' UNIQUE' : ''} INDEX "${tbl}_${index.fields.join(this.separator)}_v${version}" ON "_${tbl}" (${index.fields.join(', ')});`);
          stmt.execute();
          stmt.finalize();
        }

        const newColumns = Object.keys(schema.columns);
        const common = Object.keys(old.columns).filter(c => newColumns.includes(c)).join(', ');
        if(common) {
          stmt = this.db.prepareQuery(`INSERT INTO "_${tbl}" (${common}) SELECT * FROM "${tbl}";`);
          stmt.execute();
          stmt.finalize();
        } else
          console.warn('Redefining table with no shared columns!');

        stmt = this.db.prepareQuery(`DROP TABLE "${tbl}";`);
        stmt.execute();
        stmt.finalize();

        stmt = this.db.prepareQuery(`ALTER TABLE "_${tbl}" RENAME TO "${tbl}";`);
        stmt.execute();
        stmt.finalize();

        stmt = this.db.prepareQuery(`UPDATE "${this.schemaTable}" SET columns=$1, indexes=$2, version=$3 WHERE name = $4;`);
        stmt.execute([ JSON.stringify(schema.columns), JSON.stringify(schema.indexes), version, table ]);
        stmt.finalize();
      } finally {
        if(stmt)
          stmt.finalize();
      }
    });
  }

  public async drop(table: string): Promise<void> {
    await Promise.resolve();
    const tbl = [this.prefix, table].join(this.separator);

    this.db.transaction(() => {
      let stmt: PreparedQuery | undefined;
      try {

        stmt = this.db.prepareQuery(`DELETE FROM "${this.schemaTable}" WHERE name = $1;`);
        stmt.execute([ table ]);
        stmt.finalize();

        stmt = this.db.prepareQuery(`DROP TABLE "${tbl}";`);
        stmt.execute();
        stmt.finalize();

      } finally {
        if(stmt)
          stmt.finalize();
      }
    });
  }

  public async dropMany(tables: string[]): Promise<void> {
    await Promise.resolve();

    this.db.transaction(() => {
      let stmt: PreparedQuery | undefined;
      try {

        stmt = this.db.prepareQuery(`DELETE FROM "${this.schemaTable}" WHERE ${tables.map((_, i) => `name = $${i + 1}`).join(' OR ')}`);
        stmt.execute(tables);
        stmt.finalize();

        for(let tbl of tables) {
          tbl = [this.prefix, tbl].join(this.separator);
          stmt = this.db.prepareQuery(`DROP TABLE IF EXISTS "${tbl}";`);
          stmt.execute();
          stmt.finalize();
        }

      } finally {
        if(stmt)
          stmt.finalize();
      }
    });
  }

  public async dropPrefixed(prefix: string): Promise<void> {

    await Promise.resolve();

    this.db.transaction(() => {
      let stmt: PreparedQuery | undefined;
      try {

        stmt = this.db.prepareQuery(`SELECT name FROM "${this.schemaTable}" WHERE name LIKE $1`);
        const tables = stmt.all([ prefix + '%' ]).flat() as string[];
        stmt.finalize();

        stmt = this.db.prepareQuery(`DELETE FROM "${this.schemaTable}" WHERE name LIKE $1`);
        stmt.execute([ prefix + '%' ]);
        stmt.finalize();

        for(let tbl of tables) {
          tbl = [this.prefix, tbl].join(this.separator);
          stmt = this.db.prepareQuery(`DROP TABLE IF EXISTS "${tbl}";`);
          stmt.execute();
          stmt.finalize();
        }

      } finally {
        if(stmt)
          stmt.finalize();
      }
    });
  }

  table<T = any>(table: string): SQLiteDynTable<T>  {
    return new SQLiteDynTable<T>(this.db, [this.prefix, table].join(this.separator));
  }
}

export default SQLiteDynTableStore;

Deno.test({
  name: 'SQLite DynTableStore Test',
  async fn(): Promise<void> {
    const db = new DB(':memory:');

    const dts = new SQLiteDynTableStore(db, 'prefix');
    dts['client']['debug'] = true;
    await dts.init();

    const definition = {
      columns: {
        id: { type: ColumnType.ID, nullable: false, meta: 'ID!' },
        key: { type: ColumnType.String, nullable: false, meta: 'String!' },
        value: { type: ColumnType.JSON, nullable: true, meta: 'JSON' }
      },
      indexes: []
    };

    const name = 'user_scope_KeyValue';
    await dts.create(name, definition);
    // `id` gets added to `definition` above since it's passed by reference

    console.log('Testing definition of tables.');
    assertEquals(await dts.define('user_scope_KeyValue'), { name, ...definition });

    console.log('Definition: ', await dts.define('user_scope_KeyValue'));

    console.log('Testing existence in list.');
    assertEquals(await dts.list(), [ { name, ...definition } ]);

    const definition2 = {
      columns: {
        ...definition.columns,
        user: { type: ColumnType.ID, nullable: false, meta: 'ID!' }
      },
      indexes: [{ fields: ['key', 'user'] as const, unique: true }],
      version: 0
    };

    console.log('Testing re-defining the table.');
    await dts.redefine(name, definition2);
    assertEquals(await dts.define(name), { name, ...definition2, version: 1 });
    console.log('New Definition: ', await dts.define(name));

    console.log('Testing getting the DynTable class');
    const dt = dts.table(name);
    console.log('Quick DynTable test: add, list, remove');
    const item = await dt.add({ key: 'hi', value: 'wow!' });
    assertEquals(await dt.all(), [ { id: item.id, key: 'hi', value: 'wow!', user: null } ]);
    await dt.del(item.id);
    assertEquals(await dt.all(), []);

    console.log('Testing dropping the table.');
    await dts.drop(name);
    assertEquals(await dts.list(), []);
    assertEquals(await dts.define(name), null);

    console.log('Creating a couple tables...');
    const manyDef = { columns: { id: { type: ColumnType.ID, nullable: false } }, indexes:[] } as TableSchema;
    await dts.create('p_table_1', manyDef);
    await dts.create('p_table_2', manyDef);
    await dts.create('table_3', manyDef);
    await dts.create('table_4', manyDef);

    console.log('Listing tables with prefix "p_"');
    assertEquals(await dts.list('p_'), [ { name: 'p_table_1', ...manyDef }, { name: 'p_table_2', ...manyDef } ]);

    console.log('Dropping tables with prefix "p_"');
    await dts.dropPrefixed('p_');
    assertEquals(await dts.list('p_'), []);

    console.log('Dropping many tables...');
    await dts.dropMany([ 'table_3', 'table_4' ]);
    assertEquals(await dts.list(), []);
  }
});
