import { Space, SpaceDomainRule, SpaceRule, SpaceTimeRule } from '../types';

export interface SpaceSuggestion {
  spaceId: string;
  reason: 'domain' | 'time';
  domain?: string;
  ruleId?: string;
  canRememberDomain: boolean;
}

export const isMinuteInQuietHours = (minute: number, startMinute: number, endMinute: number): boolean => {
  if (startMinute === endMinute) return false;
  if (startMinute < endMinute) {
    return minute >= startMinute && minute < endMinute;
  }
  return minute >= startMinute || minute < endMinute;
};

const hasUrl = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const extractDomainFromUrl = (url: string): string | null => {
  if (!hasUrl(url)) return null;
  try {
    const parsed = new URL(url);
    return normalizeDomain(parsed.hostname);
  } catch {
    return null;
  }
};

export const normalizeDomain = (domain: string): string =>
  domain.trim().toLowerCase().replace(/^\.+/, '').replace(/\.+$/, '');

const matchesDomain = (ruleDomain: string, activeDomain: string): boolean => {
  const normalizedRuleDomain = normalizeDomain(ruleDomain);
  const normalizedActiveDomain = normalizeDomain(activeDomain);

  if (!normalizedRuleDomain || !normalizedActiveDomain) return false;
  return (
    normalizedActiveDomain === normalizedRuleDomain ||
    normalizedActiveDomain.endsWith(`.${normalizedRuleDomain}`)
  );
};

export const isTimeRuleActive = (rule: SpaceTimeRule, at: Date): boolean => {
  if (!rule.enabled) return false;
  if (!rule.days.includes(at.getDay())) return false;

  const minute = at.getHours() * 60 + at.getMinutes();
  if (rule.startMinute === rule.endMinute) return true;
  if (rule.startMinute < rule.endMinute) {
    return minute >= rule.startMinute && minute < rule.endMinute;
  }
  return minute >= rule.startMinute || minute < rule.endMinute;
};

const inferSpaceByDomain = (activeDomain: string, spaces: Space[], activeSpaceId: string): string | null => {
  for (const space of spaces) {
    if (space.id === activeSpaceId) continue;

    const matched = (space.apps || []).some((app) => {
      if (app.type === 'folder' && app.items) {
        return app.items.some((subItem) => {
          const domain = extractDomainFromUrl(subItem.url || '');
          return domain ? matchesDomain(domain, activeDomain) : false;
        });
      }
      const domain = extractDomainFromUrl(app.url || '');
      return domain ? matchesDomain(domain, activeDomain) : false;
    });

    if (matched) return space.id;
  }
  return null;
};

export const resolveSpaceSuggestion = (input: {
  spaces: Space[];
  activeSpaceId: string;
  rules: SpaceRule[];
  now: Date;
  activeDomain: string | null;
}): SpaceSuggestion | null => {
  const { spaces, activeSpaceId, rules, now, activeDomain } = input;
  const enabledRules = rules.filter((rule) => rule.enabled);

  if (activeDomain) {
    const domainRule = enabledRules.find((rule): rule is SpaceDomainRule => (
      rule.type === 'domain' &&
      rule.spaceId !== activeSpaceId &&
      matchesDomain(rule.domain, activeDomain)
    ));
    if (domainRule) {
      return {
        spaceId: domainRule.spaceId,
        reason: 'domain',
        domain: normalizeDomain(activeDomain),
        ruleId: domainRule.id,
        canRememberDomain: false,
      };
    }

    const inferredSpaceId = inferSpaceByDomain(activeDomain, spaces, activeSpaceId);
    if (inferredSpaceId) {
      return {
        spaceId: inferredSpaceId,
        reason: 'domain',
        domain: normalizeDomain(activeDomain),
        canRememberDomain: true,
      };
    }
  }

  const timeRule = enabledRules.find((rule): rule is SpaceTimeRule => (
    rule.type === 'time' &&
    rule.spaceId !== activeSpaceId &&
    isTimeRuleActive(rule, now)
  ));

  if (!timeRule) return null;
  return {
    spaceId: timeRule.spaceId,
    reason: 'time',
    ruleId: timeRule.id,
    canRememberDomain: false,
  };
};

export const createDefaultTimeRule = (spaceId: string): SpaceTimeRule => ({
  id: `space_rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  type: 'time',
  spaceId,
  enabled: true,
  days: [1, 2, 3, 4, 5],
  startMinute: 9 * 60,
  endMinute: 18 * 60,
});

export const createDomainRule = (spaceId: string, domain: string): SpaceDomainRule => ({
  id: `space_rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  type: 'domain',
  spaceId,
  enabled: true,
  domain: normalizeDomain(domain),
});

export const summarizeSpaceRule = (
  rule: SpaceRule,
  language: 'zh' | 'en',
  spaceName?: string
): string => {
  const scope = spaceName ? `${spaceName} · ` : '';
  if (rule.type === 'domain') {
    return language === 'zh'
      ? `${scope}域名 ${rule.domain}`
      : `${scope}Domain ${rule.domain}`;
  }

  const pad = (value: number) => value.toString().padStart(2, '0');
  const toTime = (minute: number) => `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
  return language === 'zh'
    ? `${scope}时间 ${toTime(rule.startMinute)}-${toTime(rule.endMinute)}`
    : `${scope}Time ${toTime(rule.startMinute)}-${toTime(rule.endMinute)}`;
};

export const getActiveTabDomain = async (): Promise<string | null> => {
  const chromeApi = (globalThis as typeof globalThis & { chrome?: any }).chrome;
  if (!chromeApi || !chromeApi.tabs?.query || !chromeApi.permissions?.contains) {
    return null;
  }

  const hasPermission = await new Promise<boolean>((resolve) => {
    chromeApi.permissions.contains({ permissions: ['tabs'] }, (granted: boolean) => {
      if (chromeApi.runtime?.lastError) {
        resolve(false);
        return;
      }
      resolve(Boolean(granted));
    });
  });
  if (!hasPermission) return null;

  const tabUrl = await new Promise<string | null>((resolve) => {
    chromeApi.tabs.query(
      { active: true, lastFocusedWindow: true },
      (tabs: Array<{ url?: string }> = []) => {
        if (chromeApi.runtime?.lastError || !tabs.length) {
          resolve(null);
          return;
        }
        resolve(tabs[0].url || null);
      }
    );
  });

  return tabUrl ? extractDomainFromUrl(tabUrl) : null;
};
