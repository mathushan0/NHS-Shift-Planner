import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../types';
import { useTheme } from '../hooks/useTheme';
import { AppColors } from '../theme/colors';
import { PrimaryButton } from '../components/atoms/PrimaryButton';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingDisclaimer'>;

const DISCLAIMER_POINTS = [
  {
    icon: '📅',
    title: 'Personal scheduling tool',
    body: 'MyShifts is a personal scheduling tool to help you track your shifts and working hours.',
  },
  {
    icon: '⚠️',
    title: 'Not an official record',
    body: 'Information shown in MyShifts is not an official record. Always verify your hours and schedule with your employer.',
  },
  {
    icon: '🏥',
    title: 'No affiliation with healthcare providers',
    body: 'MyShifts is not affiliated with, endorsed by, or connected to the NHS or any healthcare organisation.',
  },
  {
    icon: '🔒',
    title: 'Do not enter patient information',
    body: 'Never enter patient names, identifiers, clinical notes, or any other patient information into this app. MyShifts is not designed or approved for storing protected health information.',
  },
];

export function DisclaimerScreen({ navigation }: Props) {
  const { colors, typography, spacing } = useTheme();
  const [accepted, setAccepted] = useState(false);

  function handleAccept() {
    navigation.navigate('OnboardingDone');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing[6], paddingBottom: spacing[8] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: AppColors.nhsBlue }]}>
            <Text style={styles.iconBadgeText}>ℹ️</Text>
          </View>
          <Text
            style={[typography.heading1, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing[4] }]}
          >
            Before You Begin
          </Text>
          <Text
            style={[typography.body1, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing[2] }]}
          >
            Please read and accept the following before using MyShifts.
          </Text>
        </View>

        {/* Disclaimer points */}
        <View style={[styles.cards, { marginTop: spacing[6] }]}>
          {DISCLAIMER_POINTS.map((point, i) => (
            <View
              key={i}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface1,
                  borderRadius: 12,
                  marginBottom: spacing[3],
                  borderLeftWidth: 4,
                  borderLeftColor: AppColors.nhsBlue,
                },
              ]}
            >
              <Text style={styles.cardIcon}>{point.icon}</Text>
              <View style={styles.cardText}>
                <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '600', marginBottom: 4 }]}>
                  {point.title}
                </Text>
                <Text style={[typography.body2, { color: colors.textSecondary, lineHeight: 20 }]}>
                  {point.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Checkbox accept */}
        <TouchableOpacity
          style={[styles.checkRow, { marginTop: spacing[4] }]}
          onPress={() => setAccepted(!accepted)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: accepted ? AppColors.nhsBlue : colors.border,
                backgroundColor: accepted ? AppColors.nhsBlue : 'transparent',
              },
            ]}
          >
            {accepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[typography.body2, { color: colors.textPrimary, flex: 1, marginLeft: 12 }]}>
            I understand that MyShifts is a personal tool, not affiliated with any healthcare organisation,
            and I will not enter patient information.
          </Text>
        </TouchableOpacity>

        {/* Accept button */}
        <PrimaryButton
          label="Accept & Continue"
          onPress={handleAccept}
          style={{ marginTop: spacing[6], opacity: accepted ? 1 : 0.4 }}
          disabled={!accepted}
        />

        <Text style={[typography.caption, { color: colors.textDisabled, textAlign: 'center', marginTop: spacing[4] }]}>
          By continuing, you agree to our Terms of Use and Privacy Policy.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingTop: 32,
  },
  header: {
    alignItems: 'center',
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeText: {
    fontSize: 32,
  },
  cards: {},
  card: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  cardIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
    marginTop: 2,
  },
  cardText: {
    flex: 1,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
