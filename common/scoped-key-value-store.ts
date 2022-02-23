import { SearchOptions, BatchOptions } from './types.ts';
import KeyValueStore from './key-value-store.ts';

// deno-lint-ignore no-explicit-any
export class ScopedKeyValueStore<T = any> extends KeyValueStore<T> {
  public readonly separator: string;

  constructor(public readonly store: KeyValueStore<T>, public readonly prefix: string) {
    super();
    this.separator = store.separator;
  }

  public async init(): Promise<void> { await this.store.init(); }

  /** Get a value with a key */
  public async get<U = T>(key: string): Promise<U | null> {
    return await this.store.get<U>(this.prefix + this.separator + key);
  }

  /** Insert or update a key with a value */
  public async put<U = T>(key: string, value: U): Promise<void> {
    return await this.store.put<U>(this.prefix + this.separator + key, value);
  }

  /** Delete a key */
  public async del(key: string): Promise<void> {
    return await this.store.del(this.prefix + this.separator + key);
  }

  /** Delete everything with a key with the given prefix
   *  When implementing, ensure separator tails the string.
   */
  public async delPrefixed(prefix: string): Promise<void> {
    return await this.store.delPrefixed(this.prefix +  this.separator + prefix);
  }

  /** Search for items */
  public async search<U = T>(options: SearchOptions<U>): Promise<U[]> {
    return await this.store.search<U>({ ...options, prefix: this.prefix + (options.prefix ? this.separator + options.prefix : '') });
  }

  /** Batch-op items */
  public async batch<U = T>(options: BatchOptions<U>): Promise<BatchOptions<U>> {
    return await this.store.batch(options.map(o => ({ ...o, key: this.prefix + this.separator + o.key })));
  }
}

export default ScopedKeyValueStore;
