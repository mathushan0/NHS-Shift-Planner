import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { initializeDatabase } from './src/database/db';
import { useSettingsStore } from './src/stores/settingsStore';
import { useThemeStore } from './src/stores/themeStore';
import { useUIStore } from './src/stores/uiStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SnackbarContainer } from './src/components/molecules/Snackbar';
import { NHSColors } from './src/theme/colors';

const FIXED_USER_ID = 'local-user-1';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const initialize = useSettingsStore(s => s.initialize);
  const theme = useThemeStore(s => s.theme);


  useEffect(() => {
    async function bootstrap() {
      try {
        await initializeDatabase(FIXED_USER_ID);
        await initialize(FIXED_USER_ID);
        setDbReady(true);
      } catch (e) {
        setDbError((e as Error).message);
      }
    }
    bootstrap();
  }, []);

  if (!dbReady) {
    return (
      <View style={[styles.loading, { backgroundColor: NHSColors.nhsBlue }]}>
        {dbError ? null : <ActivityIndicator size="large" color="#FFFFFF" />}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style={theme.isDark ? 'light' : 'dark'} />
          <RootNavigator userId={FIXED_USER_ID} />
          <SnackbarContainer />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
