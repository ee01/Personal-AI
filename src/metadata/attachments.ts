export type MessageAttachmentCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'archive'
  | 'code'
  | 'file'
  | 'unknown';

export interface MessageAttachment {
  id: number | string;
  name?: string;
  type?: string;
  mimeType?: string;
  category: MessageAttachmentCategory;
  size?: number;
  sourceUrl?: string;
  messageUrl?: string;
  downloadUrl?: string;
  previewUrl?: string;
  creatorId?: number | string;
  createdAt?: number;
  modifiedAt?: number;
  storedFileId?: number | string;
  latestPostId?: number | string;
}

const FILE_ATTACHMENT_ITEM_TYPE_ID = 10;

const ATTACHMENT_EXTENSION_CATEGORIES: Array<{
  category: MessageAttachmentCategory;
  extensions: string[];
}> = [
  {
    category: 'image',
    extensions: [
      'apng',
      'avif',
      'bmp',
      'gif',
      'heic',
      'jpeg',
      'jpg',
      'png',
      'svg',
      'tif',
      'tiff',
      'webp',
    ],
  },
  {
    category: 'video',
    extensions: [
      '3g2',
      '3gp',
      'avi',
      'm4v',
      'mkv',
      'mov',
      'mp4',
      'mpeg',
      'mpg',
      'webm',
      'wmv',
    ],
  },
  {
    category: 'audio',
    extensions: [
      'aac',
      'aiff',
      'flac',
      'm4a',
      'mp3',
      'oga',
      'ogg',
      'opus',
      'wav',
      'wma',
    ],
  },
  {
    category: 'document',
    extensions: [
      'csv',
      'doc',
      'docx',
      'key',
      'md',
      'numbers',
      'pages',
      'pdf',
      'ppt',
      'pptx',
      'rtf',
      'txt',
      'xls',
      'xlsx',
    ],
  },
  {
    category: 'archive',
    extensions: ['7z', 'bz2', 'gz', 'rar', 'tar', 'tgz', 'zip'],
  },
  {
    category: 'code',
    extensions: [
      'css',
      'html',
      'java',
      'js',
      'json',
      'jsx',
      'py',
      'rb',
      'sh',
      'ts',
      'tsx',
      'xml',
      'yaml',
      'yml',
    ],
  },
];

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeComparable(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeFileType(value: unknown): string {
  return normalizeComparable(value).replace(/^\./, '');
}

function extractFileExtension(fileName: unknown): string {
  const normalizedName = normalizeComparable(fileName);
  const match = normalizedName.match(/\.([a-z0-9]+)$/i);
  return match ? normalizeFileType(match[1]) : '';
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function normalizeId(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  return String(value).trim();
}

function getFirstArrayId(value: unknown): string {
  return Array.isArray(value) && value.length > 0 ? normalizeId(value[0]) : '';
}

function normalizeHttpsUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : '';
  } catch {
    return '';
  }
}

function pickUrl(source: any, keys: string[]): string {
  for (const key of keys) {
    const url = normalizeHttpsUrl(source?.[key]);
    if (url) {
      return url;
    }
  }

  return '';
}

function mergeFileItemRecord(existing: any, incoming: any): any {
  if (!existing) {
    return incoming;
  }
  if (!incoming) {
    return existing;
  }

  return {
    ...existing,
    ...incoming,
    group_ids: incoming.group_ids || incoming.groupIds || existing.group_ids,
    groupIds: incoming.groupIds || incoming.group_ids || existing.groupIds,
    __latest_post_id:
      incoming.__latest_post_id ??
      incoming.latestPostId ??
      existing.__latest_post_id,
    latestPostId:
      incoming.latestPostId ??
      incoming.__latest_post_id ??
      existing.latestPostId,
    __size: incoming.__size ?? incoming.size ?? existing.__size,
    size: incoming.size ?? incoming.__size ?? existing.size,
    versions: incoming.versions || existing.versions,
  };
}

function getLatestFileVersion(fileItem: any): any {
  return Array.isArray(fileItem?.versions) && fileItem.versions.length > 0
    ? fileItem.versions[fileItem.versions.length - 1]
    : undefined;
}

function buildRingCentralFileDownloadUrl(fileItem: any): string {
  const version = getLatestFileVersion(fileItem);
  const fileId = normalizeId(fileItem?.id);
  const companyId = normalizeId(fileItem?.company_id || fileItem?.companyId);
  const storedFileId = normalizeId(
    version?.stored_file_id ||
      version?.storedFileId ||
      fileItem?.stored_file_id ||
      fileItem?.storedFileId,
  );

  if (!fileId || !companyId || !storedFileId) {
    return '';
  }

  const params = new URLSearchParams({
    stored_file_id: storedFileId,
    contentDisposition: 'Attachment',
  });

  return `https://dl.mvp.ringcentral.com/company/${encodeURIComponent(companyId)}/file/${encodeURIComponent(fileId)}?${params.toString()}`;
}

