import { create } from 'zustand';

export type SnackbarVariant = 'default' | 'success' | 'error' | 'warning';

export interface SnackbarConfig {
  id: string;
  message: string;
  variant: SnackbarVariant;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

interface UIStoreState {
  selectedDate: string | null; // YYYY-MM-DD
  activeModal: 'addShift' | 'editShift' | null;
  editingShiftId: string | null;
  snackbarQueue: SnackbarConfig[];
  isOffline: boolean;
  notificationsGranted: boolean | null;

  // Actions
  setSelectedDate: (date: string | null) => void;
  openAddShift: (initialDate?: string) => void;
  openEditShift: (shiftId: string) => void;
  closeModal: () => void;
  showSnackbar: (config: Omit<SnackbarConfig, 'id'>) => void;
  dismissSnackbar: (id: string) => void;
  setOffline: (isOffline: boolean) => void;
  setNotificationsGranted: (granted: boolean) => void;
}

let snackbarIdCounter = 0;

export const useUIStore = create<UIStoreState>((set, get) => ({
  selectedDate: null,
  activeModal: null,
  editingShiftId: null,
  snackbarQueue: [],
  isOffline: false,
  notificationsGranted: null,

  setSelectedDate: (date) => set({ selectedDate: date }),

  openAddShift: (initialDate) => {
    set({
      activeModal: 'addShift',
      editingShiftId: null,
      selectedDate: initialDate ?? get().selectedDate,
    });
  },

  openEditShift: (shiftId) => {
    set({ activeModal: 'editShift', editingShiftId: shiftId });
  },

  closeModal: () => {
    set({ activeModal: null, editingShiftId: null });
  },

  showSnackbar: (config) => {
    const id = `snackbar-${++snackbarIdCounter}`;
    set(state => ({
      snackbarQueue: [...state.snackbarQueue.slice(-2), { ...config, id }],
    }));
  },

  dismissSnackbar: (id) => {
    set(state => ({
      snackbarQueue: state.snackbarQueue.filter(s => s.id !== id),
    }));
  },

  setOffline: (isOffline) => set({ isOffline }),

  setNotificationsGranted: (granted) => set({ notificationsGranted: granted }),
}));
