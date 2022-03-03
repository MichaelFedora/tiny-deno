import { RequestStub } from '../api/types.ts';

// Auth Stubs

/**
 * A user.
 */
export interface User {
  /**
   * The user's ID
   */
  id?: string;

  /**
   * The user's human-friendly identifier.
   *
   * Must be unique within the database.
   */
  readonly username: string;
}

/**
 * @summary An authenticated session.
 *
 * @description
 * An authenticated session, as given by apps or users, delineated by `context`.
 *
 * If `context` is **NOT** `'secure'`, then `identifier` is a username. Otherwise, it is
 * a secure hash.
 *
 * For the following definitions:
 * - {app} is the context when it is not `'secure'` or `'user'`
 * - {userId} is associated user's ID
 * - {hash} is the identifier when the context is `'secure'`
 *
 * A session should provide access to context-defined folders:
 * - if app: `/{userId}/appdata/{app}` and `/{userId}/public/appdata/{app}`
 * - if user: `/{userId}`
 * - if secure: `/{userId}/secure/{hash}` and `/{userId}/public/secure/{hash}`
 *
 * It should also provide access to the requested collection folders, where `{collection} is an entry in the `collections` array:
 * - Read access to `/{userId}/collections/{collection}`
 * - if app, write access to only the `/{app}` child folder
 * - if user, write access to the folder
 * - if secure, write access to only the `/secure/{hash}` child folder
 *
 *
 * It should provide access to a key-value database with the following prefix (replace `!` with the
 * database-defined separator):
 * - if app: `{userId}!{app}`
 * - if user: `{userId}`
 * - if secure: `{userId}!secure!{hash}`
 *
 * It should provide access to the dynamic table database for the following identifier (replace `!` with
 * the database-defined separator)
 * - if app: `{userId}!{app}`
 * - if user: `{userId}`
 * - if secure: `{userId}!secure!{hash}`
 *
 * It should provide an inbox with the standard route of `/:context/:identifier/inbox`
 *
 * It should provide an outbox with the standard route of `/:context/:identifier/outbox`
 *
 * *If secure*, it should provide a custom-api route with the parent route `/secure/:hash/api`
 */
export interface Session {
  /**
   * The session ID
   */
  id?: string;

  /**
   * The user ID that this session is associated with.
   */
  user: string;

  /**
   * The authentication context this session has.
   *
   * Can be: 'user', 'secure', or an app domain.
   */
  context: 'user' | 'secure' | string;

  /**
   * A Username (if context is `'user'` or an app domain)
   * or a Secure Hash (if context is `'secure'`).
   */
  identifier: string;

  /**
   * A list of paths to shared collections.
   *
   * They resolve to `/collections/{path}`.
   */
  collections: readonly string[];

  /**
   * A list of other permissions the session is allowed to use. For instance,
   * a session might request a permission needed to use advance features on an extension,
   * like `friends:send` or just `inbox` to be able to use the extension itself.
   */
  permissions: readonly string[];
}

// Tiny Api

export interface TinyRequest extends RequestStub {
  // CORE (std)

  readonly headers: Headers;

  // deno-lint-ignore no-explicit-any
  json(): Promise<any>;
  text(): Promise<string>;
  readonly stream: ReadableStream<Uint8Array> | null;

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