function buildRingCentralFilePreviewUrl(fileItem: any): string {
  const downloadUrl = buildRingCentralFileDownloadUrl(fileItem);
  if (!downloadUrl) {
    return '';
  }

  const url = new URL(downloadUrl);
  url.searchParams.set('contentDisposition', 'Inline');
  return url.toString();
}

function buildRingCentralMessageUrl(post: any, fileItem: any): string {
  const groupId =
    normalizeId(post?.group_id) ||
    normalizeId(post?.groupId) ||
    normalizeId(post?.from_group_id) ||
    normalizeId(post?.fromGroupId) ||
    getFirstArrayId(post?.group_ids) ||
    getFirstArrayId(post?.groupIds) ||
    getFirstArrayId(fileItem?.group_ids) ||
    getFirstArrayId(fileItem?.groupIds);
  const postId =
    normalizeId(post?.id) ||
    normalizeId(post?.post_id) ||
    normalizeId(post?.postId) ||
    normalizeId(fileItem?.__latest_post_id) ||
    normalizeId(fileItem?.latestPostId);

  if (!groupId) {
    return '';
  }

  return postId
    ? `https://app.ringcentral.com/messages/${encodeURIComponent(groupId)}/${encodeURIComponent(postId)}`
    : `https://app.ringcentral.com/messages/${encodeURIComponent(groupId)}`;
}

function classifyAttachmentCategory(
  fileName: unknown,
  fileType: unknown,
  mimeType?: unknown,
): MessageAttachmentCategory {
  const normalizedMimeType = normalizeComparable(mimeType);
  if (normalizedMimeType.startsWith('image/')) return 'image';
  if (normalizedMimeType.startsWith('video/')) return 'video';
  if (normalizedMimeType.startsWith('audio/')) return 'audio';
  if (
    normalizedMimeType === 'application/pdf' ||
    normalizedMimeType.startsWith('text/') ||
    normalizedMimeType.includes('document') ||
    normalizedMimeType.includes('spreadsheet') ||
    normalizedMimeType.includes('presentation')
  ) {
    return 'document';
  }

  const extension = normalizeFileType(fileType) || extractFileExtension(fileName);
  if (!extension) {
    return 'unknown';
  }

  return (
    ATTACHMENT_EXTENSION_CATEGORIES.find(({ extensions }) =>
      extensions.includes(extension),
    )?.category || 'file'
  );
}

export function buildFileItemsMap(fileItems: any[] = []): Map<any, any> {
  const fileItemsMap = new Map<any, any>();

  for (const fileItem of fileItems) {
    const id = fileItem?.id;
    if (id === null || id === undefined || id === '') {
      continue;
    }

    const merged = mergeFileItemRecord(fileItemsMap.get(String(id)), fileItem);
    fileItemsMap.set(id, merged);
    fileItemsMap.set(String(id), merged);
    const numericId = Number(id);
    if (Number.isFinite(numericId)) {
      fileItemsMap.set(numericId, merged);
    }
  }

  return fileItemsMap;
}

function getPostAttachmentRefs(post: any): Array<{
  id: number | string;
  typeId?: number | string;
}> {
  const refs = new Map<
    string,
    { id: number | string; typeId?: number | string }
  >();
  const addRef = (id: unknown, typeId?: unknown) => {
    if (id === null || id === undefined || id === '') {
      return;
    }

    const key = String(id);
    const existing = refs.get(key);
    refs.set(key, {
      id: (existing?.id ?? id) as number | string,
      ...(typeId !== null && typeId !== undefined && typeId !== ''
        ? { typeId: typeId as number | string }
        : existing?.typeId !== undefined
          ? { typeId: existing.typeId }
          : {}),
    });
  };

  [
    post?.item_ids,
    post?.itemIds,
    post?.attachment_ids,
    post?.attachmentIds,
    post?.file_ids,
    post?.fileIds,
  ].forEach((ids) => {
    if (Array.isArray(ids)) {
      ids.forEach((id) => addRef(id));
    }
  });

  if (Array.isArray(post?.items)) {
    post.items.forEach((item: any) =>
      addRef(item?.id, item?.type_id ?? item?.typeId),
    );
  }

  return Array.from(refs.values());
}

function resolveFileItem(fileItemsMap: Map<any, any>, id: number | string) {
  return (
    fileItemsMap.get(id) ||
    fileItemsMap.get(String(id)) ||
    fileItemsMap.get(Number(id))
  );
}

