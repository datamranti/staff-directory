import { STAFF_DIRECTORY_CONFIG } from './config.js';
import { getIdToken } from './auth.js';

function readCache() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STAFF_DIRECTORY_CONFIG.CACHE_KEY) || 'null');
    if (!parsed?.savedAt || !parsed?.data) return null;
    return { ...parsed, fresh: Date.now() - parsed.savedAt < STAFF_DIRECTORY_CONFIG.CACHE_TTL_MS };
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(STAFF_DIRECTORY_CONFIG.CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {}
}

export function getCachedDirectory() {
  return readCache();
}

export function clearDirectoryCache() {
  try { sessionStorage.removeItem(STAFF_DIRECTORY_CONFIG.CACHE_KEY); } catch {}
}

export async function fetchDirectory({ forceTokenRefresh = false } = {}) {
  const idToken = await getIdToken(forceTokenRefresh);
  const response = await fetch(STAFF_DIRECTORY_CONFIG.API_URL, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ idToken, action: 'list', requestedAt: new Date().toISOString() })
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(text || 'The Staff Directory service returned an invalid response.'); }
  if (!response.ok || data.success === false) throw new Error(data.error || data.message || 'Unable to load the Staff Directory.');
  const users = Array.isArray(data.users) ? data.users : [];
  const normalized = { ...data, users };
  writeCache(normalized);
  return normalized;
}
