/**
 * Minimal HTTP client for the Apex Quiz FastAPI backend.
 *
 * Auth is invisible: the app provisions a guest backend account on first
 * use (register → login, credentials kept in localStorage) and refreshes
 * the JWT automatically. No login UI required.
 *
 * Backend error bodies are `{ detail: { code, message, suggestions } }`.
 */

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');

const TOKEN_KEY = 'apex-quiz-backend-tokens';
const CRED_KEY = 'apex-quiz-backend-guest';

export const isBackendConfigured = () => true;

export class BackendUnavailableError extends Error {
  constructor(message = 'Backend is not reachable') {
    super(message);
    this.name = 'BackendUnavailableError';
    this.code = 'BACKEND_UNAVAILABLE';
  }
}

export class BackendApiError extends Error {
  constructor({ code = 'UNKNOWN', message = 'Request failed', status = 0, suggestions = [] } = {}) {
    super(message);
    this.name = 'BackendApiError';
    this.code = code;
    this.status = status;
    this.suggestions = suggestions;
  }
}

function readTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeTokens(tokens) {
  try {
    if (tokens) localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable
  }
}

function readCreds() {
  try {
    return JSON.parse(localStorage.getItem(CRED_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeCreds(creds) {
  try {
    if (creds) localStorage.setItem(CRED_KEY, JSON.stringify(creds));
    else localStorage.removeItem(CRED_KEY);
  } catch {
    // storage unavailable
  }
}

const randomSecret = (length = 24) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};

function parseError(status, body) {
  const detail = body?.detail ?? body?.error ?? {};
  return new BackendApiError({
    code: detail.code || (status === 403 ? 'FORBIDDEN' : status === 401 ? 'UNAUTHORIZED' : 'REQUEST_FAILED'),
    message: detail.message || `Request failed (${status})`,
    status,
    suggestions: detail.suggestions || [],
  });
}

async function rawFetch(path, { method = 'GET', json, formData, token } = {}) {
  const headers = {};
  let body;
  if (formData) {
    body = formData;
  } else if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, { method, headers, body });
  } catch {
    throw new BackendUnavailableError(`Cannot reach the quiz backend at ${BACKEND_URL}. Start it with: uvicorn app.main:app --reload`);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty body
  }

  if (!res.ok) throw parseError(res.status, data);
  return data?.data !== undefined ? data : { data };
}

/**
 * Verifies the stored session, refreshing or provisioning as needed.
 * @returns {Promise<string|null>} access token, or null when backend is down.
 */
export async function ensureBackendSession() {
  const tokens = readTokens();
  if (tokens?.access_token) {
    try {
      await rawFetch('/api/auth/me', { token: tokens.access_token });
      return tokens.access_token;
    } catch (err) {
      if (err instanceof BackendUnavailableError) return null;
      // fall through to refresh / re-login
    }
  }

  if (tokens?.refresh_token) {
    try {
      const refreshed = await rawFetch('/api/auth/refresh', {
        method: 'POST',
        json: { refresh_token: tokens.refresh_token },
      });
      writeTokens(refreshed.data);
      return refreshed.data.access_token;
    } catch (err) {
      if (err instanceof BackendUnavailableError) return null;
      // fall through to login / register
    }
  }

  let creds = readCreds();
  if (creds) {
    try {
      return await loginWithCreds(creds);
    } catch (err) {
      if (err instanceof BackendUnavailableError) return null;
      creds = null;
      writeCreds(null);
    }
  }

  if (!creds) {
    creds = {
      email: `guest_${crypto.randomUUID().slice(0, 8)}@apexquiz.app`,
      password: randomSecret(),
    };
    try {
      const reg = await rawFetch('/api/auth/register', {
        method: 'POST',
        json: { ...creds, full_name: 'Guest' },
      });
      writeTokens(reg.data);
      writeCreds(creds);
      return reg.data.access_token;
    } catch (err) {
      if (err instanceof BackendUnavailableError) return null;
      throw err;
    }
  }

  return null;
}

async function loginWithCreds(creds) {
  const form = new URLSearchParams({ username: creds.email, password: creds.password });
  let res;
  try {
    res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
  } catch {
    throw new BackendUnavailableError();
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw parseError(res.status, data);
  writeTokens(data.data);
  writeCreds(creds);
  return data.data.access_token;
}

/**
 * Authenticated request. Refreshes the token once on 401.
 * Throws BackendUnavailableError when the backend is down.
 */
export async function apiFetch(path, { method = 'GET', json, formData } = {}) {
  const token = await ensureBackendSession();
  if (!token) {
    throw new BackendUnavailableError();
  }
  try {
    return await rawFetch(path, { method, json, formData, token });
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 401) {
      writeTokens(null);
      const retryToken = await ensureBackendSession();
      if (!retryToken) throw new BackendUnavailableError();
      return rawFetch(path, { method, json, formData, token: retryToken });
    }
    throw err;
  }
}

/** Lightweight reachability check (no auth needed). */
export async function isBackendReachable() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, { method: 'GET' });
    return res.ok;
  } catch {
    // fall back to a cheap authenticated probe below
  }
  try {
    await rawFetch('/api/auth/me', { token: readTokens()?.access_token || 'probe' });
    return true;
  } catch (err) {
    return err instanceof BackendApiError;
  }
}

export { BACKEND_URL };
