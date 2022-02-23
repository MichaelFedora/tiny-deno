import { MalformedError, NotFoundError } from '../common/errors.ts';

import { Router, RouteHandler, json, noContent } from '../api/mod.ts';
import { TinyRequest, User } from '../common/types.ts';
import { handleError } from '../common/middleware.ts';
import Api from '../common/api.ts';
import type FileStore from '../common/file-store.ts';

import type { FileList, FileListAdvance, FileInfo } from './file-types.ts';
import type FileDb from './file-db.ts';

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
    protected readonly fs: FileStore,
    protected readonly sessionValidator: RouteHandler<Req>) {

    super();
  }

  // #region store

  async read(req: TinyRequest, username: string, path: string): Promise<Response> {
    path = username + path;

    return await this.fs.sendFile(req, path); // || await this.readFile()...etc.
  }

  async write(username: string, path: string, file: BodyInit, type?: string) {
    path = username + path;
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

  async delete(username: string, path: string): Promise<void> {
    path = username + path;

    await this.fs.deleteFile(path);
    await this.db.delFileInfo(path);
  }

  async list(username: string, path: string, page?: number, advance?: boolean): Promise<FileList | FileListAdvance>;
  async list(username: string, path: string, page?: number, advance = false): Promise<FileList | FileListAdvance> {
    path = username + path;

    if(advance)
      return await this.db.listFilesAdvance(path, page);
    else
      return await this.db.listFilesAdvance(path, page);
  }

  async getStorageStats(user: User): Promise<{ used: number; available?: number; max?: number }> {
    return await this.fs.getStorageStats(user.id!);
  }

  async getInfo(username: string, path: string) {
    return await this.db.getFileInfo(username + '/' + path);
  }

  async batchInfo(username: string, paths: string[]) {
    return await Promise.all(paths.map(p => this.db.getFileInfo(username + '/' + p)));
  }

  // #endregion store

  /**
   *
   * @param router The root router to hook onto
   * @returns
   */
  compile(router: Router<Req> = new Router<Req>()): Router<Req> {

    const filesRouter = new Router<Req>();
    filesRouter.use(handleError('files'));

    filesRouter.use('/:path(.*)', this.sessionValidator, async (req, next) => {
      if(!this.#validateScopes(req.session!.scopes, '/' + req.params.path!))
        throw new MalformedError('Path out of scope(s)!');

      req.context.path = await this.parsePath(req.user!.username, req.params.path!);

      return next();
    });

    filesRouter.get('/:path(.*)', async req => {
      if(req.query.info == undefined)
        return await this.read(req, req.user!.username, req.context.path as string);

      const info = await this.getInfo(req.user!.username, req.context.path as string)

      if(!info)
        throw new NotFoundError();

      return json(info);
    });

    filesRouter.put('/:path(.*)', async req => {
      await this.write(req.user!.username, req.context.path as string, req.stream || await req.text(), req.headers.get('Content-Type') || 'application/octet-stream');
      return noContent();
    });

    filesRouter.delete('/:path(.*)', async req => {
      await this.delete(req.user!.username, req.context.path as string);
      return noContent();
    });

    router.use('/files', filesRouter);

    router.get('/list-files/:path(.*)?', this.sessionValidator, async req => {
      if(!this.#validateScopes(req.session!.scopes, req.params.path!))
        throw new MalformedError('Path out of scope(s)!');

      const path = await this.parsePath(req.user!.username, req.params.path!);

      return json(await this.list(req.user!.username, path, Number(req.query.page) || 0, Boolean(req.query.advance)));
    });

    router.get('/storage-stats', this.sessionValidator, async req => json(!req.user ? null : await this.fs.getStorageStats(req.user)))

    // POST /batch-info string[]
    router.post('/public-info/:username', async req => {
      const body: string[] = await req.json();

      if(!body || !(body instanceof Array))
        throw new MalformedError('Body must be a string[]!');

      return json(await this.batchInfo(req.params.username!, body.map(p => `/public${(p.startsWith('/') ? '' : '/')}${p}`)));
    });

    return router;
  }
}

export default FileApi;
