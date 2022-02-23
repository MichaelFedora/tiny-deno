import { TinyError, ErrorTypes } from '../common/errors.ts';
import { SlimRequestStub, SlimRouteHandler } from '../api/types.ts';

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
