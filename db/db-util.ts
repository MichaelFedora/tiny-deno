import { assertEquals } from '../deps/std.ts';
import { isEqual } from '../deps/lodash.ts';

import type { Query, QueryExpression } from '../common/types.ts';
import {  MalformedError } from '../common/errors.ts';


// deno-lint-ignore no-explicit-any
export function compileExpr<T = any>(field: string, expr: QueryExpression<T>, vars: any[]): string {
  if(!/^\$?\w+$/.test(field))
    throw new MalformedError('Field ("' + field + '") is not a valid field! Must be [a-zA-Z0-9_]+ only!');

  if(typeof expr !== 'object' || !expr || expr instanceof Date)
    return `${field} ${expr == null ? 'is' : '='} $${vars.push(expr)}`;

  const keys: (keyof QueryExpression<T>)[] = Object.keys(expr);

  if(!keys.length)
    return '';

  if(keys.length > 1) {
    const { query, params } = compileQuery<T>(expr as unknown as Query<T>);
    vars.push(...params);
    return query;
  }

  const key = keys[0];

  switch(key) {
    // comparison
    case '$eq': return `${field} ${expr[key] == null ? 'is' : '='} $${vars.push(expr[key])}`;
    case '$ne': return `${field} ${expr[key] == null ? 'is not' : '!='} $${vars.push(expr[key])}`;
    case '$gt': return `${field} > $${vars.push(expr[key])}`;
    case '$lt': return `${field} < $${vars.push(expr[key])}`;
    case '$gte': return `${field} >= $${vars.push(expr[key])}`;
    case '$lte': return `${field} <= $${vars.push(expr[key])}`;
    /** @todo fix so it escapes stuff */
    case '$in': return `${field} LIKE $${vars.push(`%${String(expr[key]).replace(/[%_@]/g, '@$1')}%`)} ESCAPE '@'`;
    case '$nin': return `${field} NOT LIKE $${vars.push(`%${String(expr[key]).replace(/[%_@]/g, '@$1')}%`)} ESCAPE '@'`;
    // logical
    case '$not': return `NOT (${compileExpr(key as string, expr[key]!, vars)})`;
    // array
    case '$all': throw new MalformedError('Cannot compile $all to SQL Query');
    case '$none': throw new MalformedError('Cannot compile $none to SQL Query');
    // nominal fields
    default:
      if(typeof key !== 'string')
        throw new MalformedError('Fields must be a string!');
      if(key.startsWith('$'))
        throw new MalformedError('Invalid operation "' + key + '"!');

      if(typeof expr[key] === 'object')
        return compileExpr(key as string, expr[key], vars);
      else
        return `${field} ${expr[key] == null ? 'is' : '='} $${vars.push(expr[key])}`;
  }
}

// deno-lint-ignore no-explicit-any
export function compileQuery<T = any>(query: Query<T>): { query: string; params: any[] } {
  // deno-lint-ignore no-explicit-any
  const vars: any[] = [];
  const statements: string[] = [];

  for(const key in query) if(query[key] !== undefined) {
    switch(key) {
      // logical
// todo fix
      case '$or':
        statements.push(query[key]!.map(q => `(${compileQuery(q)})`).join(' OR '));
        break;

      case '$and':
        statements.push(query[key]!.map(q => `(${compileQuery(q)})`).join(' AND '));
        break;

      case '$nor':
        statements.push(`NOT (${query[key]!.map(q => `(${compileQuery(q)})`).join(' OR ')})`);
        break;

      // nominal fields

      default: {
        const stmt = compileExpr(key as string, query[key], vars);

        if(stmt)
          statements.push(stmt);
        break;
      }
    }
  }

  return { query: statements.map(stmt => `(${stmt})`).join(' AND '), params: vars };
}

/**
 * @todo: add '$[key].[key]...' accessor, i.e. { 'foo.bar.baz': 2 }
 * @todo: add '$key' accessor, i.e. { 'foo': { $eq: '$bar' } }
 */

/**
 * Test a value against a query expression
 * @param query The QueryExpression object
 * @param value The value to execute the Query on
 * @returns {boolean} Whether this value tests true or not
 */// deno-lint-ignore no-explicit-any
