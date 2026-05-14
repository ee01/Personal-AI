export const getSafeExternalUrl = (url: unknown): string => {
  if (!url || url === '#') return '';

  const normalizedUrl = String(url).trim();
  if (!normalizedUrl) return '';

  try {
    const parsedUrl = new URL(normalizedUrl);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
      ? parsedUrl.href
      : '';
  } catch {
    return '';
  }
};
