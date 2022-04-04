import jose from '../deps/jose.ts';

import { Router, json, preconditionFailed, conflict } from '../api/mod.ts';

import { ForbiddenError, MalformedError, NotFoundError } from '../common/errors.ts';
import type { TinyContextualRequest, User, Session } from '../common/types.ts';
import { handleError } from '../common/middleware.ts';
import { publicKeyToAddress } from '../common/crypto-util.ts';
import type KeyValueStore from '../common/key-value-store.ts';
import type FileStore from '../common/file-store.ts';

import type { FileList, FileListAdvance, FileInfo } from '../file/file-types.ts';
import type FileDb from '../file/file-db.ts';
import FileApi from '../file/file-api.ts';


/**
 * A Gaia Api Interface
 *
 * @see https://github.com/stacks-network/gaia
 */
export class GaiaApi<Req extends TinyContextualRequest = TinyContextualRequest> extends FileApi<Req> {

  readonly #gaiaChallengeText: string;
  readonly #locks = new Set<string>();

  async #validateAssociationToken(tok: string, address: string): Promise<string> {
    /** @todo validate jwt w/ issuer being the signer */
    let token: {
      iss: string;
      exp?: number;
      iat?: number;
      childToAssociate: string;
    };

    try {
      token = jose.decodeJwt(tok) as typeof token;
    } catch {
      throw new MalformedError('Association token malformed!');
    }

    try {
      await jose.jwtVerify(tok, await jose.importSPKI(token.iss, 'ES256K'), { issuer: token.iss });
    } catch {
      throw new ForbiddenError('Association token could not be verified!');
    }

    if(token.exp && token.exp < Date.now() / 1000)
      throw new ForbiddenError('Association Token expired!');

    if(token.iat && token.iat > Date.now() / 1000)
      throw new ForbiddenError('Association Token issued in the future!');

    const childAddress = await publicKeyToAddress(token.childToAssociate);
    if(childAddress !== address)
      throw new ForbiddenError('Child address does not match bucket!');

    const signerAddress = await publicKeyToAddress(token.iss);

