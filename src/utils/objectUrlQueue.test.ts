import { describe, expect, it } from 'vitest';
import { enqueueObjectUrl } from './objectUrlQueue';

describe('objectUrlQueue', () => {
  it('keeps only the newest N urls and returns expired ones', () => {
    const queue = ['u1', 'u2'];
    const result = enqueueObjectUrl(queue, 'u3', 2);

    expect(result.nextQueue).toEqual(['u2', 'u3']);
    expect(result.expired).toEqual(['u1']);
  });

  it('never uses max size smaller than 1', () => {
    const result = enqueueObjectUrl([], 'u1', 0);
    expect(result.nextQueue).toEqual(['u1']);
    expect(result.expired).toEqual([]);
  });
});

