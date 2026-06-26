import { NoteReminder } from '../types';

export type ReminderStatus = 'none' | 'upcoming' | 'today' | 'overdue';

/**
 * Builds a Firestore-safe reminder object. Undefined timestamps are dropped
 * entirely (never stored as `undefined`, which Firestore rejects in nested
 * maps and `cleanUndefined` does not strip). When a range is given out of
 * order, the bounds are swapped so `start <= due` always holds.
 *
 * Returns `undefined` when no valid date is present, signalling the note has
 * no reminder and the field should be omitted from the payload.
 */
export const buildReminder = (start?: number | null, due?: number | null): NoteReminder | undefined => {
  const validStart = isValidTimestamp(start) ? start : undefined;
  const validDue = isValidTimestamp(due) ? due : undefined;

  if (validStart === undefined && validDue === undefined) return undefined;

  // A lone start with no due is promoted to a single-date reminder.
  if (validStart !== undefined && validDue === undefined) {
    return { due: validStart };
  }

  if (validStart === undefined) {
    return { due: validDue };
  }

  // Both present: guarantee chronological order.
  const [orderedStart, orderedDue] = validStart <= validDue! ? [validStart, validDue!] : [validDue!, validStart];
  return orderedStart === orderedDue ? { due: orderedDue } : { start: orderedStart, due: orderedDue };
};

const isValidTimestamp = (value?: number | null): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Classifies a reminder relative to `now`, using calendar-day boundaries so a
 * reminder counts as "today" for the whole day regardless of its time.
 */
export const getReminderStatus = (reminder?: NoteReminder, now: number = Date.now()): ReminderStatus => {
  if (!reminder || !isValidTimestamp(reminder.due)) return 'none';

  const dueDayEnd = endOfDay(reminder.due);
  if (now > dueDayEnd) return 'overdue';

  const dueDayStart = startOfDay(reminder.due);
  if (now >= dueDayStart) return 'today';

  return 'upcoming';
};

const startOfDay = (timestamp: number): number => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const endOfDay = (timestamp: number): number => {
  const date = new Date(timestamp);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
};

/** Whether the reminder spans a range (distinct start and due dates). */
export const isReminderRange = (reminder?: NoteReminder): boolean =>
  !!reminder && isValidTimestamp(reminder.start) && isValidTimestamp(reminder.due);

/** Formats a timestamp as dd/mm/yy. */
const formatDayMonthYear = (timestamp: number): string => {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

/** Compact label for the card seal, e.g. "26/06/25" or "26/06/25 – 30/06/25". */
export const formatReminderShort = (reminder?: NoteReminder): string => {
  if (!reminder || !isValidTimestamp(reminder.due)) return '';

  const datePart = formatDayMonthYear(reminder.due);

  if (isReminderRange(reminder)) {
    return `${formatDayMonthYear(reminder.start!)} – ${datePart}`;
  }

  return datePart;
};
