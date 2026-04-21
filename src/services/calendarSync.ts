// @ts-nocheck — V2 cloud sync: requires supabase, not active in MVP build
/**
 * calendarSync.ts — Export shifts to iOS/Android device calendar.
 * Uses expo-calendar.
 *
 * Install: npx expo install expo-calendar
 */

import { Platform, Alert } from 'react-native';
import * as Calendar from 'expo-calendar';
import { format } from 'date-fns';
import { ShiftWithType } from '../types';

const CALENDAR_NAME = 'MyShifts';
const CALENDAR_COLOR = '#005EB8'; // NHS blue

// ─── Permission helpers ────────────────────────────────────────────────────────

export async function requestCalendarPermissions(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

// ─── Calendar management ──────────────────────────────────────────────────────

async function getOrCreateMyShiftsCalendar(): Promise<string> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = calendars.find(c => c.title === CALENDAR_NAME);
  if (existing) return existing.id;

  // Create new calendar
  let sourceId: string;

  if (Platform.OS === 'ios') {
    // Use the default local calendar source on iOS
    const sources = await Calendar.getSourcesAsync();
    const localSource = sources.find(s => s.type === Calendar.SourceType.LOCAL)
      ?? sources[0];
    if (!localSource) throw new Error('No calendar source available');
    sourceId = localSource.id;
  } else {
    // Android: find a local writable source
    const sources = await Calendar.getSourcesAsync();
    const localSource = sources.find(s => s.type === 'local') ?? sources[0];
    if (!localSource) throw new Error('No calendar source available');
    sourceId = localSource.id;
  }

  const calendarId = await Calendar.createCalendarAsync({
    title: CALENDAR_NAME,
    color: CALENDAR_COLOR,
    entityType: Calendar.EntityTypes.EVENT,
    sourceId,
    source: { isLocalAccount: true, name: CALENDAR_NAME, type: Calendar.SourceType.LOCAL },
    name: CALENDAR_NAME,
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });

  return calendarId;
}

// ─── Shift → Calendar event ────────────────────────────────────────────────────

function shiftToEventDetails(shift: ShiftWithType): Omit<Calendar.Event, 'id' | 'calendarId'> {
  const startDate = new Date(shift.start_datetime);
  const endDate = new Date(shift.end_datetime);
  const hours = Math.round(shift.duration_minutes / 60 * 10) / 10;
  const typeName = shift.shift_type.name;
  const abbrev = shift.shift_type.abbreviation || typeName.slice(0, 2).toUpperCase();

  const title = `[${abbrev}] ${typeName}${shift.is_bank_shift ? ' (Bank)' : ''}`;
  const notes = [
    `MyShifts — ${typeName}`,
    `Duration: ${hours}h`,
    shift.location ? `Location: ${shift.location}` : null,
    shift.notes ? `Notes: ${shift.notes}` : null,
    shift.is_bank_shift ? 'Bank / agency shift' : null,
  ].filter(Boolean).join('\n');

  return {
    title,
    startDate,
    endDate,
    notes,
    location: shift.location ?? undefined,
    alarms: [{ relativeOffset: -60 }], // 1 hour reminder
    availability: Calendar.Availability.BUSY,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    allowsModification: true,
    color: shift.shift_type.colour_hex,
  } as any;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type SyncResult = {
  synced: number;
  skipped: number;
  errors: number;
};

/**
 * Sync an array of shifts to the device MyShifts calendar.
 * Checks for existing events by matching title+date to avoid duplicates.
 */
export async function syncShiftsToCalendar(shifts: ShiftWithType[]): Promise<SyncResult> {
  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) {
    throw new Error('Calendar permission denied. Please grant Calendar access in Settings.');
  }

  const calendarId = await getOrCreateMyShiftsCalendar();

  // Fetch existing events in the range to check for duplicates
  const minDate = new Date(Math.min(...shifts.map(s => new Date(s.start_datetime).getTime())));
  const maxDate = new Date(Math.max(...shifts.map(s => new Date(s.end_datetime).getTime())));

  const existingEvents = await Calendar.getEventsAsync([calendarId], minDate, maxDate);
  const existingTitlesAndDates = new Set(
    existingEvents.map(e => `${e.title}|${format(new Date(e.startDate as any), 'yyyy-MM-dd')}`)
  );

  let synced = 0, skipped = 0, errors = 0;

  for (const shift of shifts) {
    const details = shiftToEventDetails(shift);
    const key = `${details.title}|${format(new Date(shift.start_datetime), 'yyyy-MM-dd')}`;

    if (existingTitlesAndDates.has(key)) {
      skipped++;
      continue;
    }

    try {
      await Calendar.createEventAsync(calendarId, details);
      synced++;
    } catch (err) {
      console.warn('[CalendarSync] Failed to create event:', err);
      errors++;
    }
  }

  return { synced, skipped, errors };
}

/**
 * Remove all MyShifts calendar events in a date range.
 */
export async function clearCalendarRange(start: Date, end: Date): Promise<number> {
  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) throw new Error('Calendar permission denied');

  const calendarId = await getOrCreateMyShiftsCalendar();
  const events = await Calendar.getEventsAsync([calendarId], start, end);

  let removed = 0;
  for (const event of events) {
    try {
      await Calendar.deleteEventAsync(event.id);
      removed++;
    } catch {
      // ignore individual failures
    }
  }
  return removed;
}

/**
 * Get the MyShifts calendar ID (creates if doesn't exist).
 */
export async function getMyShiftsCalendarId(): Promise<string | null> {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) return null;
    return getOrCreateMyShiftsCalendar();
  } catch {
    return null;
  }
}
