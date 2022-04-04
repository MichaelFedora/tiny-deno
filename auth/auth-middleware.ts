import jose from '../deps/jose.ts';

import { RouteHandler, text } from '../api/mod.ts';
import { AuthError } from '../common/errors.ts';

import type { AuthRequest, AuthJWT } from './auth-types.ts';
import type AuthDb from './auth-db.ts';

import { importSecret } from './auth-util.ts';

export function validateUserSession(db: AuthDb, optional = false): RouteHandler<AuthRequest> {
  return async (req: AuthRequest, next) => {
    try  {

      const query = req.url.indexOf('?') >= 0
        ? new URLSearchParams(req.url.slice(req.url.indexOf('?')))
        : null;

      const auth = req.headers.get('Authorization') || '';

      const token = query?.get('sid') || (
        /^(?:bearer|session)\s+.+$/i.test(auth)
          ? auth.replace(/^(?:bearer|session)\s+/i, '').trim()
          : '');

      const jwt = token ? jose.decodeJwt(token) as AuthJWT : null;
      const session = jwt ? await db.getSession(jwt.jti) : null;

      if(!session)
        throw new AuthError('No session found!');

      try {
        await jose.jwtVerify(token, await importSecret(session.secret));
      } catch(e) {
        console.error('auth token validation error:', e);
        throw new AuthError('Token does not validate!');
      }

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
