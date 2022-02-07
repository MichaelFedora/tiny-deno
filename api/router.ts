import { RequestStub, RouteHandler } from './types.ts';

/**
 * A step on the path of the router
 */
interface RouteStep<Req extends RequestStub = RequestStub> {
  /** The route */
  route: string;
  /** What request method to limit to; empty for USE, as we do not limit for that */
  type?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** The route handler (or router) */
  handler: Router<Req> | RouteHandler<Req>;
}

export class Router<Req extends RequestStub = RequestStub> {

  /**
   * The steps to walk through every time we need to match a route to its destination
   */// deno-lint-ignore no-explicit-any
  readonly #steps: RouteStep<any>[] = [];

  /**
   * Condense many RouterHandlers into one (chaining via `next()`)
   * @param {readonly RouteHandler[]} handlers The handlers to condense
   * @returns {RouterHandler} The single condensed RouteHandler
   */
  #condense<R extends Req = Req>(handlers: readonly RouteHandler<R>[]): RouteHandler<R> {
    if(!handlers?.length)
      return (_, next) => next();

    if(handlers.length === 1)
      return handlers[0];

    return async (ctx, next) => {
      let i = 0;
      const call = () => handlers[i] ? handlers[i++](ctx, call) : next();
      return await call();
    };
  }

  /**
   * Use a route handler or a router for a particular route, regardless of the request method
   * @param {string} route The route to use the handler/router on
   * @param {Router | RouteHandler} handler A router or route handler
   * @param {Array<Router | RouteHandler>} handlers Any other route handlers to chain
   * @returns {this} this
   */
  use<R extends Req = Req>(route: string, handler: Router<R> | RouteHandler<R>, ...handlers: (Router<R> | RouteHandler<R>)[]): this;
  /**
   * Use a route handler or a router regardless of the request method or route
   * @param {Router | RouteHandler} handler A router or route handler
   * @param {Array<Router | RouteHandler>} handlers Any other route handlers to chain
   * @returns {this} this
   */
  use<R extends Req = Req>(handler: Router<R> | RouteHandler<R>, ...handlers: (Router<R> | RouteHandler<R>)[]): this;
  use<R extends Req = Req>(routeOrHandler: string | Router<R> | RouteHandler<R>, ...handlers: (Router<R> | RouteHandler<R>)[]): this  {
    const route = (!routeOrHandler || typeof routeOrHandler === 'string' ? routeOrHandler : '') || '/';

    if(typeof routeOrHandler === 'function' || routeOrHandler instanceof Router)
      handlers.unshift(routeOrHandler);

    for(const handler of handlers) {
      this.#steps.push({
        route,
        handler
      });
    }

    return this;
  }

  /**
   *
   * @param {route} route The route
   * @param {string} type The route method (GET/POST/PUT/DELETE)
   * @param {Array<RouteHandler>} handlers The handlers to add to our #step array (condensed)
   */
  #add<R extends Req = Req>(route: string, type: 'GET' | 'POST' | 'PUT' | 'DELETE', handlers: RouteHandler<R>[]): void {

    // enforce `/{route}` with no trailing `/`'s
    route = '/' + route.replace(/^\/+|\/+$/g, '');

    this.#steps.push({
      route,
      type,
      handler: this.#condense(handlers)
    });
  }

  /**
   * Add handlers to a GET {route} call
   * @param {string} route The route
   * @param {Router | RouteHandler} handler A router or route handler
   * @param {Array<Router | RouteHandler>} handlers Any other route handlers to chain
   * @returns {this} this
   */
  get<R extends Req = Req>(route: string, handler: RouteHandler<R>, ...handlers: RouteHandler<R>[]): this {
    handlers.unshift(handler);
    this.#add(route, 'GET', handlers);
    return this;
  }

  /**
   * Add handlers to a POST {route} call
   * @param {string} route The route
   * @param {Router | RouteHandler} handler A router or route handler
   * @param {Array<Router | RouteHandler>} handlers Any other route handlers to chain
   * @returns {this} this
   */
  post<R extends Req = Req>(route: string, handler: RouteHandler<R>, ...handlers: RouteHandler<R>[]): this {
    handlers.unshift(handler);
    this.#add(route, 'POST', handlers);
    return this;
  }

  /**
   * Add handlers to a PUT {route} call
   * @param {string} route The route
   * @param {Router | RouteHandler} handler A router or route handler
   * @param {Array<Router | RouteHandler>} handlers Any other route handlers to chain
   * @returns {this} this
   */
  put<R extends Req = Req>(route: string, handler: RouteHandler<R>, ...handlers: RouteHandler<R>[]): this {
    handlers.unshift(handler);
    this.#add(route, 'PUT', handlers);
    return this;
  }

  /**
   * Add handlers to a DELETE {route} call
   * @param {string} route The route
   * @param {Router | RouteHandler} handler A router or route handler
   * @param {Array<Router | RouteHandler>} handlers Any other route handlers to chain
   * @returns {this} this
   */
  delete<R extends Req = Req>(route: string, handler: RouteHandler<R>, ...handlers: RouteHandler<R>[]): this {
    handlers.unshift(handler);
    this.#add(route, 'DELETE', handlers);
    return this;
  }

  /**
   * Match a route to the request url
   * @param {string} url The request url
   * @param {string} route The route
   * @param {string?} type The route type -- if undefined (for USE), it also matches any sub-routes
   * @returns {boolean} Whether or not it matches
   */
  #matchRoute(url: string, route: string, type?: string): boolean {
    let pattern = new URLPattern({ pathname: route });
    let test = pattern.test(url);

    if(type || test)
      return test;

    pattern = new URLPattern({ pathname: route + '(.*)' });
    test = pattern.test(url);

    return test;
  }

  /**
   * Find a path through the step list
   * @param {Request} req The request
   * @param {string?} base The base url to append to the routes we are matching; used for sub-routers
   * @returns {Array<RouteHandler>} The path through the step list -- should be iterated through to process
   */
  #pathfind<R extends Req = Req>(req: R, base = ''): RouteHandler<R>[] {

    // enforce `/{route}` with no trailing `/`'s
    if(base)
      base = '/' + base.replace(/^\/+|\/+$/g, '');

    const path: RouteHandler<R>[] = [];

    for(const step of this.#steps) {
      // append the base to the route and remove any trailing `/`'s for the proper route to match against
      const route = (base + step.route).replace(/\/+$/g, '');

      if( (step.type && req.method !== step.type) ||
          !this.#matchRoute(req.url, route, step.type) )
        continue;

      // move the handler into a variable in case it changes while it is being processed
      const handler = step.handler;

      if(handler instanceof Router)
        path.push(...(handler as Router<R>).#pathfind(req, route));
      else {
        path.push((req, next) => {
          // match the route params for utility reasons
          req.params = (new URLPattern({ pathname: route + '/:else(.*)?' })).exec(req.url)?.pathname?.groups;
          delete req.params!.else;

          return handler(req, next);
        });
      }
    }

    return path;
  }

  /**
   * Process a request.
   *
   * **Note:** `req` is modified to add `query` and `params` onto it during processing,
   * and then reset after. If these are functions, it could go awry if you just assume things.
   *
   * @param {Request} req The request
   * @param {string?} base The base url
   * @returns {Promise<Response | undefined>} The response generated from the given routes,
   * or undefined if nothing was returned
   */
  async process<R extends Req = Req>(req: R, base = ''): Promise<Response | undefined> {

    const path = this.#pathfind(req, base);

    if(!path.length)
      return undefined;

    // store because we modify these

    const query = req.query;
    const params = req.params;

    // generate the query object for utility reasons
    req.query = req.url.includes('?')
      ? Object.fromEntries((new URLSearchParams(req.url.slice(req.url.indexOf('?')))).entries())
      : undefined;

    // used to check if the chain never finished and we got "ghosted"
    const nextResponse = new Response();

    const res = await this.#condense(path)(req, () => nextResponse);

    // cleanup

    req.query = query;
    req.params = params;

    if(!res || res === nextResponse)
      return undefined;

    return res;
  }
}

export default Router;
