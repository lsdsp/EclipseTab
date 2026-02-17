import { describe, expect, it } from 'vitest';
import { resolveDockInsertIndex } from './dockInsertIndex';

describe('dockInsertIndex', () => {
  it('returns insertion index based on center points', () => {
    const centers = [100, 200, 300];

    expect(resolveDockInsertIndex(50, centers)).toBe(0);
    expect(resolveDockInsertIndex(150, centers)).toBe(1);
    expect(resolveDockInsertIndex(250, centers)).toBe(2);
    expect(resolveDockInsertIndex(350, centers)).toBe(3);
  });
});

