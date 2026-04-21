/**
 * syncIntegration.ts — Sync integration layer for Zustand stores.
 *
 * This module shows exactly how the existing stores should call sync, and
 * provides the syncStore that tracks sync status across the app.
 *
 * Usage pattern:
 *   1. Import useSyncStore in your component / screen.
 *   2. After any mutating store action, call triggerSync() if cloud sync is enabled.
 *   3. Mount <SyncController /> once in the app (e.g. in RootNavigator) to handle
 *      automatic sync triggers (foreground, reconnect, 15-min interval).
 *
 * The existing shiftStore and settingsStore do NOT need to be modified —
 * sync is triggered by the caller layer (screens / SyncController) after
 * mutations, keeping stores free of network concerns.
 */

import { create } from 'zustand';
import { useEffect, useRef } from 'react';
import { runSync, SyncResult } from './sync';
import { isAuthenticated, getActiveUserId } from './auth';
import { isSupabaseConfigured } from './supabase';
import { checkIsOnline } from '../hooks/useNetworkStatus';
import { useShiftStore } from '../stores/shiftStore';
import { useSettingsStore } from '../stores/settingsStore';

// ─── Sync Store ───────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface SyncStoreState {
  status: SyncStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  pushed: number;
  pulled: number;
  conflicts: number;

  // Actions
  setSyncing: () => void;
  setSyncResult: (result: SyncResult) => void;
  reset: () => void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  status: 'idle',
  lastSyncAt: null,
  lastError: null,
  pushed: 0,
  pulled: 0,
  conflicts: 0,

  setSyncing: () => set({ status: 'syncing', lastError: null }),

  setSyncResult: (result: SyncResult) =>
    set({
      status: result.error ? 'error' : 'success',
      lastSyncAt: result.syncedAt ?? null,
      lastError: result.error,
      pushed: result.pushed,
      pulled: result.pulled,
      conflicts: result.conflicts,
    }),

  reset: () =>
    set({
      status: 'idle',
      lastSyncAt: null,
      lastError: null,
      pushed: 0,
      pulled: 0,
      conflicts: 0,
    }),
}));

// ─── triggerSync ──────────────────────────────────────────────────────────────

/**
 * Attempt a sync if all preconditions are met.
 * Safe to call from anywhere — it no-ops gracefully when sync can't run.
 *
 * @param source Optional label for debugging (e.g. 'foreground', 'create-shift').
 */
export async function triggerSync(source = 'manual'): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const authed = await isAuthenticated();
  if (!authed) return;

  const online = await checkIsOnline();
  if (!online) return;

  const userId = await getActiveUserId();
  const syncStore = useSyncStore.getState();

  if (syncStore.status === 'syncing') return; // Already running.

  syncStore.setSyncing();
  console.log(`[Sync] Triggered from: ${source}`);

  const result = await runSync(userId);
  syncStore.setSyncResult(result);

  if (result.error) {
    console.warn(`[Sync] Sync error (${source}):`, result.error);
  } else {
    console.log(
      `[Sync] Success (${source}): pushed=${result.pushed} pulled=${result.pulled} conflicts=${result.conflicts}`
    );
  }

  // After pulling, reload the shift store so UI reflects remote changes.
  if (result.pulled > 0) {
    const userId = await getActiveUserId();
    const shiftStore = useShiftStore.getState();
    await shiftStore.loadUpcomingShifts(userId);
  }
}

// ─── SyncController (React component) ────────────────────────────────────────
// Mount this once in your navigation root (e.g. RootNavigator.tsx).
// It handles automatic sync triggers without polluting screens.

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * SyncController manages automatic sync triggers.
 *
 * Mount once at the app root:
 *   import { SyncController } from '../services/syncIntegration';
 *   // Inside RootNavigator render:
 *   <SyncController />
 *
 * This is a renderless component (returns null).
 * It integrates with useNetworkStatus via the onReconnect callback.
 */
export function SyncController(): null {
  const settings = useSettingsStore(s => s.settings);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cloudSyncEnabled = settings?.cloud_sync_enabled === 1;

  useEffect(() => {
    if (!cloudSyncEnabled) return;

    // Sync on mount (app foregrounded / fresh launch).
    triggerSync('mount');

    // Sync every 15 minutes while the app is in foreground.
    intervalRef.current = setInterval(() => {
      triggerSync('interval');
    }, SYNC_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [cloudSyncEnabled]);

  return null;
}

// ─── Store action wrappers ────────────────────────────────────────────────────
// These wrap the existing store actions and call triggerSync after writes.
// Import these in screens instead of using the store actions directly.

/**
 * Create a shift and sync to cloud.
 */
export async function createShiftAndSync(
  userId: string,
  data: Parameters<ReturnType<typeof useShiftStore.getState>['createShift']>[1]
): ReturnType<ReturnType<typeof useShiftStore.getState>['createShift']> {
  const shiftStore = useShiftStore.getState();
  const result = await shiftStore.createShift(userId, data);
  void triggerSync('create-shift');
  return result;
}

/**
 * Update a shift and sync to cloud.
 */
export async function updateShiftAndSync(
  shiftId: string,
  data: Parameters<ReturnType<typeof useShiftStore.getState>['updateShift']>[1],
  reminderMinutes?: number[]
): Promise<void> {
  const shiftStore = useShiftStore.getState();
  await shiftStore.updateShift(shiftId, data, reminderMinutes);
  void triggerSync('update-shift');
}

/**
 * Delete a shift and sync to cloud.
 */
export async function deleteShiftAndSync(shiftId: string): Promise<void> {
  const shiftStore = useShiftStore.getState();
  await shiftStore.deleteShift(shiftId);
  void triggerSync('delete-shift');
}

/**
 * Update settings and sync to cloud.
 */
export async function updateSettingsAndSync(
  data: Parameters<ReturnType<typeof useSettingsStore.getState>['updateSettings']>[0]
): Promise<void> {
  const settingsStore = useSettingsStore.getState();
  await settingsStore.updateSettings(data);

  // Only sync settings changes if cloud sync is currently enabled.
  const settings = useSettingsStore.getState().settings;
  if (settings?.cloud_sync_enabled === 1) {
    void triggerSync('update-settings');
  }
}

// ─── Example: how to wire useNetworkStatus into SyncController ────────────────
//
// In your RootNavigator.tsx (or wherever you mount SyncController):
//
//   import { useNetworkStatus } from '../hooks/useNetworkStatus';
//   import { triggerSync } from '../services/syncIntegration';
//   import { useSettingsStore } from '../stores/settingsStore';
//
//   function NetworkSyncBridge() {
//     const cloudSyncEnabled = useSettingsStore(s => s.settings?.cloud_sync_enabled === 1);
//
//     useNetworkStatus({
//       onReconnect: cloudSyncEnabled ? () => triggerSync('reconnect') : undefined,
//     });
//
//     return null;
//   }
//
// Then render both in your navigator:
//   <SyncController />
//   <NetworkSyncBridge />
//   <NavigationContainer>...</NavigationContainer>
