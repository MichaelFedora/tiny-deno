import type { Router } from '../api/mod.ts';
import { TinyRequest } from './types.ts';

/**
 * An abstract base Api object, which contains a function that requires
 * the implementing class to be able to compile into a Router
 */
export abstract class Api<Req extends TinyRequest = TinyRequest> {

  /**
   * Compile the Api into a Router
   *
   * @param router (optional) the router to compile to
   * @returns the compiled router
   */
  public abstract compile(router?: Router<Req>): Router<Req>;
}

export default Api;
