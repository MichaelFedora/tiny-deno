// deno-lint-ignore-file no-explicit-any
import type { SearchOptions, BatchOptions } from '../common/types.ts';
import type { GQLSchema, GQLResult } from './db-types.ts';

export abstract class TinyDb {

  constructor(protected readonly prefix = '') { }

  // global

  public abstract delAllUserData(user: string, scope?: string): Promise<void>;

  // key value

  public abstract get<T = any>(user: string, scope: string, key: string): Promise<T | null>;
  public abstract add<T = any>(user: string, scope: string, value: T): Promise<string>;
  public abstract put<T = any>(user: string, scope: string, key: string, value: T): Promise<void>;
  public abstract del(user: string, scope: string, key: string): Promise<void>;

  public abstract search<T = any>(user: string, scope: string, options: SearchOptions<T>): Promise<T[]>;
  public abstract batch<T = any>(user: string, scope: string, options: BatchOptions<T>): Promise<BatchOptions<T>>;

  // dyn table

  public abstract getSchema(user: string, scope: string, name: string): Promise<GQLSchema | null>;
  public abstract getSchemas(user: string, scope?: string): Promise<GQLSchema[]>;
  public abstract registerSchemas(user: string, scope: string, schema: string, stubs?: string): Promise<GQLSchema[]>;
  public abstract replaceSchema(user: string, scope: string, name: string, schema: string, stubs?: string): Promise<GQLSchema>;
  public abstract dropSchema(user: string, scope: string, name: string): Promise<void>;
  public abstract dropManySchemas(user: string, scope: string, names: string[]): Promise<void>;
  public abstract query(user: string, scope: string, query: string): Promise<GQLResult>;
}

export default TinyDb;
