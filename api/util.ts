// # Functions

/**
 * Parse a query from a URL via URLSearchParams.
 * @param url The URL to parse the query from
 * @returns An object with the queries from the URL
 */
export function parseQuery(url: string): Record<string, string> {
  return (url.includes('?')
    ? Object.fromEntries((new URLSearchParams(url.slice(url.indexOf('?')))).entries())
    : undefined) ?? { };
}

/**
 * Parse URL parameters from a url for the given route via URLPattern
 * Do not use this as a matching function, for this matches routes that have other information via
 * the reserved parameter `tiny_else`, in addition to which you should not use.
 *
 * @param route The route to use as the template
 * @param url The URL to parse the query from
 * @returns An object with the parameters from the URL
 */
export function parseParams(route: string, url: string): Record<string, string> {
  const params = (new URLPattern({ pathname: route + '/:tiny_else(.*)?' })).exec(url)?.pathname?.groups ?? { };
  delete params.tiny_else;

  return params;
}

// # Responses

/**
 * Create a text response.
 * @param {string} body The body of the response
 * @param {ResponseInit} init Response options
 * @returns {Response} The response
 */
export function text(body = '', init: ResponseInit = { }): Response {
  if(typeof body !== 'string')
    body = String(body);

  init = Object.assign({
    ...init,
    headers: {
      'Content-Type': 'text/plain',
      'Content-Length': body.length,
      ...init.headers
    },
    status: init.status ?? 200
  });

  return new Response(body, init);
}

/**
 * Create a JSON response.
 * @param {any} body The body of the response
 * @param {ResponseInit} init Response options
 * @returns {Response} The response
 */
export function json(body: unknown, init: ResponseInit = { }): Response {

  const bod = JSON.stringify(body, null, 2);

  init = Object.assign({
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': bod.length,
      ...init.headers
    },
    status: init.status ?? 200
  });

  return new Response(bod, init);
}

/**
 * Create a 204 "No Content" response with no body.
 * @param {ResponseInit} init Response options
 * @returns {Response} The response
 */
export function noContent(init: ResponseInit = { }): Response {
  return new Response(undefined, { ...init, status: 204 });
}

/**
 * Create a 307 redirect response.
 * @param {string} url The redirect url
 * @param {ResponseInit} init Response options
 * @returns {Response} The response
 */
export function redirect(url: string, init: ResponseInit = { }): Response {
  return new Response(undefined, { status: 307, ...init, headers: { ...init.headers, location: url } });
}

/**
 * Create a 412 precondition failed response.
 * @param {BodyInit | undefined | null} body The body of the response
 * @param {ResponseInit} init Response options
 * @returns {Response} The response
 */
export function preconditionFailed(body?: BodyInit | undefined | null, init?: ResponseInit): Response {
  return new Response(body, { status: 412, statusText: 'Precondition Failed', ...init })
}

/**
 * Create a 409 conflict response.
 * @param {BodyInit | undefined | null} body The body of the response
 * @param {ResponseInit} init Response options
 * @returns {Response} The response
 */
export function conflict(body?: BodyInit | undefined | null, init?: ResponseInit): Response {
  return new Response(body, { status: 409, statusText: 'Conflict', ...init });
}
