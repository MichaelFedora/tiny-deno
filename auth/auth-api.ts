import { isEqual } from '../deps/lodash.ts';

import { Router, json, text, noContent, redirect } from '../api/mod.ts';
import { AuthError, ForbiddenError, MalformedError, NotFoundError } from '../common/errors.ts';
import { handleError } from '../common/middleware.ts';
import Api from '../common/api.ts';

import { getSalt, hashPassword } from './auth-util.ts';
import { AuthSession, AuthUser, AuthRequest, Handshake, MasterKey } from './auth-types.ts';
import { validateUserSession} from './auth-middleware.ts';
import AuthDb from './auth-db.ts';


export class AuthApi extends Api {

  readonly #whitelist: readonly string[];
  readonly #requireScopes: boolean;
  readonly #allowHandshakes: boolean;
  readonly #allowMasterKeys: boolean;
  readonly #handshakeExpTime: number;

  constructor(protected readonly db: AuthDb, config: {
      whitelist?: readonly string[];
      requireScopes?: boolean;
      allowHandshakes?: boolean;
      allowMasterKeys?: boolean;
      handshakeExpTime?: number;
    } = { }) {

    super();

    this.#whitelist = config.whitelist?.slice() || [];
    this.#requireScopes = config.requireScopes || true;
    this.#allowHandshakes = config.allowHandshakes || true;
    this.#allowMasterKeys = config.allowMasterKeys || true;
    this.#handshakeExpTime = config.handshakeExpTime || 300000; // 5 minutes
  }

  #validateScopes(scopes: string): readonly string[] {
    let ret: readonly string[];