export function extractPostFileAttachments(
  post: any,
  fileItemsMap: Map<any, any>,
): MessageAttachment[] {
  return getPostAttachmentRefs(post)
    .map((ref) => {
      const fileItem = resolveFileItem(fileItemsMap, ref.id);
      if (!fileItem) {
        if (Number(ref.typeId) !== FILE_ATTACHMENT_ITEM_TYPE_ID) {
          return null;
        }
        const messageUrl = buildRingCentralMessageUrl(post, undefined);

        return {
          id: ref.id,
          category: 'unknown' as const,
          ...(messageUrl ? { sourceUrl: messageUrl, messageUrl } : {}),
        };
      }

      const name = normalizeText(fileItem.name || fileItem.fileName);
      const type = normalizeFileType(fileItem.type || fileItem.extension);
      const mimeType = normalizeText(
        fileItem.mime_type || fileItem.mimeType || fileItem.content_type,
      );
      const version = getLatestFileVersion(fileItem);
      const storedFileId =
        version?.stored_file_id ||
        version?.storedFileId ||
        fileItem.stored_file_id ||
        fileItem.storedFileId;
      const size = normalizeOptionalNumber(
        fileItem.__size ?? fileItem.size ?? version?.size,
      );
      const createdAt = normalizeOptionalNumber(
        fileItem.created_at ?? fileItem.createdAt,
      );
      const modifiedAt = normalizeOptionalNumber(
        fileItem.modified_at ?? fileItem.modifiedAt,
      );
      const messageUrl = buildRingCentralMessageUrl(post, fileItem);
      const sourceUrl =
        pickUrl(fileItem, [
          'sourceUrl',
          'permalink',
          'publicUrl',
          'public_url',
          'webUrl',
          'web_url',
          'viewUrl',
          'view_url',
          'url',
          'href',
        ]) ||
        buildRingCentralFileDownloadUrl(fileItem) ||
        messageUrl;
      const downloadUrl =
        pickUrl(fileItem, [
          'downloadUrl',
          'download_url',
          'contentUri',
          'content_uri',
          'contentUrl',
          'content_url',
        ]) || buildRingCentralFileDownloadUrl(fileItem);
      const previewUrl =
        pickUrl(fileItem, [
          'previewUrl',
          'preview_url',
          'thumbnailUrl',
          'thumbnail_url',
        ]) || buildRingCentralFilePreviewUrl(fileItem);

      return {
        id: fileItem.id ?? ref.id,
        ...(name ? { name } : {}),
        ...(type ? { type } : {}),
        ...(mimeType ? { mimeType } : {}),
        category: classifyAttachmentCategory(name, type, mimeType),
        ...(size !== undefined ? { size } : {}),
        ...(sourceUrl ? { sourceUrl } : {}),
        ...(messageUrl ? { messageUrl } : {}),
        ...(downloadUrl ? { downloadUrl } : {}),
        ...(previewUrl ? { previewUrl } : {}),
        ...(fileItem.creator_id || fileItem.creatorId
          ? { creatorId: fileItem.creator_id || fileItem.creatorId }
          : {}),
        ...(createdAt !== undefined ? { createdAt } : {}),
        ...(modifiedAt !== undefined ? { modifiedAt } : {}),
        ...(storedFileId ? { storedFileId } : {}),
        ...(fileItem.__latest_post_id || fileItem.latestPostId
          ? {
              latestPostId:
                fileItem.__latest_post_id || fileItem.latestPostId,
            }
          : {}),
      };
    })
    .filter(Boolean) as MessageAttachment[];
}

function formatAttachmentSize(size?: number): string {
  if (size === undefined) {
    return '';
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function formatMessageAttachment(attachment: MessageAttachment): string {
  const categoryLabels: Record<MessageAttachmentCategory, string> = {
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    document: 'Document',
    archive: 'Archive',
    code: 'Code',
    file: 'File',
    unknown: 'Attachment',
  };
  const label = categoryLabels[attachment.category];
  const details = [
    attachment.type ? `type=${attachment.type}` : '',
    attachment.mimeType ? `mime=${attachment.mimeType}` : '',
    formatAttachmentSize(attachment.size),
    attachment.sourceUrl ? `link=${attachment.sourceUrl}` : '',
  ].filter(Boolean);
  const name = attachment.name || `id:${attachment.id}`;

  return details.length > 0
    ? `${label}: ${name} (${details.join(', ')})`
    : `${label}: ${name}`;
}

export function appendAttachmentSummaryToText(
  text: string,
  attachments: MessageAttachment[],
): string {
  if (attachments.length === 0) {
    return text;
  }

  const attachmentLines = attachments.map(
    (attachment, index) =>
      `[Attachment ${index + 1}] ${formatMessageAttachment(attachment)}`,
  );

  return [text.trim(), attachmentLines.join('\n')].filter(Boolean).join('\n');
}
