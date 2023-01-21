import { Client, PoolClient } from '../../deps/postgres.ts';
import { toCamel } from '../../db/db-util.ts';

// deno-lint-ignore no-explicit-any
export class PgClient<T = any> {

  protected debug = false;
  protected autoRelease = true;

  constructor(private client: () => PoolClient | Client | Promise<PoolClient | Client>,
    private executor = 'anon',
    options?: Partial<{ debug: boolean; autoRelease: boolean }>) {

    options = Object.assign({
      debug: this.debug,
      autoRelease: this.autoRelease,
    }, options);

    this.debug = Boolean(options.debug);
    this.autoRelease = Boolean(options.autoRelease);
  }


  protected _mapReturnRecurse<U = T>(item: Record<string, unknown>): U {
    const old = item;
    item = { };

    for(const okey in old) {
      let key = okey;

      if(key.includes('_'))
        key = toCamel(key);

      item[key] = old[okey];
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
   * Execute a query, wrapped in nice logic.
   * @param {string | TemplateStringsArray} query The query
   * @param {...any[]} params Replacement parameters ($1, $2, etc)
   */// deno-lint-ignore no-explicit-any
  async #run<U = T>(query: string | TemplateStringsArray, ...params: any[]) {
    const client = await this.client();
    if(!client)
      throw new Error(`${this.executor}: No client!`);

    try {
      return await client.queryObject<U>(query as string , ...params);

    } catch(e) {
      throw e;

    } finally {
      if(this.autoRelease && typeof (client as PoolClient).release === 'function')
        (client as PoolClient).release();
    }
  }

  /**
   * Execute a query, without a return.
   * @param {string | TemplateStringsArray} query The query
   * @param {...any[]} params Replacement parameters ($1, $2, etc)
   */// deno-lint-ignore no-explicit-any
   async exec(query: string | TemplateStringsArray, ...params: any[]): Promise<void> {
    if(this.debug)
      console.debug(`[${this.executor}][exec]:`, query);

    await this.#run(query, ...params);
  }

  /**
   * Execute a query and return the number of rows affected
   * @param {string | TemplateStringsArray} query The query
   * @param {...any[]} params Replacement parameters ($1, $2, etc)
   * @returns {Promise<number?>} The number of rows affected
   */// deno-lint-ignore no-explicit-any
  async count(query: string | TemplateStringsArray, ...params: any[]): Promise<number | undefined> {
    if(this.debug)
      console.debug(`[${this.executor}][count]:`, query);

    return await this.#run(query, ...params).then(res => res.rowCount);
  }

  /**
   * Execute a query and return the first row. Used when you only want one return or are only expecting
   * one return (i.e. on an UPDATE or INSERT statement).
   * @param {string | TemplateStringsArray} query The query
   * @param {...any[]} params Replacement parameters ($1, $2, etc)
   * @returns {Promise<any?>} The first row
   */// deno-lint-ignore no-explicit-any
  async one<U = T>(query: string | TemplateStringsArray, ...params: any[]): Promise<U | null> {
    if(this.debug)
      console.debug(`[${this.executor}][one]:`, query);

    const res = await this.#run<U>(query, ...params);
    return this.mapReturn(res.rows[0]);
  }

  /**
   * Execute a query and return all rows selected.
   * @param {string | TemplateStringsArray} query The query
   * @param {...any[]} params Replacement parameters ($1, $2, etc)
   * @returns {Promise<any[]>} All rows selected
   */// deno-lint-ignore no-explicit-any
  async all<U = T>(query: string | TemplateStringsArray, ...params: any[]): Promise<U[]> {

    if(this.debug)
      console.debug(`[${this.executor}][all]:`, query);

    const res = await this.#run<U>(query, ...params);
    return res.rows.map(r => this.mapReturn<U>(r)!).filter(v => v !== null);
  }
}

export default PgClient;
