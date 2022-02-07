
import KeyValueStore from '../../common/key-value-store.ts';
import type { SearchOptions, BatchOptions } from '../../common/types.ts';
import { resolveQuery } from '../../db/db-util.ts';

/**
 * Key-Value store based off of the web Storage interface.
 */
export class StorageKeyValueStore extends KeyValueStore {

  public readonly store: Storage;
  public readonly separator = '_';
  public readonly prefix: string;

  async #get<T = unknown>(key: string): Promise<T | null> {
    return await Promise.resolve(this.#decode<T>(this.store.getItem(key)));
  }

  async #put(key: string, value: unknown): Promise<void> {
    await Promise.resolve(this.store.setItem(key, this.#encode(value)))
  }

  async #del(key: string): Promise<void> {
    await Promise.resolve(this.store.removeItem(key));
  }

  #encode(value: unknown): string {
    return JSON.stringify(value);
  }

  #decode<T = unknown>(value: string | null): T | null {
    if(value === null)
      return null;

    return JSON.parse(value);
  }

  #key(k: string): string { return `${this.prefix}${k}`; }
  #keys(prefix?: string): string[] {

    const startWith = prefix ? `${this.prefix}${this.separator}${prefix}` : this.prefix;

    const keys = new Set<string>();
    for(let i = 0; i < this.store.length; i++)
      if(startWith && this.store.key(i)?.startsWith(startWith))
        keys.add(this.store.key(i)!);

    return Array.from(keys);
  }

  public async init(): Promise<void> { }

  constructor(storage: Storage, prefix?: string) {
    super();

    this.store = storage;

    if(prefix)
      this.prefix = prefix + this.separator;
    else
      this.prefix = '';
  }

  /** Get a value with a key */
  public async get<T = unknown>(key: string): Promise<T | null> {
    return await this.#get<T>(this.prefix + key);
  }

  /** Insert or update a key with a value */
  public async put<T = unknown>(key: string, value: T): Promise<void> {
    await this.#put(this.prefix + key, value);
  }

  /** Delete a key */
  public async del(key: string): Promise<void> {
    await this.#del(this.prefix + key);
  }

  /** Delete everything with a key with the given prefix
   *  When implementing, ensure separator tails the string.
   */
  public async delPrefixed(prefix: string): Promise<void> {
    await Promise.all(this.#keys(prefix).map(k => this.#del(k)));
  }

  /** Search for items */
  public async search<T = unknown>(options: SearchOptions<T>): Promise<T[]> {
    const results: T[] = [];
    let count = 0;
    const skip = options.skip || 0;
    const limit = options.limit || 0;

    const prefix = options.prefix != undefined
      ? `${this.prefix}${options.prefix}`
      : this.prefix;

    for(const key of this.#keys()) {
      const val = await this.#get<T>(prefix + key);

      if(val == null)
        continue;

      if(options.query && !resolveQuery(options.query, val))
        continue;

      count++;

      if(count <= skip)
        continue;

      results.push(val);

      if(limit && (count - skip) >= limit)
        break;
    }

    return results;
  }

  /** Batch-op items */
  public async batch<T = unknown>(options: BatchOptions<T>): Promise<BatchOptions<T>> {
    const results: BatchOptions<T> = [];

    for(const b of options) {
      if(b.type === 'del')
        await this.del(b.key).then(() => results.push(b));
      else if(b.type === 'put')
        await this.put(b.key, b.value)
          .then(() => this.get<T>(b.key))
          .then(value => results.push({ ...b, value: value! }));
      else
        results.push(null as unknown as BatchOptions<T>[0]);
    }

    return results;
  }
}

export default StorageKeyValueStore;
