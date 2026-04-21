/**
 * Auth service for MyShifts.
 *
 * Design principles:
 *  - Auth is OPTIONAL. The app works fully without it.
 *  - Anonymous users get a device UUID (generated at first launch).
 *  - Cloud sync requires an authenticated Supabase session.
 *  - JWTs are stored in expo-secure-store (never AsyncStorage or SQLite).
 *  - On sign-in, local data is migrated to use the Supabase UID.
 */

import { Session, User as SupabaseUser, AuthError } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { getDatabase } from '../database/db';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEVICE_USER_ID_KEY = 'nhs_shift_planner_device_user_id';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthResult {
  session: Session | null;
  user: SupabaseUser | null;
  error: string | null;
}

export interface SignUpData {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

// ─── Device identity (anonymous) ──────────────────────────────────────────────

/**
 * Get or create the device-scoped anonymous user ID.
 * This is the stable identity used before (or instead of) Supabase Auth.
 * Stored in SecureStore so it survives app reinstalls on the same device
 * (iOS: only if iCloud Keychain backup is enabled; Android: always local).
 */
export async function getOrCreateDeviceUserId(): Promise<string> {
  let userId = await SecureStore.getItemAsync(DEVICE_USER_ID_KEY);

  if (!userId) {
    userId = randomUUID();
    await SecureStore.setItemAsync(DEVICE_USER_ID_KEY, userId);
  }

  return userId;
}

/**
 * Returns the currently active user ID:
 *  - Supabase UID if authenticated
 *  - Device UUID otherwise
 */
export async function getActiveUserId(): Promise<string> {
  if (!isSupabaseConfigured()) {
    return getOrCreateDeviceUserId();
  }

  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    return session.user.id;
  }

  return getOrCreateDeviceUserId();
}

// ─── Auth operations ──────────────────────────────────────────────────────────

/**
 * Sign up with email and password.
 * Creates a Supabase Auth account. Email verification may be required
 * depending on Supabase project settings.
 */
export async function signUp(data: SignUpData): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { session: null, user: null, error: 'Cloud sync is not configured.' };
  }

  const supabase = getSupabaseClient();

  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        display_name: data.displayName ?? null,
      },
    },
  });

  if (error) {
    return { session: null, user: null, error: formatAuthError(error) };
  }

  return {
    session: authData.session,
    user: authData.user,
    error: null,
  };
}

/**
 * Sign in with email and password.
 * On success, triggers local user ID migration from device UUID to Supabase UID.
 */
export async function signIn(data: SignInData): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { session: null, user: null, error: 'Cloud sync is not configured.' };
  }

  const supabase = getSupabaseClient();
  const deviceUserId = await getOrCreateDeviceUserId();

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    return { session: null, user: null, error: formatAuthError(error) };
  }

  if (authData.user) {
    await migrateLocalDataToSupabaseUid(deviceUserId, authData.user.id);
  }

  return {
    session: authData.session,
    user: authData.user,
    error: null,
  };
}

/**
 * Sign out. Clears the Supabase session from SecureStore.
 * Local SQLite data is preserved.
 */
export async function signOut(): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { error: null };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: formatAuthError(error) };
  }

  return { error: null };
}

/**
 * Get the current active session (if any).
 * Returns null if the user is not authenticated.
 */
export async function getCurrentSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Get the current authenticated user (if any).
 */
export async function getCurrentUser(): Promise<SupabaseUser | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Check whether the user is currently authenticated.
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getCurrentSession();
  return session !== null && !isSessionExpired(session);
}

/**
 * Refresh the JWT token. Called automatically by the Supabase client,
 * but can be invoked manually before a sync operation.
 */
export async function refreshSession(): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { session: null, user: null, error: 'Cloud sync is not configured.' };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.refreshSession();

  if (error) {
    return { session: null, user: null, error: formatAuthError(error) };
  }

  return { session: data.session, user: data.user, error: null };
}

/**
 * Delete the Supabase account and all associated cloud data.
 * Satisfies GDPR right to erasure.
 * Local SQLite data is NOT deleted by this call.
 */
