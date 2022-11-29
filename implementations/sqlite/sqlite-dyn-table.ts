// deno-lint-ignore-file no-explicit-any
import { maylily } from '../../deps.ts';
import { assertEquals } from '../../deps/std.ts';
import { DB } from '../../deps/sqlite.ts';

import SQLiteClient from './clients/wasm-sqlite-client.ts';

import type { SearchOptions, BatchOptions } from '../../common/types.ts';
import { DynTable, TableSchema, ColumnType } from '../../common/dyn-table.ts';

import { mapToEntries, mapToInsert, compileQuery } from '../../db/db-util.ts';

const Scalars = ['string', 'number', 'boolean'] as const;

export class SQLiteDynTable<T = any> extends DynTable<T> {

  protected readonly client: SQLiteClient;

  constructor(protected readonly db: DB, schema: TableSchema) {
    super(schema);

    this.client = new SQLiteClient(db, 'dyn-tbl][' + this.schema.name!);
  }

  #encode(value: Partial<T>): Record<string, string | number | boolean | null> {
    const record = { } as Record<string, string | number | boolean | null>;
    if(!value)
      return record;

    for(const key in value) {
      if(!this.schema.columns[key])
        continue;

      if(Scalars.includes(typeof value[key] as typeof Scalars[0]) || value[key] == null)
        record[key] = value[key] as any;
      else
        record[key] = JSON.stringify(value[key]);
    }

