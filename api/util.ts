/**
 * Create a text response
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
 * Create a JSON response
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
 * Create a redirect response.
 * @param {string} url The redirect url
 * @param {ResponseInit} init Response options
 * @returns {Response} The response
 */
export function redirect(url: string, init: ResponseInit = { }): Response {
  return new Response(undefined, { status: 302, ...init, headers: { ...init.headers, location: url } });
}
