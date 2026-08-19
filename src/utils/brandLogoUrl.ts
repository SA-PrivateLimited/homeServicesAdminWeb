const ASSETS_ORIGIN = 'https://assets.akanso.in';

function uploadsKey(raw: string): string | null {
  if (raw.startsWith('/uploads/')) {
    return raw.slice('/uploads/'.length);
  }
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (parsed.pathname.startsWith('/uploads/')) {
        return parsed.pathname.slice('/uploads/'.length);
      }
    } catch {
      return null;
    }
  }
  return null;
}

/** Map legacy /uploads paths and S3 keys to the public assets CDN. */
export function resolveBrandLogoUrl(logoUrl?: string): string {
  const raw = (logoUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

  if (/^https?:\/\/assets\.akanso\.in\//i.test(raw)) {
    return raw.replace(/^http:\/\//i, 'https://');
  }

  const key = uploadsKey(raw);
  if (key) {
    return `${ASSETS_ORIGIN}/${key.replace(/^\/+/, '')}`;
  }

  if (
    !raw.startsWith('/') &&
    !/^https?:\/\//i.test(raw) &&
    /^[a-zA-Z0-9_-]+\//.test(raw)
  ) {
    return `${ASSETS_ORIGIN}/${raw.replace(/^\/+/, '')}`;
  }

  if (/^https?:\/\//i.test(raw)) return raw;

  return '';
}
