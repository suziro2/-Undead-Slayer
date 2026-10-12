// Thin fetch wrapper. All URLs are relative so the browser never calls localhost.
//
// Auth: the server sets an HttpOnly session cookie. Some browsers and embedded previews block cookies and
// site storage, so the login response also returns a session token. The token is kept in memory, in
// localStorage when that works, and as a last resort in the page address (?session=...). It is sent as a
// Bearer header. Logout and expired sessions clear it everywhere.
const TOKEN_KEY = 'gravemark.session';
const URL_PARAM = 'session';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;

export class ApiError extends Error {
  constructor(message, status, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

let memoryToken = null;

function tokenFromUrl() {
  try {
    const token = new URLSearchParams(location.search).get(URL_PARAM);
    return token && TOKEN_PATTERN.test(token) ? token : null;
  } catch { return null; }
}

function writeTokenToUrl(token) {
  try {
    const url = new URL(location.href);
    if (token) url.searchParams.set(URL_PARAM, token);
    else url.searchParams.delete(URL_PARAM);
    if (url.href !== location.href) history.replaceState(history.state, '', url);
  } catch { /* address bar not writable: other copies still work */ }
}

function readStoredToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

// A token in the address (after a reload or a link) is picked up on load.
memoryToken = tokenFromUrl();

// Shown in the corner label so a player can report the login state without developer tools.
export function sessionInfo() {
  let storage = 'ok';
  try {
    localStorage.setItem('gravemark.probe', '1');
    localStorage.removeItem('gravemark.probe');
  } catch { storage = 'blocked'; }
  const source = memoryToken
    ? (tokenFromUrl() ? 'address' : readStoredToken() ? 'memory+stored' : 'memory')
    : readStoredToken() ? 'stored' : 'none';
  return { token: source, storage };
}

export function getSessionToken() {
  return memoryToken || readStoredToken() || tokenFromUrl();
}

function setSessionToken(token) {
  memoryToken = token || null;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage blocked: the address and the in-memory copy still work */ }
  writeTokenToUrl(memoryToken);
}

// Build id injected by the server into the page (see server/app.js). Lets the server detect stale pages.
const CLIENT_BUILD = document.querySelector('meta[name="gravemark-build"]')?.content || '';

export async function api(method, url, body) {
  const init = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (CLIENT_BUILD) init.headers['X-Client-Build'] = CLIENT_BUILD;
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
    setSessionToken(null);
    window.dispatchEvent(new CustomEvent('gravemark:session-expired'));
  }
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.field);
  if (data?.token) setSessionToken(data.token);
  return data;
}

export const get = (url) => api('GET', url);
export const post = (url, body) => api('POST', url, body);
export const put = (url, body) => api('PUT', url, body);