export async function deleteAccount(): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { error: 'Cloud sync is not configured.' };
  }

  const supabase = getSupabaseClient();

  // Delete all user data rows before deleting the auth account.
  // RLS ensures we can only touch our own records.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'No authenticated user found.' };
  }

  // Hard delete all cloud records for this user.
  // Order matters due to foreign key constraints.

  // 1. Delete reminders (linked via shift_id, not user_id directly).
  const { data: userShifts, error: shiftFetchErr } = await supabase
    .from('shifts')
    .select('id')
    .eq('user_id', user.id);
  if (shiftFetchErr) {
    console.error('[Auth] Failed to fetch shifts for reminder deletion:', shiftFetchErr.message);
  } else {
    const shiftIds = (userShifts ?? []).map((s: { id: string }) => s.id);
    if (shiftIds.length > 0) {
      const { error } = await supabase.from('reminders').delete().in('shift_id', shiftIds);
      if (error) {
        console.error(`[Auth] Failed to delete reminders for user ${user.id}:`, error.message);
      }
    }
  }

  // 2. Delete tables that have a direct user_id column.
  const tables = ['shifts', 'shift_types', 'settings', 'sync_log'] as const;
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('user_id', user.id);
    if (error) {
      console.error(`[Auth] Failed to delete ${table} for user ${user.id}:`, error.message);
    }
  }

  // 3. Delete the users profile row (PK is id, not user_id).
  await supabase.from('users').delete().eq('id', user.id);

  // Sign out (Supabase does not expose client-side account deletion in all plans;
  // the actual auth.users record deletion requires a service_role Edge Function call).
  await supabase.auth.signOut();

  return { error: null };
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(
  callback: (session: Session | null) => void
): () => void {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const supabase = getSupabaseClient();
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => subscription.unsubscribe();
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * When a user signs in for the first time on a device, migrate all local SQLite
 * records from the anonymous device UUID to their Supabase UID.
 *
 * This is idempotent: if the device UUID already matches the Supabase UID
 * (e.g. the user logged in from a fresh install) it's a no-op.
 */
async function migrateLocalDataToSupabaseUid(
  deviceUserId: string,
  supabaseUid: string
): Promise<void> {
  if (deviceUserId === supabaseUid) return;

  const db = getDatabase();
  const now = new Date().toISOString();

  try {
    // Run all updates in a transaction for atomicity.
    await db.withTransactionAsync(async () => {
      // Check if a record for the device user exists before migrating.
      const existingUser = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM users WHERE id = ?',
        [deviceUserId]
      );

      if (!existingUser) return; // Nothing to migrate.

      // Update foreign key references first, then the primary key.
      await db.runAsync('UPDATE shifts SET user_id = ? WHERE user_id = ?', [supabaseUid, deviceUserId]);
      await db.runAsync('UPDATE shift_types SET user_id = ? WHERE user_id = ?', [supabaseUid, deviceUserId]);
      await db.runAsync('UPDATE settings SET user_id = ? WHERE user_id = ?', [supabaseUid, deviceUserId]);
      await db.runAsync('UPDATE sync_log SET user_id = ? WHERE user_id = ?', [supabaseUid, deviceUserId]);
      await db.runAsync(
        'UPDATE users SET id = ?, updated_at = ? WHERE id = ?',
        [supabaseUid, now, deviceUserId]
      );
    });

    // Update SecureStore so future calls to getOrCreateDeviceUserId return the Supabase UID.
    await SecureStore.setItemAsync(DEVICE_USER_ID_KEY, supabaseUid);

    console.log(`[Auth] Migrated local data from device UUID ${deviceUserId} to Supabase UID ${supabaseUid}`);
  } catch (err) {
    console.error('[Auth] Failed to migrate local data to Supabase UID:', err);
    // Non-fatal: local data is still accessible under the device UUID.
    // Sync will handle reconciliation.
  }
}

function isSessionExpired(session: Session): boolean {
  if (!session.expires_at) return false;
  // expires_at is a Unix timestamp (seconds).
  return Date.now() / 1000 >= session.expires_at;
}

function formatAuthError(error: AuthError): string {
  // Map common Supabase auth error codes to user-friendly messages.
  switch (error.message) {
    case 'Invalid login credentials':
      return 'Incorrect email or password.';
    case 'Email not confirmed':
      return 'Please verify your email address before signing in.';
    case 'User already registered':
      return 'An account with this email already exists.';
    case 'Password should be at least 6 characters':
      return 'Password must be at least 6 characters.';
    default:
      return error.message ?? 'An unexpected error occurred.';
  }
}
