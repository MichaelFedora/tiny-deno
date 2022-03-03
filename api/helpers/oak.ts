/** Stub declaration of an Oak Router Context */
interface OakContextStub {

  state: Record<string, unknown>;
  params: Record<string | number, string | undefined>;

  request: {
    url: URL;

    body(options: { type: 'stream' }): { value: ReadableStream<Uint8Array> };

    originalRequest: { request: Request };
  }

  response: {
    headers: Headers;
    // deno-lint-ignore no-explicit-any
    body: any;

    status: number;
  }
}

/** Stub Declaration of an Oak Router Middleware */
type OakMiddlewareStub = (ctx: OakContextStub, next: () => Promise<unknown>) => Promise<unknown> | unknown;

/** Stub declaration of an Oak Router */
interface OakRouterStub {
  use(route: string, middleware: OakMiddlewareStub, ...middlewares: OakMiddlewareStub[]): void;
  head(route: string, middleware: OakMiddlewareStub, ...middlewares: OakMiddlewareStub[]): void;
  options(route: string, middleware: OakMiddlewareStub, ...middlewares: OakMiddlewareStub[]): void;
  get(route: string, middleware: OakMiddlewareStub, ...middlewares: OakMiddlewareStub[]): void;
  post(route: string, middleware: OakMiddlewareStub, ...middlewares: OakMiddlewareStub[]): void;
  put(route: string, middleware: OakMiddlewareStub, ...middlewares: OakMiddlewareStub[]): void;
  delete(route: string, middleware: OakMiddlewareStub, ...middlewares: OakMiddlewareStub[]): void;
}

/*
// Type checks

import type { Router as OakRouter, RouterContext as OakContext, RouterMiddleware as OakMiddleware } from 'https://deno.land/x/oak/mod.ts';

declare const realCtx: OakContext<string>;
declare const stubMiddleware: OakMiddlewareStub;
declare const realRouter: OakRouter;

declare let realMiddleware: OakMiddleware<string>;
declare let stubCtx: OakContextStub;
declare let stubRouter: OakRouterStub;

realMiddleware = stubMiddleware;
stubCtx = realCtx;
stubRouter = realRouter;
// */

import Router from '../router.ts';
import type { RouteHandler } from '../types.ts';
import { parseQuery } from '../util.ts';

/**
 * Map a Tiny Request Handler to an Oak Middleware
 * @param handler the Tiny Request Handler
 * @returns a wrapped Oak Middleware
 */
export function mapHandlerToOak(handler: RouteHandler): OakMiddlewareStub {
  return async (ctx: OakContextStub, next) => {

    // Map the request to be compatible

    const req = Object.assign(ctx.request.originalRequest.request, {
      stream: ctx.request.body({ type: 'stream' })?.value,
      query: parseQuery(ctx.request.url.href),
      params: ctx.params,
      context: ctx.state
    });

    // Run the handler

    const nextResponse = new Response();
    const res = await handler(req, () => nextResponse);

    // We're supposed to go "next"

    if(res === nextResponse)
      return next();

    // We didn't get anything
    if(!res)
      return;

    // Merge responses

    for(const [header, value] of res.headers)
      ctx.response.headers.append(header, value);

    if(res.body != undefined)
      ctx.response.body = res.body;

    if(res.status != undefined)
      ctx.response.status = res.status;
  };
}

/**
 * Appends a Tiny Router handlers to the given Oak Router.
 * If sub-routers show up, these will also be appended.
 *
 * @param {TinyRouter} router The Tiny Router to map
 * @param {OakRouter} oakRouter The Oak Router to map to
 * @param {string} base (optional) The Base URL to append to the routes
 */
export function appendRouterToOak(router: Router, oakRouter: OakRouterStub, base?: string): void {
  base = base ?? '';

  if(base)
    base = '/' + base.replace(/^\/+|\/+$/g, '');

  router.map(step => {
    if(step.handler instanceof Router)
      return appendRouterToOak(step.handler, oakRouter, base + step.route);

    const middleware = mapHandlerToOak(step.handler);

    return oakRouter[step.type ? step.type.toLocaleLowerCase() as 'use' : 'use'](base + step.route, middleware);
  });
}
