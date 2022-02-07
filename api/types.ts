/**
 * A request stub which this library uses. You can either set the two required fields yourself or
 * just pass something that is compatible (like the standard `Request` object).
 */
export interface RequestStub {

  // CORE (std)

  /** The (full) url */
  readonly url: string;
  /** The method (GET | PUT | POST | DELETE) */
  readonly method: string;

  // GENERATED

  /** Generated via URLPattern */
  params?: Record<string, string | undefined>;
  /** Generated via URLSearchParams */
  query?: Record<string, string | undefined>;
}

/** A route handler or middleware. Can `await` or just return `next` to continue along the chain, but should otherwise return a Response. */
export type RouteHandler<Req extends RequestStub = RequestStub> = (req: Req, next: () => Promise<Response> | Response) => Promise<Response> | Response;