    return record;
  }

  #decode(value: Record<string, string> | null): T | null {
    if(value === null)
      return null;

    const record = { } as T;

    for(const key in value) {
      if(!this.schema.columns[key])
        continue;

      // take care of null/undefined values
      if(value[key] == null) {
        (record as Record<string, unknown>)[key] = value[key];
        continue;
      }

      let v;

      switch(this.schema.columns[key].type) {
        // scalars
        case ColumnType.Boolean: v = Boolean(value[key] && /1|true/i.test(value[key])); break;
        case ColumnType.String: v = String(value[key]); break;
        case ColumnType.Int: v = Number.parseInt(value[key]); break;
        case ColumnType.Float: v = Number(value[key]); break;
        case ColumnType.ID: v = String(value[key]); break;

        // complex
        case ColumnType.Date: v = new Date(Number.parseInt(value[key]) || value[key]); break;
        case ColumnType.JSON:
          try {
            v = JSON.parse(value[key]);
          } catch {
            v = value[key];
          }
          break;
      }

      (record as Record<string, unknown>)[key] = v;
    }

    return record;
  }

  async all(filter?: Partial<T>): Promise<T[]> {
    const base = `SELECT * FROM "${this.schema.name}"`

    let rows: Record<string, string>[];

    if(filter) {
      const { query, params } = mapToEntries(this.#encode(filter), false);
      rows = await this.client.all(`${base} WHERE ${query};`, ...params);
    } else
      rows = await this.client.all(base + ';');

    return rows.map(r => this.#decode(r)!).filter(v => v !== null);
  }

  async search(search: SearchOptions<T>): Promise<T[]> {
    const { query, params } = search.query ? compileQuery<T>(search.query) : { query: '', params: [] };

    let stmt = `SELECT ${search.projection?.join(',') || '*'} FROM "${this.schema.name}"`;
    if(query)
      stmt += ' WHERE ' + query;

    if(search.sort) {
      const tokens = search.sort.split(/\s+/)
        .filter(tok => Boolean(tok) && /^[+-]?\w+$/.test(tok))
        .map(tok => tok.startsWith('-')
          ? `${tok.slice(1)} DESC`
          : tok.startsWith('+')
            ? `${tok.slice(1)} ASC`
            : `${tok}`);

      if(tokens.length)
        stmt += ` ORDER BY ${tokens.join(', ')}`;
    }

    if(search.limit)
      stmt += ` LIMIT $${params.push(search.limit)}`;

    if(search.skip)
      stmt += `${!search.limit ? 'LIMIT -1' : ''} OFFSET $${params.push(search.skip)}`;

    return await this.client.all(stmt, ...params).then(res => res.map(row => this.#decode(row)!));
  }

  async one(id: string): Promise<T | null> {
    const row = await this.client.one(`SELECT * FROM "${this.schema.name}" WHERE id = $1;`, id);
    return this.#decode(row);
  }

  async add(input: Partial<T>): Promise<T> {
    const id = await maylily();

    const { query, params } = mapToInsert({ id, ...this.#encode(input) });

    const row = await this.client.one(`INSERT INTO "${this.schema.name}" ${query} RETURNING *;`, ...params);

    return this.#decode(row)!;
  }

  async put(id: string, input: Partial<T>): Promise<T> {
    const { query, params } = mapToEntries(this.#encode(input), true);

    const row = await this.client.one(`UPDATE "${this.schema.name}" SET ${query} WHERE id = $${params.length + 1} RETURNING *;`, ...params, id);
    return this.#decode(row)!;
  }

  async del(id: string): Promise<void> {
    await this.client.exec(`DELETE FROM "${this.schema.name}" WHERE id = $1`, id);
  }

  async batch(ops: BatchOptions<T>): Promise<BatchOptions<T>> {
    await Promise.resolve();

    if(!ops.length)
      return [];

    this.db.transaction(() => {
      for(const op of ops) {

        if(op.type === 'put') {
          const { query, params } = mapToEntries(this.#encode(op.value), true);

          const stmt = this.db.prepareQuery(`UPDATE "${this.schema.name}" SET ${query} WHERE id = $${params.length + 1} RETURNING *;`);
          try {
            stmt.execute([ ...params, op.key ]);

          } catch(e) {
            throw e;

          } finally {
            stmt.finalize();
          }
        } else if(op.type == 'del') {
          const stmt = this.db.prepareQuery(`DELETE FROM "${this.schema.name}" WHERE id = $1`);
          try {
            stmt.execute([op.key]);

          } catch(e) {
            throw e;

          } finally {
            stmt.finalize();
          }
        } else
          continue;
      }
    });

    return [];
  }

  async delMany(ids: readonly string[]): Promise<void> {
    if(!ids.length)
      return;

    await this.client.exec(`DELETE FROM "${this.schema.name}" WHERE ${ids.map((_, i) => `id = $${i + 1}`).join(' OR ')}`, ...ids);
  }
}

export default SQLiteDynTable;


Deno.test({
  name: 'SQLiteDynTable Test',
  async fn(): Promise<void> {
    const db = new DB(':memory:');

    const dyn = new SQLiteDynTable<{ id: string; key: string; value?: string | null }>(db, {
      name: 'DynTable',
      columns: {
        id: { type: ColumnType.ID, nullable: false, meta: 'ID!' },
        key: { type: ColumnType.String, nullable: false, meta: 'String!' },
        value: { type: ColumnType.JSON, nullable: true, meta: 'JSON' }
      },
      indexes: []
    });
    dyn['client']['debug'] = true;

    await dyn['client'].exec('CREATE TABLE IF NOT EXISTS DynTable (id TEXT PRIMARY KEY, key TEXT NOT NULL, value TEXT);');

    const el = await dyn.add({ key: 'hi!', value: 'wow!' });
    console.log('Testing if add({ key: "hi!", value: "wow!" }) => { id, key: "hi!", value: "wow!" }');
    assertEquals(el, { id: el.id, key: 'hi!', value: 'wow!' });

    console.log('Testing if one(id) => { id, key: "hi!", value: "wow!" }');
    assertEquals(await dyn.one(el.id), el);

    console.log('Testing if all => [{ id, key: "hi!", value: "wow!" }]');
    assertEquals(await dyn.all(), [el]);

    console.log('Testing if put(id, { value: undefined }) => { id, key: "hi!", value: null }');
    assertEquals(await dyn.put(el.id, { value: undefined }), { id: el.id, key: "hi!", value: null });

    console.log('Testing if del(id) => void');
    assertEquals(await dyn.del(el.id), undefined);

    console.log('Testing if table is empty.');
    assertEquals(await dyn.all(), []);

    console.log('Adding more data...');
    const neat = await dyn.add({ key: 'neat' });
    const alright = await dyn.add({ key: 'alright', value: 'airtight' });

    console.log('Testing search');
    console.log(await dyn.search({ skip: 1, limit: 1, projection: ['key'], sort: '-key', query: { key: { $ne: null } } }))

    await dyn.batch([
      { type: 'put', key: neat.id, value: { key: 'oh shoot' } as any },
      { type: 'del', key: alright.id }
    ]);
    console.log('Testing if batch worked.');
    assertEquals(await dyn.all(), [ { id: neat.id, key: 'oh shoot', value: null }]);
  }
});

