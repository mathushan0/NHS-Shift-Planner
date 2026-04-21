/**
 * Supabase client setup for MyShifts.
 *
 * The anon key is safe to bundle — Row-Level Security enforces access control.
 * The service_role key must NEVER be bundled; it lives only in Edge Functions / CI.
 *
 * JWT tokens are stored in expo-secure-store (hardware-backed on supported devices).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ─── Environment ──────────────────────────────────────────────────────────────
// These are set via EAS secrets / .env.local.
// expo-constants or react-native-dotenv can expose these at build time.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[Supabase] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is not set. ' +
      'Cloud sync will be unavailable.'
  );
}

// ─── SecureStore adapter ──────────────────────────────────────────────────────
// Supabase Auth requires a storage adapter. We use expo-secure-store so that
// JWTs are protected by the device Secure Enclave / hardware keystore.
// iOS: data protected with kSecAttrAccessibleAfterFirstUnlock.
// Web is not a target for this client (web uses its own Supabase instance).

const secureStoreAdapter = {
  getItem: (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return Promise.resolve(null);
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') return Promise.resolve();
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string): Promise<void> => {
    if (Platform.OS === 'web') return Promise.resolve();
    return SecureStore.deleteItemAsync(key);
  },
};

// ─── Client singleton ─────────────────────────────────────────────────────────
let _supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      '[Supabase] Cannot create client: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set.'
    );
  }

  _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // Disable for React Native (no URL schemes)
    },
    global: {
      headers: {
        'X-Client-Info': 'myshifts-ios',
      },
    },
    db: {
      schema: 'public',
    },
  });

  return _supabase;
}

/**
 * Convenience export — use this throughout the app.
 * Falls back gracefully when credentials are missing (offline-only mode).
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
