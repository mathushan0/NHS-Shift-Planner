import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../hooks/useTheme';
import { useThemeStore } from '../stores/themeStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { SegmentedControl } from '../components/atoms/SegmentedControl';
import { FormTextInput } from '../components/atoms/FormTextInput';
import { PrimaryButton } from '../components/atoms/PrimaryButton';
import { MoreStackParamList, DarkModePreference, PayPeriodType } from '../types';

type Props = NativeStackScreenProps<MoreStackParamList, 'More'>;

const DARK_MODE_OPTIONS = [
  { label: 'System', value: '0' },
  { label: 'Dark', value: '1' },
  { label: 'Light', value: '2' },
];

const PAY_PERIOD_OPTIONS = [
  { label: 'Weekly', value: 'weekly' },
  { label: '2 Weekly', value: 'fortnightly' },
  { label: '4 Weekly', value: 'monthly_4week' },
  { label: 'Monthly', value: 'monthly_calendar' },
];

const REMINDER_OPTIONS = [
  { label: '15 min', value: '15' },
  { label: '30 min', value: '30' },
  { label: '1 hour', value: '60' },
  { label: '2 hours', value: '120' },
];

interface SettingRowProps {
  label: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}

function SettingRow({ label, subtitle, right, onPress }: SettingRowProps) {
  const { colors, typography, spacing } = useTheme();
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      style={[styles.settingRow, { borderBottomColor: colors.border }]}
      {...(onPress ? { accessibilityRole: 'button' } : {})}
    >
      <View style={styles.settingLabel}>
        <Text style={[typography.body1, { color: colors.textPrimary }]}>{label}</Text>
        {subtitle ? (
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right ? <View style={styles.settingRight}>{right}</View> : null}
    </Container>
  );
}

function SectionHeader({ title }: { title: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <Text
      style={[
        typography.caption,
        {
          color: colors.textSecondary,
          fontWeight: '700',
          letterSpacing: 0.8,
          paddingHorizontal: spacing[4],
          paddingTop: spacing[5],
          paddingBottom: spacing[1],
        },
      ]}
    >
      {title.toUpperCase()}
    </Text>
  );
}

export function SettingsScreen({ navigation }: Props) {
  const { colors, typography, spacing, radius, elevation } = useTheme();
  const { setDarkModePreference, darkModePreference } = useThemeStore();
  const { settings, updateSettings, setDisplayName, displayName } = useSettingsStore();
  const { showSnackbar, notificationsGranted } = useUIStore();

  const [name, setName] = useState(displayName ?? '');
  const [contractedHours, setContractedHours] = useState(
    String(settings?.contracted_hours ?? '37.5')
  );
  const [isSaving, setIsSaving] = useState(false);

  async function handleSaveProfile() {
    setIsSaving(true);
    try {
      await setDisplayName(name.trim());
      showSnackbar({ message: 'Profile saved', variant: 'success' });
    } catch {
      showSnackbar({ message: 'Failed to save', variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  function handleDarkMode(value: string) {
    const pref = parseInt(value, 10) as DarkModePreference;
    setDarkModePreference(pref);
    updateSettings({ dark_mode: pref });
  }

  function handlePayPeriod(value: string) {
    updateSettings({ pay_period_type: value as PayPeriodType });
  }

  function handleDefaultReminder(value: string) {
    updateSettings({ default_reminder_minutes: parseInt(value, 10) });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      <View style={[styles.header, { paddingHorizontal: spacing[4], backgroundColor: colors.surface1 }]}>
        <Text style={[typography.heading2, { color: colors.textPrimary }]}>Settings</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('ShiftHistory')}
          style={[styles.historyBtn, { borderColor: colors.border, borderRadius: radius.md }]}
        >
          <Text style={[typography.body2, { color: colors.primary, fontWeight: '600' }]}>History</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Profile */}
        <SectionHeader title="Profile" />
        <View
          style={[
            styles.card,
            elevation[1],
            { backgroundColor: colors.surface1, borderRadius: radius.lg, marginHorizontal: spacing[4] },
          ]}
        >
          <View style={{ padding: spacing[4] }}>
            <FormTextInput
              label="Display name"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
              returnKeyType="done"
              containerStyle={{ marginBottom: spacing[3] }}
            />
            <FormTextInput
              label="Contracted hours / week"
              value={contractedHours}
              onChangeText={setContractedHours}
              placeholder="37.5"
              keyboardType="decimal-pad"
              returnKeyType="done"
              containerStyle={{ marginBottom: spacing[4] }}
            />
            <PrimaryButton
              label="Save Profile"
              onPress={handleSaveProfile}
              isLoading={isSaving}
            />
          </View>
        </View>

        {/* Appearance */}
        <SectionHeader title="Appearance" />
        <View
          style={[
            styles.card,
            elevation[1],
            { backgroundColor: colors.surface1, borderRadius: radius.lg, marginHorizontal: spacing[4] },
          ]}
        >
          <View style={{ padding: spacing[4] }}>
            <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: spacing[2] }]}>
              Theme
            </Text>
            <SegmentedControl
              segments={DARK_MODE_OPTIONS}
              selectedValue={String(darkModePreference)}
              onSelect={handleDarkMode}
            />
          </View>
        </View>

        {/* Pay Period */}
        <SectionHeader title="Pay Period" />
        <View
          style={[
            styles.card,
            elevation[1],
            { backgroundColor: colors.surface1, borderRadius: radius.lg, marginHorizontal: spacing[4] },
          ]}
        >
          <View style={{ padding: spacing[4] }}>
            <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: spacing[2] }]}>
              Pay period type
            </Text>
            <SegmentedControl
              segments={PAY_PERIOD_OPTIONS}
              selectedValue={settings?.pay_period_type ?? 'monthly_calendar'}
              onSelect={handlePayPeriod}
            />
          </View>
        </View>

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <View
          style={[
            styles.card,
            elevation[1],
            { backgroundColor: colors.surface1, borderRadius: radius.lg, marginHorizontal: spacing[4] },
          ]}
        >
          <SettingRow
            label="Notification status"
            subtitle={
              notificationsGranted === null
                ? 'Unknown'
                : notificationsGranted
                ? '✅ Enabled'
                : '⚠️ Disabled — go to Settings to enable'
            }
          />
          <View style={{ padding: spacing[4] }}>
            <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: spacing[2] }]}>
              Default reminder
            </Text>
            <SegmentedControl
              segments={REMINDER_OPTIONS}
              selectedValue={String(settings?.default_reminder_minutes ?? 60)}
              onSelect={handleDefaultReminder}
            />
          </View>
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View
          style={[
            styles.card,
            elevation[1],
            { backgroundColor: colors.surface1, borderRadius: radius.lg, marginHorizontal: spacing[4] },
          ]}
        >
          <SettingRow label="Version" right={<Text style={[typography.body2, { color: colors.textSecondary }]}>1.0.0</Text>} />
          <SettingRow
            label="Privacy"
            subtitle="All data stored locally on your device"
          />
          <SettingRow
            label="Open Source"
            subtitle="MyShifts — free for healthcare workers"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  card: {
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  settingLabel: {
    flex: 1,
  },
  settingRight: {
    marginLeft: 12,
  },
});
