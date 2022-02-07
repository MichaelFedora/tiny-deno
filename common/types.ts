import { RequestStub } from '../api/types.ts';

// Auth Stubs

export interface User {
  id?: string;
  readonly username: string;
}

export interface Session {
  id?: string;
  user: string;
  scopes: readonly string[];
}

// Tiny Api

export interface TinyRequest extends RequestStub {
  // CORE (std)

  readonly headers: Headers;

  // deno-lint-ignore no-explicit-any
  json(): Promise<any>;
  text(): Promise<string>;
  stream(): Promise<ReadableStream<Uint8Array> | null>;

  // BONUS (tiny)

  /** Available everywhere a session is authenticated */
  session?: Session;
  // deno-lint-ignore no-explicit-any
  user?: User | any;
}

// Query / Search Options

/*
 * Inspired by Mongoose typings, which can be found here:
 * https://github.com/Automattic/mongoose/blob/master/index.d.ts
 */

export type QuerySegmentKey =
    '$or'
  | '$and'
  | '$nor'
  | '$not';

export const QuerySegmentKeys: readonly QuerySegmentKey[] = Object.freeze([
  '$or',
  '$and',
  '$nor',
  '$not'
] as const);

export type QueryExpressionKey =
    '$eq'
  | '$ne'
  | '$gt'
  | '$lt'
  | '$gte'
  | '$lte'
  | '$in'
  | '$nin'
  | '$not'
  | '$all'
  | '$none';

export const QueryExpressionKeys: readonly QueryExpressionKey[] = Object.freeze([
  '$eq',
  '$ne',
  '$gt',
  '$lt',
  '$gte',
  '$lte',
  '$in',
  '$nin',
  '$all',
  '$none'
] as const);

export interface QueryExpression<T> {
  // comparison
  readonly $eq?: T | null;
  readonly $ne?: T | null;
  readonly $gt?: T extends Array<unknown> ? number : T;
  readonly $lt?: T extends Array<unknown> ? number : T;
  readonly $gte?: T extends Array<unknown> ? number : T;
  readonly $lte?: T extends Array<unknown> ? number : T;
  readonly $in?: T extends Array<infer U> ? U[] : T[];
  readonly $nin?: T extends Array<infer U> ? U[] : T[];
  // logical
  readonly $not?: QueryExpression<T>;
  // array
  readonly $all?: T extends Array<infer U> ? U[] : never;
  readonly $none?: T extends Array<infer U> ? U[] : never;
  // nominal field
  // deno-lint-ignore no-explicit-any
  readonly [key: string]: any;
}

interface QuerySegment<T> {
  // logical
  readonly $or?:  Query<T>[];
  readonly $and?: Query<T>[];
  readonly $nor?: Query<T>[];
  // nominal field
  // deno-lint-ignore no-explicit-any
  readonly [key: string]: any;
}

export type Query<T> = {
  readonly [K in keyof T]?: T[K] | QueryExpression<T[K]>
} & QuerySegment<T>;


export interface SearchOptions<T> {
  readonly skip?: number;
  readonly limit?: number;
  readonly query?: Query<T>;
  readonly sort?: string;

  // for key-value only
  readonly prefix?: string;

  // for dyn-table only
  readonly projection?: string[];
}

// Batch

interface BatchPut<T = unknown> {
  readonly type: 'put';
  key: string;
  readonly value: T;
}

interface BatchDel {
  readonly type: 'del';
  key: string;
}

export type BatchOptions<T = unknown> = (BatchPut<T> | BatchDel)[];
