import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabParamList } from '../types';
import { useTheme } from '../hooks/useTheme';
import { useUIStore } from '../stores/uiStore';
import { HomeStack } from './HomeStack';
import { CalendarStack } from './CalendarStack';
import { HoursStack } from './HoursStack';
import { SettingsStack } from './SettingsStack';
import { FAB } from '../components/molecules/FAB';


const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<string, string> = {
  HomeTab: '🏠',
  CalendarTab: '📅',
  HoursTab: '⏱️',
  MoreTab: '⚙️',
};

const TAB_LABELS: Record<string, string> = {
  HomeTab: 'Home',
  CalendarTab: 'Calendar',
  HoursTab: 'Hours',
  MoreTab: 'More',
};

function FABTabButton() {
  const openAddShift = useUIStore(s => s.openAddShift);

  // We navigate via the global modal pattern: openAddShift sets store state
  // and the HomeStack / AddEditShift screen listens for it. For simplicity
  // we push AddEditShift on whichever stack the user is in.
  // Since FAB is global, we raise a store event and let RootNavigator handle it.
  return (
    <View style={styles.fabContainer}>
      <FAB onPress={() => openAddShift()} />
    </View>
  );
}

export function TabNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.surface1,
          borderTopColor: colors.border,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, focused }) => (
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.7 }}>
            {TAB_ICONS[route.name] ?? '●'}
          </Text>
        ),
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="CalendarTab"
        component={CalendarStack}
        options={{ tabBarLabel: 'Calendar' }}
      />
      {/* FAB placeholder tab — the tab itself shows nothing, FAB is rendered above */}
      <Tab.Screen
        name="HoursTab"
        component={HoursStack}
        options={{
          tabBarLabel: 'Hours',
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={SettingsStack}
        options={{ tabBarLabel: 'More' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 60,
    right: 20,
    zIndex: 999,
  },
});
