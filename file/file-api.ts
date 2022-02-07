import { ForbiddenError, MalformedError } from '../common/errors.ts';

import { Router, RouteHandler, json, text, noContent } from '../api/mod.ts';
import { TinyRequest, User } from '../common/types.ts';
import { handleError } from '../common/middleware.ts';
import Api from '../common/api.ts';

import type { FileList, FileListAdvance } from './file-types.ts';
import type FileDb from './file-db.ts';
import type FileStore from '../common/file-store.ts';

export class FileApi<Req extends TinyRequest = TinyRequest> extends Api<Req> {

  #validateScopes(scopes: readonly string[], path: string): boolean {
    if(scopes.includes('!user') || scopes.includes('/'))
      return true;

    return Boolean(scopes.find(scope => path.startsWith(scope)));
  }

  constructor(protected readonly db: FileDb,
    protected readonly fs: FileStore,
    protected readonly sessionValidator: RouteHandler<Req>,
    protected readonly sendFile: (req: Req, path: string) => Response | Promise<Response>) {

    super();
  }

  // #region store

  async read(username: string, path: string): Promise<Response> {
    return await this.fs.sendFile(path); // || await this.readFile()...etc.
  }

  async write(username: string, path: string, file: BodyInit, type?: string) {
    path = username + path;
    const size = await this.fs.saveFile(file, path);

    console.log('write!', path);

    await this.db.setFileInfo(path, {
      name: path.slice(path.lastIndexOf('/') + 1),
      modified: Date.now(),
      size,
      path,
      type
    });
  }

  async delete(username: string, path: string): Promise<void> {
    await this.fs.deleteFile(path);
    await this.db.delFileInfo(path);
  }

  async list(username: string, path: string, page?: number, advance?: boolean): Promise<FileList | FileListAdvance>;
  async list(username: string, path: string, page?: number, advance = false): Promise<FileList | FileListAdvance> {
    if(advance)
      return await this.db.listFilesAdvance(path, page);
    else
      return await this.db.listFilesAdvance(path, page);
  }

  async getStorageStats(user: User): Promise<{ used: number; available?: number; max?: number }> {
    return await this.fs.getStorageStats(user.id!);
  }

  async batchInfo(paths: string[]) {
    return await Promise.all(paths.map(p => this.db.getFileInfo(p)));
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

    filesRouter.use('/:path(.*)', this.sessionValidator, (req, next) => {
      if(!this.#validateScopes(req.session!.scopes, '/' + req.params!.path!))
        throw new MalformedError('Path out of scope(s)!');

      return next();
    });

    filesRouter.get('/:path(.*)', async req => await this.sendFile(req, await this.fs.validatePath(`/${req.user!.username}/${req.params!.path!}`)));
    filesRouter.put('/:path(.*)', async req => {
      await this.write(req.user!.username, '/' + req.params!.path!, await req.stream() || await req.text(), req.headers.get('Content-Type') || 'application/octet-stream');
      return noContent();
    });

    filesRouter.delete('/:path(.*)', async req => {
      await this.delete(req.user!.username, '/' + req.params!.path!);
      return noContent();
    });

    router.use('/files', filesRouter);

    router.get('/list-files/:path(.*)?', this.sessionValidator, async req => {
      req.params!.path = '/' + req.params!.path;

      if(!this.#validateScopes(req.session!.scopes, req.params!.path!))
        throw new MalformedError('Path out of scope(s)!');

      return json(await this.list(req.user!.username, req.params!.path!, Number(req.query?.page) || 0, Boolean(req.query?.advance)));
    });

    router.get('/storage-stats', this.sessionValidator, async req => json(!req.user ? null : await this.fs.getStorageStats(req.user)))

    // POST /batch-info string[]
    router.post('/public-info/:username', async req => {
      const body: string[] = await req.json();

      if(!body || !(body instanceof Array))
        throw new MalformedError('Body must be a string[]!');

      return json(await this.batchInfo(body.map(p => `/public/${req.params!.username!}${(p.startsWith('/') ? '' : '/')}${p}`)));
    });

    return router;
  }
}

export default FileApi;
