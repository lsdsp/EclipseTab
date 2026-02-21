import { describe, expect, it } from 'vitest';
import {
  CURRENT_SPACE_EXPORT_SCHEMA_VERSION,
  decodeSpaceShareCode,
  encodeSpaceShareCode,
  normalizeMultiSpaceImportSchema,
  normalizeSingleSpaceImportSchema,
  type MultiSpaceExportData,
  type SpaceExportData,
} from './spaceExportImport';

describe('space export schema normalization', () => {
  it('normalizes single-space import data without schemaVersion to current version', () => {
    const input: SpaceExportData = {
      version: '1.0',
      type: 'eclipse-space-export',
      data: {
        name: 'Main',
        iconType: 'text',
        apps: [],
      },
    };

    const normalized = normalizeSingleSpaceImportSchema(input);
    expect(normalized.schemaVersion).toBe(CURRENT_SPACE_EXPORT_SCHEMA_VERSION);
  });

  it('normalizes multi-space import data without schemaVersion to current version', () => {
    const input: MultiSpaceExportData = {
      version: '1.0',
      type: 'eclipse-multi-space-export',
      data: {
        spaces: [
          {
            name: 'Main',
            iconType: 'text',
            apps: [],
          },
        ],
      },
    };

    const normalized = normalizeMultiSpaceImportSchema(input);
    expect(normalized.schemaVersion).toBe(CURRENT_SPACE_EXPORT_SCHEMA_VERSION);
  });

  it('rejects future schema versions', () => {
    const input: SpaceExportData = {
      version: '1.0',
      schemaVersion: CURRENT_SPACE_EXPORT_SCHEMA_VERSION + 1,
      type: 'eclipse-space-export',
      data: {
        name: 'Main',
        iconType: 'text',
        apps: [],
      },
    };

    expect(() => normalizeSingleSpaceImportSchema(input)).toThrow('Unsupported space import schema version');
  });

  it('round-trips single space share code', () => {
    const input: SpaceExportData = {
      version: '1.0',
      type: 'eclipse-space-export',
      data: {
        name: 'Main',
        iconType: 'text',
        apps: [],
      },
    };

    const shareCode = encodeSpaceShareCode({ type: 'single', data: input });
    const decoded = decodeSpaceShareCode(shareCode);

    expect(decoded.type).toBe('single');
    if (decoded.type === 'single') {
      expect(decoded.data.data.name).toBe('Main');
      expect(decoded.data.schemaVersion).toBe(CURRENT_SPACE_EXPORT_SCHEMA_VERSION);
    }
  });
});
