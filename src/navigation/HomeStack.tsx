import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../types';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ShiftDetailScreen } from '../screens/ShiftDetailScreen';
import { AddEditShiftScreen } from '../screens/AddEditShiftScreen';
import { useTheme } from '../hooks/useTheme';

const Stack = createNativeStackNavigator<HomeStackParamList & { AddEditShift: { shiftId?: string; initialDate?: string } }>();

export function HomeStack() {
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
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ShiftDetail"
        component={ShiftDetailScreen}
        options={{ title: 'Shift Details' }}
      />
      <Stack.Screen
        name={'AddEditShift' as any}
        component={AddEditShiftScreen}
        options={({ route }) => ({
          title: (route.params as any)?.shiftId ? 'Edit Shift' : 'New Shift',
          presentation: 'modal',
        })}
      />
    </Stack.Navigator>
  );
}
