import type DynTable from './dyn-table.ts';

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
  name?: string;

  columns: Record<'id' | keyof T, { type: ColumnType; nullable: boolean; meta?: string }>;
  indexes: { fields: readonly ('id' | keyof T)[], unique?: boolean }[];
  readonly version?: number;
}

export abstract class DynTableStore {

  public abstract readonly separator: string;

  public abstract init(): Promise<void>;

  public abstract create<T = Record<string, unknown>>(table: string, schema: TableSchema<T>): Promise<void>;
  public abstract define<T = Record<string, unknown>>(table: string): Promise<TableSchema<T> | null>;
  public abstract list(prefix?: string): Promise<TableSchema[]>;

  /**
   * Re-defines a table, or defines a new one if the old one doesn't exist
   * @param table The table name
   * @param schema The schema
   */
  public abstract redefine<T = Record<string, unknown>>(table: string, schema: TableSchema<T>): Promise<void>;
  public abstract drop(table: string): Promise<void>;

  public abstract dropMany(tables: string[]): Promise<void>;
  public abstract dropPrefixed(prefix: string): Promise<void>;

  // deno-lint-ignore no-explicit-any
  public abstract table<T = any>(table: string): DynTable<T>;
}

export default DynTableStore;
