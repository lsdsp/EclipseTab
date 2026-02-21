import { webcrypto } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BackupPackage } from './fullBackup';
import { decryptBackupPackageJson, encryptBackupPackage } from './encryptedBackup';

const samplePackage: BackupPackage = {
  type: 'eclipse-full-backup',
  exportVersion: '1.0.0',
  createdAt: Date.now(),
  localStorageEntries: {
    EclipseTab_spaces: '{"spaces":[],"activeSpaceId":"","version":1}',
  },
  assets: {
    wallpapers: [],
    stickerAssets: [],
  },
};

beforeAll(() => {
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
      writable: true,
    });
  }
});

describe('encryptedBackup', () => {
  it('encrypts and decrypts backup package json', async () => {
    const encrypted = await encryptBackupPackage(samplePackage, 'pass123');
    const plainJson = await decryptBackupPackageJson(encrypted, 'pass123');
    const parsed = JSON.parse(plainJson) as BackupPackage;

    expect(parsed.type).toBe('eclipse-full-backup');
    expect(parsed.exportVersion).toBe('1.0.0');
    expect(parsed.localStorageEntries.EclipseTab_spaces).toContain('spaces');
  });

  it('throws when password is incorrect', async () => {
    const encrypted = await encryptBackupPackage(samplePackage, 'pass123');
    await expect(decryptBackupPackageJson(encrypted, 'wrong-pass')).rejects.toThrow(
      'Failed to decrypt backup payload'
    );
  });
});

