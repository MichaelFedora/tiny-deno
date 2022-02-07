import { FileInfo, FileList, FileListAdvance } from './file-types.ts';

export abstract class FileDb {

  constructor(protected readonly prefix = '') { }

  abstract getFileInfo(path: string): Promise<FileInfo | null>;
  abstract setFileInfo(path: string, data: FileInfo): Promise<void>;
  abstract delFileInfo(path: string): Promise<void>;

  abstract delFileInfoRecurse(path: string): Promise<void>;

  abstract listFiles(path: string, page?: number): Promise<FileList>;
  abstract listFilesAdvance(path: string, page?: number): Promise<FileListAdvance>;
}

export default FileDb;
