import jose from '../deps/jose.ts';

import { Router, json, text, noContent, redirect } from '../api/mod.ts';
import { AuthError, ForbiddenError, MalformedError, NotFoundError } from '../common/errors.ts';
import { handleError } from '../common/middleware.ts';
import Api from '../common/api.ts';

import { getSalt, hashPassword, importSecret } from './auth-util.ts';
import { AuthSession, AuthUser, AuthRequest, Handshake, MasterKey } from './auth-types.ts';
import { validateUserSession} from './auth-middleware.ts';
import AuthDb from './auth-db.ts';


export class AuthApi extends Api {

  readonly #whitelist: readonly string[];
  readonly #allowRegistration: boolean;
  readonly #allowHandshakes: boolean;
  readonly #allowMasterKeys: boolean;
  readonly #handshakeExpTime: number;
  readonly #sessionExpTime: number;
  readonly #serverName: string;

  constructor(protected readonly db: AuthDb, config: {
      whitelist?: readonly string[];
      allowRegistration?: boolean;
      allowHandshakes?: boolean;
      allowMasterKeys?: boolean;
      handshakeExpTime?: number;
      sessionExpTime?: number;
      serverName?: string;
    } = { }) {

    super();

    this.#whitelist = config.whitelist?.slice() ?? [];
    this.#allowRegistration = config.allowRegistration ?? true;
    this.#allowHandshakes = config.allowHandshakes ?? true;
    this.#allowMasterKeys = config.allowMasterKeys ?? true;
    this.#handshakeExpTime = config.handshakeExpTime ?? 300000; // 5 minutes
    this.#sessionExpTime = config.sessionExpTime ?? 604800000; // 1 week
    this.#serverName = config.serverName ?? 'tiny';
  }

  async #createSessionJWT(sess: string): Promise<string | undefined>;
  async #createSessionJWT(sess: AuthSession): Promise<string>;
  async #createSessionJWT(sess: string | AuthSession): Promise<string | undefined>;
  async #createSessionJWT(sess: string | AuthSession): Promise<string | undefined> {
    if(typeof sess !== 'object')
      sess = (await this.db.getSession(sess))!;

    if(!sess)
      return undefined;

