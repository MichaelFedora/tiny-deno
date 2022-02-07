import { RouteHandler, text } from '../api/mod.ts';
import { AuthError } from '../common/errors.ts';

import type { AuthRequest } from './auth-types.ts';
import type AuthDb from './auth-db.ts';

export function validateUserSession(db: AuthDb, optional = false): RouteHandler<AuthRequest> {
  return async (req: AuthRequest, next) => {
    try  {

      const params = req.url.indexOf('?') >= 0
        ? new URLSearchParams(req.url.slice(req.url.indexOf('?')))
        : null;

      const auth = req.headers.get('Authorization') || '';

      const sid = params?.get('sid') || (
        /^(?:bearer|session)\s+.+$/.test(auth)
          ? auth.replace(/^(?:bearer|session)\s+/, '').trim()
          : '');

      const session = sid ? await db.getSession(sid) : null;
      if(!session)
        throw new AuthError('No session found!');

      const user = await db.getUser(session.user);
      if(!user)
        throw new AuthError('No user found!');

      req.session = session;
      req.user = user;

      return next(); // pass through errors

    } catch(e) {
      if(e instanceof AuthError) {
        if(!optional)
          return text(e.message, { status: 403 });
      } else {
        console.error('Error validating token:', e);
        if(!optional)
          return text('Failed to validate token.', { status: 500 });
      }

      req.session = undefined;
      req.user = undefined;

      return next();
    }
  }
}
