import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { useSettingsStore } from '../../stores/settingsStore';
import { PrimaryButton } from '../../components/atoms/PrimaryButton';
import { AppColors } from '../../theme/colors';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingDone'>;

export function OnboardingCompleteScreen({ navigation }: Props) {
  const { colors, typography, spacing } = useTheme();
  const completeOnboarding = useSettingsStore(s => s.completeOnboarding);
  const displayName = useSettingsStore(s => s.displayName);
  const [isLoading, setIsLoading] = React.useState(false);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 12,
        stiffness: 150,
        delay: 200,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  async function handleGetStarted() {
    setIsLoading(true);
    try {
      await completeOnboarding();
      // Navigation handled by RootNavigator reacting to onboarding_complete flag
    } catch {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      <View style={[styles.content, { paddingHorizontal: spacing[6] }]}>
        {/* Checkmark animation */}
        <Animated.View
          style={[
            styles.checkContainer,
            { backgroundColor: AppColors.nhsAquaGreen, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Text style={styles.checkmark}>✓</Text>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
          <Text
            style={[
              typography.heading1,
              { color: colors.textPrimary, textAlign: 'center', marginBottom: spacing[3] },
            ]}
          >
            You're all set{displayName ? `, ${displayName}` : ''}!
          </Text>
          <Text
            style={[
              typography.body1,
              { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing[8] },
            ]}
          >
            MyShifts is ready. Start by adding your first shift.
          </Text>

          {/* Summary chips */}
          {[
            '📅  Add and track shifts',
            '⏱️  Monitor your contracted hours',
            '🔔  Get reminders before shifts',
            '📄  Export PDF reports',
          ].map((item, i) => (
            <View
              key={i}
              style={[
                styles.featureRow,
                { backgroundColor: colors.surface1, borderRadius: 12, marginBottom: spacing[2] },
              ]}
            >
              <Text style={[typography.body2, { color: colors.textPrimary }]}>{item}</Text>
            </View>
          ))}
        </Animated.View>

        <PrimaryButton
          label="Start Planning"
          onPress={handleGetStarted}
          isLoading={isLoading}
          style={{ marginTop: spacing[8] }}
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
  checkContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  checkmark: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 56,
  },
  featureRow: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