export function resolveExpr<T = any>(query: QueryExpression<T>, value: T): boolean {
  const keys: (keyof QueryExpression<T>)[] = Object.keys(query);

  if(!keys.length)
    return true;

  if(keys.length > 1)
    return resolveQuery<T>(query as unknown as Query<T>, value);

  const key = keys[0];

  switch(key) {
    // comparison
    case '$eq': return isEqual(query.$eq!, value);
    case '$ne': return !isEqual(query.$ne!, value);
    case '$gt': return query.$gt! > (value instanceof Array ? value.length : value);
    case '$lt': return query.$lt! < (value instanceof Array ? value.length : value);
    case '$gte': return query.$gte! >= (value instanceof Array ? value.length : value);
    case '$lte': return query.$lte! <= (value instanceof Array ? value.length : value);
    case '$in': return value instanceof Array ? Boolean(value.find(v => query.$in!.includes(v))) : query.$in!.includes(value);
    case '$nin': return value instanceof Array ? Boolean(value.find(v => !query.$nin!.includes(v))) : query.$in!.includes(value);
    // logical
    case '$not': return !resolveExpr(query[key]!, value);
    // array
    case '$all': return value instanceof Array ? !value.find(v => !query.$all!.includes(v)) : false;
    case '$none': return value instanceof Array ? !value.find(v => query.$none!.includes(v)) : false;
    // nominal fields
    default:
      if(typeof query[key] === 'object')
        return resolveExpr(query[key], value[key as keyof T]);
      else
        return query[key] === value[key as keyof T];
  }
}

/**
 * Test a value against a query
 * @param query The query to test the value against
 * @param value The value to execute the query on
 * @returns {boolean} Whether this value tests true or not
 */
// deno-lint-ignore no-explicit-any
export function resolveQuery<T = any>(query: Query<T>, value: T): boolean {
  for(const key in query) if(query[key] !== undefined) {
    switch(key) {
      // logical

      case '$or': {
        let yay = false;

        for(const elem of query[key] as Query<T>[])
          if(resolveQuery(elem, value)) { yay = true; break; }

        if(!yay)
          return false;

        break;
      }

      case '$and':
        for(const elem of query[key] as Query<T>[])
          if(!resolveQuery(elem, value)) return false;

        break;

      case '$nor': {
        let nay = true;

        for(const elem of query[key] as Query<T>[])
          if(resolveQuery(elem, value)) { nay = false; break; }

        if(!nay)
          return false;

        break;
      }

      // nominal fields

      default:
        if(typeof query[key] === 'object') {
          if(!resolveExpr(query[key], value[key as keyof T]))
            return false;
        } else if(!isEqual(query[key], value[key as keyof T]))
          return false;
    }
  }

  return true;
}

Deno.test({
  name: 'Query Tests',
  fn(): void {
    interface TestType {
      key: string;
      name?: string;
      value: number;
      array: boolean[];
      foo: { bar: unknown };
    }

    const test: TestType = {
      key: 'my_key_wow!',
      value: 2,
      array: [true, true],
      foo: { bar: 3 }
    };

    assertEquals(resolveExpr<TestType>({ }, test), true, 'empty expr');
    assertEquals(resolveExpr<TestType['key']>({ $ne: 'my_key_wow!' }, test.key), false, '$ne key');
    assertEquals(resolveExpr<TestType['foo']>({ bar: 3 }, test.foo), true, 'bar: 3');
    assertEquals(resolveExpr<TestType['array']>({ $in: [false] }, test.array), false, 'array $in false');
    assertEquals(resolveExpr<TestType['array']>({ $none: [false] }, test.array), true, 'array $none false');

    assertEquals(resolveQuery<TestType>({ }, test), true, 'empty query');
    assertEquals(resolveQuery<TestType>({ key: { $eq: 'my_key_wow!' }, value: 2 }, test), true, '$eq key, value: 2');
    assertEquals(resolveQuery<TestType>({
      value: 2,
      $or: [
        { array: { $in: [true] } },
        { array: { $all: [false] } }
      ]
    }, test), true, 'complicated');
  }
});

/**
 * Converts a key from camelCase to snake_case
 * @param {string} key The key to convert
 * @returns {string} The converted key
 */
export function toSnake(key: string): string {
  return key.split(/([A-Z])/g).map((v, i) => i % 2 === 1 ? '_' + v.toLocaleLowerCase() : v).join('');
}

/**
 * Converts a key from snake_case to camelCase
 * @param {string} key The key to convert
 * @returns {string} The converted key
 */
export function toCamel(key: string): string {
  return key.split('_').map((v, i) => i < 1 ? v : v[0].toLocaleUpperCase() + v.slice(1)).join('');
}

