import { SlimRequestStub, RequestStub, RouteHandler } from './types.ts';
import { parseQuery, parseParams } from './util.ts';

/**
 * A step on the path of the router
 */
interface RouteStep<Req extends RequestStub = RequestStub> {
  /** The route (pathname) */
  route: string;
  /** What request method to limit to; empty for USE, as we do not limit for that */
  type?: 'HEAD' | 'OPTIONS' | 'GET' | 'POST' | 'PUT' | 'DELETE';
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
   * Map the steps of the router to something that may be more useful for consumption.
   *
   * @param callbackfn The callback function when mapping a step
   **/// deno-lint-ignore no-explicit-any
  map<R extends Req = Req, Ret = any>(callbackfn: (step: RouteStep<R>) => Ret): Ret[] {
    return this.#steps.map((v) => callbackfn(v));
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
  #add<R extends Req = Req>(route: string, type: 'HEAD' | 'OPTIONS' | 'GET' | 'POST' | 'PUT' | 'DELETE', handlers: RouteHandler<R>[]): void {

    // enforce `/{route}` with no trailing `/`'s
    route = '/' + route.replace(/^\/+|\/+$/g, '');

    this.#steps.push({
      route,
      type,
      handler: this.#condense(handlers)
    });
  }

  /**
   * Add handlers to a HEAD {route} call
   * @param {string} route The route
   * @param {Router | RouteHandler} handler A router or route handler
   * @param {Array<Router | RouteHandler>} handlers Any other route handlers to chain
   * @returns {this} this
   */
  head<R extends Req = Req>(route: string, handler: RouteHandler<R>, ...handlers: RouteHandler<R>[]): this {
    handlers.unshift(handler);
    this.#add(route, 'HEAD', handlers);
    return this;
  }

  /**
   * Add handlers to a OPTIONS {route} call
   * @param {string} route The route
   * @param {Router | RouteHandler} handler A router or route handler
   * @param {Array<Router | RouteHandler>} handlers Any other route handlers to chain
   * @returns {this} this
   */
  options<R extends Req = Req>(route: string, handler: RouteHandler<R>, ...handlers: RouteHandler<R>[]): this {
    handlers.unshift(handler);
    this.#add(route, 'OPTIONS', handlers);
    return this;
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
  #matchRoute(url: string, route: string, matchExtra?: boolean): boolean {
    let pattern = new URLPattern({ pathname: route });
    let test = pattern.test(url);

    if(!matchExtra || test)
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
  #pathfind<R extends Req = Req>(req: Partial<R> & SlimRequestStub, options?: { base?: string; matchType?: boolean }): { type: RouteStep['type']; route: string; handler: RouteHandler<R> }[] {
    let base = options?.base ?? '';
    const matchType = options?.matchType !== false;

    // enforce `/{route}` with no trailing `/`'s
    if(base)
      base = '/' + base.replace(/^\/+|\/+$/g, '');

    const path: {
      // for options checking
      type: RouteStep['type'];
      // for debugging
      route: string;
      handler: RouteHandler<R>
    }[] = [];

    for(const step of this.#steps) {
      // append the base to the route and remove any trailing `/`'s for the proper route to match against
      const route = (base + step.route).replace(/\/+$/g, '');

      if( (matchType && step.type && req.method !== step.type) ||
          !this.#matchRoute(req.url, route, !step.type) )
        continue;

      // move the handler into a variable in case it changes while it is being processed
      const handler = step.handler;

      if(handler instanceof Router)
        path.push(...(handler as Router<R>).#pathfind(req, { base: route, matchType }));
      else {
        path.push({ type: step.type, route, handler: (req, next) => {
          // match the route params for utility reasons
          req.params = parseParams(route, req.url);
          return handler(req, next);
        } });
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
  async process<R extends Req = Req>(req: Partial<R> & SlimRequestStub, base = ''): Promise<Response | undefined> {

    const path = this.#pathfind(req, { base });

    if(!path.length)
      return undefined;

    // store because we modify these

    const query = req.query;
    const params = req.params;
    const context = req.context;

    // generate the query object for utility reasons
    req.query = parseQuery(req.url);
    req.context = { };

    // used to check if the chain never finished and we got "ghosted"
    const nextResponse = new Response();

    const res = await this.#condense(path.map(p => p.handler))(req as R, () => nextResponse);

    // cleanup

    req.query = query;
    req.params = params;
    req.context = context;

    if(!res || res === nextResponse)
      return undefined;

    return res;
  }

  parseOptions<R extends Req = Req>(req: Partial<R> & SlimRequestStub, base = ''): { methods: string } {
    const path = this.#pathfind(req, { base, matchType: false });

    const methods = new Set<string>();

    for(const p of path)
      if(p.type)
        methods.add(p.type);

    methods.add('OPTIONS');

    return { methods: Array.from(methods.values()).join(', ') };
  }
}

export default Router;
