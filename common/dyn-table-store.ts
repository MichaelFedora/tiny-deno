import { type DynTable, TableSchema, ColumnType } from './dyn-table.ts';
export { type TableSchema, ColumnType };

export abstract class DynTableStore {

  public abstract readonly separator: string;

  public abstract init(): Promise<void>;

  public abstract create<T = Record<string, unknown>>(schema: TableSchema<T>): Promise<DynTable<T>>;
  public abstract define<T = Record<string, unknown>>(table: string): Promise<TableSchema<T> | null>;
  public abstract list(prefix?: string): Promise<TableSchema[]>;

  /**
   * Re-defines a table, or defines a new one if the old one doesn't exist
   * @param table The table name
   * @param schema The schema
   */
  public abstract redefine<T = Record<string, unknown>>(table: string, schema: Omit<TableSchema<T>, 'name'>): Promise<DynTable<T>>;
  public abstract drop(table: string): Promise<void>;

  public abstract dropMany(tables: string[]): Promise<void>;
  public abstract dropPrefixed(prefix: string): Promise<void>;

  // deno-lint-ignore no-explicit-any
  public abstract table<T = any>(table: string): Promise<DynTable<T> | null>;
}

export default DynTableStore;
