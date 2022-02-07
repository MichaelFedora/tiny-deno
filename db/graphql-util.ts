import {
  gql, makeExecutableSchema,

  graphql,
  GraphQLError,
  GraphQLScalarType, GraphQLNonNull, GraphQLList,
  isWrappingType
} from '../deps/graphql.ts';

import type {
  ValueNode, ObjectValueNode, GraphQLSchema, GraphQLObjectType,
  ObjectTypeDefinitionNode
} from '../deps/graphql.ts';

import { GQLContext } from './graphql-types.ts';
import GQLTable from './graphql-table.ts';

/**
 * Prettifies a GQL string
 * @param {string} gql The GQL string
 * @returns {string} The formatted GQL string
 */
 export function formatGQL(gql: string): string;
 // deno-lint-ignore no-explicit-any
 export function formatGQL(gql: TemplateStringsArray, ...data: any[]): string;
 // deno-lint-ignore no-explicit-any
 export function formatGQL(gql: string | TemplateStringsArray, ...data: any[]): string {
   if(typeof gql === 'string') // multi-line trim, reduce multi-spaces, and then indent fields
     return gql.replace(/^\s+|\s+$/gm, '').replace(/}(.)/g, '}\n\n$1').replace(/ +/g, ' ').replace(/\n(?!}|type |enum |interface )/gm, '\n  ');
   else // reduce to string then format
     return formatGQL((gql as TemplateStringsArray).reduce((acc, c, i) => acc + data[i - 1] + c));
 }

export function stringifyGQLObject(obj: GraphQLObjectType): string {
  return `type ${obj.name} {
  ${Object.entries(obj.getFields()).map(([name, field]) => {
    let def = '$1';
    let type = field.type;

    while(isWrappingType(type)) {
      if(type instanceof GraphQLNonNull)
        def += '!';
      else if(type instanceof GraphQLList)
        def = `[${def}]`;
      else
        throw new Error('IDK what type this is');

      type = type.ofType as typeof type;
    }

    def = def.replace('$1', type.name);

    return `${name}: ${def}`;
  }).join('\n  ')}
}`;
}

function parseObject(ast: ObjectValueNode, variables?: Record<string, unknown> | null) {
  const value = { } as Record<string, unknown>;

  for(const field of ast.fields)
    value[field.name.value] = parseLiteralJSON(field.value, variables);

  return value;
}

function parseLiteralJSON(ast: ValueNode, variables?: Record<string, unknown> | null): unknown {
  switch(ast.kind) {
    case 'StringValue':
    case 'BooleanValue':
      return ast.value;
    case 'IntValue':
    case 'FloatValue':
      return parseFloat(ast.value);
    case 'ObjectValue':
      return parseObject(ast, variables);
    case 'ListValue':
      return ast.values.map(n => parseLiteralJSON(n, variables));
    case 'NullValue':
      return null;
    case 'Variable':
      return variables ? variables[ast.name.value] : undefined; // shrug
  }
}

const baseScalars = Object.freeze([
  'Boolean', 'String', 'Int', 'Float', 'ID'
] as const);

const baseSchemas: readonly { name: string; schema: string; resolver?: GraphQLScalarType }[] = Object.freeze([
  {
    name: 'Date',
    schema: /* GraphQL */ `scalar Date`,
    resolver: new GraphQLScalarType({
      name: 'Date',
      serialize: (v: unknown) => {
        if(typeof v === 'number' || typeof v === 'string')
          v = new Date(v);

        return (v && v instanceof Date) ? v.toISOString() : null;
      },
      parseValue: (v: unknown) => (typeof v === 'string' || typeof v === 'number') ? new Date(v) : null,
      parseLiteral(ast) {
        if(ast.kind !== 'StringValue' && ast.kind !== 'IntValue' && ast.kind !== 'FloatValue')
          throw new GraphQLError('Dates must be a string or a number!');

        const date = new Date(ast.kind === 'StringValue' ? ast.value : parseFloat(ast.value));

        if(date.toString() === 'Invalid Date')
          throw new GraphQLError('Invalid date!');

        return date;
      }
    })
  },
  {
    name: 'JSON',
    schema: /* GraphQL */ `scalar JSON`,
    resolver: new GraphQLScalarType({
      name: 'JSON',
      serialize(v) { return v; },
      parseValue(v) { return v; },
      parseLiteral(v, variables) { return parseLiteralJSON(v, variables); }
    })
  },
  {
    name: 'Void',
    schema: /* GraphQL */ `scalar Void`,
    resolver: new GraphQLScalarType({
      name: 'Void',
      serialize() { return null; },
      parseValue() { return null; },
      parseLiteral() { return null; }
    })
  },
  { name: 'Operation', schema: /* GraphQL */ `
enum Operation {
  add
  put
  del
}
`.trim() },
  { name: 'SearchOptions', schema:
  /* GraphQL */ `
input SearchOptions {
  start: String
  end: String
  skip: Int
  limit: Int
  query: JSON
  projection: [String]
  sort: String
}
`.trim() }
]);

export const reservedTypeNames = Object.freeze([
  ...baseScalars,
  ...baseSchemas.map(s => s.name)
] as const);

export function makeTypeSchemas(tables: GQLTable[]): string {
  return `${baseSchemas.map(b => b.schema).join('\n')}

${tables.map(t => t.fullSchema).join('\n\n')}
`;
}

function makeGlobalSchema(tables: GQLTable[]): string {
  return `${makeTypeSchemas(tables)}

type Query {
  ${tables.map(t => t.queries)}
}

type Mutation {
  ${tables.map(t => t.mutations)}
}

type Subscription {
  ${tables.map(t => t.subscriptions).join('\n \n ')}
}
`;
}

export function defineTableHelper(type: string, stubs = '') {
  const typeDefs = gql(
    baseSchemas.map(b => b.schema).join('\n') + '\n'
    + stubs + '\n'
    + type);

  const objDefs = typeDefs.definitions
    .slice(baseSchemas.length)
    .filter(t => t.kind === 'ObjectTypeDefinition' && t.fields?.length) as ObjectTypeDefinitionNode[];

  const defs = [];

  const schema: GraphQLSchema = makeExecutableSchema({ typeDefs });

  for(const objDef of objDefs) {
    const name = objDef.name.value;

    const objType = schema.getType(name)! as GraphQLObjectType;

    defs.push(GQLTable.parseGqlObj(objType));
  }

  return defs;
}

export function makeSchema(tables: GQLTable[]): GraphQLSchema {
  const globalSchema = makeGlobalSchema(tables);

  const typeDefs = gql(globalSchema);

  const resolvers = {
    ...baseSchemas.filter(b => b.resolver).map((b) => ({ [b.name]: b.resolver })).reduce((acc, c) => ({ ...acc, ...c })),
    ...tables.map(t => ({ [t.name]: t.resolvers })).reduce((acc, c) => ({ ...acc, ...c })),
    Query: {
      ...tables
        .map(t => t.queryResolvers)
        .reduce((acc, c) => ({ ...acc, ...c }))
    },
    Mutation: { ...tables.map(t => t.mutationResolvers).reduce((acc, c) => ({ ...acc, ...c })) }
  };

  const schema: GraphQLSchema = makeExecutableSchema({ typeDefs, resolvers });

  return schema;
}

// deno-lint-ignore no-explicit-any
export async function query(schema: GraphQLSchema, query: string, context: GQLContext, root?: any) {
  return await graphql({ schema, source: query, rootValue: root, contextValue: context });
}
