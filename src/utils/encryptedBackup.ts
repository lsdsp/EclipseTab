import type { BackupPackage } from './fullBackup';

const ENCRYPTION_VERSION = 1;
const PBKDF2_ITERATIONS = 120_000;
const PBKDF2_HASH = 'SHA-256';
const AES_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

export interface EncryptedBackupPayload {
  version: number;
  algorithm: 'AES-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  cipherText: string;
  createdAt: number;
}

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(binary, 'binary').toString('base64');
};

const fromBase64 = (value: string): Uint8Array => {
  const binary =
    typeof atob === 'function'
      ? atob(value)
      : Buffer.from(value, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const toBase64Url = (bytes: Uint8Array): string =>
  toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const fromBase64Url = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return fromBase64(padded);
};

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const deriveKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
  if (!password.trim()) {
    throw new Error('Password is required');
  }
  if (!crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable');
  }

  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    baseKey,
    { name: AES_ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
};

export const encryptBackupPackage = async (
  backupPackage: BackupPackage,
  password: string
): Promise<string> => {
  return encryptJsonContent(JSON.stringify(backupPackage), password);
};

export const encryptJsonContent = async (
  content: string,
  password: string
): Promise<string> => {
  const encoder = new TextEncoder();
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = await deriveKey(password, salt);
  const plainBytes = encoder.encode(content);
  const encrypted = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plainBytes)
  );

  const payload: EncryptedBackupPayload = {
    version: ENCRYPTION_VERSION,
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64Url(salt),
    iv: toBase64Url(iv),
    cipherText: toBase64Url(new Uint8Array(encrypted)),
    createdAt: Date.now(),
  };

  return JSON.stringify(payload);
};

const parseEncryptedPayload = (content: string): EncryptedBackupPayload => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new Error('Encrypted backup payload is not valid JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Encrypted backup payload is invalid');
  }

  const candidate = parsed as Partial<EncryptedBackupPayload>;
  if (
    candidate.version !== ENCRYPTION_VERSION ||
    candidate.algorithm !== 'AES-GCM' ||
    candidate.kdf !== 'PBKDF2-SHA256' ||
    typeof candidate.iterations !== 'number' ||
    typeof candidate.salt !== 'string' ||
    typeof candidate.iv !== 'string' ||
    typeof candidate.cipherText !== 'string'
  ) {
    throw new Error('Encrypted backup payload structure is invalid');
  }

  return candidate as EncryptedBackupPayload;
};

export const decryptBackupPackageJson = async (
  encryptedContent: string,
  password: string
): Promise<string> => {
  const payload = parseEncryptedPayload(encryptedContent);
  if (payload.iterations !== PBKDF2_ITERATIONS) {
    throw new Error(`Unsupported encryption iterations: ${payload.iterations}`);
  }

  const salt = fromBase64Url(payload.salt);
  const iv = fromBase64Url(payload.iv);
  const cipherBytes = fromBase64Url(payload.cipherText);
  const key = await deriveKey(password, salt);

  try {
    const plain = await crypto.subtle.decrypt(
      { name: AES_ALGORITHM, iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(cipherBytes)
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error('Failed to decrypt backup payload');
  }
};
