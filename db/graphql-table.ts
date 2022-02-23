import type { GraphQLObjectType } from '../deps/graphql.ts';
import { GraphQLError, GraphQLNonNull, GraphQLList, isWrappingType } from '../deps/graphql.ts';

import { cloneDeep } from '../deps/lodash.ts';

import type { SearchOptions, BatchOptions } from '../common/types.ts';

import { reservedTypeNames } from './graphql-util.ts';
import type { ParsedGQLField, GQLResolver, GQLSchemaField, GQLContext } from './graphql-types.ts';

// deno-lint-ignore no-explicit-any
export abstract class GQLTable<T extends { id: string } & Record<string, unknown> = any> {
  readonly name: string;
  get lname(): string { return this.name[0].toLocaleLowerCase() + this.name.slice(1); }

  readonly fields: readonly GQLSchemaField[];

  constructor(name: string, fields: GQLTable['fields']) {
    this.name = name;
    this.fields = Object.freeze(cloneDeep(fields));
  }

  static parseGqlObj(obj: GraphQLObjectType): { name: string; fields: ParsedGQLField[] } {
    const fields: ParsedGQLField[] = [];

    for(const [name, field] of Object.entries(obj.getFields())) {
      let def = '$1';
      let type = field.type;

      while(isWrappingType(type)) {
        if(type instanceof GraphQLNonNull)
          def += '!';
        else if(type instanceof GraphQLList)
          def = `[${def}]`;
        else
          throw new GraphQLError('IDK what type "' + type + '" is');

        type = type.ofType as typeof type;
      }

      def = def.replace('$1', type.name);

      fields.push({ key: name, type: def, rawType: type.name, nullable: !def.endsWith('!') });
    }

    return { name: obj.name, fields };
  }


  get schema(): string {
    return /* GraphQL */ `
type ${this.name} {
  ${this.fields.map(f =>
    reservedTypeNames.includes(f.type.replace(/[![\]]/g, ''))
      ? `${f.key}: ${f.type}`
      : `${f.key}: ${f.type}\n  ${f.key}ID: ID`).join('\n  ')}
}`.trim()
  }

  get inputSchema(): string {
    return `
input ${this.name}Input {
  ${this.fields.filter(f => f.key !== 'id').map(f =>
    `${f.key}: ${reservedTypeNames.includes(f.type.replace(/[![\]]/g, '')) ? f.type : 'ID'}`).join('\n  ')}
}`.trim()
  }

  get batchInputSchema(): string {
    return /* GraphQL */ `
input ${this.name}BatchInput {
  type: Operation!
  id: ID!
  value: ${this.name}Input
}`.trim();
  }

  get batchReturnSchema(): string {
    return /* GraphQL */ `
type ${this.name}BatchReturn {
  type: Operation!
  id: ID!
  value: ${this.name}
}`.trim();
  }

  get fullSchema(): string {
    return [
      this.schema,
      this.inputSchema,
      this.batchInputSchema,
      this.batchReturnSchema
    ].join('\n');
  }

  get resolvers(): Record<string, GQLResolver<T, unknown, GQLContext>> {
    const resolvers = { } as { [key: string]: (source: T, args: unknown, ctx: GQLContext) => unknown };

    for(const field of this.fields) {
      if(!reservedTypeNames.includes(field.type.replace(/[![\]]/g, ''))) {
        resolvers[field.key] = (src, _, ctx) => ctx.load(field.type, src[field.key] as string);
        resolvers[field.key + 'ID'] = src => src[field.key];
      }
    }

    return resolvers;
  }

  abstract all(filter: Partial<T> | undefined, ctx: GQLContext): Promise<T[]>;
  abstract search(search: SearchOptions<T>, ctx: GQLContext): Promise<T[]>;
  abstract one(id: string, ctx: GQLContext): Promise<T>;

  get queries(): string {
    return `${this.lname}s(search: SearchOptions): [${this.name}]!` +
    `  ${this.lname}(id: ID!): ${this.name}`
  }

  get queryResolvers(): Record<string, GQLResolver<unknown, unknown, GQLContext>> {
    return {
      [this.lname + 's']: (_, { filter, search }: { filter?: Partial<T>; search?: SearchOptions<T> }, ctx) =>
        search ? this.search(search, ctx) : this.all(filter, ctx),
      [this.lname]: (_, { id }: { id: string }, ctx) => this.one(id, ctx)
    } as Record<string, GQLResolver<unknown, unknown, GQLContext>>;
  }

  abstract batch(input: BatchOptions<T>, ctx: GQLContext): Promise<BatchOptions<T>>;
  abstract add(input: Partial<T>, ctx: GQLContext): Promise<T>;
  abstract put(id: string, input: Partial<T>, ctx: GQLContext): Partial<T>;
  abstract del(id: string, ctx: GQLContext): Promise<void>;

  get mutations(): string {
    return `batch${this.name}(input: [${this.name}BatchInput]!): [${this.name}BatchReturn]!`
    + `  add${this.name}(input: ${this.name}Input!): ${this.name}!`
    + `  put${this.name}(id: ID!, input: ${this.name}Input!): ${this.name}!`
    + `  del${this.name}(id: ID!): Void`;
  }

  get mutationResolvers(): Record<string, GQLResolver<unknown, unknown, GQLContext>> {
    return {
      ['batch' + this.name]: (_, { input }: { input: BatchOptions<T> }, ctx) => this.batch(input, ctx),
      ['add' + this.name]: (_, { input }: { input: T }, ctx) => this.add(input, ctx),
      ['put' + this.name]: (_, { id, input }: { id: string, input: T }, ctx) => this.put(id, input, ctx),
      ['del' + this.name]: (_, { id }: { id: string }, ctx) => this.del(id, ctx)
    } as Record<string, GQLResolver<unknown, unknown, GQLContext>>
  }

  get subscriptions(): string {
    return `${this.lname}(id: ID, op: Operation): ${this.name}`;
  }
}

export default GQLTable;
