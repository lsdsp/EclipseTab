import { logger } from './logger';

export interface WebDavCredentials {
  endpoint: string;
  username: string;
  password: string;
}

const normalizeCredentialValue = (value: string): string => value.trim();

const toBase64Utf8 = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(binary, 'binary').toString('base64');
};

const buildBasicAuthHeader = (username: string, password: string): string =>
  `Basic ${toBase64Utf8(`${username}:${password}`)}`;

export const normalizeWebDavEndpoint = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('WebDAV endpoint is required');
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('WebDAV endpoint URL is invalid');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('WebDAV endpoint must use http or https');
  }
  return url.toString();
};

export const buildWebDavOriginPattern = (endpoint: string): string => {
  const normalized = normalizeWebDavEndpoint(endpoint);
  const url = new URL(normalized);
  return `${url.origin}/*`;
};

export const ensureWebDavPermissionForEndpoint = async (endpoint: string): Promise<boolean> => {
  if (typeof chrome === 'undefined' || !chrome.permissions?.contains || !chrome.permissions?.request) {
    return true;
  }

  const originPattern = buildWebDavOriginPattern(endpoint);
  const hasPermission = await new Promise<boolean>((resolve) => {
    chrome.permissions.contains({ origins: [originPattern] }, (granted) => {
      if (chrome.runtime?.lastError) {
        logger.warn('[WebDAV] permissions.contains failed', chrome.runtime.lastError);
        resolve(false);
        return;
      }
      resolve(Boolean(granted));
    });
  });
  if (hasPermission) {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    chrome.permissions.request({ origins: [originPattern] }, (granted) => {
      if (chrome.runtime?.lastError) {
        logger.warn('[WebDAV] permissions.request failed', chrome.runtime.lastError);
        resolve(false);
        return;
      }
      resolve(Boolean(granted));
    });
  });
};

const normalizeCredentials = (credentials: WebDavCredentials): WebDavCredentials => {
  const endpoint = normalizeWebDavEndpoint(credentials.endpoint);
  const username = normalizeCredentialValue(credentials.username);
  const password = credentials.password;

  if (!username) {
    throw new Error('WebDAV username is required');
  }
  if (!password) {
    throw new Error('WebDAV password is required');
  }

  return { endpoint, username, password };
};

export const uploadTextToWebDav = async (
  credentials: WebDavCredentials,
  content: string
): Promise<void> => {
  const { endpoint, username, password } = normalizeCredentials(credentials);

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      Authorization: buildBasicAuthHeader(username, password),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: content,
  });

  if (!response.ok) {
    throw new Error(`WebDAV upload failed (${response.status})`);
  }
};

export const downloadTextFromWebDav = async (
  credentials: WebDavCredentials
): Promise<string> => {
  const { endpoint, username, password } = normalizeCredentials(credentials);

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: buildBasicAuthHeader(username, password),
      'Cache-Control': 'no-store',
    },
  });

  if (response.status === 404) {
    throw new Error('Remote backup does not exist');
  }
  if (!response.ok) {
    throw new Error(`WebDAV download failed (${response.status})`);
  }
  return response.text();
};

