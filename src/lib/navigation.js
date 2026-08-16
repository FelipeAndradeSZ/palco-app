export function getSafeReturnPath(value, fallback = '/') {
  if (typeof value !== 'string') return fallback;

  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }

  return trimmed;
}

export function getLoginUrl(returnTo) {
  const safePath = getSafeReturnPath(returnTo);
  return `/login?returnTo=${encodeURIComponent(safePath)}`;
}
