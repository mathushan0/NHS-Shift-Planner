import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../hooks/useTheme';
import { useShiftStore } from '../stores/shiftStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { getShiftTypes } from '../database/repositories/shiftTypeRepository';
import { FormTextInput } from '../components/atoms/FormTextInput';
import { PrimaryButton } from '../components/atoms/PrimaryButton';
import { SecondaryButton } from '../components/atoms/SecondaryButton';
import { ShiftTypeBadge } from '../components/atoms/ShiftTypeBadge';
import { BannerAlert } from '../components/molecules/BannerAlert';
import { ShiftType, AddShiftFormData } from '../types';
import {
  combineDateAndTime,
  calculateDurationMinutes,
  toDatetimeString,
  getDateFromDatetime,
  getTimeFromDatetime,
} from '../utils/dateUtils';

type Props = NativeStackScreenProps<any, 'AddEditShift'>;

const REMINDER_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: '1 day', value: 1440 },
];

const TEMPLATES_KEY = 'shift_templates';

interface ShiftTemplate {
  id: string;
  name: string;
  shift_type_id: string;
  start_time: string;
  end_time: string;
  location: string;
  notes: string;
  is_bank_shift: boolean;
  reminders: number[];
}

export function AddEditShiftScreen({ navigation, route }: Props) {
  const { colors, typography, spacing, radius } = useTheme();
  const { createShift, updateShift, loadShiftById, checkOverlap, selectedShift } = useShiftStore();
  const { showSnackbar } = useUIStore();
  const userId = useSettingsStore(s => s.userId) ?? 'local-user-1';
  // All reminder features available — premium tier not active in this build
  const isPremium = true;

  const shiftId: string | undefined = route.params?.shiftId;
  const initialDate: string | undefined = route.params?.initialDate;
  const isEditing = !!shiftId;

  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [date, setDate] = useState(initialDate ?? format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('19:30');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [isBankShift, setIsBankShift] = useState(false);
  const [selectedReminders, setSelectedReminders] = useState<number[]>([60]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    loadShiftTypes();
    loadTemplates();
    if (isEditing) loadExistingShift();
  }, []);

  async function loadShiftTypes() {
    const types = await getShiftTypes(userId);
    setShiftTypes(types);
    if (types.length > 0 && !selectedTypeId) {
      setSelectedTypeId(types[0].id);
    }
  }

  async function loadExistingShift() {
    const shift = await loadShiftById(shiftId!);
    if (!shift) return;
    setSelectedTypeId(shift.shift_type_id);
    setDate(getDateFromDatetime(shift.start_datetime));
    setStartTime(getTimeFromDatetime(shift.start_datetime));
    setEndTime(getTimeFromDatetime(shift.end_datetime));
    setLocation(shift.location ?? '');
    setNotes(shift.notes ?? '');
    setIsBankShift(shift.is_bank_shift === 1);
    setSelectedReminders(shift.reminders.map(r => r.minutes_before));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!selectedTypeId) errs.type = 'Please select a shift type';
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) errs.date = 'Enter date as YYYY-MM-DD';
    if (!startTime.match(/^\d{2}:\d{2}$/)) errs.startTime = 'Enter time as HH:MM';
    if (!endTime.match(/^\d{2}:\d{2}$/)) errs.endTime = 'Enter time as HH:MM';

    const start = combineDateAndTime(date, startTime);
    const end = combineDateAndTime(date, endTime);
    // Handle overnight shifts
    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }
    const duration = calculateDurationMinutes(start, end);
    if (duration < 15) errs.endTime = 'Shift must be at least 15 minutes';
    if (duration > 24 * 60) errs.endTime = 'Shift cannot exceed 24 hours';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function checkForOverlap(): Promise<boolean> {
    const start = combineDateAndTime(date, startTime);
    const end = combineDateAndTime(date, endTime);
    if (end <= start) end.setDate(end.getDate() + 1);

    const overlapping = await checkOverlap(
      userId,
      toDatetimeString(start),
      toDatetimeString(end),
      isEditing ? shiftId : undefined
    );

    if (overlapping.length > 0) {
      const names = overlapping.map(s => s.shift_type.name).join(', ');
      setOverlapWarning(`Overlaps with: ${names}`);
      return true;
    }
    setOverlapWarning(null);
    return false;
  }

  async function handleSave() {
    if (!validate()) return;

    const hasOverlap = await checkForOverlap();

    // Allow save even with overlap after user is warned
    setIsLoading(true);
    try {
      const start = combineDateAndTime(date, startTime);
      const end = combineDateAndTime(date, endTime);
      if (end <= start) end.setDate(end.getDate() + 1);

      const duration = calculateDurationMinutes(start, end);

      if (isEditing) {
        await updateShift(
          shiftId!,
          {
            shift_type_id: selectedTypeId,
            start_datetime: toDatetimeString(start),
            end_datetime: toDatetimeString(end),
            duration_minutes: duration,
            location: location.trim() || null,
            notes: notes.trim() || null,
            is_bank_shift: isBankShift ? 1 : 0,
          },
          selectedReminders
        );
        showSnackbar({ message: 'Shift updated', variant: 'success' });
      } else {
        await createShift(userId, {
          user_id: userId,
          shift_type_id: selectedTypeId,
          start_datetime: toDatetimeString(start),
          end_datetime: toDatetimeString(end),
          duration_minutes: duration,
          location: location.trim() || null,
          notes: notes.trim() || null,
          is_bank_shift: isBankShift ? 1 : 0,
          status: 'scheduled',
        });
        showSnackbar({ message: 'Shift added', variant: 'success' });
      }
      navigation.goBack();
    } catch {
      showSnackbar({ message: 'Failed to save shift', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTemplates() {
    try {
      const raw = await AsyncStorage.getItem(TEMPLATES_KEY);
      if (raw) setTemplates(JSON.parse(raw));
    } catch {}
  }

  async function saveTemplate() {
    if (!templateName.trim()) {
      Alert.alert('Name required', 'Give your template a name.');
      return;
    }
    const template: ShiftTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      shift_type_id: selectedTypeId,
      start_time: startTime,
      end_time: endTime,
      location,
      notes,
      is_bank_shift: isBankShift,
      reminders: selectedReminders,
    };
    const updated = [...templates, template];
    setTemplates(updated);
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
    setTemplateName('');
    setShowTemplateModal(false);
    showSnackbar({ message: 'Template saved', variant: 'success' });
  }

  async function deleteTemplate(id: string) {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
  }

  function applyTemplate(t: ShiftTemplate) {
    setSelectedTypeId(t.shift_type_id);
    setStartTime(t.start_time);
    setEndTime(t.end_time);
    setLocation(t.location);
    setNotes(t.notes);
    setIsBankShift(t.is_bank_shift);
    setSelectedReminders(t.reminders);
    setShowTemplateModal(false);
    showSnackbar({ message: `Template "${t.name}" applied`, variant: 'success' });
  }

  const maxReminders = isPremium ? 5 : 1;

  function toggleReminder(minutes: number) {
    setSelectedReminders(prev => {
      if (prev.includes(minutes)) return prev.filter(m => m !== minutes);
      if (prev.length >= maxReminders) {
        if (!isPremium) {
          Alert.alert(
            'Premium Feature',
            'Upgrade to Premium to add up to 5 reminders per shift.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Upgrade', onPress: () => navigation.navigate('Subscription') },
            ]
          );
          return prev;
        }
        return prev;
      }
      return [...prev, minutes];
    });
  }

  const selectedType = shiftTypes.find(t => t.id === selectedTypeId);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingHorizontal: spacing[4] }]}
          keyboardShouldPersistTaps="handled"
        >
          {overlapWarning ? (
            <BannerAlert
              variant="warning"
              message={overlapWarning}
              style={{ marginBottom: spacing[3] }}
            />
          ) : null}

          {/* Shift type */}
          <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: spacing[2] }]}>
            Shift Type *
          </Text>
          {errors.type ? (
            <Text style={[typography.caption, { color: colors.error, marginBottom: 4 }]}>{errors.type}</Text>
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeScroll}
          >
            {shiftTypes.map(type => (
              <TouchableOpacity
                key={type.id}
                onPress={() => setSelectedTypeId(type.id)}
                style={[
                  styles.typeChip,
                  {
                    borderColor: type.id === selectedTypeId ? type.colour_hex : colors.border,
                    borderRadius: radius.md,
                    backgroundColor:
                      type.id === selectedTypeId
                        ? type.colour_hex + '22'
                        : colors.surface1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: type.id === selectedTypeId }}
              >
                <View
                  style={[styles.typeDot, { backgroundColor: type.colour_hex }]}
                />
                <Text
                  style={[
                    typography.body2,
                    {
                      color: type.id === selectedTypeId ? type.colour_hex : colors.textPrimary,
                      fontWeight: '600',
                    },
                  ]}
                >
                  {type.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Date */}
          <FormTextInput
            label="Date *"
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            returnKeyType="next"
            error={errors.date}
            containerStyle={{ marginBottom: spacing[3] }}
          />

          {/* Times */}
          <View style={styles.timeRow}>
            <FormTextInput
              label="Start time *"
              value={startTime}
              onChangeText={setStartTime}
              placeholder="HH:MM"
              keyboardType="numbers-and-punctuation"
              returnKeyType="next"
              error={errors.startTime}
              containerStyle={{ flex: 1, marginRight: spacing[2] }}
            />
            <FormTextInput
              label="End time *"
              value={endTime}
              onChangeText={setEndTime}
              placeholder="HH:MM"
              keyboardType="numbers-and-punctuation"
              returnKeyType="next"
              error={errors.endTime}
              containerStyle={{ flex: 1 }}
            />
          </View>

          {/* Location */}
          <FormTextInput
            label="Location"
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Ward 4, Main Theatre"
            autoCapitalize="words"
            returnKeyType="next"
            containerStyle={{ marginBottom: spacing[3] }}
          />

          {/* Notes */}
          <FormTextInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes... (Do not enter patient information)"
            multiline
            numberOfLines={3}
            returnKeyType="default"
            containerStyle={{ marginBottom: spacing[3] }}
            style={{ minHeight: 80, paddingTop: 12 }}
          />

          {/* Bank shift toggle */}
          <View
            style={[
              styles.toggleRow,
              {
                backgroundColor: colors.surface1,
                borderRadius: radius.md,
                padding: spacing[4],
                marginBottom: spacing[3],
              },
            ]}
          >
            <View style={styles.flex}>
              <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '600' }]}>
                Bank / agency shift
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Mark this as a bank or agency shift
              </Text>
            </View>
            <Switch
              value={isBankShift}
              onValueChange={setIsBankShift}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Bank shift"
            />
          </View>

          {/* Templates (Premium) */}
          {isPremium && (
            <View style={{ marginBottom: spacing[3] }}>
              <View style={styles.templateHeader}>
                <Text style={[typography.body2, { color: colors.textSecondary }]}>Templates</Text>
                <TouchableOpacity onPress={() => setShowTemplateModal(true)} style={styles.templateBtn}>
                  <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>Load / Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Reminders */}
          <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: spacing[2] }]}>
            Reminders {isPremium ? '(up to 5)' : '(1 on free)'}
          </Text>
          <View style={styles.reminderRow}>
            {REMINDER_OPTIONS.map(opt => {
              const isSelected = selectedReminders.includes(opt.value);
              const isLocked = !isPremium && !isSelected && selectedReminders.length >= 1;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => toggleReminder(opt.value)}
                  style={[
                    styles.reminderChip,
                    {
                      backgroundColor: isSelected ? colors.primary : isLocked ? colors.surface2 : colors.surface1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderRadius: radius.md,
                      opacity: isLocked ? 0.5 : 1,
                    },
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                >
                  <Text
                    style={[
                      typography.body2,
                      { color: isSelected ? '#FFFFFF' : colors.textPrimary, fontWeight: '600' },
                    ]}
                  >
                    {opt.label}{isLocked ? ' 👑' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Template Modal */}
          <Modal
            visible={showTemplateModal}
            animationType="slide"
            transparent
            onRequestClose={() => setShowTemplateModal(false)}
          >
            <View style={[styles.modalOverlay]}>
              <View style={[styles.modalCard, { backgroundColor: colors.surface1, borderRadius: radius.xl }]}>
                <Text style={[typography.heading3, { color: colors.textPrimary, marginBottom: spacing[4] }]}>
                  Shift Templates
                </Text>

                {templates.length > 0 ? (
                  templates.map(t => (
                    <View key={t.id} style={[styles.templateRow, { borderColor: colors.border }]}>
                      <TouchableOpacity onPress={() => applyTemplate(t)} style={{ flex: 1 }}>
                        <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '600' }]}>{t.name}</Text>
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>
                          {t.start_time}–{t.end_time}{t.location ? ` · ${t.location}` : ''}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteTemplate(t.id)} style={styles.deleteTemplatBtn}>
                        <Text style={[typography.caption, { color: colors.error }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: spacing[3] }]}>
                    No saved templates yet.
                  </Text>
                )}

                <Text style={[typography.body2, { color: colors.textSecondary, marginTop: spacing[3], marginBottom: spacing[2] }]}>
                  Save current shift as template
                </Text>
                <TextInput
                  value={templateName}
                  onChangeText={setTemplateName}
                  placeholder="e.g. My Long Day"
                  placeholderTextColor={colors.textDisabled}
                  style={[
                    typography.body1,
                    {
                      color: colors.textPrimary,
                      borderWidth: 1.5,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      minHeight: 44,
                      marginBottom: spacing[2],
                    },
                  ]}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    onPress={saveTemplate}
                    style={[styles.modalBtn, { backgroundColor: colors.primary, borderRadius: radius.md }]}
                  >
                    <Text style={[typography.body2, { color: '#FFFFFF', fontWeight: '700' }]}>Save Template</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowTemplateModal(false)}
                    style={[styles.modalBtn, { backgroundColor: colors.surface2, borderRadius: radius.md }]}
                  >
                    <Text style={[typography.body2, { color: colors.textPrimary, fontWeight: '600' }]}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Save / Cancel */}
          <PrimaryButton
            label={isEditing ? 'Save Changes' : 'Add Shift'}
            onPress={handleSave}
            isLoading={isLoading}
            style={{ marginTop: spacing[6], marginBottom: spacing[3] }}
          />
          <SecondaryButton
            label="Cancel"
            onPress={() => navigation.goBack()}
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
  content: { paddingTop: 16, paddingBottom: 40 },
  typeScroll: { gap: 8, paddingBottom: 12 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    gap: 6,
    minHeight: 44,
  },
  typeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reminderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  reminderChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    minHeight: 44,
    justifyContent: 'center',
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  templateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    padding: 24,
    paddingBottom: 40,
    maxHeight: '75%',
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  deleteTemplatBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  templateInput: {
    borderWidth: 1.5,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
});
