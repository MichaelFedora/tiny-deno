import { TinyRequest } from '../common/types.ts';

export abstract class FileStore {

  abstract validatePath(path: string, forcePublic?: boolean): string | Promise<string>;

  abstract sendFile(req: TinyRequest, path: string): Response | Promise<Response>;
  abstract saveFile(body: BodyInit, path: string): Promise<number>;
  abstract deleteFile(path: string): Promise<void>;

  abstract getStorageStats(user: string): Promise<{ used: number; available?: number; max?: number }>;
}

export default FileStore;
