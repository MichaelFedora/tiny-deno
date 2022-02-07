export interface FileInfo {
  id?: string;
  path?: string;

  name: string;
  size: number;
  modified: number;
  type?: string;
}

export interface FileList {
  entries: string[];
  page?: number;
}

export interface FileListAdvance {
  entries: { [path: string]: FileInfo };
  page?: number;
}
