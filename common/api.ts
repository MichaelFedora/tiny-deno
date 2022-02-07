import type { Router } from '../api/mod.ts';
import { TinyRequest } from './types.ts';

export abstract class Api<Req extends TinyRequest = TinyRequest> {

  public abstract compile(router?: Router<Req>): Router<Req>;
}

export default Api;
