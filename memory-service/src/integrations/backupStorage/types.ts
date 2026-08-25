export interface BackupObjectInfo {
  key: string;
  sizeBytes: number;
  lastModified?: string;
}

export interface BackupPutInput {
  key: string;
  filePath: string;
  sizeBytes: number;
  contentType?: string;
}

export interface BackupStorageProvider {
  readonly kind: 'webdav' | 's3' | 'local';
  put(input: BackupPutInput): Promise<void>;
  head(key: string): Promise<BackupObjectInfo>;
  list(prefix: string): Promise<BackupObjectInfo[]>;
  delete(key: string): Promise<void>;
  test(): Promise<{ ok: true; detail: string }>;
}
