export const DEFAULT_AR_PROVIDER_SELECTION = 'all';
export const AR_PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,63}$/;
// Enough for every supported provider: 24 maximum-length OSCP IDs plus the
// built-in sources and separators, while still bounding URL and request input.
export const MAX_AR_PROVIDER_SELECTION_CHARS = 1536;

export function parseArProviderSelection(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > MAX_AR_PROVIDER_SELECTION_CHARS)
    return null;
  if (normalized === 'all' || normalized === 'none') return normalized;
  const ids = normalized.split(',');
  if (!ids.length || ids.some((id) => !AR_PROVIDER_ID_PATTERN.test(id)))
    return null;
  return [...new Set(ids)].sort().join(',');
}

export function normalizeArProviderSelection(value) {
  return parseArProviderSelection(value) || DEFAULT_AR_PROVIDER_SELECTION;
}
