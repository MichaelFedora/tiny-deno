import { User } from '../common/types.ts';

export interface GQLSchemaField {
  key: string;
  type: string;
}

export interface ParsedGQLField extends GQLSchemaField {
  rawType: string;
  nullable: boolean;
}

export type GQLResolver<Src = unknown, Args = unknown, Ctx = unknown> = (source: Src, args: Args, ctx: Ctx) => Promise<unknown> | unknown

// parent loader?

export type Loader<T = unknown, Ctx = unknown> = (key: string, ctx: Ctx) => Promise<T>;

export interface GQLContext {
  user: User | null;
  // session: string | undefined;
  // deno-lint-ignore no-explicit-any
  load<T = any>(type: string, id: string): Promise<T | null>;
}
