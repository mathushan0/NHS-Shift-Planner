import { create } from 'zustand';
import { Settings, PayPeriodType, DarkModePreference, JobRole } from '../types';
import * as settingsRepo from '../database/repositories/settingsRepository';

interface SettingsStoreState {
  settings: Settings | null;
  userId: string | null;
  displayName: string | null;
  jobRole: JobRole | null;
  contractedHoursPerWeek: number | null;
  isLoading: boolean;

  // Actions
  initialize: (userId: string) => Promise<void>;
  updateSettings: (data: Partial<Omit<Settings, 'user_id' | 'updated_at'>>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  setDarkMode: (mode: DarkModePreference) => Promise<void>;
  setPayPeriod: (type: PayPeriodType, startDay: number) => Promise<void>;
  setContractedHours: (hours: number) => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  settings: null,
  userId: null,
  displayName: null,
  jobRole: null,
  contractedHoursPerWeek: null,
  isLoading: false,

  initialize: async (userId: string) => {
    set({ isLoading: true, userId });
    try {
      const settings = await settingsRepo.getSettings(userId);
      // Load persisted user fields (display_name, contracted_hours)
      const db = (await import('../database/db')).getDatabase();
      const user = await db.getFirstAsync<{ display_name: string | null; contracted_hours: number | null }>(
        `SELECT display_name, contracted_hours FROM users WHERE id = ?`,
        [userId]
      );
      set({
        settings,
        displayName: user?.display_name ?? null,
        contractedHoursPerWeek: user?.contracted_hours ?? null,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  updateSettings: async (data) => {
    const { userId } = get();
    if (!userId) return;

    const updated = await settingsRepo.updateSettings(userId, data);
    set({ settings: updated });
  },

  completeOnboarding: async () => {
    const { userId } = get();
    if (!userId) return;
    await settingsRepo.setOnboardingComplete(userId);
    const updated = await settingsRepo.getSettings(userId);
    set({ settings: updated });
  },

  setDarkMode: async (mode: DarkModePreference) => {
    await get().updateSettings({ dark_mode: mode });
  },

  setPayPeriod: async (type: PayPeriodType, startDay: number) => {
    await get().updateSettings({ pay_period_type: type, pay_period_start_day: startDay });
  },

  setContractedHours: async (hours: number) => {
    set({ contractedHoursPerWeek: hours });
    const { userId } = get();
    if (userId) {
      const db = (await import('../database/db')).getDatabase();
      await db.runAsync(
        `UPDATE users SET contracted_hours = ?, updated_at = ? WHERE id = ?`,
        [hours, new Date().toISOString(), userId]
      );
    }
  },

  setDisplayName: async (name: string) => {
    set({ displayName: name });
    const { userId } = get();
    if (userId) {
      const db = (await import('../database/db')).getDatabase();
      await db.runAsync(
        `UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?`,
        [name, new Date().toISOString(), userId]
      );
    }
  },
}));
