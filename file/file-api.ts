import { ForbiddenError, MalformedError, NotFoundError } from '../common/errors.ts';

import { Router, json, noContent } from '../api/mod.ts';
import { TinyRequest, TinyContextualRequest, Session } from '../common/types.ts';
import { handleError } from '../common/middleware.ts';
import Api from '../common/api.ts';
import type FileStore from '../common/file-store.ts';

import type { FileList, FileListAdvance, FileInfo } from './file-types.ts';
import type FileDb from './file-db.ts';

const roots = Object.freeze(['public', 'private', 'root', 'collections'] as const);

interface TinyRouteRequest extends TinyContextualRequest {
  params: TinyContextualRequest['params'] & { root: 'public' | 'private' | 'root' | 'collections'; path?: string };
}

/**
 * The Api for the File Module of the Tiny suite
 * Should be mounted to a `/:context/:identifier`
 * with those route params. It should also have an optional-authentication
 * middleware filling out the User and Session fields.
 */
export class FileApi<Req extends TinyContextualRequest = TinyContextualRequest> extends Api<Req> {

  cleanPath(path: string): string {
    return ('/' + path).replace(/\.{2,}/g, '').replace(/(\/+\.)?\/+/g, '/');
  }

  makePath(user: string,
    root: 'public' | 'private' | 'root' | 'collections',
    context: 'user' | 'secure' | string,
    identifier: string,
    path = '/'): string {

    if(!path.startsWith('/'))
      path = '/' + path;

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

        case 'collections':
          absPath += '/collections';
          break;

        default: // it's an app
          absPath += `/appdata/${context}`;
      }
    }

    return absPath + path;
  }

  validatePath(params: {
      context: 'user' | 'secure' | '~' | string;
      identifier: string;

      root: 'public' | 'private' | 'root' | 'collections';
      path?: string;
    },
    userId: string,
    session?: Session): false | { perm: 'read' | 'write', path: string } {

    if(!params.path)
      params.path = '/';

    const context = params.context === '~' ? session?.context : params.context;
    const identifier = params.identifier === '~' ? session?.identifier : params.identifier;

    if(!context || !identifier)
      return false;

    // clean up the path and add a '/' prefix
    const path = this.cleanPath(params.path);
    const foreign = !session || session.user !== userId;

    // create the path

    const absPath = this.makePath(userId, params.root, params.context, params.identifier, path);
    const publicPath =`/${userId}/public/`;

    // if it's us, and we're a user session, always write access
    if(!foreign && session.context === 'user')
      return { perm: 'write', path: absPath };

    /** @todo multiplayer storage - add checks to see if we're allowed private read or write access */
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

  async getStorageStats(userId: string): Promise<{ used: number; available?: number; max?: number }> {
    return await this.fs.getStorageStats(userId);
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

    /**
     * For the following route: `/:root(public|private|root|collections)/:path(.*)'
     *
     * Giving the following parameters:
     * - `root`: `'public' | 'private' | 'root' | 'collections'`
     * - `path`: `string | undefined`
     */
    router.use('/:root(public|private|root|collections)/:path(.*)',
      handleError('file-store'),
      new Router<TinyRouteRequest>()
        .use('', (req, next) => {
          const validated = this.validatePath(req.params, req.context.user.id!, req.session);
          if(!validated)
            throw new ForbiddenError('Requested path is inaccessible.');

          req.context.path = validated.path;
          req.context.perm = validated.perm;

          return next();
        })
        .get('', async req => {
          if(req.query.info == undefined)
            return await this.read(req, req.context.path as string);

          const info = await this.getInfo(req.context.path as string)

          if(!info)
            throw new NotFoundError();

          return json(info);
        })
        .put('', async req => {
          if(req.context.perm !== 'write')
            throw new ForbiddenError('Read access only.');

          await this.write(req.context.path as string, req.stream ?? await req.blob(), req.headers.get('Content-Type') || 'application/octet-stream');

          return noContent();
        })
        .delete('', async req => {
          if(req.context.perm !== 'write')
            throw new ForbiddenError('Read access only.');

          await this.delete(req.context.path as string);

          return noContent();
        }));

    router.get('/list-files/:root(public|private|root|collections)?/:path(.*)?', async req => {
      const validation = this.validatePath({
        context: req.context.context,
        identifier: req.context.identifier,
        root: req.params.root! as 'public' | 'private' | 'root' | 'collections',
        path: req.params.path
      }, req.context.user.id!, req.session);

      if(!validation || validation.perm !== 'write')
        throw new ForbiddenError('Cannot index requested path.');

      const advance = Boolean(req.query.advance);
      const page = (req.query.page && Number.parseInt(req.query.page)) || 0;

      const list = await this.list(validation.path, page, advance);
      const prefixLen = ('/' + req.context.user.id!).length;

      if(advance) {
        const entries: FileListAdvance['entries'] = { };
        for(const [path, info] of Object.entries((list as FileListAdvance).entries))
          entries[path.slice(prefixLen)] = info;

        (list as FileListAdvance).entries = entries;

      } else
        (list as FileList).entries = (list as FileList).entries.map(e => e.slice(prefixLen))

      return json(list);
    });

    router.get('/storage-stats', async req => json(!req.user ? null : await this.fs.getStorageStats(req.user)))

    // POST /batch-info string[]
    router.post('/batch-info', async req => {
      const body: string[] = await req.json();

      if(!body || !(body instanceof Array))
        throw new MalformedError('Body must be a string[]!');

      const validated = body.map(path => {
        if(!path.startsWith('/'))
          path = '/' + path;

        const root = roots.find(r => path.startsWith('/' + r)) || 'root';

        if(path.startsWith('/' + root))
          path = path.slice(0, root.length + 1);

        return this.validatePath({
          context: req.context.context,
          identifier: req.context.identifier,
          root,
          path
        }, req.context.user.id!, req.session);

      }).filter(Boolean) as { perm: 'read' | 'write'; path: string; }[];

      if(!validated.length)
        return json([]);

      return json(await this.batchInfo(validated.map(p => p.path)));
    });

    return router;
  }
}

export default FileApi;
