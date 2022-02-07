import { SearchOptions, BatchOptions } from './types.ts';

// deno-lint-ignore no-explicit-any
export abstract class KeyValueStore<T = any> {
  public abstract readonly separator: string;

  public abstract init(): Promise<void>;

  /** Get a value with a key */
  public abstract get<U = T>(key: string): Promise<U | null>;
  /** Insert or update a key with a value */
  public abstract put<U = T>(key: string, value: U): Promise<void>;
  /** Delete a key */
  public abstract del(key: string): Promise<void>;
  /** Delete everything with a key with the given prefix
   *  When implementing, ensure separator tails the string.
   */
  public abstract delPrefixed(prefix: string): Promise<void>;
  /** Search for items */
  public abstract search<U = T>(options: SearchOptions<U>): Promise<U[]>;
  /** Batch-op items */
  public abstract batch<U = T>(options: BatchOptions<U>): Promise<BatchOptions<U>>;
}

export default KeyValueStore;
