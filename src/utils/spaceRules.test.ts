import { describe, expect, it } from 'vitest';
import { createDefaultSpace, SpaceRule } from '../types';
import {
  createDomainRule,
  createDefaultTimeRule,
  extractDomainFromUrl,
  isMinuteInQuietHours,
  isTimeRuleActive,
  normalizeDomain,
  resolveSpaceSuggestion,
} from './spaceRules';

describe('spaceRules domain helpers', () => {
  it('normalizes and extracts domains safely', () => {
    expect(normalizeDomain('  .Sub.Example.COM. ')).toBe('sub.example.com');
    expect(extractDomainFromUrl('https://a.b.example.com/path')).toBe('a.b.example.com');
    expect(extractDomainFromUrl('invalid')).toBeNull();
  });
});

describe('spaceRules time matcher', () => {
  it('matches weekday rule in configured range', () => {
    const rule = createDefaultTimeRule('space-work');
    const at = new Date('2026-02-23T10:00:00'); // Monday
    expect(isTimeRuleActive(rule, at)).toBe(true);
  });
});

describe('spaceRules quiet hours', () => {
  it('matches wrap-around quiet ranges', () => {
    expect(isMinuteInQuietHours(30, 23 * 60, 7 * 60)).toBe(true);
    expect(isMinuteInQuietHours(12 * 60, 23 * 60, 7 * 60)).toBe(false);
  });

  it('supports normal ranges and disabled range', () => {
    expect(isMinuteInQuietHours(10 * 60, 9 * 60, 18 * 60)).toBe(true);
    expect(isMinuteInQuietHours(20 * 60, 9 * 60, 18 * 60)).toBe(false);
    expect(isMinuteInQuietHours(9 * 60, 9 * 60, 9 * 60)).toBe(false);
  });
});

describe('spaceRules suggestion resolver', () => {
  const work = createDefaultSpace('Work', []);
  const life = createDefaultSpace('Life', [
    { id: '1', name: 'GitHub', url: 'https://github.com', type: 'app' },
  ]);

  it('prioritizes explicit domain rules', () => {
    const rules: SpaceRule[] = [createDomainRule(life.id, 'github.com')];
    const suggestion = resolveSpaceSuggestion({
      spaces: [work, life],
      activeSpaceId: work.id,
      rules,
      now: new Date('2026-02-23T10:00:00'),
      activeDomain: 'github.com',
    });

    expect(suggestion?.spaceId).toBe(life.id);
    expect(suggestion?.reason).toBe('domain');
    expect(suggestion?.canRememberDomain).toBe(false);
  });

  it('falls back to inferred domain suggestion and allows remember action', () => {
    const suggestion = resolveSpaceSuggestion({
      spaces: [work, life],
      activeSpaceId: work.id,
      rules: [],
      now: new Date('2026-02-23T10:00:00'),
      activeDomain: 'github.com',
    });

    expect(suggestion?.spaceId).toBe(life.id);
    expect(suggestion?.canRememberDomain).toBe(true);
  });
});
