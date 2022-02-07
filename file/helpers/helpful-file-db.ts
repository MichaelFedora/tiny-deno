import { KeyValueStore } from '../../common/key-value-store.ts';

import FileDb from '../file-db.ts';

import { FileInfo, FileList, FileListAdvance } from '../file-types.ts';


export class HelpfulFileDb extends FileDb {

  constructor(protected readonly keyValueStore: KeyValueStore, prefix = '') { super(prefix); }

  async init(): Promise<void> {
    await this.keyValueStore.init();
  }

  #key(path: string) {
    if(this.prefix)
      return [this.prefix, 'file', path].join(this.keyValueStore.separator);
    else
      return `file${this.keyValueStore.separator}${path}`;
  }

  async getFileInfo(path: string): Promise<FileInfo | null> {
    // return this.fileInfos.all({ path }, { limit: 1 }).then(res => res[0]);
    return await this.keyValueStore.get(this.#key(path));
  }

  async setFileInfo(path: string, data: FileInfo): Promise<void> {
    await this.keyValueStore.put(this.#key(path), { ...data, path });
  }

  async delFileInfo(path: string): Promise<void> {
    await this.keyValueStore.del(this.#key(path));
  }


  async delFileInfoRecurse(path: string): Promise<void> {
    await this.keyValueStore.delPrefixed(this.#key(path));
  }

  async listFiles(path: string, page = 0): Promise<FileList> {
    const entries = await this.keyValueStore.search<FileInfo>({
      prefix: this.#key(path),
      projection: [ 'path' ],
      skip: page * 100,
      limit: 100
    }).then(res => res.map(e => e.path!));

    const ret: FileList = { entries };

    if(entries.length > (page + 1) * 100)
      ret.page = page + 1;

    return ret;
  }

  async listFilesAdvance(path: string, page = 0): Promise<FileListAdvance> {
    const entries = await this.keyValueStore.search<FileInfo>({
      prefix: this.#key(path),
      skip: page * 100,
      limit: 100
    });

    const ret: FileListAdvance = { entries: { } };

    for(const entry of entries) {
      ret.entries[entry.path!] = entry;
      delete entry.path;
    }

    if(entries.length > (page + 1) * 100)
      ret.page = page + 1;

    return ret;
  }
}

export default HelpfulFileDb;