    try {
      ret = JSON.parse(scopes);
      if(!(ret instanceof Array) || (this.#requireScopes && !ret.length) || ret.findIndex(a => !a.startsWith('/')) >= 0)
        throw new Error();
    } catch(_) {
      throw new MalformedError('Could not parse scopes query; should be a JSON array of paths that start with "/".')
    }

    return ret;
  }

  // #region core

  async login(username: string, password: string): Promise<string> {
    if(this.#whitelist?.length && !this.#whitelist.includes(username))
      throw new AuthError('Whitelist is active.');

    const user = await this.db.getUserFromUsername(username);
    if(!user)
      throw new AuthError('Username / password mismatch.');

    const pass = await hashPassword(password, user.salt);
    if(user.pass !== pass)
      throw new AuthError('Username / password mismatch.');

    return await this.db.addSession(user.id!, ['!user', '/']);
  }

  async register(username: string, password: string): Promise<void> {
    if(this.#whitelist?.length && !this.#whitelist.includes(username))
      throw new ForbiddenError('Whitelist is active.');

    if(await this.db.getUserFromUsername(username))
      throw new ForbiddenError('Username taken!');

    const salt = getSalt();
    const user: AuthUser = {
      username: username,
      salt,
      pass: await hashPassword(password, salt),
      created: Date.now()
    };

    await this.db.addUser(user);
  }

  async changePass(user: AuthUser, password: string, newpass: string, keep?: string): Promise<void> {
    if(await hashPassword(password, user.salt) !== user.pass)
      throw new ForbiddenError('Password mismatch.');

    const salt = getSalt();
    const pass = await hashPassword(newpass, salt);

    await this.db.putUser(user.id!, Object.assign(user, { salt, pass }));
    const sids = await this.db.getSessionIdsForUser(user.id!);
    await this.db.delManySessions(!keep ? sids : sids.filter(sid => sid !== keep));
  }

  async sessions(user: AuthUser): Promise<AuthSession[]> {
    return await this.db.getSessionsForUser(user.id!);
  }

  async deleteSession(id: string, user: AuthUser): Promise<void> {
    const sess = id ? await this.db.getSession(id) : null;

    if(!sess || sess.user !== user.id)
      throw new NotFoundError('No session found!');

    await this.db.delSession(id!);
  }

  async deleteSessions(user: string, keep?: string): Promise<void> {
    const sids = await this.db.getSessionIdsForUser(user);
    await this.db.delManySessions(!keep ? sids : sids.filter(sid => sid !== keep));
  }

  async refresh(session: AuthSession): Promise<string> {
    const sess = await this.db.addSession(session.user, session.scopes);
    await this.db.delSession(session.id!);
    return sess;
  }

  async logout(session: string): Promise<void> {
    await this.db.delSession(session);
  }

  // #endregion core

  // #region handshakes

  async startHandshake(redirect: string, scopes: readonly string[], username?: string): Promise<string> {
    const hsId = await this.db.addHandshake({ redirect, scopes, created: Date.now() } as Handshake);

    return `/handshake?handshake=${hsId}${username ? `&username=${username}` : ''}`;
  }

  async completeHandshake(redirect: string, scopes: readonly string[], code: string): Promise<string> {
    const handshake = await this.db.getHandshakeFromCode(code);
    if(!handshake)
      throw new NotFoundError('Handshake not found with the given code!');

    console.log(handshake.redirect !== redirect, handshake.scopes, scopes);

    await this.db.delHandshake(handshake.id!);
    if(handshake.redirect !== redirect || !isEqual(handshake.scopes, scopes))
      throw new MalformedError('Handshake/body mismatch!');

    const user = await this.db.getUser(handshake.user!);
    if(!user)
      throw new NotFoundError('User not found!');

    return await this.db.addSession(user.id!, handshake.scopes);
  }

  async testHandshake(id: string, session: AuthSession): Promise<Handshake> {
    if(!session.scopes.includes('!user'))
      throw new ForbiddenError('Must be a user!');

    const handshake = await this.db.getHandshake(id);
    if(!handshake || (handshake.user && handshake.user !== session.user))
      throw new NotFoundError('No handshake found with id "' + id + '"!');

    if(handshake.created + this.#handshakeExpTime < Date.now()) {
      await this.db.delHandshake(id);
      throw new NotFoundError('Handshake expired!');
    }

    return handshake;
  }

  async approveHandshake(handshake: Handshake, user: AuthUser): Promise<string> {

    let code: string;
    do {
      code = getSalt().replace(/\+/g, '-');
    } while(await this.db.getHandshakeFromCode(code) != null);

    handshake.user = user.id;
    handshake.code = code;

    await this.db.putHandshake(handshake.id!, handshake);

    return handshake.redirect + '?code=' + code;
  }

  async cancelHandshake(handshake: Handshake): Promise<string> {
    await this.db.delHandshake(handshake.id!);
    return handshake.redirect + '?error=access_denied';
  }

  // #endregion handshakes

  // #region masterkeys

  async generateSessionFromMasterKey(key: string, scopes: readonly string[]): Promise<string> {

    const masterKey = await this.db.getMasterKey(key);
    if(!masterKey)
      throw new NotFoundError('Master key not found!');

    const user = await this.db.getUser(masterKey.user);
    if(!user)
      throw new NotFoundError('User not found!');

    return await this.db.addSession(user.id!, scopes);
  }

  async getMasterKeys(user: string): Promise<MasterKey[]> {
    return await this.db.getMasterKeysForUser(user);
  }

  async addMasterKey(user: string, name = ''): Promise<string> {
    return await this.db.addMasterKey({ user, name, created: Date.now() });
  }

  async getMasterKey(user: string, id: string): Promise<MasterKey | null> {
    const key = await this.db.getMasterKey(id);

    if(!key || key.user !== user)
      return null;

    return key;
  }

  async updateMasterKey(key: MasterKey, name: string): Promise<void> {
    await this.db.putMasterKey(key.id!, { ...key, name });
  }

  async deleteMasterKey(key: MasterKey): Promise<void> {
    await this.db.delMasterKey(key.id!);
  }

  // #endregion masterkeys

  compile(router = new Router<AuthRequest>()): Router<AuthRequest> {
    const requireUserSession = validateUserSession(this.db);

    router.use(handleError('Auth'));

    // #region core

    router.post('/login', async req => {
      const body: { username: string; password: string } = await req.json();

      if(!body || typeof body !== 'object' || !body.username || !body.password)
        throw new MalformedError('Must pass a { username, password } object!');

      return json(await this.login(body.username, body.password));
    });

    router.post('/register', async req => {
      const body: { username: string; password: string } = await req.json();

      if(!body || typeof body !== 'object' || !body.username || !body.password)
        throw new MalformedError('Must pass a { username, password } object!');

      await this.register(body.username, body.password);
      return noContent();
    });

    router.post('/change-pass', requireUserSession, async (req: AuthRequest) => {
      if(!req.session!.scopes.includes('!user'))
        throw new ForbiddenError('Must be a user!');

      const body: { password: string; newpass: string } = await req.json();

      if(typeof body !== 'object' || !body || !body.password || !body.newpass)
        throw new MalformedError('Body must have a password and a newpass.');

      await this.changePass(req.user, body.password, body.newpass, req.session!.id!);

      return noContent();
    });

    router.use('/sessions', requireUserSession, (req, next) => {
      if(!req.session!.scopes.includes('!user'))
        throw new ForbiddenError('Must be a user!');

      return next();
    });

    router.get('/sessions', async req => json(await this.sessions(req.user)));

    router.delete('/sessions/:id', async req => {
      await this.deleteSession(req.params!.id!, req.user);

      return noContent();
    });

    router.delete('/sessions', async req => {
      await this.deleteSessions(req.user, req.session!.id!);

      return noContent();
    });

    router.post('/logout', requireUserSession, async req => {
      if(req.session)
        await this.logout(req.session!.id!);

      return noContent();
    });

    router.get('/refresh', requireUserSession, async (req: AuthRequest) => text(await this.refresh(req.session!)));

    // #endregion core

    if(this.#allowHandshakes) {
      const handshakeRouter = new Router<AuthRequest>();
      handshakeRouter.use(handleError('auth-handshake'));

      handshakeRouter.get('/start', async req => {
        if(!req.query || !req.query.redirect || (!req.query.scopes && this.#requireScopes))
          throw new MalformedError('Must have ?redirect={url}<&scopes=["/scopes"]> query.');

        const scopes = req.query.scopes ? this.#validateScopes(req.query.scopes) : [];

        return redirect(await this.startHandshake(req.query.redirect, scopes, req.query.username));
      });

      handshakeRouter.post('/complete', async req => {
        const body: {
          redirect: string;
          scopes: string[];
          code: string;
        } = await req.json();
        if(!body || typeof body !== 'object' || !body.redirect || (this.#requireScopes && !body.scopes) || !body.code)
          throw new MalformedError('Body should contain: { redirect, scopes, code }!');

        return text(await this.completeHandshake(body.redirect, body.scopes, body.code));
      });

      handshakeRouter.use('/:id', requireUserSession, async (req, next) => {
        if(!req.session!.scopes.includes('!user'))
          throw new ForbiddenError('Must be a user!');

        console.log(req.params, req.query);

        req.handshake = await this.testHandshake(req.params!.id!, req.session!);
        return next();
      });

      handshakeRouter.get('/:id', req => json({
        redirect: req.handshake!.redirect,
        scopes: req.handshake!.scopes
      }));

      handshakeRouter.get('/:id/approve', async req => redirect(await this.approveHandshake(req.handshake!, req.user!)));
      handshakeRouter.get('/:id/cancel', async req => redirect(await this.cancelHandshake(req.handshake!)));

      router.use('/handshake', handshakeRouter);

      router.post('/session', async req => {
        const body: {
          redirect: string;
          scopes: string[];
          code: string;
        } = await req.json();
        if(!body || typeof body !== 'object' || !body.redirect || (this.#requireScopes && !body.scopes) || !body.code)
          throw new MalformedError('Body should contain: { redirect, scopes, code }!');

        return text(await this.completeHandshake(body.redirect, body.scopes, body.code));
      });
    }

    if(this.#allowMasterKeys) {
      const masterKeyRouter = new Router<AuthRequest>();
      masterKeyRouter.use(handleError('auth-master-key'));

      masterKeyRouter.post('/:id/generate-session', async req => {
        if(!req.query?.scopes)
          throw new MalformedError('?scopes=[..] required!');

        return json(await this.generateSessionFromMasterKey(req.params!.id!, this.#validateScopes(req.query.scopes)));
      });

      masterKeyRouter.use(requireUserSession, (req, next) => {
        if(!req.session!.scopes.includes('!user'))
          throw new ForbiddenError('Must be a user!');

        return next();
      });

      masterKeyRouter.get('/', async req => json(await this.getMasterKeys(req.user!.id!)));
      masterKeyRouter.post('/', async req => text(await this.addMasterKey(req.user!.id!, req.query?.name)));

      masterKeyRouter.use('/:id', async (req, next) => {
        const key = await this.getMasterKey(req.params!.id!, req.user!.id!);
        if(!key)
          throw new NotFoundError('Key not found with id "' + req.params!.id! + '"!');

        req.masterKey = key;

        return next();
      });

      masterKeyRouter.put('/:id', async req => {
        const body: { name: string } = await req.json();
        if(!body || typeof body !== 'object' || !body.name || typeof body.name !== 'string')
          throw new MalformedError('Body should be { name: string }!');

        await this.updateMasterKey(req.masterKey!, body.name);
        return noContent();
      });

      masterKeyRouter.delete('/:id', async req => {
        await this.deleteMasterKey(req.masterKey!);
        return noContent();
      });

      router.use('/master-key', masterKeyRouter);
    }

    return router;
  }
}

export default AuthApi;
