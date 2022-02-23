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
