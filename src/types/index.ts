// ─────────────────────────────────────────────
// Core domain types for NHS Shift Planner
// ─────────────────────────────────────────────

export type ShiftStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'sick'
  | 'annual_leave'
  | 'swapped_out'
  | 'swapped_in';

export type PayPeriodType =
  | 'weekly'
  | 'fortnightly'
  | 'monthly_4week'
  | 'monthly_calendar';

export type DarkModePreference = 0 | 1 | 2; // 0=system, 1=dark, 2=light

export type BankHolidayRegion =
  | 'england-and-wales'
  | 'scotland'
  | 'northern-ireland';

export type JobRole =
  | 'nurse_midwife'
  | 'doctor'
  | 'hca_porter'
  | 'ahp'
  | 'admin'
  | 'other';

// ─────────────────────────────────────────────
// Database row types (match SQLite schema)
// ─────────────────────────────────────────────

export interface User {
  id: string;
  email: string | null;
  display_name: string | null;
  nhs_trust: string | null;
  job_role: JobRole | null;
  contracted_hours: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ShiftType {
  id: string;
  user_id: string;
  name: string;
  colour_hex: string;
  default_duration_hours: number | null;
  is_paid: 1 | 0;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Shift {
  id: string;
  user_id: string;
  shift_type_id: string;
  start_datetime: string;
  end_datetime: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  is_bank_shift: 1 | 0;
  status: ShiftStatus;
  sync_version: number;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Reminder {
  id: string;
  shift_id: string;
  minutes_before: number;
  notification_id: string | null;
  is_sent: 1 | 0;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Settings {
  user_id: string;
  theme_primary_colour: string;
  theme_secondary_colour: string;
  dark_mode: DarkModePreference;
  default_reminder_minutes: number;
  pay_period_start_day: number;
  pay_period_type: PayPeriodType;
  widget_enabled: 1 | 0;
  cloud_sync_enabled: 1 | 0;
  last_bank_holiday_fetch: string | null;
  onboarding_complete: 1 | 0;
  updated_at: string;
}

export interface BankHoliday {
  id: string;
  date: string;
  name: string;
  region: BankHolidayRegion;
  created_at: string;
}

// ─────────────────────────────────────────────
// View/app layer types (enriched)
// ─────────────────────────────────────────────

export interface ShiftWithType extends Shift {
  shift_type: ShiftType;
}

export interface ShiftWithTypeAndReminders extends ShiftWithType {
  reminders: Reminder[];
}

export interface HoursSummary {
  total_minutes: number;
  bank_minutes: number;
  contracted_minutes: number | null;
  shifts: ShiftWithType[];
  breakdown: Array<{ type_name: string; colour_hex: string; minutes: number }>;
}

export interface WeekDayInfo {
  date: Date;
  dateString: string; // YYYY-MM-DD
  shifts: ShiftWithType[];
  isToday: boolean;
  isSelected: boolean;
}

// ─────────────────────────────────────────────
// Form types
// ─────────────────────────────────────────────

export interface AddShiftFormData {
  shift_type_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  location: string;
  notes: string;
  is_bank_shift: boolean;
  reminders: Array<{ minutes_before: number }>;
}

// ─────────────────────────────────────────────
// Navigation types
// ─────────────────────────────────────────────

export type RootStackParamList = {
  Onboarding: undefined;
  MainApp: undefined;
};

export type OnboardingStackParamList = {
  OnboardingWelcome: undefined;
  OnboardingSetup: undefined;
  OnboardingPermissions: undefined;
  OnboardingDone: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  CalendarTab: undefined;
  HoursTab: undefined;
  MoreTab: undefined;
};

export type HomeStackParamList = {
  Dashboard: undefined;
  ShiftDetail: { shiftId: string };
};

export type CalendarStackParamList = {
  Calendar: { initialDate?: string };
  ShiftDetail: { shiftId: string };
};

export type HoursStackParamList = {
  HoursSummary: undefined;
  ShiftDetail: { shiftId: string };
};

export type MoreStackParamList = {
  More: undefined;
  ShiftHistory: undefined;
  ShiftDetail: { shiftId: string };
  Settings: undefined;
  NotificationSettings: undefined;
  ShiftTypesSettings: undefined;
  PayPeriodSettings: undefined;
  AccountSettings: undefined;
};

export type AddShiftModalParamList = {
  AddEditShift: { shiftId?: string; initialDate?: string };
};
