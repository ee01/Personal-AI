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

export const getFirstSafeExternalUrl = (...urls: unknown[]): string => {
  for (const url of urls) {
    const safeUrl = getSafeExternalUrl(url);
    if (safeUrl) return safeUrl;
  }

  return '';
};
