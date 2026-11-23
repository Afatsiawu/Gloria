const rawBase = import.meta.env.API_URL || import.meta.env.VITE_API_URL || '/api';
const BASE = /\/api\/?$/.test(rawBase)
  ? rawBase.replace(/\/$/, '')
  : `${rawBase.replace(/\/$/, '')}/api`;

export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let memoryCsrfToken = '';
let memoryCsrfSignature = '';

function csrfToken() {
  if (memoryCsrfToken) return memoryCsrfToken;
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function csrfSignature() {
  return memoryCsrfSignature;
}

export function errorMessage(error) {
  if (!error) return 'Something went wrong.';
  if (error.details?.length) {
    return `${error.message} (${error.details.map((d) => d.message || d.path).join('; ')})`;
  }
  return error.message || 'Something went wrong.';
}

const SESSION_FREE_PATHS = [
  '/auth/csrf',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/me',
];

export async function api(path, { method = 'GET', body, formData, signal, headers = {} } = {}) {
  const isUnsafe = !['GET', 'HEAD', 'OPTIONS'].includes(method);

  const buildOptions = () => {
    const options = { method, credentials: 'include', headers: { ...headers }, signal };
    if (formData) {
      options.body = formData;
    } else if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    if (isUnsafe) {
      options.headers['X-CSRF-Token'] = csrfToken();
      const signature = csrfSignature();
      if (signature) options.headers['X-CSRF-Signature'] = signature;
    }
    return options;
  };

  const doFetch = async () => {
    try {
      return await fetch(`${BASE}${path}`, buildOptions());
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new ApiError(0, 'NETWORK_ERROR', 'You appear to be offline. Check your connection and try again.');
    }
  };

  let response = await doFetch();

  // Recover once from a stale/missing CSRF token by refreshing it and retrying.
  if (response.status === 403 && isUnsafe && path !== '/auth/csrf') {
    const clone = response.clone();
    const payload = await clone.json().catch(() => null);
    if (payload?.error?.message?.toLowerCase().includes('security token')) {
      await ensureCsrf();
      response = await doFetch();
    }
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    let payload = null;
    if (contentType.includes('application/json')) {
      payload = await response.json().catch(() => null);
    }
    const error = payload?.error;
    if (response.status === 401 && !SESSION_FREE_PATHS.includes(path)) {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    if (response.status === 403) {
      window.dispatchEvent(new CustomEvent('auth:forbidden', { detail: { path, method } }));
    }
    throw new ApiError(
      response.status,
      error?.code || 'REQUEST_FAILED',
      error?.message || `Request failed (${response.status}).`,
      error?.details || []
    );
  }
  if (contentType.includes('application/json')) return response.json();
  return response.text();
}

export async function ensureCsrf() {
  try {
    const data = await api('/auth/csrf');
    if (data?.csrfToken) memoryCsrfToken = data.csrfToken;
    if (data?.csrfSignature) memoryCsrfSignature = data.csrfSignature;
  } catch {
    // The server also sets the cookie on every response; navigation will retry.
  }
}

async function blobRequest(path) {
  const response = await fetch(`${BASE}${path}`, { credentials: 'include' });
  if (!response.ok) {
    let message = `Download failed (${response.status}).`;
    try {
      const payload = await response.json();
      if (payload?.error?.message) message = payload.error.message;
    } catch {
      // ignore
    }
    throw new ApiError(response.status, 'DOWNLOAD_FAILED', message);
  }
  return response.blob();
}

export async function download(path, filename) {
  const blob = await blobRequest(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'download';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function openProtectedFile(path) {
  const blob = await blobRequest(path);
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener');
  if (!win) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export const money = (value) => `GHS ${Number(value || 0).toFixed(2)}`;
