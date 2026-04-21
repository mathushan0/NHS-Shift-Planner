import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { OnboardingStackParamList } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { useUIStore } from '../../stores/uiStore';
import { PrimaryButton } from '../../components/atoms/PrimaryButton';
import { SecondaryButton } from '../../components/atoms/SecondaryButton';
import { AppColors } from '../../theme/colors';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingPermissions'>;

export function NotificationPermissionScreen({ navigation }: Props) {
  const { colors, typography, spacing } = useTheme();
  const setNotificationsGranted = useUIStore(s => s.setNotificationsGranted);
  const [isLoading, setIsLoading] = useState(false);

  async function requestPermissions() {
    setIsLoading(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === 'granted';
      setNotificationsGranted(granted);
    } catch {
      setNotificationsGranted(false);
    } finally {
      setIsLoading(false);
      navigation.navigate('OnboardingDisclaimer');
    }
  }

  function skipPermissions() {
    setNotificationsGranted(false);
    navigation.navigate('OnboardingDisclaimer');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      <View style={[styles.content, { paddingHorizontal: spacing[6] }]}>
        {/* Step indicator */}
        <View style={styles.stepRow}>
          {[1, 2, 3].map(step => (
            <View
              key={step}
              style={[
                styles.stepDot,
                { backgroundColor: step === 3 ? colors.primary : colors.surface3 },
              ]}
            />
          ))}
        </View>

        {/* Illustration */}
        <View style={[styles.illustrationContainer, { backgroundColor: AppColors.nhsPaleGrey, borderRadius: 24 }]}>
          <Text style={styles.illustrationEmoji}>🔔</Text>
        </View>

        {/* Text */}
        <Text style={[typography.heading1, { color: colors.textPrimary, textAlign: 'center', marginBottom: spacing[3] }]}>
          Stay on time
        </Text>
        <Text style={[typography.body1, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing[2] }]}>
          Allow notifications so MyShifts can remind you before every shift.
        </Text>
        <Text style={[typography.body2, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing[8] }]}>
          You can change this any time in Settings.
        </Text>

        {/* Buttons */}
        <PrimaryButton
          label="Enable Notifications"
          onPress={requestPermissions}
          isLoading={isLoading}
          style={{ marginBottom: spacing[3] }}
        />
        <SecondaryButton
          label="Maybe later"
          onPress={skipPermissions}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 48,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  illustrationContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  illustrationEmoji: {
    fontSize: 56,
  },
});