    const jwt = new jose.SignJWT({ jti: sess.id! })
      .setProtectedHeader({ alg: 'HS384' })
      .setIssuer(this.#serverName)
      .setSubject(sess.user)
      .setIssuedAt(Math.floor(sess.created / 1000))
      .setExpirationTime(Math.floor((sess.created + this.#sessionExpTime) / 1000));

    return await jwt.sign(await importSecret(sess.secret));
  }

  async #createMasterKeyJWT(key: string): Promise<string | undefined>;
  async #createMasterKeyJWT(key: MasterKey): Promise<string>;
  async #createMasterKeyJWT(key: string | MasterKey): Promise<string | undefined>;
  async #createMasterKeyJWT(key: string | MasterKey): Promise<string | undefined> {
    if(typeof key !== 'object')
      key = (await this.db.getMasterKey(key))!;

    if(!key)
      return undefined;

    const jwt = new jose.SignJWT({ jti: key.id! })
      .setProtectedHeader({ alg: 'HS384' })
      .setIssuer(this.#serverName)
      .setSubject(key.user)
      .setIssuedAt(Math.floor(key.created / 1000));

    return await jwt.sign(await importSecret(key.secret));
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

    const sid = await this.db.addSession(user.id!, 'user', username);
    return (await this.#createSessionJWT(sid))!;
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

  async sessions(user: AuthUser): Promise<Omit<AuthSession, 'secret'> []> {
    return await this.db.getSessionsForUser(user.id!).then(res => res.map(s => ({ ...s, secret: undefined })));
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
    const sess = await this.db.addSession(session.user, session.context, session.identifier, session);
    await this.db.delSession(session.id!);
    return sess;
  }

  async logout(session: string): Promise<void> {
    await this.db.delSession(session);
  }

  // #endregion core

  // #region handshakes

  async startHandshake(redirect: string, app: string, extra?: Partial<{
    permissions: readonly string[];
    collections: readonly string[];
  }>, username?: string): Promise<string> {
    if(app === 'secure')
      throw new ForbiddenError('App cannot be called "secure".');

    const hsId = await this.db.addHandshake({
      app,
      redirect,

      permissions: extra?.permissions ?? [],
      collections: extra?.collections ?? [],

      created: Date.now()
    } as Handshake);

    return `/handshake?handshake=${hsId}${username ? `&username=${username}` : ''}`;
  }

  async completeHandshake(redirect: string, app: string, code: string, extra?: Partial<{
    permissions: readonly string[];
    collections: readonly string[];
  }>): Promise<string> {
    if(app === 'secure')
      throw new ForbiddenError('App cannot be called "secure".');

    const handshake = await this.db.getHandshakeFromCode(code);
    if(!handshake)
      throw new NotFoundError('Handshake not found with the given code!');

    await this.db.delHandshake(handshake.id!);
    if(handshake.redirect !== redirect)
      throw new MalformedError('Handshake/body mismatch!');

    const user = await this.db.getUser(handshake.user!);
    if(!user)
      throw new NotFoundError('User not found!');

    if(handshake.app !== app ||
      JSON.stringify(extra?.permissions ?? []) !== JSON.stringify(handshake.permissions) ||
      JSON.stringify(extra?.collections ?? []) !== JSON.stringify(handshake.collections))
      throw new MalformedError('Handshake/body mismatch!');

    const sid = await this.db.addSession(user.id!, handshake.app, user.username);

    return (await this.#createSessionJWT(sid))!;
  }

  async testHandshake(id: string, session: AuthSession): Promise<Handshake> {
    if(session.context !== 'user')
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

  async generateSessionFromMasterKey(key: string, context: string, identifier: string, extra?: Partial<Pick<AuthSession, 'collections' | 'permissions'>>): Promise<string> {

    const masterKey = await this.db.getMasterKey(key);
    if(!masterKey)
      throw new NotFoundError('Master key not found!');

    const user = await this.db.getUser(masterKey.user);
    if(!user)
      throw new NotFoundError('User not found!');

    const sid = await this.db.addSession(user.id!, context, identifier, extra);

    return (await this.#createSessionJWT(sid))!;
  }

  async getMasterKeys(user: string): Promise<{
    id: string;
    name?: string;
    created: number;
    token: string;
  }[]> {
    const keys =  await this.db.getMasterKeysForUser(user);

    const ret: Promise<{
      id: string;
      name?: string;
      created: number;
      token: string;
    }>[] = [];

    for(const k of keys) {
      ret.push(this.#createMasterKeyJWT(k).then(token => ({
        id: k.id!,
        name: k.name ?? '',
        created: k.created,
        token
      })));
    }

    return await Promise.all(ret);
  }

  async addMasterKey(user: string, name = ''): Promise<string> {
    return await this.db.addMasterKey(user, name);
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

      return text(await this.login(body.username, body.password));
    });

    router.post('/register', async req => {
      const body: { username: string; password: string } = await req.json();

      if(!body || typeof body !== 'object' || !body.username || !body.password)
        throw new MalformedError('Must pass a { username, password } object!');

      await this.register(body.username, body.password);
      return noContent();
    });

    router.get('/can-register', () => {
      if(!this.#allowRegistration)
        throw new ForbiddenError();

      return noContent();
    });

    router.post('/change-pass', requireUserSession, async (req: AuthRequest) => {
      if(req.session!.context !== 'user')
        throw new ForbiddenError('Must be a user!');

      const body: { password: string; newpass: string } = await req.json();

      if(typeof body !== 'object' || !body || !body.password || !body.newpass)
        throw new MalformedError('Body must have a password and a newpass.');

      await this.changePass(req.user, body.password, body.newpass, req.session!.id!);

      return noContent();
    });

    router.use('/sessions', requireUserSession, (req, next) => {
      if(req.session?.context !== 'user')
        throw new ForbiddenError('Must be a user!');

      return next();
    });

    router.get('/sessions', async req => json(await this.sessions(req.user)));

    router.delete('/sessions/:id', async req => {
      await this.deleteSession(req.params.id!, req.user);

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
        if(!req.query?.redirect || !req.query.app)
          throw new MalformedError('Must have ?redirect={url}&app={app}<&permissions=[]><&collections=[]> query.');

        const permissions = req.query.permissions?.replaceAll(/[\[\]]/g, '').split(',') ?? [];
        const collections = req.query.collections?.replaceAll(/[\[\]]/g, '').split(',') ?? [];

        return redirect(await this.startHandshake(req.query.redirect, req.query.app, { permissions, collections }, req.query.username));
      });

      handshakeRouter.post('/complete', async req => {
        let body: {
          code: string;

          app: string;
          redirect: string;

          permissions?: string[];
          collections?: string[];
        } | null = null;

        try {
          body = await req.json();
        } catch {
          // do nothing
        }

        if(!body || typeof body !== 'object' || !body.redirect || !body.app || !body.code)
          throw new MalformedError('Body should contain: { redirect, app, code, collections?, permissions? }!');

        return text(await this.completeHandshake(body.redirect, body.app, body.code, { collections: body.collections, permissions: body.permissions }));
      });

      handshakeRouter.use('/:id', requireUserSession, async (req, next) => {
        if(req.session!.context !== 'user')
          throw new ForbiddenError('Must be a user!');

        req.handshake = await this.testHandshake(req.params.id!, req.session!);
        return next();
      });

      handshakeRouter.get('/:id', req => json({
        app: req.handshake!.app,
        redirect: req.handshake!.redirect,

        permissions: req.handshake!.permissions,
        collections: req.handshake!.collections,

        created: req.handshake!.created
      }));

      handshakeRouter.get('/:id/approve', async req => redirect(await this.approveHandshake(req.handshake!, req.user!)));
      handshakeRouter.get('/:id/cancel', async req => redirect(await this.cancelHandshake(req.handshake!)));

      router.use('/handshake', handshakeRouter);
    }

    /** !@todo! redo with the new token format */
    if(this.#allowMasterKeys) {
      const masterKeyRouter = new Router<AuthRequest>();
      masterKeyRouter.use(handleError('auth-master-key'));

      masterKeyRouter.post('/:id/generate-session', async req => {
        const body: {
          context: string;
          identifier: string;
        } & Partial<Pick<AuthSession, 'collections' | 'permissions'>> = await req.json();

        if(!body || typeof body !== 'object' || !body.context || !body.identifier || (body.collections && !(body.collections instanceof Array)) || (body.permissions && !(body.permissions instanceof Array)))
          throw new MalformedError('Body should contain: { context, identifier, collections?, permissions? }');

        return json(await this.generateSessionFromMasterKey(req.params.id!, body.context, body.identifier, body));
      });

      masterKeyRouter.use(requireUserSession, (req, next) => {
        if(req.session!.context !== 'user')
          throw new ForbiddenError('Must be a user!');

        return next();
      });

      masterKeyRouter.get('/', async req => json(await this.getMasterKeys(req.user!.id!)));
      masterKeyRouter.post('/', async req => text(await this.addMasterKey(req.user!.id!, req.query.name)));

      masterKeyRouter.use('/:id', async (req, next) => {
        const key = await this.getMasterKey(req.params.id!, req.user!.id!);
        if(!key)
          throw new NotFoundError('Key not found with id "' + req.params.id! + '"!');

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
