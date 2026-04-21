import { create } from 'zustand';
import { Shift, ShiftWithType, ShiftWithTypeAndReminders, ShiftStatus } from '../types';
import * as shiftRepo from '../database/repositories/shiftRepository';
import * as reminderRepo from '../database/repositories/reminderRepository';
import { scheduleShiftReminders, cancelShiftReminders } from '../services/notifications';

interface ShiftStoreState {
  shifts: ShiftWithType[];
  upcomingShifts: ShiftWithType[];
  selectedShift: ShiftWithTypeAndReminders | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadUpcomingShifts: (userId: string) => Promise<void>;
  loadShiftsForDateRange: (userId: string, start: string, end: string) => Promise<ShiftWithType[]>;
  loadShiftById: (shiftId: string) => Promise<ShiftWithTypeAndReminders | null>;
  createShift: (
    userId: string,
    data: Omit<Shift, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'sync_version' | 'synced_at'>
  ) => Promise<Shift>;
  updateShift: (shiftId: string, data: Partial<Shift>, reminderMinutes?: number[]) => Promise<void>;
  deleteShift: (shiftId: string) => Promise<void>;
  undoDeleteShift: (shift: Shift) => Promise<void>;
  updateStatus: (shiftId: string, status: ShiftStatus) => Promise<void>;
  checkOverlap: (userId: string, start: string, end: string, excludeId?: string) => Promise<ShiftWithType[]>;
  clearSelectedShift: () => void;
  clearError: () => void;
}

export const useShiftStore = create<ShiftStoreState>((set, get) => ({
  shifts: [],
  upcomingShifts: [],
  selectedShift: null,
  isLoading: false,
  error: null,

  loadUpcomingShifts: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const upcoming = await shiftRepo.getUpcomingShifts(userId, 20);
      set({ upcomingShifts: upcoming, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  loadShiftsForDateRange: async (userId: string, start: string, end: string) => {
    try {
      const shifts = await shiftRepo.getShiftsForDateRange(userId, start, end);
      set({ shifts });
      return shifts;
    } catch (e) {
      set({ error: (e as Error).message });
      return [];
    }
  },

  loadShiftById: async (shiftId: string) => {
    try {
      const shift = await shiftRepo.getShiftById(shiftId);
      if (!shift) return null;

      const shiftType = await import('../database/repositories/shiftTypeRepository').then(m =>
        m.getShiftTypeById(shift.shift_type_id)
      );
      const reminders = await reminderRepo.getRemindersForShift(shiftId);

      if (!shiftType) return null;

      const enriched: ShiftWithTypeAndReminders = {
        ...shift,
        shift_type: shiftType,
        reminders,
      };
      set({ selectedShift: enriched });
      return enriched;
    } catch (e) {
      set({ error: (e as Error).message });
      return null;
    }
  },

  createShift: async (userId, data) => {
    set({ isLoading: true, error: null });
    try {
      const shift = await shiftRepo.createShift(data);
      await get().loadUpcomingShifts(userId);
      set({ isLoading: false });
      return shift;
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },

  updateShift: async (shiftId, data, reminderMinutes) => {
    set({ isLoading: true, error: null });
    try {
      await shiftRepo.updateShift(shiftId, data);

      if (reminderMinutes !== undefined) {
        // Cancel old reminders and reschedule
        const oldReminders = await reminderRepo.getRemindersForShift(shiftId);
        await cancelShiftReminders(oldReminders);
        await reminderRepo.softDeleteRemindersForShift(shiftId);

        const updatedShift = await shiftRepo.getShiftById(shiftId);
        if (updatedShift && reminderMinutes.length > 0) {
          await scheduleShiftReminders(updatedShift, reminderMinutes);
        }
      }

      if (data.user_id) {
        await get().loadUpcomingShifts(data.user_id);
      }
      set({ isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },

  deleteShift: async (shiftId: string) => {
    try {
      const reminders = await reminderRepo.getRemindersForShift(shiftId);
      await cancelShiftReminders(reminders);
      await reminderRepo.softDeleteRemindersForShift(shiftId);
      await shiftRepo.softDeleteShift(shiftId);
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    }
  },

  undoDeleteShift: async (shift: Shift) => {
    const db = (await import('../database/db')).getDatabase();
    await db.runAsync(
      `UPDATE shifts SET deleted_at = NULL, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), shift.id]
    );
    // Restore soft-deleted reminders for this shift
    await db.runAsync(
      `UPDATE reminders SET deleted_at = NULL, updated_at = ? WHERE shift_id = ?`,
      [new Date().toISOString(), shift.id]
    );
    // Reschedule notifications for restored reminders
    const restoredReminders = await reminderRepo.getRemindersForShift(shift.id);
    if (restoredReminders.length > 0) {
      const minutesBefore = restoredReminders.map(r => r.minutes_before);
      await scheduleShiftReminders(shift, minutesBefore);
    }
  },

  updateStatus: async (shiftId, status) => {
    try {
      await shiftRepo.updateShiftStatus(shiftId, status);
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  checkOverlap: async (userId, start, end, excludeId) => {
    return shiftRepo.checkOverlap(userId, start, end, excludeId);
  },

  clearSelectedShift: () => set({ selectedShift: null }),
  clearError: () => set({ error: null }),
}));
