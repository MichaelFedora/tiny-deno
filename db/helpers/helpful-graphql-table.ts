

import DynTable from '../../common/dyn-table.ts';

import type { SearchOptions, BatchOptions } from '../../common/types.ts';

import type { GQLSchema } from '../db-types.ts';
import type { GQLContext } from '../graphql-types.ts';

import GQLTable from '../graphql-table.ts';

// deno-lint-ignore no-explicit-any
export class HelpfulGQLTable<T = any> extends GQLTable {

  constructor(protected readonly dynTable: DynTable, schema: GQLSchema) {
    super(schema.name, schema.fields);
  }

  async all(_ctx: GQLContext): Promise<T[]> {
    return await this.dynTable.all();
  }

  async search(search: SearchOptions<T>, _ctx: GQLContext): Promise<T[]> {
    return await this.dynTable.search(search);
  }

  async one(id: string, _ctx: GQLContext): Promise<T> {
    return await this.dynTable.one(id);
  }

  async batch(input: BatchOptions<T>, _ctx: GQLContext): Promise<BatchOptions<T>> {
    return await this.dynTable.batch(input);
  }

  async add(input: Partial<T>, _ctx: GQLContext): Promise<T> {
    return await this.dynTable.add(input)
  }

  async put(id: string, input: Partial<T>, _ctx: GQLContext): Promise<Partial<T>> {
    return await this.dynTable.put(id, input);
  }

  async del(id: string, _ctx: GQLContext): Promise<void> {
    return await this.dynTable.del(id);
  }
}

export default HelpfulGQLTable;
