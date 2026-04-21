import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../types';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ShiftDetailScreen } from '../screens/ShiftDetailScreen';
import { ShiftHistoryScreen } from '../screens/ShiftHistoryScreen';
import { useTheme } from '../hooks/useTheme';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export function SettingsStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface1 },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="More"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ShiftHistory"
        component={ShiftHistoryScreen}
        options={{ title: 'Shift History' }}
      />
      <Stack.Screen
        name="ShiftDetail"
        component={ShiftDetailScreen}
        options={{ title: 'Shift Details' }}
      />
    </Stack.Navigator>
  );
}
