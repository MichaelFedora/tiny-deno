import { MalformedError, NotFoundError } from '../common/errors.ts';

import { Router, RouteHandler, json, noContent } from '../api/mod.ts';
import { TinyRequest, User, Session } from '../common/types.ts';
import { handleError } from '../common/middleware.ts';
import Api from '../common/api.ts';
import type FileStore from '../common/file-store.ts';

import type { FileList, FileListAdvance, FileInfo } from './file-types.ts';
import type FileDb from './file-db.ts';

const pathRoots = Object.freeze([ 'public', 'private', 'root', 'collections' ]);

export class FileApi<Req extends TinyRequest = TinyRequest> extends Api<Req> {

  protected async parsePath(username: string, path: string) {
    return await this.fs.validatePath(`/${username}/${path}`);
  }

  #validateScopes(scopes: readonly string[], path: string): boolean {
    if(scopes.includes('!user') || scopes.includes('/'))
      return true;

    return Boolean(scopes.find(scope => path.startsWith(scope)));
  }

  constructor(protected readonly db: FileDb,
    protected readonly fs: FileStore) {

    super();
  }

  // #region store

  async read(req: TinyRequest, path: string): Promise<Response> {
    if(!path.startsWith('/'))
      path = '/' + path;

    return await this.fs.sendFile(req, path); // || await this.readFile()...etc.
  }

  async write(path: string, file: BodyInit, type?: string) {
    if(!path.startsWith('/'))
      path = '/' + path;

    const size = await this.fs.saveFile(file, path);

    const info: FileInfo = {
      name: path.slice(path.lastIndexOf('/') + 1),
      modified: Date.now(),
      size,
      path,
      type
    }

    await this.db.setFileInfo(path, info);

    return info;
  }

  async delete(path: string): Promise<void> {
    if(!path.startsWith('/'))
      path = '/' + path;

    await this.fs.deleteFile(path);
    await this.db.delFileInfo(path);
  }

  async list(path: string, page?: number, advance = false): Promise<FileList | FileListAdvance> {
    if(!path.startsWith('/'))
      path = '/' + path;

    if(advance)
      return await this.db.listFilesAdvance(path, page);
    else
      return await this.db.listFilesAdvance(path, page);
  }

  async getStorageStats(user: User): Promise<{ used: number; available?: number; max?: number }> {
    return await this.fs.getStorageStats(user.id!);
  }

  async getInfo(path: string) {
    if(!path.startsWith('/'))
      path = '/' + path;

    return await this.db.getFileInfo(path);
  }

  async batchInfo(paths: string[]) {
    return await Promise.all(paths.map(p => this.db.getFileInfo(p)));
  }

  // #endregion store

  /**
   * Compile the file API into a router. The router (or the router this is going into)
   * should already have the `/files/:context/:identifier` on it, with optional
   * authentication validation.
   *
   * @param router A router to hook onto
   * @returns The new/given router
   */
  compile(router: Router<Req> = new Router<Req>()): Router<Req> {

    const cleanPath = function(path: string): string {
      return ('/' + path).replace(/\.{2,}/g, '').replace(/(\/+\.)?\/+/g, '/');
    }

    const makePath = function(user: string,
      root: 'public' | 'private' | 'root' | 'collection',
      context: 'user' | 'secure' | string,
      identifier: string,
      path: string): string {

      let absPath = `/${user}`;

      if(root === 'public')
        absPath += '/public';

      if(root !== 'root') {
        switch(context) {
          case 'secure':
            absPath += `/appdata/secure/${identifier}`;
            break;

          case 'user':
            if(root === 'private')
              absPath += '/private';
            break;

          default: // it's an app
            absPath += `/appdata/${context}`;
        }
      }

      return absPath + path;
    }

    const validatePath = (params: {
        context: 'user' | 'secure' | '~' | string;
        identifier: string;

        user: string;

        root: 'public' | 'private' | 'root' | 'collection';
        path?: string;
      },
      session?: Session): false | { perm: 'read' | 'write', path: string } => {

      if(!params.path)
        return false;

      const context = params.context === '~' ? session?.context : params.context;
      const identifier = params.identifier === '~' ? session?.identifier : params.identifier;

      if(!context || !identifier)
        return false;

      // clean up the path and add a '/' prefix
      const path = cleanPath(params.path);
      const foreign = !session || session.user !== params.user;

      // create the path

      const absPath = makePath(params.user, params.root, params.context, params.identifier, path);
      const publicPath =`/${params.user}/public/`;

      // if it's us, and we're a user session, always write access
      if(!foreign && session.context === 'user')
        return { perm: 'write', path: absPath };

      // if it's a foreign user, just check to see if it's a public path
      if(foreign)
        return absPath.startsWith(publicPath) ? { perm: 'read', path: absPath } : false;

      /** `/${session-user}` */
      const basePath = `/${session.user}`;
      /** `${app}/` or `secure/${hash}/` */
      const appPath = `${context}/` + (context === 'secure' ? `${identifier}/` : '');

      const writePaths = [
        // `/${session-user}/appdata/${app}/`
        basePath + '/appdata/' + appPath,
        // `/${session-user}/public/appdata/${app}/`
        basePath + '/public/appdata/' + appPath,
        // `/${session-user}/collections/${coll}/${app}/`
        ...session.collections.map(coll => basePath + `/collections/${coll}/` + appPath)
      ];

      if(writePaths.find(p => absPath.startsWith(p)))
        return { perm: 'write', path: absPath };

      const readPaths = [
        // `/${route-user}/public/`
        publicPath,
        // `/${session-user}/collections/${coll}/`
        ...session.collections.map(coll => basePath + `/collections/${coll}/`)
      ];

      if(readPaths.find(p => absPath.startsWith(p)))
        return { perm: 'read', path: absPath };

      return false;
    }

    /**
     * For the following route: `/:root(public|private|root|collections)/:path(.*)'
     *
     * Giving the following paramters:
     * - `root`: `'public' | 'private' | 'root' | 'collections'`
     * - `path`: `string | undefined`
     */
    router.use('/:root(public|private|root|collections)/:path(.*)',
      handleError('file-store'),
      new Router<Req>()
        .use('', async (req, next) => {
          if(!this.#validateScopes(req.session!.scopes, '/' + req.params.path!))
            throw new MalformedError('Path out of scope(s)!');

          req.context.path = await this.parsePath(req.user!.username, req.params.path!);

          return next();
        })
        .get('', async req => {
          if(req.query.info == undefined)
            return await this.read(req, req.user!.username, req.context.path as string);

          const info = await this.getInfo(req.user!.username, req.context.path as string)

          if(!info)
            throw new NotFoundError();

          return json(info);
        })
        .put('', async req => {
          await this.write(req.user!.username, req.context.path as string, req.stream || await req.text(), req.headers.get('Content-Type') || 'application/octet-stream');
          return noContent();
        })
        .delete('', async req => {
          await this.delete(req.user!.username, req.context.path as string);
          return noContent();
        }));



    router.get('/list-files', async req => {
      if(!this.#validateScopes(req.session!.scopes, req.params.path!))
        throw new MalformedError('Path out of scope(s)!');

      const path = await this.parsePath(req.user!.username, req.params.path!);

      return json(await this.list(req.user!.username, path, Number(req.query.page) || 0, Boolean(req.query.advance)));
    });

    router.get('/list-files/:root(public|private|root|collections)/:path(.*)?')

    router.get('/storage-stats', async req => json(!req.user ? null : await this.fs.getStorageStats(req.user)))

    // POST /batch-info string[]
    router.post('/batch-info', async req => {
      const body: string[] = await req.json();

      if(!body || !(body instanceof Array))
        throw new MalformedError('Body must be a string[]!');

      const validated = body.map(path => validatePath({ ...req.params, path }, req.session)).filter(Boolean) as { perm: 'read' | 'write'; path: string; }[];

      if(!validated.length)
        return json([]);

      return json(await this.batchInfo(validated.map(p => p.path)));
    });

    return router;
  }
}

export default FileApi;
