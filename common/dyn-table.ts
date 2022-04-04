import type { SearchOptions, BatchOptions } from './types.ts';

export enum ColumnType {
  Boolean = 'Boolean',
  String = 'String',
  Int = 'Int',
  Float = 'Float',
  ID = 'ID',

  Date = 'Date',
  JSON = 'JSON'
}

export interface TableSchema<T = Record<string, unknown>> {
  readonly id?: string;
  name: string;

  columns: {
    [P in keyof T]: {
      type: P extends 'id'
        ? ColumnType.ID
        : T[P] extends boolean ? ColumnType.Boolean
        : T[P] extends string ? ColumnType.String | ColumnType.ID
        : T[P] extends number ? ColumnType.Int | ColumnType.Float
        : T[P] extends Date ? ColumnType.Date
        : ColumnType;

      nullable: P extends 'id' ? false : boolean;
      meta?: P extends 'id' ? 'ID!' : string
    }
  } & { id?: { type: ColumnType.ID; nullable: false; meta: 'ID!' } };

  indexes: { fields: readonly ('id' | keyof T)[], unique?: boolean }[];
  readonly version?: number;
}

// deno-lint-ignore no-explicit-any
export abstract class DynTable<T = any> {

  constructor(public readonly schema: Readonly<TableSchema>) { }

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