/**
 * Make a value safe for SQL consumption. Consider filtering out
 * `undefined` values first, because they will return null.
 *
 * If on PostgreSQL, consider running this first:
 * ```javascript
 *   if(value instanceof Date)
  *    return `to_timestamp(${value.getTime() / 1000})`;
 * ```
 * @param {any} value The value to safen
 * @returns {string} The safen'd value
 */
export function safen(value: number): number;
export function safen(value: string | Date | Record<string, unknown> | unknown[]): string;
export function safen(value: undefined | null): null;
export function safen(value: unknown): null | string | number;
export function safen(value: unknown): null | string | number {
  if(value === null) return null;
  if(value === undefined) return null; // ???

  switch(typeof(value)) {
    case 'number':
      return value;
    case 'string':
    case 'object':
    default: { // help
      let str = JSON.stringify(value).replace(/'/g, '\'\'').replace(/\\"/g, '"').replace(/^"|"$/g, '\'');
      if(str[0] !== '\'') str = '\'' + str;
      if(str[str.length - 1] !== '\'') str += '\'';
      return str;
    }
  }
}

// deno-lint-ignore no-explicit-any
export function flattenQueryParams({ query, params }: { query: string, params: any[] }): string {
  let flat = query;
  for(const p of params)
    flat = flat.replace(/\$\d+/, String(safen(p)));

  return flat;
}


/**
 * Map a map of columns to values to a SQL selector or update partial query. Pass
 * `true` as the `put` parameter to use `is` for nulls and `, ` for the delimiter
 * (i.e. for update statements).
 *
 * e.x. `{ key: null, foo: "bar" }` will become `key is null AND foo="bar"` or
 * `key=null, foo="bar"`
 *
 * @param {Record<string, string>} map The map of { column: value }
 * @param {boolean?} put Wether to map to an update statement or not
 * @returns {string} The mapped partial query
 */// deno-lint-ignore no-explicit-any
export function mapToEntries(map: Record<string, any>, put = false): { query: string, params: any[] } {
  const querySegments: string[] = [];
  const params = [];

  for(const key in map) {
    params.push(map[key]);
    querySegments.push(`${key} ${(put || !(map[key] == null || map[key] === 'null')) ? '=' : 'is'} $${params.length}`);
  }

  return { query: querySegments.join(put ? ', ' : ' AND '), params };
}

Deno.test({
  name: 'mapToEntries',
  fn(): void {
    console.log('Testing { key: null, foo: "bar" } PUT')
    assertEquals(flattenQueryParams(mapToEntries({ key: null, foo: 'bar'})), 'key is null AND foo = \'bar\'');

    console.log('Testing { key: "null", foo: 2 } PUT')
    assertEquals(flattenQueryParams(mapToEntries({ key: 'null', foo: 2 as unknown as string }, true)), 'key = \'null\', foo = 2');

    console.log('Testing { } (empty)')
    assertEquals(flattenQueryParams(mapToEntries({ })), '');
  }
});


/**
 * Map a map of columns to values to a SQL insert partial query.
 * e.x. `{ key: "value" }` will become `(key) VALUES ("value")`
 *
 * @param {Record<string, string>} map The map of { column: value }
 * @returns {string} The mapped partial query
 */// deno-lint-ignore no-explicit-any
export function mapToInsert(map: Record<string, any>): { query: string; params: any[] } {
  // use Object.entries ?
  const keys = [] as string[];
  const valueIds = [] as string[];
  const params = [];

  for(const key in map) {
    keys.push(key);
    valueIds.push('$' + keys.length);
    params.push(map[key]);
  }

  return { query: `(${keys.join(', ')}) VALUES (${valueIds.join(', ')})`, params };
}

Deno.test({
  name: 'mapToInsert',
  fn(): void {
    console.log('Testing \'{ key: null, foo: "bar" }\'');
    assertEquals(flattenQueryParams(mapToInsert({ key: null as unknown as string, foo: 'bar'})), '(key, foo) VALUES (null, \'bar\')');

    console.log('Testing { key: undefined, foo: 2 }');
    assertEquals(flattenQueryParams(mapToInsert({ key: undefined, foo: 2 as unknown as string  })), '(key, foo) VALUES (null, 2)');

    console.log('Testing { } (empty)');
    assertEquals(flattenQueryParams(mapToInsert({ })), '() VALUES ()');
  }
});
