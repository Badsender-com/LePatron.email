'use strict';

/**
 * The period `list_changes` reads (ADR 0031): from two ISO 8601 dates, in
 * UTC unless they say otherwise, or the last days by default. Only ISO 8601
 * is read, strictly: a day that is not one of the calendar (2026-02-31), a
 * month alone, or another form (11/16/2026) is refused, never guessed nor
 * read at the server's hour.
 */

const DAY_MS = 24 * 3600 * 1000;
const DEFAULT_DAYS = 7;

// A day, or a day and a time to the minute, second or millisecond, with an
// optional zone: `Z` or an offset.
const ISO_8601 = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-](\d{2}):(\d{2}))?)?$/;

const MAX_HOUR = 23;
const MAX_MINUTE = 59;

// Whether the day is one of the calendar: read back, it gives itself.
function isCalendarDay(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const inRange = (value, max) => value === undefined || Number(value) <= max;

/**
 * A date as given, in milliseconds, or null when it is no ISO 8601 date.
 *
 * @param {string} text
 * @param {{ endOfDay: boolean }} options whether a day alone is read to its
 *   last millisecond, for the end of a period
 * @returns {number|null}
 */
function dateOf(text, { endOfDay }) {
  const parts = ISO_8601.exec(text);
  if (!parts) return null;
  const [, year, month, day, hour, minute, second, zone, zoneH, zoneM] = parts;
  if (!isCalendarDay(Number(year), Number(month), Number(day))) return null;
  if (
    !inRange(hour, MAX_HOUR) ||
    !inRange(minute, MAX_MINUTE) ||
    !inRange(second, MAX_MINUTE) ||
    !inRange(zoneH, MAX_HOUR) ||
    !inRange(zoneM, MAX_MINUTE)
  ) {
    return null;
  }
  if (hour === undefined) {
    const start = Date.UTC(Number(year), Number(month) - 1, Number(day));
    return endOfDay ? start + DAY_MS - 1 : start;
  }
  // Without a zone, in UTC, as the tool says: never the server's hour.
  const at = Date.parse(zone ? text : `${text}Z`);
  return Number.isNaN(at) ? null : at;
}

const notADate = (text) =>
  `"${text}" is not an ISO 8601 date: give a day of the calendar, such as 2026-11-16, or a date-time, such as 2026-11-16T10:00:00Z.`;

/**
 * @param {{ since?: string, until?: string }} args
 * @returns {{ since: number, until: number } | { refused: string }} in
 *   milliseconds, both included
 */
function periodOf({ since, until }) {
  const end = until ? dateOf(until, { endOfDay: true }) : Date.now();
  if (end === null) return { refused: notADate(until) };
  const start = since
    ? dateOf(since, { endOfDay: false })
    : end - DEFAULT_DAYS * DAY_MS;
  if (start === null) return { refused: notADate(since) };
  if (start > end) {
    return {
      refused:
        'The period ends before it starts: since must come before until.',
    };
  }
  return { since: start, until: end };
}

module.exports = { periodOf, DEFAULT_DAYS };
