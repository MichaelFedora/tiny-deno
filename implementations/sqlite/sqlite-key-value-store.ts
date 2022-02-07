// deno-lint-ignore-file no-explicit-any
import { assertEquals } from '../../deps/std.ts';
import { DB } from '../../deps/sqlite.ts';

import SQLiteClient from './clients/wasm-sqlite-client.ts';

import KeyValueStore from '../../common/key-value-store.ts';
import type { SearchOptions, BatchOptions } from '../../common/types.ts';

import { compileQuery } from '../../db/db-util.ts';

export class SQLiteKeyValueStore<T = any> extends KeyValueStore<T> {

  public readonly separator = '!!';
  protected readonly client: SQLiteClient;

  constructor(db: DB, protected readonly table: string) {
    super();

    this.client = new SQLiteClient(db, 'key-val][' + table);
  }

  #encode(value: any): string {
    return JSON.stringify(value);
  }

  #decode(value: string | null): any {
    if(value === null)
      return null;

    if(value === undefined)
      return null; // could be undefined, but types says T | null

    if(typeof value !== 'string') {// ó
      console.warn('Value isn\'t a string?!', value);
      return value;
    }

    let ret: any = value;

    try {
      ret = JSON.parse(value);
    } catch {
      console.warn('Failed to parse JSON; keeping value.', ret);
    }

    if(typeof ret === 'string' && /^\d+-\d\d-\d\dT\d\d:\d\d:\d\d\.\d\d\dZ$/.test(ret as string))
      return new Date(ret);

    return ret;
  }

  #inited = false;

  async init(): Promise<void> {
    if(this.#inited)
      return;

    this.#inited = true;

    await this.client.exec(`CREATE TABLE IF NOT EXISTS "${this.table}" (key TEXT PRIMARY KEY NOT NULL, value TEXT);`);
  }

  async get<U = T>(key: string): Promise<U | null> {
    return await this.client.one(`SELECT value FROM "${this.table}" WHERE key = $1;`, key).then(res => this.#decode(res?.value));
  }

  async put(key: string, value: any): Promise<void> {
    if(value == null)
      return await this.del(key);

    await this.client.exec(`INSERT INTO "${this.table}" (key, value) VALUES ($1, $2) ON CONFLICT DO UPDATE SET value = $2;`, key, this.#encode(value));
  }

  async del(key: string): Promise<void> {
    await this.client.exec(`DELETE FROM "${this.table}" WHERE key=$1`, key);
  }

  async delPrefixed(prefix: string): Promise<void> {
    await this.client.exec(`DELETE FROM "${this.table}" WHERE key LIKE $1`, prefix + '%');
  }

  async search<U = T>(search: SearchOptions<{ key: string; value: string }>): Promise<U[]> {
    const { query, params } = search.query ? compileQuery(search.query) : { query: '', params: [] };

    let stmt = `SELECT value FROM "${this.table}"`;

    if(query || search.prefix)
      stmt += ' WHERE ';

    if(search.prefix)
      stmt += `key LIKE $${params.push(search.prefix.replace(/[%_@]/g, '@$1') + '%')} ESCAPE '@'`;

    if(query && search.prefix)
      stmt += ' AND ';

    if(query)
      stmt += query;

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

    return await this.client.all(stmt, ...params).then(res => res.map(row => this.#decode(row.value)! as U));
  }

  async batch<U = T>(ops: BatchOptions<U>): Promise<BatchOptions<U>> {
    await Promise.resolve();

    if(!ops.length)
      return [];

    const db = this.client['db'];

    db.transaction(() => {
      for(const op of ops) {

        if(op.type === 'put') {
          const stmt = db.prepareQuery(`INSERT INTO "${this.table}" (key, value) VALUES ($1, $2) ON CONFLICT DO UPDATE SET value = $2;`);
          try {
            stmt.execute([op.key, this.#encode(op.value)]);

          } catch(e) {
            throw e;

          } finally {
            stmt.finalize();
          }
        } else if(op.type == 'del') {
          const stmt = db.prepareQuery(`DELETE FROM "${this.table}" WHERE key=$1`);
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
}

export default SQLiteKeyValueStore;

Deno.test({
  name: 'SQLiteKeyValue Test',
  async fn(): Promise<void> {
    const db = new DB(':memory:');

    const kv = new SQLiteKeyValueStore(db, 'KeyValue');
    kv['client']['debug'] = true;
    await kv.init();

    await kv.put('key', 'value');
    console.log('Testing if KeyValue has { key: "value" } in it');
    assertEquals(db.query('SELECT * FROM KeyValue'), [ ['key', '"value"'] ]);

    console.log('Testing if get("key") => "value"');
    assertEquals(await kv.get('key'), 'value');

    await kv.put('key', null);
    console.log('Testing if get("key") => null');
    assertEquals(await kv.get('key'), null);

    await kv.put('key', undefined);
    console.log('Testing if get("key") => null (even though it was set to `undefined`)');
    assertEquals(await kv.get('key'), null);

    await kv.put('key', '');
    console.log('Testing if get("key") => ""');
    assertEquals(await kv.get('key'), '');

    await kv.del('key');
    console.log('Testing if get("key") => null (deleted)');
    assertEquals(await kv.get('key'), null);
    console.log('Asserting it doesn\'t exist');
    assertEquals(db.query('SELECT * FROM KeyValue WHERE key = $1', ['key']), []);


    await kv.put('n:int', 2);
    console.log('Testing if get("n:int") => 2');
    assertEquals(await kv.get('n:int'), 2);

    await kv.put('n:fl', 1 / 3);
    console.log('Testing if get("n:fl") => 1 / 3');
    assertEquals(await kv.get('n:fl'), 1 / 3);

    console.log('Testing search for n: 1->2 -key')
    const search = await kv.search({
      prefix: 'n:',
      skip: 1,
      limit: 2,
      sort: '-key'
    });
    assertEquals(search, [ { kye: 'n:fl' } ]);

    await kv.delPrefixed('n:');
    console.log('Testing if delPrefixed("n:") cleared numbers');
    assertEquals(db.query('SELECT * FROM KeyValue WHERE key IS NOT null'), []);


    await kv.put('bool', true);
    console.log('Testing if get("bool") => true');
    assertEquals(await kv.get('bool'), true);

    const date = new Date();
    await kv.put('date', date);
    console.log('Testing if get("date") => Date');
    assertEquals(await kv.get('date'), date);

    const json = { foo: { bar: "{ not: true }" } };
    await kv.put('json', json);
    console.log('Testing if get("json") => { foo: { bar: "{ not: true }" } }')
    assertEquals(await kv.get('json'), json);

    await kv.batch([
      { type: 'put', key: 'neat', value: 'nice' },
      { type: 'del', key: 'bool' },
      { type: 'del', key: 'wah' }
    ]);
    console.log('Testing if batch worked (and skipped "wah").');
    assertEquals(await kv.get('neat'), 'nice');
    assertEquals(await kv.get('bool'), null);
  }
});
