export interface ParsedICalendarEvent {
  id: string;
  title: string;
  startAt: number;
  endAt?: number;
  allDay: boolean;
}

interface ParsedDateResult {
  timestamp: number;
  allDay: boolean;
}

const unfoldIcsLines = (icsText: string): string[] => {
  const lines = icsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const unfolded: string[] = [];

  lines.forEach((line) => {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
      return;
    }
    unfolded.push(line);
  });

  return unfolded;
};

const parseIcsDate = (rawValue: string, forceAllDay: boolean): ParsedDateResult | null => {
  const value = rawValue.trim();

  if (forceAllDay || /^\d{8}$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6));
    const day = Number(value.slice(6, 8));
    const timestamp = new Date(year, month - 1, day).getTime();
    return Number.isNaN(timestamp) ? null : { timestamp, allDay: true };
  }

  const dateTimeMatch = value.match(/^(\d{8})T(\d{6})(Z?)$/);
  if (!dateTimeMatch) return null;

  const datePart = dateTimeMatch[1];
  const timePart = dateTimeMatch[2];
  const isUtc = dateTimeMatch[3] === 'Z';

  const year = Number(datePart.slice(0, 4));
  const month = Number(datePart.slice(4, 6));
  const day = Number(datePart.slice(6, 8));
  const hour = Number(timePart.slice(0, 2));
  const minute = Number(timePart.slice(2, 4));
  const second = Number(timePart.slice(4, 6));

  const timestamp = isUtc
    ? Date.UTC(year, month - 1, day, hour, minute, second)
    : new Date(year, month - 1, day, hour, minute, second).getTime();

  if (Number.isNaN(timestamp)) return null;
  return { timestamp, allDay: false };
};

const unescapeIcsText = (value: string): string =>
  value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');

const toUniqueEventId = (uid: string | undefined, startAt: number, fallbackIndex: number): string => {
  if (uid && uid.trim()) return uid.trim();
  return `event-${startAt}-${fallbackIndex}`;
};

export const parseICalendarEvents = (icsText: string, nowMs: number): ParsedICalendarEvent[] => {
  const lines = unfoldIcsLines(icsText);
  const events: ParsedICalendarEvent[] = [];
  let inEvent = false;
  let current: {
    uid?: string;
    summary?: string;
    dtStart?: ParsedDateResult;
    dtEnd?: ParsedDateResult;
  } = {};

  const flushEvent = () => {
    if (!current.dtStart) {
      current = {};
      return;
    }

    const title = current.summary?.trim() || 'Untitled';
    const event: ParsedICalendarEvent = {
      id: toUniqueEventId(current.uid, current.dtStart.timestamp, events.length),
      title,
      startAt: current.dtStart.timestamp,
      endAt: current.dtEnd?.timestamp,
      allDay: current.dtStart.allDay,
    };
    if (event.endAt && event.endAt < event.startAt) {
      delete event.endAt;
    }
    events.push(event);
    current = {};
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      return;
    }
    if (trimmed === 'END:VEVENT') {
      inEvent = false;
      flushEvent();
      return;
    }
    if (!inEvent) return;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) return;
    const rawKey = trimmed.slice(0, colonIndex);
    const rawValue = trimmed.slice(colonIndex + 1);

    const keyParts = rawKey.split(';');
    const key = keyParts[0].toUpperCase();
    const params = keyParts.slice(1).map((part) => part.toUpperCase());
    const isAllDay = params.some((param) => param === 'VALUE=DATE');

    if (key === 'UID') {
      current.uid = rawValue.trim();
      return;
    }
    if (key === 'SUMMARY') {
      current.summary = unescapeIcsText(rawValue);
      return;
    }
    if (key === 'DTSTART') {
      current.dtStart = parseIcsDate(rawValue, isAllDay) ?? undefined;
      return;
    }
    if (key === 'DTEND') {
      current.dtEnd = parseIcsDate(rawValue, isAllDay) ?? undefined;
    }
  });

  const oneDay = 24 * 60 * 60 * 1000;
  return events
    .filter((event) => (event.endAt ?? event.startAt) >= nowMs - oneDay)
    .sort((a, b) => a.startAt - b.startAt)
    .slice(0, 20);
};
