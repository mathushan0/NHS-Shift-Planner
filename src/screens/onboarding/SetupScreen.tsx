import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList, JobRole } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { useSettingsStore } from '../../stores/settingsStore';
import { FormTextInput } from '../../components/atoms/FormTextInput';
import { PrimaryButton } from '../../components/atoms/PrimaryButton';
import { SegmentedControl } from '../../components/atoms/SegmentedControl';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingSetup'>;

const JOB_ROLES: Array<{ label: string; value: JobRole }> = [
  { label: 'Nurse/Midwife', value: 'nurse_midwife' },
  { label: 'Doctor', value: 'doctor' },
  { label: 'HCA/Porter', value: 'hca_porter' },
  { label: 'AHP', value: 'ahp' },
  { label: 'Admin', value: 'admin' },
  { label: 'Other', value: 'other' },
];

const PAY_PERIOD_OPTIONS = [
  { label: 'Weekly', value: 'weekly' },
  { label: '2 Weekly', value: 'fortnightly' },
  { label: '4 Weekly', value: 'monthly_4week' },
  { label: 'Monthly', value: 'monthly_calendar' },
];

export function SetupScreen({ navigation }: Props) {
  const { colors, typography, spacing, radius } = useTheme();
  const { setDisplayName, setContractedHours, updateSettings } = useSettingsStore();

  const [name, setName] = useState('');
  const [nhsTrust, setNhsTrust] = useState('');
  const [jobRole, setJobRole] = useState<JobRole>('nurse_midwife');
  const [contractedHours, setContractedHoursLocal] = useState('37.5');
  const [payPeriod, setPayPeriod] = useState('monthly_calendar');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Please enter your name';
    const hours = parseFloat(contractedHours);
    if (isNaN(hours) || hours <= 0 || hours > 80) {
      newErrors.contractedHours = 'Enter a valid number of hours (1–80)';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleNext() {
    if (!validate()) return;
    setIsLoading(true);
    try {
      await setDisplayName(name.trim());
      await setContractedHours(parseFloat(contractedHours));
      await updateSettings({
        pay_period_type: payPeriod as any,
        pay_period_start_day: 1,
      });
      navigation.navigate('OnboardingPermissions');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingHorizontal: spacing[5] }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[typography.heading1, { color: colors.textPrimary }]}>
              Tell us about yourself
            </Text>
            <Text style={[typography.body1, { color: colors.textSecondary, marginTop: spacing[2] }]}>
              We'll use this to personalise your experience.
            </Text>
          </View>

          {/* Step indicator */}
          <View style={styles.stepRow}>
            {[1, 2, 3].map(step => (
              <View
                key={step}
                style={[
                  styles.stepDot,
                  { backgroundColor: step === 1 ? colors.primary : colors.surface3 },
                ]}
              />
            ))}
          </View>

          {/* Name */}
          <FormTextInput
            label="Your name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sarah"
            autoCapitalize="words"
            returnKeyType="next"
            error={errors.name}
            containerStyle={{ marginBottom: spacing[4] }}
          />

          {/* NHS Trust */}
          <FormTextInput
            label="NHS Trust / Organisation (optional)"
            value={nhsTrust}
            onChangeText={setNhsTrust}
            placeholder="e.g. Leeds Teaching Hospitals"
            autoCapitalize="words"
            returnKeyType="next"
            containerStyle={{ marginBottom: spacing[4] }}
          />

          {/* Job role */}
          <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: spacing[2] }]}>
            Job role
          </Text>
          <View style={styles.roleGrid}>
            {JOB_ROLES.map(role => (
              <TouchableOpacity
                key={role.value}
                onPress={() => setJobRole(role.value)}
                style={[
                  styles.roleChip,
                  {
                    backgroundColor:
                      jobRole === role.value ? colors.primary : colors.surface1,
                    borderColor:
                      jobRole === role.value ? colors.primary : colors.border,
                    borderRadius: radius.md,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: jobRole === role.value }}
              >
                <Text
                  style={[
                    typography.body2,
                    {
                      color: jobRole === role.value ? '#FFFFFF' : colors.textPrimary,
                      fontWeight: '600',
                    },
                  ]}
                >
                  {role.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Contracted hours */}
          <FormTextInput
            label="Contracted hours per week"
            value={contractedHours}
            onChangeText={setContractedHoursLocal}
            placeholder="37.5"
            keyboardType="decimal-pad"
            returnKeyType="done"
            error={errors.contractedHours}
            containerStyle={{ marginTop: spacing[4], marginBottom: spacing[4] }}
          />

          {/* Pay period */}
          <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: spacing[2] }]}>
            Pay period
          </Text>
          <SegmentedControl
            segments={PAY_PERIOD_OPTIONS}
            selectedValue={payPeriod}
            onSelect={setPayPeriod}
            style={{ marginBottom: spacing[6] }}
          />

          <PrimaryButton
            label="Continue"
            onPress={handleNext}
            isLoading={isLoading}
            style={{ marginBottom: spacing[8] }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: {
    paddingTop: 32,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 32,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    minHeight: 44,
    justifyContent: 'center',
  },
});
