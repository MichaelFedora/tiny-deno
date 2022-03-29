import { SlimRequestStub, SlimRouteHandler, RouteHandler } from '../api/types.ts';

import { TinyError, MalformedError, ErrorTypes } from '../common/errors.ts';
import { TinyRequest, TinyContextualRequest } from '../common/types.ts';

const trueArray = Object.freeze(['true', '1', 'yes']);

export function parseTrue(query: unknown): boolean {
  return trueArray.includes(String(query).toLocaleLowerCase());
}

/**
 * A middleware to handle errors
 * @param action The action we are handling an error for
 * @returns {async (req, next) => Promise<Response>} Error handling Middleware
 */
export function handleError<R extends SlimRequestStub>(action: string): SlimRouteHandler<R> {
  return async function(_req, next) {
    try {
      return await next();

    } catch(err) {
      if(err instanceof TinyError) {
        switch(err.type) {
          case ErrorTypes.NOT_FOUND:
            return new Response(err.message || undefined, { status: 404 });

          case ErrorTypes.MALFORMED:
          case ErrorTypes.AUTH:
          case ErrorTypes.FORBIDDEN:
          default:
            return new Response(err.message || err.text || `Indescribable "${err.type}" Error`, { status: err.status || 500 });
        }

      } else {
        console.error(`Error performing ${action}:`, err);

        return new Response(`Failed to perform ${action}.`, { status: 500 });
      }
    }
  }
}

export function makeContextIdentifierValidator<R extends TinyRequest>(getContext: (via: 'username' | 'hash', identifier: string) => Promise<{ user: string, app?: string }>): RouteHandler<R & TinyContextualRequest> {
  return async (req: R, next: () => Response | Promise<Response>) => {

    if(!req.params.context || !req.params.identifier)
      throw new MalformedError('This is a Context-Identifier route and a context or identifier is missing or invalid!');

    const ctx = await getContext(req.params.context === 'secure' ? 'hash' : 'username', req.params.identifier as string);

    req.context.user = ctx.user;

    if(ctx.app)
      req.context.app = ctx.app;

    return next();
  };
}
