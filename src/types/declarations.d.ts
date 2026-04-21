// Type stubs for packages that may not be installed in dev environment
// These are resolved at build time via EAS / native build

declare module '@react-native-community/netinfo' {
  export interface NetInfoState {
    type: string;
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    details: Record<string, unknown> | null;
  }
  export type NetInfoSubscription = () => void;
  export function fetch(): Promise<NetInfoState>;
  export function addEventListener(
    listener: (state: NetInfoState) => void
  ): NetInfoSubscription;
  const NetInfo: {
    fetch: typeof fetch;
    addEventListener: typeof addEventListener;
  };
  export default NetInfo;
}

declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    multiGet(keys: string[]): Promise<[string, string | null][]>;
    multiSet(keyValuePairs: [string, string][]): Promise<void>;
  };
  export default AsyncStorage;
}
