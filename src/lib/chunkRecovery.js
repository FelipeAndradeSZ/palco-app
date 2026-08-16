const CHUNK_RELOAD_KEY = 'palco:chunk-reload-at';
const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

export function isChunkLoadError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(message);
}

export function canReloadForChunkError(lastReloadAt, now = Date.now()) {
  const parsedLastReloadAt = Number(lastReloadAt || 0);
  return !Number.isFinite(parsedLastReloadAt)
    || now - parsedLastReloadAt > CHUNK_RELOAD_COOLDOWN_MS;
}

export function requestChunkReload(error) {
  if (!isChunkLoadError(error) || typeof window === 'undefined') return false;

  try {
    const lastReloadAt = window.sessionStorage.getItem(CHUNK_RELOAD_KEY);
    if (!canReloadForChunkError(lastReloadAt)) return false;
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    // A reload still recovers the current deployment when storage is unavailable.
  }

  window.location.reload();
  return true;
}

export function clearChunkReloadGuard() {
  try {
    window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // Storage can be blocked by privacy settings.
  }
}

export function registerChunkRecovery() {
  if (typeof window === 'undefined') return () => {};

  const handlePreloadError = (event) => {
    if (!isChunkLoadError(event.payload)) return;
    event.preventDefault();
    requestChunkReload(event.payload);
  };

  window.addEventListener('vite:preloadError', handlePreloadError);
  return () => window.removeEventListener('vite:preloadError', handlePreloadError);
}
