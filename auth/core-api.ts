import { ForbiddenError, MalformedError } from '../common/errors.ts';

import { Router, json, text, noContent } from '../api/mod.ts';
import { handleError } from '../common/middleware.ts';
import Api from '../common/api.ts';

import { hashPassword } from './auth-util.ts';
import type { AuthSession, AuthUser, AuthRequest } from './auth-types.ts';
import { validateUserSession } from './auth-middleware.ts';
import AuthDb from './auth-db.ts';


export class CoreApi extends Api<AuthRequest> {
  readonly #type: string;

  constructor(protected readonly db: AuthDb, type = '') {
    super();
    this.#type = type;
  }

  type() { return this.#type; }

  self(user?: AuthUser) {
    if(!user)
      return null;

    return { id: user.id!, username: user.username };
  }

  async deleteSelf(sess: AuthSession, user: AuthUser, pass: string): Promise<void> {
    if(!sess)
      throw new ForbiddenError('Not authenticated!');

    if(sess.context !== 'user')
      throw new ForbiddenError('Must be a user!');

    if(await hashPassword(pass, user.salt) !== user.pass)
      throw new ForbiddenError('Password does not match!');

    await this.db.delUser(user.id!);
  }

  compile(router = new Router<AuthRequest>()): Router<AuthRequest> {
    const optionalUserSession = validateUserSession(this.db, true);
    const requireUserSession = validateUserSession(this.db);

    router.get('/type', () => text(this.type()));

    router.get('/self', handleError('get-self'), optionalUserSession, req => json(this.self(req.user)));

    router.delete('/self', handleError('delete-self'), requireUserSession, async (req: AuthRequest) => {
      if(!req.query.pass)
        throw new MalformedError('?pass=.. required!');

      await this.deleteSelf(req.session!, req.user, req.query.pass);

      return noContent();
    });

    return router;
  }
}

export default CoreApi;
