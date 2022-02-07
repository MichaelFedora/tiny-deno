import type { RequestStub } from './types.ts';

/**
 * A GraphQL Request -- needs to be able to parse JSON and optionally have headers (for parsing ACCEPT).
 */
export interface GQLRequest extends RequestStub {
  readonly headers?: Headers;

  // deno-lint-ignore no-explicit-any
  json(): Promise<any>;
}

/**
 * Digest a GraphQL Request.
 *
 * @param req the request
 * @param graphiql (optional) whether to parse graphiql requests or not
 *
 * @returns a Response if something went bad.
 * @returns `'graphiql'` if the `graphiql` parameter was true and it should render.
 * @returns `{ query: string, contentType: string }` or `{ mutation: string, contentType: string }`
 * if the query/mutation could be parsed.
 */
export async function digestGraphQL<Req extends GQLRequest>(req: Req, graphiql?: boolean): Promise<Response | 'graphiql' | {
  query?: string;
  mutation?: string;

  contentType: string;
}> {
  const accept = req.headers?.get('Accept') || ''

  const typeList = [
    'text/html',
    'text/plain',
    'application/json',
    '*/*'
  ].map(contentType => ({ contentType, index: accept.indexOf(contentType) }))
    .filter(({ index }) => index >= 0)
    .sort((a, b) => a.index - b.index)
    .map(({ contentType }) => contentType);


  if(accept && !typeList.length)
    return new Response('Not Acceptable', { status: 406 });

  if(!['GET', 'PUT', 'POST', 'PATCH'].includes(req.method))
    return new Response('Method Not Allowed', { status: 405 });


  let params: Promise<{ query?: string; mutation?: string }>;


  if(req.method === 'GET') {
    const urlQuery = req.url.substring(req.url.indexOf('?'));
    const queryParams = new URLSearchParams(urlQuery);

    if(graphiql && typeList.length && typeList[0] === 'text/html' && !queryParams.has('raw'))
      return 'graphiql';

    if(typeList.length === 1 && typeList[0] === 'text/html')
      return new Response('Not Acceptable', { status: 406 });

    if(!queryParams.has('query'))
      return new Response('Malformed Request Query', { status: 400 });

    params = Promise.resolve({ query: queryParams.get('query') || undefined })

  } else if (typeList.length === 1 && typeList[0] === 'text/html')
    return new Response('Not Acceptable', { status: 406 })
  else
    params = req.json()

  try {
    let contentType = 'text/plain'

    if(!typeList.length || typeList.includes('application/json') || typeList.includes('*/*'))
      contentType = 'application/json'

    const ret = { ...await params, contentType };

    if(!ret.query && !ret.mutation)
      return new Response('Malformed Request ' + (req.method === 'GET' ? 'Query' : 'Body'), { status: 400 });

    return ret;

  } catch (e) {
    console.error(e);

    return new Response('Malformed Request ' + (req.method === 'GET' ? 'Query' : 'Body'), {
      status: 400
    });
  }
}
