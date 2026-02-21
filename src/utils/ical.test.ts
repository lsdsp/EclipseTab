import { describe, expect, it } from 'vitest';
import { parseICalendarEvents } from './ical';

describe('parseICalendarEvents', () => {
  it('parses upcoming timed and all-day events', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:evt-1',
      'SUMMARY:Daily Standup',
      'DTSTART:20260221T080000Z',
      'DTEND:20260221T083000Z',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:evt-2',
      'SUMMARY:Holiday',
      'DTSTART;VALUE=DATE:20260222',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseICalendarEvents(ics, Date.UTC(2026, 1, 21, 0, 0, 0));
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe('Daily Standup');
    expect(events[0].allDay).toBe(false);
    expect(events[1].title).toBe('Holiday');
    expect(events[1].allDay).toBe(true);
  });

  it('ignores invalid event blocks and keeps result sorted', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:No start',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'SUMMARY:Second',
      'DTSTART:20260223T100000Z',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'SUMMARY:First',
      'DTSTART:20260222T100000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');

    const events = parseICalendarEvents(ics, Date.UTC(2026, 1, 21, 0, 0, 0));
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe('First');
    expect(events[1].title).toBe('Second');
  });
});
