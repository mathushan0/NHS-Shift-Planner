import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addMonths,
  differenceInMinutes,
  isToday,
  isSameDay,
  eachDayOfInterval,
  getDay,
} from 'date-fns';
import { PayPeriodType } from '../types';

// ─── Formatting ──────────────────────────────────────────────

export function formatDate(date: Date | string, pattern: string = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern);
}

export function formatTime(date: Date | string, use24h: boolean = false): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, use24h ? 'HH:mm' : 'h:mm a');
}

export function formatDatetime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "EEE d MMM · HH:mm");
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function toDatetimeString(date: Date): string {
  return date.toISOString();
}

export function combineDateAndTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function getTimeFromDatetime(datetime: string): string {
  return format(parseISO(datetime), 'HH:mm');
}

export function getDateFromDatetime(datetime: string): string {
  return format(parseISO(datetime), 'yyyy-MM-dd');
}

// ─── Duration Calculation ─────────────────────────────────────

export function calculateDurationMinutes(start: Date, end: Date): number {
  return differenceInMinutes(end, start);
}

export function doesSpanTwoDays(start: Date, end: Date): boolean {
  return !isSameDay(start, end);
}

// ─── Pay Period ───────────────────────────────────────────────

export interface DateRange {
  start: Date;
  end: Date;
}

export function getCurrentPayPeriod(
  type: PayPeriodType,
  startDay: number = 1 // ISO weekday 1=Mon
): DateRange {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: (startDay - 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6 });

  switch (type) {
    case 'weekly':
      return {
        start: weekStart,
        end: endOfWeek(now, { weekStartsOn: (startDay - 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6 }),
      };

    case 'fortnightly':
      return {
        start: weekStart,
        end: endOfWeek(addWeeks(weekStart, 1), { weekStartsOn: (startDay - 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6 }),
      };

    case 'monthly_4week':
      return {
        start: weekStart,
        end: endOfWeek(addWeeks(weekStart, 3), { weekStartsOn: (startDay - 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6 }),
      };

    case 'monthly_calendar':
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      };
  }
}

export function getWeekRange(date: Date = new Date()): DateRange {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

export function getMonthRange(date: Date = new Date()): DateRange {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}

// ─── Calendar ─────────────────────────────────────────────────

export function getWeekDays(referenceDate: Date = new Date()): Date[] {
  const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

export function getMonthCalendarDays(year: number, month: number): Date[] {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(new Date(year, month - 1));

  // Include leading days from prev month to fill first week
  const calStart = startOfWeek(start, { weekStartsOn: 1 });
  // Include trailing days from next month to fill last week
  const calEnd = endOfWeek(end, { weekStartsOn: 1 });

  return eachDayOfInterval({ start: calStart, end: calEnd });
}

export function isDayToday(date: Date): boolean {
  return isToday(date);
}

// ─── Greeting ─────────────────────────────────────────────────

export function getGreeting(name?: string | null): string {
  const hour = new Date().getHours();
  let greeting: string;

  if (hour >= 5 && hour < 12) {
    greeting = 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon';
  } else {
    greeting = 'Good evening';
  }

  return name ? `${greeting}, ${name}` : greeting;
}

// ─── Bar chart data helpers ───────────────────────────────────

export function getDayLabels(startDate: Date, count: number = 7): string[] {
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    labels.push(format(d, 'EEE')[0]); // M, T, W, T, F, S, S
  }
  return labels;
}

export function getWeekLabels(startDate: Date, count: number = 4): string[] {
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    labels.push(`W${i + 1}`);
  }
  return labels;
}