    return signerAddress;
  }

  async #validateToken(tok: string, address: string): Promise<{
    token: string;
    signerAddress: string;
    issuerAddress: string;
    issuedAt?: number;
  }> {

    let token: {
      iss: string;
      exp?: number;
      iat?: number;
      gaiaChallenge: string;
      associationToken?: string;
    };

    try {
      token = jose.decodeJwt(tok) as typeof token;
    } catch {
      throw new MalformedError('Authorization token malformed!');
    }

    try {
      await jose.jwtVerify(tok, await jose.importSPKI(token.iss, 'ES256K'), { issuer: token.iss });
    } catch {
      throw new ForbiddenError('Authorization token could not be verified!');
    }

    if(token.gaiaChallenge !== this.#gaiaChallengeText)
      throw new ForbiddenError('Gaia challenge mis-match!');

    if(token.exp && token.exp < Date.now() / 1000)
      throw new ForbiddenError('Token expired!');

    const oldestValidTimestamp = await this.getOldestValidTimestamp(address);
    if(oldestValidTimestamp && (!token.exp || token.exp < oldestValidTimestamp))
      throw new ForbiddenError('Token lacks expiration or is before the oldest valid timestamp (i.e. revoked)!');

    if(token.iat && token.iat > Date.now() / 1000)
      throw new ForbiddenError('Token issued in the future!');

    const issuerAddress = await publicKeyToAddress(token.iss);

    if(issuerAddress !== address)
      throw new ForbiddenError('Token is not issued for this address!');

    const signerAddress = token.associationToken ? await this.#validateAssociationToken(token.associationToken, address) : issuerAddress;

    return { token: tok, issuerAddress, signerAddress, issuedAt: token.iat };
  }

  constructor(readonly db: FileDb,
    readonly fs: FileStore,
    protected readonly kv: KeyValueStore,
    protected readonly getUserFromAddress: (address: string) => Promise<User | null>,
    gaiaChallengeText?: string) {

    super(db, fs);

    this.#gaiaChallengeText = gaiaChallengeText ?? 'tiny_challenge_text';
  }

  // #region store

  async getOldestValidTimestamp(address: string): Promise<number | null> {
    return await this.kv.get<number>('gaia:oldestValidTimestamp:' + address);
  }

  async setOldestValidTimestamp(address: string, value: number): Promise<void> {
    await this.kv.put('gaia:oldestValidTimestamp:' + address, value);
  }

  async validateGaiaPath(address: string, path = '', session?: Session) {
    const urlPath = this.cleanPath('gaia/' + address! + '/' + path);
    const source = await this.getUserFromAddress(address!);
    if(!source)
      throw new NotFoundError();

    const v = this.validatePath({ context: 'user', identifier: source.username, root: 'public', path: urlPath }, source.id!, session);
    if(!v)
      throw new NotFoundError();

    return v;
  }

  // #endregion store

  /**
   * Creates a Gaia API.
   *
   * @example
   * ```typescript
   * app.use('/gaia', fileApi.compileGaia());
   * ```
   * @param router (optional) The router to compile the gaia API to
   * @returns The given or created router
   */
  compile(router: Router<Req> = new Router<Req>()): Router<Req> {

    router.use(handleError('gaia'));

    // public

    router.head('/read/:address/:path(.+)', async req => {
      const info = await this.getInfo(req.params.address! + '/' + req.params.path);
      if(!info)
        throw new NotFoundError();

      const headers: HeadersInit = {
        'Content-Length': String(info.size),
        'ETag': String(info.modified)
      };

      if(info.type)
        headers['Content-Type'] = info.type;

      return new Response(undefined, { status: 204, headers });
    });

    router.get('/read/:address/:path(.+)', async req => {
      const { path } = await this.validateGaiaPath(req.params.address!, req.params.path, req.session);

      const info = await this.getInfo(path);
      if(!info)
        throw new NotFoundError();

      const res = await this.read(req, req.query.username!, );
      res.headers.append('ETag', String(info.modified));

      return res;
    });

    router.get('/hub_info', req => json({
      challenge_text: this.#gaiaChallengeText,
      read_url_prefix: req.url.slice(0, -('hub_info'.length)) + 'read',
      latest_auth_version: 'v1'
    }));

    // permission protected

    router.use(async (req, next) => {
      const auth = req.headers.get('Authorization');
      if(!auth)
        throw new ForbiddenError('No authorization given!');

      const info = await this.#validateToken(auth, req.params.address!);
      const user = await this.getUserFromAddress(info.signerAddress);

      if(!user)
        throw new ForbiddenError('No user registered for signer "' + info.signerAddress + '".');

      req.user = user;
      req.context.username = user.username;
      const { path, perm } = await this.validateGaiaPath(req.params.address!, req.params.path, req.session);

      if(perm !== 'write')
        throw new ForbiddenError();

      req.context.path = path;
      req.context.perm = perm;

      return next();
    });

    router.post('/store/:address/:path(.+)', async req => {
      if(this.#locks.has(req.context.path as string))
        return conflict('File is in use.');

      /**
       * Create New: `If-None-Match: *`
       * Update: `If-Match: eTag`
       * Overwrite: `If-Match: *`
       *
       * If we're already writing to the file, return '409 Conflict'
       */

      const ifMatch = req.headers.get('If-Match');
      const ifNoneMatch = req.headers.get('If-None-Match');

      // we're gonna be a little looser then standard gaia
      // if(!ifMatch && !ifNoneMatch)
      //   return preconditionFailed('Must have \'If(-None)-Match\' Header');

      if(ifNoneMatch && ifNoneMatch !== '*')
        return preconditionFailed('Only supports \'*\' for If-None-Match');

      if(ifMatch !== '*') {
        const info = await this.getInfo(req.context.path as string);

        if(info && ifNoneMatch === '*')
          return preconditionFailed('Cannot create: File already exists.');

        if(!info && ifMatch !== '*')
          return preconditionFailed('Cannot update: File does not exist.');

        if(ifMatch && ifMatch !== '*' && (!info?.modified || String(info.modified) !== ifMatch))
          return preconditionFailed('Cannot update: eTag does not match.');
      }

      if(this.#locks.has(req.context.path as string))
        return conflict('File is in use.');

      let info: FileInfo;
      try {
        this.#locks.add(req.context.path as string);

        info = await this.write(req.context.path as string,
          req.stream || await req.text(),
          req.headers.get('Content-Type') || 'application/octet-stream');

      } catch(e) {
        throw e;

      } finally {
        this.#locks.delete(req.context.path as string);
      }


      return json({
        // assumes this is a unique match (should be..?)
        publicURL: req.url.replace(`/store/${req.params.address!}`, `/read/${req.params.address!}`),
        etag: String(info.modified)
      });
    });

    router.delete('/delete/:address/:path(.+)', async req => {
      if(this.#locks.has(req.context.path as string))
        return conflict('File is in use.');

      const ifMatch = req.headers.get('If-Match');
      if(ifMatch) {
        const info = await this.getInfo(req.context.path as string);

        if(!info && ifMatch !== '*')
          return preconditionFailed('Cannot delete: File does not exist.');

        if(ifMatch && ifMatch !== '*' && (!info?.modified || String(info.modified) !== ifMatch))
          return preconditionFailed('Cannot delete: eTag does not match.');

        // check again because we had to await something
        if(this.#locks.has(req.context.path as string))
          return conflict('File is in use.');
      }

      try {
        this.#locks.add(req.context.path as string);

        await this.delete(req.context.path as string);

      } catch(e) {
        throw e;

      } finally {
        this.#locks.delete(req.context.path as string);
      }

      return new Response(undefined, { status: 202 });
    });

    router.post('/revoke-all/:address', async req => {
      let oldestValidTimestamp: number;

      try {
        const body = await req.json();
        oldestValidTimestamp = Number(body.oldestValidTimestamp);
      } catch {
        throw new MalformedError('Could not get `oldestValidTimestamp` from the body.');
      }

      if(!Number.isInteger(oldestValidTimestamp))
        throw new MalformedError('Revoke-all `oldestValidTimestamp` must be an integer!');

      await this.setOldestValidTimestamp(req.params.address!, oldestValidTimestamp);

      return json({ status: 'success' }, { status: 202 });
    });

    router.post('/list-files/:address', async req => {
      let page = 0;
      let advance = false;

      try {
        const body = await req.json();

        if(body?.page && (typeof body.page === 'number' || (typeof body.page === 'string' && /$\d+^/.test(body.page))))
          page = Number(body.page as string | number);

        advance = body?.stat === true;
      } finally {
        // do nothing
      }

      const list = await this.list(req.context.path as string, page, advance);

      const stat: {
        entries: string[] | { name: string; lastModifiedDate: number; contentLength: number; etag: string }[];
        page?: string;
      } = {
        entries: !advance
          ? (list as FileList).entries as string[]
          : Object.entries((list as FileListAdvance).entries).map(([path, info]) => ({
            name: path,
            lastModifiedDate: info.modified,
            contentLength: info.size,
            etag: String(info.modified)
          })),
        page: list.page ? String(list.page) : undefined
      };

      return json(stat);
    });

    return router;
  }
}

export default GaiaApi;
