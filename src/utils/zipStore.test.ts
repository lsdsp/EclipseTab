import { describe, expect, it } from 'vitest';
import { createSingleFileZip, readSingleFileZip } from './zipStore';

describe('zipStore', () => {
  it('creates and reads single file zip', async () => {
    const zip = createSingleFileZip('backup.json', '{"ok":true}');
    const parsed = await readSingleFileZip(zip);

    expect(parsed.fileName).toBe('backup.json');
    expect(parsed.content).toBe('{"ok":true}');
  });

  it('throws for invalid zip blob', async () => {
    const invalid = new Blob(['not-a-zip'], { type: 'application/octet-stream' });
    await expect(readSingleFileZip(invalid)).rejects.toThrow('Invalid ZIP');
  });
});

