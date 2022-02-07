// deno-lint-ignore-file no-explicit-any
import { maylily } from '../../deps.ts';
import type { DB } from '../../deps/sqlite.ts';

import SQLiteClient from './clients/wasm-sqlite-client.ts';

// import TinyDB from '../../db/tiny-db.ts';
import type { SearchOptions, BatchOptions } from '../../common/types.ts';
import { NotSupportedError } from '../../common/errors.ts';

import { safen } from '../../db/db-util.ts';

/**
 * Optimized Tiny DB (WIP)
 */
// deno-lint-ignore no-unused-vars
/* export */ class SQLiteTinyDB /* extends TinyDB */ {

  public readonly separator = '_';
  protected readonly client: SQLiteClient;

  constructor(protected readonly db: DB, protected readonly table: string) {
    // super();

    this.client = new SQLiteClient(db, 'root');
  }

  #encode(value: any): string {
    return JSON.stringify(value);
  }

  #decode(value: string | null): any {
    if(value === null)
      return null;

    return JSON.parse(value);
  }

  async create(): Promise<void> {
    await this.client.exec(`CREATE TABLE IF NOT EXISTS "${this.table}" (
      id TEXT PRIMARY KEY NOT NULL,
      user TEXT NOT NULL,
      scope TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT
    );`);

    await this.client.exec(`CREATE INDEX IF NOT EXISTS user ON "${this.table}" (user);`);
    await this.client.exec(`CREATE UNIQUE INDEX IF NOT EXISTS user_scope_key ON "${this.table}" (user, scope, key);`);
  }

  async get<T = any>(user: string, scope: string, key: string): Promise<T> {
    return await this.client.one(`SELECT value FROM "${this.table}" WHERE user=${safen(user)} AND scope=${safen(scope)} AND key=${safen(key)};`).then(res => res?.value);
  }

  async add<T = any>(user: string, scope: string, value: T): Promise<string> {
    const id = safen(await maylily());
    return await this.client.one(`INSERT INTO "${this.table}" (id, user, scope, key, value) VALUES (${id}, ${safen(user)}, ${safen(scope)}, ${id}, ${safen(this.#encode(value))}) RETURNING key;`).then(res => res!.key);
  }

  #makePutQuery(user: string, scope: string, key: string, value: any): string {
    return `INSERT INTO "${this.table}" (user, scope, key, value) VALUES (${safen(user)}, ${safen(scope)}, ${safen(key)}, ${safen(this.#encode(value))}) ON CONFLICT ON CONSTRAINT user_scope_key DO UPDATE SET value = EXCLUDED.value;`;
  }

  async put(user: string, scope: string, key: string, value: any): Promise<void> {
    await this.client.exec(this.#makePutQuery(user, scope, key, value));
  }

  #makeDelQuery(user: string, scope?: string, key?: string) {
    let query = `DELETE FROM "${this.table}" WHERE user=${safen(user)}`;
    if(scope) {
      query += ' AND scope=' + safen(scope);

      if(key)
        query += ' AND key=' + safen(key);
    }
    return query + ';';
  }

  async del(user: string, scope: string, key: string): Promise<void> {
    await this.client.exec(this.#makeDelQuery(user, scope, key));
  }

  async delAllUserData(user: string, scope?: string): Promise<void> {
    await this.client.exec(this.#makeDelQuery(user, scope));
  }

  search<T = any>(_user: string, _scope: string, _search: SearchOptions<{ key: string; value: string }>): Promise<T[]> {
    throw new NotSupportedError('Cannot search with SQLite (yet!)');
  }

  async batch<T = any>(user: string, scope: string, ops: BatchOptions): Promise<BatchOptions<T>> {
    if(!ops.length)
      return [];

    let query = '';
    for(const op of ops) {
      if(op.type === 'put')
        query += this.#makePutQuery(user, scope, op.key, op.value);
      else if(op.type == 'del')
        query += this.#makeDelQuery(user, scope, op.key);
      else
        continue;
    }

    if(!query)
      return [];

    await this.client.exec(query);

    return [];
  }
}
