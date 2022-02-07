export interface GQLSchema {
  id: string;
  user: string;
  scope: string;

  name: string;
  fields: { key: string; type: string }[];
}

// deno-lint-ignore no-explicit-any
export interface GQLResult<T extends Record<string, any> = Record<string, any>> {
  errors?: readonly Error[];
  data?: Partial<T> | null;
}
