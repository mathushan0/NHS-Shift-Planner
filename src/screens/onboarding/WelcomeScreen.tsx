import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { PrimaryButton } from '../../components/atoms/PrimaryButton';
import { NHSColors } from '../../theme/colors';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingWelcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const { typography, spacing } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: NHSColors.nhsBlue }]}>
      <SafeAreaView style={styles.safe}>
        {/* NHS logo area */}
        <View style={styles.logoArea}>
          <View style={styles.nhsLogo}>
            <Text style={styles.nhsLogoText}>NHS</Text>
          </View>
        </View>

        {/* Main content */}
        <View style={styles.content}>
          <Text style={styles.title}>Shift Planner</Text>
          <Text style={styles.subtitle}>
            Your personal NHS rota organiser — track shifts, view hours, and never miss a reminder.
          </Text>
        </View>

        {/* Feature bullets */}
        <View style={styles.features}>
          {[
            { icon: '📅', text: 'Visualise your rota at a glance' },
            { icon: '⏱️', text: 'Track contracted vs worked hours' },
            { icon: '🔔', text: 'Get reminders before every shift' },
            { icon: '📄', text: 'Export reports as PDF' },
          ].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={[styles.cta, { paddingBottom: spacing[8] }]}>
          <PrimaryButton
            label="Get Started"
            onPress={() => navigation.navigate('OnboardingSetup')}
            style={styles.ctaButton}
          />
          <Text style={styles.privacyNote}>
            All data stays on your device. No account required.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  logoArea: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 24,
  },
  nhsLogo: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  nhsLogoText: {
    fontSize: 28,
    fontWeight: '900',
    color: NHSColors.nhsBlue,
    letterSpacing: 4,
  },
  content: {
    paddingHorizontal: 32,
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 26,
  },
  features: {
    paddingHorizontal: 32,
    marginBottom: 40,
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    flex: 1,
  },
  cta: {
    paddingHorizontal: 32,
    marginTop: 'auto',
    gap: 12,
  },
  ctaButton: {
    backgroundColor: '#FFFFFF',
  },
  privacyNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
});
