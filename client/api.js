// Thin fetch wrapper. All URLs are relative so the browser never calls localhost.
//
// Auth: the server sets an HttpOnly session cookie. Embedded previews can drop cookies, so the
// login/register response also returns the session token, which is kept in sessionStorage (per tab)
// and sent as a Bearer header. Logout clears it.
const TOKEN_KEY = 'gravemark.session';

export class ApiError extends Error {
  constructor(message, status, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

let memoryToken = null;

export function getSessionToken() {
  if (memoryToken) return memoryToken;
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function setSessionToken(token) {
  memoryToken = token || null;
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* storage blocked (common in cross-site iframes): the in-memory copy still works */ }
}

export async function api(method, url, body) {
  const init = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  const token = getSessionToken();
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (method !== 'GET') {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body ?? {});
  }
  let res;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError('Network error. Check your connection and try again.', 0);
  }
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (url === '/api/auth/logout') setSessionToken(null);
  if (res.status === 401 && !url.startsWith('/api/auth/')) {
    window.dispatchEvent(new CustomEvent('gravemark:session-expired'));
  }
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.field);
  if (data?.token) setSessionToken(data.token);
  return data;
}

export const get = (url) => api('GET', url);
export const post = (url, body) => api('POST', url, body);
export const put = (url, body) => api('PUT', url, body);
