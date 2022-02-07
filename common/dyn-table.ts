import type { SearchOptions, BatchOptions } from './types.ts';

// deno-lint-ignore no-explicit-any
export abstract class DynTable<T = any> {

  constructor(public readonly table: string) { }

  public abstract all(filter?: Partial<T>): Promise<T[]>;
  public abstract search(search: SearchOptions<T>): Promise<T[]>;
  public abstract one(id: string): Promise<T | null>;

  public abstract batch(input: BatchOptions<T>): Promise<BatchOptions<T>>;
  public abstract add(input: Partial<T>): Promise<T>;
  public abstract put(id: string, input: Partial<T>): Promise<T>;
  public abstract del(id: string): Promise<void>;

  // utility
  public abstract delMany(ids: readonly string[]): Promise<void>;
}

export default DynTable;
