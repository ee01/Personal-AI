import type { BackupStorageProvider } from './types.js';
import { S3Provider, type S3ProviderOptions } from './S3Provider.js';
import { WebdavProvider, type WebdavProviderOptions } from './WebdavProvider.js';

export type { BackupObjectInfo, BackupPutInput, BackupStorageProvider } from './types.js';
export { LocalDirProvider } from './LocalDirProvider.js';
export { S3Provider } from './S3Provider.js';
export { WebdavProvider } from './WebdavProvider.js';

export type AutoBackupProviderKind = 'webdav' | 's3';

export function createBackupStorageProvider(input: {
  provider: AutoBackupProviderKind;
  webdav?: Partial<WebdavProviderOptions> & { url?: string };
  s3?: Partial<S3ProviderOptions>;
}): BackupStorageProvider {
  if (input.provider === 's3') {
    const s3 = input.s3;
    if (!s3?.endpoint || !s3.bucket || !s3.accessKeyId || !s3.secretAccessKey) {
      throw new Error('S3 backup is missing endpoint, bucket, or credentials');
    }
    return new S3Provider({
      endpoint: s3.endpoint,
      region: s3.region || 'auto',
      bucket: s3.bucket,
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey,
    });
  }

  const url = (input.webdav?.baseUrl || input.webdav?.url || '').trim();
  if (!url) {
    throw new Error('WebDAV backup is missing URL');
  }
  return new WebdavProvider({
    baseUrl: url,
    username: input.webdav?.username || '',
    password: input.webdav?.password || '',
  });
}
