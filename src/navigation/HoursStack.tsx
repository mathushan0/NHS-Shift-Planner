import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HoursStackParamList } from '../types';
import { HoursSummaryScreen } from '../screens/HoursSummaryScreen';
import { ShiftDetailScreen } from '../screens/ShiftDetailScreen';
import { ShiftHistoryScreen } from '../screens/ShiftHistoryScreen';
import { useTheme } from '../hooks/useTheme';

const Stack = createNativeStackNavigator<HoursStackParamList & { ShiftHistory: undefined }>();

export function HoursStack() {
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
        name="HoursSummary"
        component={HoursSummaryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ShiftDetail"
        component={ShiftDetailScreen}
        options={{ title: 'Shift Details' }}
      />
      <Stack.Screen
        name={'ShiftHistory' as any}
        component={ShiftHistoryScreen}
        options={{ title: 'Shift History' }}
      />
    </Stack.Navigator>
  );
}
