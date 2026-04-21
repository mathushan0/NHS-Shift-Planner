import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSettingsStore } from '../stores/settingsStore';
import { RootStackParamList } from '../types';
import { OnboardingStack } from './OnboardingStack';
import { TabNavigator } from './TabNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface Props {
  userId: string;
}

export function RootNavigator({ userId }: Props) {
  const settings = useSettingsStore(s => s.settings);

  const onboardingComplete = settings?.onboarding_complete === 1;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!onboardingComplete ? (
        <Stack.Screen name="Onboarding" component={OnboardingStack} />
      ) : (
        <Stack.Screen
          name="MainApp"
          // Pass userId to TabNavigator via initial params would require a different approach;
          // since userId is stored in settingsStore we use that in child screens.
          component={TabNavigator}
        />
      )}
    </Stack.Navigator>
  );
}
