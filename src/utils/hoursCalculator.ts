import { ShiftWithType, HoursSummary } from '../types';
import { format, parseISO, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';

export function calculateHoursSummary(
  shifts: ShiftWithType[],
  contractedHoursPerWeek: number | null,
  startDate: Date,
  endDate: Date
): HoursSummary {
  const paidShifts = shifts.filter(s => s.shift_type.is_paid === 1);
  const bankShifts = shifts.filter(s => s.is_bank_shift === 1 && s.shift_type.is_paid === 1);

  const totalMinutes = paidShifts.reduce((acc, s) => acc + s.duration_minutes, 0);
  const bankMinutes = bankShifts.reduce((acc, s) => acc + s.duration_minutes, 0);

  // Contracted hours scaled to the period
  let contractedMinutes: number | null = null;
  if (contractedHoursPerWeek !== null) {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const weeks = days / 7;
    contractedMinutes = Math.round(contractedHoursPerWeek * 60 * weeks);
  }

  // Group by shift type for breakdown
  const typeMap = new Map<string, { type_name: string; colour_hex: string; minutes: number }>();
  for (const shift of paidShifts) {
    const key = shift.shift_type_id;
    const existing = typeMap.get(key);
    if (existing) {
      existing.minutes += shift.duration_minutes;
    } else {
      typeMap.set(key, {
        type_name: shift.shift_type.name,
        colour_hex: shift.shift_type.colour_hex,
        minutes: shift.duration_minutes,
      });
    }
  }

  return {
    total_minutes: totalMinutes,
    bank_minutes: bankMinutes,
    contracted_minutes: contractedMinutes,
    shifts,
    breakdown: Array.from(typeMap.values()).sort((a, b) => b.minutes - a.minutes),
  };
}

export function getHoursStatusColor(
  totalMinutes: number,
  contractedMinutes: number | null,
  colors: { success: string; warning: string; error: string; textSecondary: string }
): string {
  if (contractedMinutes === null) return colors.textSecondary;
  const ratio = totalMinutes / contractedMinutes;
  if (ratio > 1.05) return colors.error;
  if (ratio > 0.9) return colors.success;
  return colors.textSecondary;
}

export function getProgressBarWidth(
  totalMinutes: number,
  contractedMinutes: number | null
): number {
  if (!contractedMinutes) return 0;
  return Math.min(totalMinutes / contractedMinutes, 1);
}

// Get per-day hours for bar chart (weekly view)
export function getDailyHoursData(
  shifts: ShiftWithType[],
  startDate: Date,
  endDate: Date
): number[] {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  return days.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayShifts = shifts.filter(s => {
      const shiftDate = format(parseISO(s.start_datetime), 'yyyy-MM-dd');
      return shiftDate === dayStr && s.shift_type.is_paid === 1;
    });
    return dayShifts.reduce((acc, s) => acc + s.duration_minutes / 60, 0);
  });
}

// Get per-week hours for bar chart (monthly view)
export function getWeeklyHoursData(
  shifts: ShiftWithType[],
  startDate: Date,
  weekCount: number = 4
): number[] {
  const data: number[] = [];
  for (let i = 0; i < weekCount; i++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekShifts = shifts.filter(s => {
      const d = parseISO(s.start_datetime);
      return d >= weekStart && d <= weekEnd && s.shift_type.is_paid === 1;
    });
    data.push(weekShifts.reduce((acc, s) => acc + s.duration_minutes / 60, 0));
  }
  return data;
}

export function minutesToHoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
