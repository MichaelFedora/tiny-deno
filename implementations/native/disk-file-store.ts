import { serveFile, joinPath } from '../../deps/std.ts';

import { ForbiddenError, NotSupportedError, MalformedError, NotFoundError } from '../../common/errors.ts';
import { TinyRequest } from '../../common/types.ts';

import FileStore from '../../common/file-store.ts';

import { sizeOf } from './disk-util.ts';

export class DiskFileStore extends FileStore {

  #storageRoot: string;
  #storageMax: number | undefined;
  #userStorageMax: number | undefined;

  #base: string;

  async #ls(path: string) {
    const ret: Deno.DirEntry[] = [];

    for await (const dir of Deno.readDir(path))
      ret.push(dir);

    return ret;
  }

  async #ensurePath(path: string) {
    const relative = path.slice(this.#storageRoot.length);
    const split = relative.split(/[\\/]+/).filter(Boolean).slice(0, -1);

    let curr = this.#storageRoot;

    for(const folder of split) {
      const ls = await this.#ls(curr);

      curr = joinPath(curr, folder)

      const entry = ls.find(dir => dir.name === folder);
      if(entry && !entry.isDirectory)
        throw new MalformedError('"'+ folder + '" was supposed to be a folder but is a file!');
      else if(!entry)
        await Deno.mkdir(curr);
    }
  }

  constructor(config: { storageRoot: string; storageMax?: number; userStorageMax?: number }) {
    super();

    this.#storageRoot = config.storageRoot;
    this.#storageMax = config.storageMax;
    this.#userStorageMax = config.userStorageMax;
    this.#base = Deno.realPathSync(this.#storageRoot);

    Deno.realPath(this.#storageRoot)
      .then(path => this.#base = path)
      .catch(e => console.error('[DISK-FS] Error getting storage root path:', e));
  }

  validatePath(path: string, forcePublic = false): string {
    if(!this.#base)
      throw new Error('No base!');

    const real = joinPath(this.#base, path);

    const base = forcePublic ? joinPath(this.#base + '/public') : this.#base;

    if(!real.startsWith(base))
      throw new ForbiddenError('Path goes out of bounds!');

    return real.slice(this.#base.length);
  }

  async sendFile(req: TinyRequest, path: string): Promise<Response> {
    const filePath = joinPath(this.#base + '/' + path);

    try {
      return await serveFile(req instanceof Request ? req : new Request('', req), filePath);

    } catch(e) {
      console.error('[DISK-FS] Error serving file at:', filePath);

      throw e instanceof Deno.errors.NotFound
        ? new NotFoundError()
        : e;
    }
  }

  async saveFile(body: BodyInit, path: string): Promise<number> {
    path = joinPath(this.#base + '/' + path);

    await this.#ensurePath(path);

    if(body instanceof ReadableStream || body instanceof Blob) {
      const file = await Deno.open(path, { write: true, create: true, truncate: true });
      await (body instanceof Blob ? body.stream() : body).pipeTo(file.writable);
      if(Deno.resources()[file.rid])
        Deno.close(file.rid);
    } else if(typeof body === 'string')
      await Deno.writeFile(path, (new TextEncoder()).encode(body), { create: true });
    else if(typeof body === 'object' && (body as ArrayBufferView)?.buffer)
      await Deno.writeFile(path, new Uint8Array((body as ArrayBufferView).buffer), { create: true });
    else if(body instanceof ArrayBuffer)
      await Deno.writeFile(path, new Uint8Array(body), { create: true });
    else
      throw new NotSupportedError('FormData and URLSearchParams (and/or whatever type you gave) are not supported!');

    const stat = await Deno.stat(path);

    return stat.size;
  }

  async deleteFile(path: string): Promise<void> {
    path = await Deno.realPath(this.#base + '/' + path)

    await Deno.remove(path);

    // cleanup

    const folders = path.slice(this.#storageRoot.length).split(/[\/\\]+/g).filter(Boolean).slice(0, -1);

    for(let i = 0; i < folders.length; i++) {
      const dir = await Deno.realPath(this.#base + '/' + folders.slice(0, folders.length - i).join('/'));
      const size = await sizeOf(dir);
      if(!size)
        await Deno.remove(dir);
      else
        break;
    }
  }

  async getStorageStats(user: string): Promise<{ used: number; available?: number; max?: number }> {
    const used = await sizeOf(await Deno.realPath(this.#base + '/' + user));

    let max = undefined;
    if(this.#storageMax) {
      const currentUsed = await sizeOf(this.#base!);

      max = this.#storageMax - currentUsed + used;

      if(this.#userStorageMax)
        max = Math.min(max, this.#userStorageMax);

    } else if(this.#userStorageMax)
      max = this.#userStorageMax;

    return { used, available: max && max > 0 ? max - used : undefined, max };
  }
}

export default DiskFileStore;
