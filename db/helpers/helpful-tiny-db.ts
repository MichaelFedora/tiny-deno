// deno-lint-ignore-file no-explicit-any
import { maylily } from '../../deps.ts';

import { NotFoundError } from '../../common/errors.ts';
import type { SearchOptions, BatchOptions } from '../../common/types.ts';
import type { GQLSchema, GQLResult } from './../db-types.ts';

import { KeyValueStore } from '../../common/key-value-store.ts';
import { DynTableStore, TableSchema, ColumnType } from '../../common/dyn-table-store.ts';
import { User } from '../../common/types.ts';

import { TinyDb } from '../tiny-db.ts';

import { defineTableHelper, reservedTypeNames, makeSchema, query as execQuery } from '../graphql-util.ts';
import { ParsedGQLField } from '../graphql-types.ts';

import GQLTable from '../graphql-table.ts';
import HelpfulGQLTable from './helpful-graphql-table.ts';

export class HelpfulTinyDb extends TinyDb {

  constructor(protected readonly keyValueStore: KeyValueStore,
    protected readonly dynTableStore: DynTableStore,
    protected readonly getUser: (id: string) => Promise<User | null>,
    prefix = '') {

    super(prefix);
  }

  async init(): Promise<void> {
    await this.keyValueStore.init();
    await this.dynTableStore.init();
  }

  public async delAllUserData(user: string, scope?: string): Promise<void> {
    await this.keyValueStore.delPrefixed(this.#key(user, scope));
    await this.dynTableStore.dropPrefixed(this.#table(user, scope));
  }

  // #region key value

  #key(user: string, scope?: string, ...keys: string[]): string {
    return [this.prefix, user, scope, ...keys].filter(Boolean).join(this.keyValueStore.separator);
  }

  public get<T = any>(user: string, scope: string, key: string): Promise<T | null> {
    return this.keyValueStore.get(this.#key(user, scope, key));
  }

  public async add<T = any>(user: string, scope: string, value: T): Promise<string> {
    const key = await maylily();
    (value as Record<string, unknown>).key = key;
    await this.keyValueStore.put(this.#key(user, scope, key), value);
    return key;
  }

  public async put<T = any>(user: string, scope: string, key: string, value: T): Promise<void> {
    await this.keyValueStore.put(this.#key(user, scope, key), value);
  }

  public async del(user: string, scope: string, key: string): Promise<void> {
    await this.keyValueStore.del(this.#key(user, scope, key));
  }

  public async search<T = any>(user: string, scope: string, options: SearchOptions<T>): Promise<T[]> {
    const root = this.#key(user, scope) + this.keyValueStore.separator;

    const opts = Object.assign({ }, options, {
      prefix: options.prefix ? this.#key(user, scope, String(options.prefix)) : root,
    });

    return await this.keyValueStore.search(opts);
  }

  public async batch<T = any>(user: string, scope: string, options: BatchOptions<T>): Promise<BatchOptions<T>> {
    if(!options.length) return [];

    const opts: BatchOptions<T> = [];
    for(const opt of options)
      opts.push({ ...opt, key: this.#key(user, scope, opt.key) });

    return await this.keyValueStore.batch(opts)
  }

  // #endregion key value


  // #region dyn table

  #table(user: string, scope?: string, ...keys: string[]): string {
    return [this.prefix, user, scope, ...keys].filter(Boolean).join(this.dynTableStore.separator);
  }

  #translateSchema(schema: TableSchema): GQLSchema {
    const [ user, scope, name ] = schema.name!
      .slice(this.prefix.length + this.dynTableStore.separator.length)
      .split(this.dynTableStore.separator);

    return {
      id: schema.id!,
      user, scope, name,
      fields: Object.entries(schema.columns).map(([key, type]) => ({ key, type: type.meta || `${type.type}${!type.nullable ? '!' : ''}` }))
    };
  }

  public async getSchema(user: string, scope: string, name: string): Promise<GQLSchema | null> {
    const schema = await this.dynTableStore.define(this.#table(user, scope, name));
    if(!schema)
      return schema;

    if(!schema.name)
      schema.name = name;

    return this.#translateSchema(schema);
  }

  public async getSchemas(user: string, scope?: string): Promise<GQLSchema[]> {
    const schemas = await this.dynTableStore.list(this.#table(user, scope));
    return schemas.map(s => this.#translateSchema(s));
  }

  async #registerSchema(user: string, scope: string, obj: {
    name: string;
    fields: ParsedGQLField[];
  }): Promise<GQLSchema> {

    const schema: TableSchema = { columns: { }, indexes: [] };
    for(const field of obj.fields) {
      const reference = reservedTypeNames.includes(field.rawType);

      schema.columns[field.key] = {
        type: ColumnType[field.rawType as keyof typeof ColumnType] ? field.rawType as ColumnType :
          reference ? ColumnType.ID : ColumnType.JSON,
        nullable: field.nullable,
        meta: field.type
      }
    }

    await this.dynTableStore.create(this.#table(user, scope, obj.name), schema);
    schema.name = [this.prefix, user, scope, obj.name].filter(Boolean).join(this.dynTableStore.separator);

    return this.#translateSchema(schema);
  }

  public async registerSchemas(user: string, scope: string, schema: string, stubs?: string): Promise<GQLSchema[]> {
    const objs = defineTableHelper(schema, stubs);

    const returns = [] as GQLSchema[];
    for(const obj of objs)
      returns.push(await this.#registerSchema(user, scope, obj));

    return returns;
  }

  public async replaceSchema(user: string, scope: string, name: string, schema: string, stubs?: string): Promise<GQLSchema> {
    const objs = defineTableHelper(schema, stubs);
    const obj = objs.find(o => o.name === name);
    if(!obj)
      throw new NotFoundError('No schema found with the name of the table we are replacing!');

    return await this.#registerSchema(user, scope, obj);
  }

  public async dropSchema(user: string, scope: string, name: string): Promise<void> {
    await this.dynTableStore.drop(this.#table(user, scope, name));
  }

  public async dropManySchemas(user: string, scope: string, names: string[]): Promise<void> {
    await this.dynTableStore.dropMany(names.map(n => this.#table(user, scope, n)));
  }

  public async query<T = Record<string, any>>(user: string, scope: string, query: string): Promise<GQLResult<T>> {
    const tables: GQLTable[] = [];

    const schemas = await this.getSchemas(user, scope);
    for(const schema of schemas)
      tables.push(new HelpfulGQLTable(this.dynTableStore.table(this.#table(user, scope, schema.name)), schema));

    const schema = makeSchema(tables);
    return await execQuery(schema, query, {
      user: await this.getUser(user),
      async load(type: string, id: string) {
        const tbl = tables.find(t => t.name === type);

        if(!tbl)
          return null;

        return await tbl.one(id, this);
      }
    }) as GQLResult<T>;
  }

  // #endregion dyn table
}

export default HelpfulTinyDb;
