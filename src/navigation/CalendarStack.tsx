import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CalendarStackParamList } from '../types';
import { CalendarScreen } from '../screens/CalendarScreen';
import { ShiftDetailScreen } from '../screens/ShiftDetailScreen';
import { AddEditShiftScreen } from '../screens/AddEditShiftScreen';
import { useTheme } from '../hooks/useTheme';

const Stack = createNativeStackNavigator<CalendarStackParamList & { AddEditShift: { shiftId?: string; initialDate?: string } }>();

export function CalendarStack() {
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
        name="Calendar"
        component={CalendarScreen}
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
