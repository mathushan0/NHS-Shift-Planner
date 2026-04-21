/**
 * useNetworkStatus — detect online/offline state and trigger sync on reconnect.
 *
 * Uses @react-native-community/netinfo.
 * iOS only target, but the hook is platform-safe.
 *
 * Usage:
 *   const { isOnline, connectionType } = useNetworkStatus();
 *
 * The hook automatically triggers a sync when transitioning from offline → online.
 * Pass `onReconnect` to customise behaviour (e.g. run runSync).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
} from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConnectionType =
  | 'wifi'
  | 'cellular'
  | 'ethernet'
  | 'none'
  | 'unknown';

export interface NetworkStatus {
  /** True if the device has internet reachability. */
  isOnline: boolean;
  /** Underlying connection type. */
  connectionType: ConnectionType;
  /** True while the initial network state has not yet been resolved. */
  isChecking: boolean;
}

export interface UseNetworkStatusOptions {
  /**
   * Called when transitioning from offline → online.
   * Perfect place to trigger a sync: () => runSync(userId)
   */
  onReconnect?: () => void | Promise<void>;
  /**
   * Called when transitioning from online → offline.
   * Use to show an offline banner.
   */
  onDisconnect?: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNetworkStatus(options: UseNetworkStatusOptions = {}): NetworkStatus {
  const { onReconnect, onDisconnect } = options;

  const [state, setState] = useState<NetworkStatus>({
    isOnline: true,    // Optimistic default; corrected on first NetInfo event.
    connectionType: 'unknown',
    isChecking: true,
  });

  // Track previous online state to detect transitions.
  const wasOnlineRef = useRef<boolean | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const updateFromNetInfo = useCallback(
    (netState: NetInfoState) => {
      const isOnline = netState.isConnected === true && netState.isInternetReachable !== false;
      const connectionType = mapConnectionType(netState.type as string);

      setState({
        isOnline,
        connectionType,
        isChecking: false,
      });

      const previouslyOnline = wasOnlineRef.current;

      // Detect reconnect transition (offline → online).
      if (isOnline && previouslyOnline === false) {
        onReconnect?.();
      }

      // Detect disconnect transition (online → offline).
      if (!isOnline && previouslyOnline === true) {
        onDisconnect?.();
      }

      wasOnlineRef.current = isOnline;
    },
    [onReconnect, onDisconnect]
  );

  useEffect(() => {
    // Fetch initial state.
    NetInfo.fetch().then(updateFromNetInfo).catch(() => {
      setState(prev => ({ ...prev, isChecking: false }));
    });

    // Subscribe to changes.
    const unsubscribe: NetInfoSubscription = NetInfo.addEventListener(updateFromNetInfo);

    // Also trigger sync when app comes to foreground (in case network changed while backgrounded).
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        const comingToForeground =
          appStateRef.current.match(/inactive|background/) && nextAppState === 'active';

        if (comingToForeground && wasOnlineRef.current) {
          // App resumed while online → good time to sync.
          onReconnect?.();
        }

        appStateRef.current = nextAppState;
      }
    );

    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [updateFromNetInfo, onReconnect]);

  return state;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapConnectionType(type: string): ConnectionType {
  switch (type) {
    case 'wifi':
      return 'wifi';
    case 'cellular':
      return 'cellular';
    case 'ethernet':
      return 'ethernet';
    case 'none':
      return 'none';
    default:
      return 'unknown';
  }
}

// ─── Standalone utility ───────────────────────────────────────────────────────

/**
 * One-shot check for network availability. Use outside React components
 * (e.g. inside sync service, background tasks).
 */
export async function checkIsOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}
