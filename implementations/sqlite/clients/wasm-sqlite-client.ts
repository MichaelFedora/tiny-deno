import { assertEquals, assertRejects } from '../../../deps/std.ts';
import { DB } from '../../../deps/sqlite.ts';

import SQLiteClient from './abstract-sqlite-client.ts';

// deno-lint-ignore no-explicit-any
export class WasmSQLiteClient<T = any> extends SQLiteClient<T> {

  constructor(protected readonly db: DB,
    protected readonly executor = 'anon',
    protected debug = false) {
      super();
    }


  protected _mapReturnRecurse<U = T>(item: Record<string, unknown>): U {
    const old = item;
    item = { };

    // sqlite likes camel case =)
    for(const /*o*/key in old) {

      // let key = okey;

      // if(key.includes('_'))
      //   key = toCamel(key);

      item[key] = old[/*o*/key];
    }

    for(const key in item) {
      if(item[key] == null)
        continue;
      else if(typeof item[key] === 'string' && /^\d+-\d\d-\d\dT\d\d:\d\d:\d\d\.\d\d\dZ$/.test(item[key] as string))
        item[key] = new Date(item[key] as string);
      else if(typeof item[key] === 'object' && !(item[key] instanceof Date))
        item[key] = this._mapReturnRecurse<unknown>(item[key] as Record<string, unknown>);
    }

    return item as U;
  }

  public mapReturn<U = T>(item: Record<keyof U, unknown>): U | null {
    return !item ? null : this._mapReturnRecurse<U>(item);
  }

  /**
   * Execute a query, without a return.
   * @param {string} query The query
   * @param {...any[]} params Replacement parameters ($1, $2, etc)
   */// deno-lint-ignore no-explicit-any
   async exec(query: string, ...params: any[]): Promise<void> {
    if(this.debug)
      console.debug(`[${new Date().toISOString()}][sqlite][${this.executor}][exec]:`, query, params.length ? params : '');

    const stmt = this.db.prepareQuery(query);
    try {
      await Promise.resolve(stmt.execute(params));
    } catch(e) {
      throw e;
    } finally {
      stmt.finalize();
    }
  }

  /**
   * Execute a query and return the first row. Used when you only want one return or are only expecting
   * one return (i.e. on an UPDATE or INSERT statement).
   * @param {string | TemplateStringsArray} query The query
   * @param {...any[]} params Replacement parameters ($1, $2, etc)
   * @returns {Promise<any?>} The first row
   */// deno-lint-ignore no-explicit-any
  async one<U = T>(query: string, ...params: any[]): Promise<U | null> {

    if(this.debug)
      console.debug(`[${new Date().toISOString()}][sqlite][${this.executor}][one]:`, query, params.length ? params : '');

    const stmt = this.db.prepareQuery(query);
    try {
      const iter = stmt.iterEntries(params);
      const res = await Promise.resolve(iter.next());

      if(res.done && !res.value)
        return null;

      const next = await Promise.resolve(iter.next());
      if(!next.done || next.value)
        throw new Error('Multiple records with key found!');

      return this.mapReturn(res.value as U);
    } catch(e) {
      throw e;
    } finally {
      stmt.finalize();
    }
  }

  /**
   * Execute a query and return all rows selected.
   * @param {string | TemplateStringsArray} query The query
   * @param {...any[]} params Replacement parameters ($1, $2, etc)
   * @returns {Promise<any[]>} All rows selected
   */// deno-lint-ignore no-explicit-any
  async all<U = T>(query: string, ...params: any[]): Promise<U[]> {

    if(this.debug)
      console.debug(`[${new Date().toISOString()}][sqlite][${this.executor}][all]:`, query, params.length ? params : '');

    const stmt = this.db.prepareQuery(query);
    try {
      const rows = await Promise.resolve(stmt.allEntries(params));
      return (rows as U[]).map(row => this.mapReturn<U>(row)!).filter(v => v !== null);
    } catch(e) {
      throw e;
    } finally {
      stmt.finalize();
    }
  }
}

export default WasmSQLiteClient;

Deno.test({
  name: 'WasmSQLiteClient Test',
  async fn(): Promise<void> {
    const db = new DB(':memory:');
    const client = new WasmSQLiteClient(db, 'tester', true);

    await client.exec(`CREATE TABLE IF NOT EXISTS test (key TEXT PRIMARY KEY, value TEXT)`);
    await client.exec(`INSERT INTO test (key, value) VALUES ($1, $2)`, 'hello', 'world');
    assertEquals(db.query('SELECT * FROM test'), [ ['hello', 'world'] ]);
    assertEquals(await client.one('SELECT * FROM test'), { key: 'hello', value: 'world' });
    assertEquals(await client.all('SELECT * FROM test'), [{ key: 'hello', value: 'world' }]);

    const date = new Date();
    assertEquals(await client.one(`INSERT INTO test (key, value) VALUES ($1, $2) RETURNING *`, 'foo', date), { key: 'foo', value: date });
    await assertRejects(() => client.one('SELECT * FROM test'), undefined, 'Multiple records with key found!');

    assertEquals(await client.all('SELECT * FROM test'), [{ key: 'hello', value: 'world' }, { key: 'foo', value: date }]);

    await client.exec(`DELETE FROM test WHERE value IS NOT null OR value IS null`);
    assertEquals(await client.all('SELECT * FROM test'), []);

    await client.exec(`CREATE TABLE IF NOT EXISTS testTwo (camelCase TEXT PRIMARY KEY, snake_case TEXT);`);
    await client.exec(`INSERT INTO testTwo (camelCase, snake_case) VALUES ('neatStuff', 'indeed_indeed');`);
    console.log(await client.all(`SELECT camelcase, snake_case FROM testTwo`));
    console.log(db.queryEntries(`SELECT camelcase, snake_case FROM testTwo`));
  }
});
