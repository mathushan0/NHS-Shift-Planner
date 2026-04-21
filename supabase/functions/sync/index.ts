/**
 * Supabase Edge Function: sync
 *
 * Bidirectional sync in a single round-trip.
 * Handles conflict resolution server-side using:
 *   - Higher sync_version wins
 *   - Tie-break: server's updated_at >= client's updated_at → server wins
 *
 * The function runs with the service_role key, bypassing RLS.
 * Authentication is verified via the JWT in the Authorization header.
 *
 * Deploy with: supabase functions deploy sync
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Types ────────────────────────────────────────────────────────────────────

type SyncTable = 'shifts' | 'shift_types' | 'reminders' | 'settings';

interface ClientChange {
  table: SyncTable;
  id: string;
  operation: 'upsert' | 'delete';
  payload: Record<string, unknown>;
  sync_version: number;
  updated_at: string;
}

interface ServerChange {
  table: SyncTable;
  id: string;
  operation: 'upsert' | 'delete';
  payload: Record<string, unknown>;
  sync_version: number;
}

interface ConflictResolution {
  id: string;
  resolution: 'server_wins' | 'client_wins';
  winning_version: number;
}

interface SyncRequest {
  client_changes: ClientChange[];
  last_sync_at: string | null;
}

interface SyncResponse {
  server_changes: ServerChange[];
  conflicts: ConflictResolution[];
  sync_timestamp: string;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed.');
  }

  // ── Authenticate ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(401, 'Missing or invalid Authorization header.');
  }
  const jwt = authHeader.slice('Bearer '.length);

  // Create a client with the user's JWT to verify identity.
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return errorResponse(401, 'Invalid or expired session.');
  }

  const userId = user.id;

  // Create service_role client for RLS-bypassing writes.
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // ── Parse request ─────────────────────────────────────────────────────────
  let body: SyncRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body.');
  }

  const { client_changes = [], last_sync_at } = body;

  // Validate all changes belong to the authenticated user.
  for (const change of client_changes) {
    const payloadUserId = change.payload?.user_id ?? change.payload?.id;
    if (
      change.table !== 'reminders' &&  // reminders don't have user_id in payload
      payloadUserId !== userId
    ) {
      return errorResponse(403, `Forbidden: change for table '${change.table}' belongs to another user.`);
    }
  }

  const syncTimestamp = new Date().toISOString();
  const conflicts: ConflictResolution[] = [];
  const serverChanges: ServerChange[] = [];

  // ── Process client changes ────────────────────────────────────────────────
  for (const change of client_changes) {
    try {
      const resolution = await applyClientChange(adminClient, change, userId);
      if (resolution) conflicts.push(resolution);
    } catch (err) {
      console.error(`[Sync] Failed to apply change for ${change.table}/${change.id}:`, err);
      // Continue processing other changes rather than failing the whole sync.
    }
  }

  // ── Fetch server changes since last_sync_at ───────────────────────────────
  const tables: SyncTable[] = ['shift_types', 'shifts', 'reminders', 'settings'];
  for (const table of tables) {
    const changes = await fetchServerChanges(adminClient, table, userId, last_sync_at);
    serverChanges.push(...changes);
  }

  // ── Respond ───────────────────────────────────────────────────────────────
  const response: SyncResponse = {
    server_changes: serverChanges,
    conflicts,
    sync_timestamp: syncTimestamp,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function applyClientChange(
  // deno-lint-ignore no-explicit-any
  client: any,
  change: ClientChange,
  userId: string
): Promise<ConflictResolution | null> {
  const { table, id, operation, payload, sync_version, updated_at } = change;

  // Fetch existing server record for conflict detection.
  // Settings uses user_id as PK.
  const pkField = table === 'settings' ? 'user_id' : 'id';
  const pkValue = table === 'settings' ? userId : id;

  const { data: existing } = await client
    .from(table)
    .select('sync_version, updated_at')
    .eq(pkField, pkValue)
    .maybeSingle();

  if (existing) {
    const serverVersion: number = existing.sync_version ?? 1;
    const serverUpdatedAt = new Date(existing.updated_at).getTime();
    const clientUpdatedAt = new Date(updated_at).getTime();

    // Conflict: server has a higher version, or same version but server is newer.
    const serverWins =
      serverVersion > sync_version ||
      (serverVersion === sync_version && serverUpdatedAt >= clientUpdatedAt);

    if (serverWins) {
      return {
        id,
        resolution: 'server_wins',
        winning_version: serverVersion,
      };
    }
  }

  // Client wins (or no existing record) — apply the change.
  if (operation === 'upsert') {
    // Ensure user_id is correct on the payload (security: don't trust client payload).
    if (table !== 'reminders') {
      payload.user_id = userId;
    }

    const { error } = await client
      .from(table)
      .upsert(payload, { onConflict: pkField });

    if (error) {
      throw new Error(`Upsert failed for ${table}/${id}: ${error.message}`);
    }
  } else if (operation === 'delete') {
    // Soft delete: set deleted_at if not already set.
    const { error } = await client
      .from(table)
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq(pkField, pkValue)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Soft delete failed for ${table}/${id}: ${error.message}`);
    }
  }

  if (existing) {
    return { id, resolution: 'client_wins', winning_version: sync_version };
  }

  return null; // New record, no conflict.
}

async function fetchServerChanges(
  // deno-lint-ignore no-explicit-any
  client: any,
  table: SyncTable,
  userId: string,
  lastSyncAt: string | null
): Promise<ServerChange[]> {
  const cutoff = lastSyncAt ?? '1970-01-01T00:00:00Z';

  let query = client.from(table).select('*');

  if (table === 'reminders') {
    // Reminders don't have user_id directly; they belong to shifts which have user_id.
    // Fetch the authenticated user's shift IDs first, then filter reminders by those.
    const { data: userShifts, error: shiftErr } = await client
      .from('shifts')
      .select('id')
      .eq('user_id', userId);
    if (shiftErr) {
      console.error('[Sync] Failed to fetch shift IDs for reminder filter:', shiftErr.message);
      return [];
    }
    const shiftIds = (userShifts ?? []).map((s: { id: string }) => s.id);
    if (shiftIds.length === 0) return []; // No shifts → no reminders.
    query = query.in('shift_id', shiftIds).gte('updated_at', cutoff);
  } else if (table === 'settings') {
    query = query.eq('user_id', userId).gte('updated_at', cutoff);
  } else {
    query = query.eq('user_id', userId).gte('updated_at', cutoff);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`[Sync] Failed to fetch server changes for ${table}:`, error.message);
    return [];
  }

  if (!data) return [];

  return (data as Record<string, unknown>[]).map(record => ({
    table,
    id: (record.id ?? record.user_id) as string,
    operation: record.deleted_at ? 'delete' : 'upsert',
    payload: record,
    sync_version: (record.sync_version as number | undefined) ?? 1,
  }));
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}
