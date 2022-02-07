// deno-lint-ignore no-explicit-any
export abstract class SQLiteClient<T = any> {

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
   abstract exec(query: string, ...params: any[]): Promise<void>;

  /**
   * Execute a query and return the first row. Used when you only want one return or are only expecting
   * one return (i.e. on an UPDATE or INSERT statement).
   * @param {string | TemplateStringsArray} query The query
   * @param {...any[]} params Replacement parameters ($1, $2, etc)
   * @returns {Promise<any?>} The first row
   */// deno-lint-ignore no-explicit-any
   abstract one<U = T>(query: string, ...params: any[]): Promise<U | null>;

  /**
   * Execute a query and return all rows selected.
   * @param {string | TemplateStringsArray} query The query
   * @param {...any[]} params Replacement parameters ($1, $2, etc)
   * @returns {Promise<any[]>} All rows selected
   */// deno-lint-ignore no-explicit-any
  abstract all<U = T>(query: string, ...params: any[]): Promise<U[]>;
}

export default SQLiteClient;
