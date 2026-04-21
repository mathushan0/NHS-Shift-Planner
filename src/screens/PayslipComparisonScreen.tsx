/**
 * PayslipComparisonScreen — Payslip Comparison Tool (Premium)
 *
 * Enter payslip gross amount, compare against calculated pay,
 * flag potential underpayment.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useTheme } from '../hooks/useTheme';
import { useShiftStore } from '../stores/shiftStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { PremiumLockOverlay, PremiumBadge } from '../components/molecules/PremiumBadge';
import { LoadingSpinner } from '../components/molecules/LoadingSpinner';
import { ShiftWithType } from '../types';
import { minutesToHoursLabel } from '../utils/hoursCalculator';

type Props = NativeStackScreenProps<any, 'PayslipComparison'>;

// Same band rates as PayCalculator
const AFC_BANDS = [
  { band: '1',  label: 'Band 1',  rate: 11.56 },
  { band: '2',  label: 'Band 2',  rate: 12.03 },
  { band: '3',  label: 'Band 3',  rate: 12.73 },
  { band: '4',  label: 'Band 4',  rate: 13.66 },
  { band: '5',  label: 'Band 5',  rate: 15.67 },
  { band: '6',  label: 'Band 6',  rate: 18.79 },
  { band: '7',  label: 'Band 7',  rate: 22.44 },
  { band: '8a', label: 'Band 8a', rate: 26.51 },
  { band: '8b', label: 'Band 8b', rate: 31.49 },
  { band: '8c', label: 'Band 8c', rate: 37.57 },
  { band: '8d', label: 'Band 8d', rate: 44.28 },
  { band: '9',  label: 'Band 9',  rate: 52.26 },
];

const MONTH_OPTIONS = Array.from({ length: 3 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return {
    label: format(d, 'MMMM yyyy'),
    value: format(d, 'yyyy-MM'),
    date: d,
  };
});

function getUnsocialEnhancement(shifts: ShiftWithType[], hourlyRate: number): number {
  let enhancement = 0;
  for (const s of shifts) {
    if (!s.shift_type.is_paid) continue;
    const start = new Date(s.start_datetime);
    const end = new Date(s.end_datetime);
    const cur = new Date(start);
    while (cur < end) {
      const day = cur.getDay();
      const hour = cur.getHours();
      const dateStr = format(cur, 'yyyy-MM-dd');
      const ratePerMin = hourlyRate / 60;
      if (day === 0) {
        enhancement += ratePerMin * 0.60; // Sunday +60%
      } else if (day === 6) {
        enhancement += ratePerMin * 0.30; // Saturday +30%
      } else if (hour >= 20 || hour < 6) {
        enhancement += ratePerMin * 0.30; // Weekday night +30%
      }
      cur.setMinutes(cur.getMinutes() + 1);
    }
  }
  return enhancement;
}

export function PayslipComparisonScreen({ navigation }: Props) {
  const { colors, typography, spacing, radius } = useTheme();
  const isPremium = useSubscriptionStore(s => s.isPremium);
  const { loadShiftsForDateRange } = useShiftStore();
  const userId = useSettingsStore(s => s.userId) ?? 'local-user-1';

  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[0].value);
  const [payslipGross, setPayslipGross] = useState('');
  const [selectedBand, setSelectedBand] = useState(AFC_BANDS[4]);
  const [customRate, setCustomRate] = useState('');
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [shifts, setShifts] = useState<ShiftWithType[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const hourlyRate = useMemo(() => {
    if (useCustomRate) {
      const r = parseFloat(customRate);
      return isNaN(r) || r <= 0 ? 0 : r;
    }
    return selectedBand.rate;
  }, [useCustomRate, customRate, selectedBand]);

  async function loadShifts() {
    if (hourlyRate <= 0) {
      Alert.alert('Rate needed', 'Please set your hourly rate or AfC band first.');
      return;
    }
    setIsLoading(true);
    const monthDate = MONTH_OPTIONS.find(m => m.value === selectedMonth)?.date ?? new Date();
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const loaded = await loadShiftsForDateRange(
      userId,
      format(start, 'yyyy-MM-dd'),
      format(end, 'yyyy-MM-dd')
    );
    setShifts(loaded);
    setHasLoaded(true);
    setIsLoading(false);
  }

  const paidShifts = shifts.filter(s => s.shift_type.is_paid);
  const totalMins = paidShifts.reduce((a, s) => a + s.duration_minutes, 0);
  const basicPay = (totalMins / 60) * hourlyRate;
  const enhancement = useMemo(() => {
    if (!hasLoaded || shifts.length === 0 || hourlyRate <= 0) return 0;
    return getUnsocialEnhancement(paidShifts, hourlyRate);
  }, [shifts, hourlyRate, hasLoaded]);
  const calculatedGross = basicPay + enhancement;

  const payslipAmount = parseFloat(payslipGross) || 0;
  const discrepancy = payslipAmount - calculatedGross;
  const discrepancyPct = calculatedGross > 0 ? Math.abs(discrepancy / calculatedGross) * 100 : 0;
  const isPotentialUnderpayment = payslipAmount > 0 && discrepancy < -5; // >£5 under

  const selectedMonthDate = MONTH_OPTIONS.find(m => m.value === selectedMonth)?.date ?? new Date();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      {!isPremium && <PremiumLockOverlay message="Payslip Comparison is a Premium Feature" />}
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: spacing[4] }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[typography.heading2, { color: colors.textPrimary }]}>Payslip Check</Text>
          <PremiumBadge size="sm" />
        </View>
        <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: spacing[4] }]}>
          Compare your payslip against your calculated hours × rate to spot discrepancies.
        </Text>

        {/* Month selector */}
        <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
          <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: spacing[2] }]}>Pay month</Text>
          <View style={styles.monthRow}>
            {MONTH_OPTIONS.map(m => (
              <TouchableOpacity
                key={m.value}
                onPress={() => setSelectedMonth(m.value)}
                style={[styles.monthChip, {
                  backgroundColor: m.value === selectedMonth ? colors.primary : colors.surface2,
                  borderRadius: radius.md,
                }]}
              >
                <Text style={[typography.caption, { color: m.value === selectedMonth ? '#FFFFFF' : colors.textPrimary, fontWeight: '600' }]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Rate input */}
        <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
          <View style={styles.rateHeaderRow}>
            <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700' }]}>Hourly Rate</Text>
            <View style={styles.rateToggle}>
              {['Band', 'Custom'].map((m, i) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setUseCustomRate(i === 1)}
                  style={[styles.modeBtn, {
                    backgroundColor: (useCustomRate ? i === 1 : i === 0) ? colors.primary : 'transparent',
                    borderRadius: radius.sm,
                  }]}
                >
                  <Text style={[typography.caption, {
                    color: (useCustomRate ? i === 1 : i === 0) ? '#FFFFFF' : colors.textSecondary,
                    fontWeight: '600',
                  }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {!useCustomRate ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bandScroll}>
                {AFC_BANDS.map(b => (
                  <TouchableOpacity
                    key={b.band}
                    onPress={() => setSelectedBand(b)}
                    style={[styles.bandChip, {
                      backgroundColor: b.band === selectedBand.band ? colors.primary : colors.surface2,
                      borderRadius: radius.sm,
                    }]}
                  >
                    <Text style={[typography.caption, { color: b.band === selectedBand.band ? '#FFFFFF' : colors.textPrimary, fontWeight: '700' }]}>
                      {b.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[typography.body2, { color: colors.textPrimary, marginTop: 8 }]}>
                Rate: £{selectedBand.rate.toFixed(2)}/hr
              </Text>
            </>
          ) : (
            <View style={[styles.inputRow, { borderColor: colors.border, borderRadius: radius.md, marginTop: 8 }]}>
              <Text style={[typography.heading3, { color: colors.textSecondary, marginLeft: 12 }]}>£</Text>
              <TextInput
                value={customRate}
                onChangeText={setCustomRate}
                keyboardType="decimal-pad"
                style={[typography.heading3, { flex: 1, color: colors.textPrimary, paddingHorizontal: 8, paddingVertical: 12 }]}
                placeholder="0.00"
                placeholderTextColor={colors.textDisabled}
              />
              <Text style={[typography.body2, { color: colors.textSecondary, marginRight: 12 }]}>/hr</Text>
            </View>
          )}
        </View>

        {/* Payslip gross input */}
        <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
          <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing[2] }]}>
            Payslip Gross Amount
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 8 }]}>
            Enter the gross (before tax) amount from your payslip for {format(selectedMonthDate, 'MMMM yyyy')}
          </Text>
          <View style={[styles.inputRow, { borderColor: colors.border, borderRadius: radius.md }]}>
            <Text style={[typography.heading3, { color: colors.textSecondary, marginLeft: 12 }]}>£</Text>
            <TextInput
              value={payslipGross}
              onChangeText={setPayslipGross}
              keyboardType="decimal-pad"
              style={[typography.heading3, { flex: 1, color: colors.textPrimary, paddingHorizontal: 8, paddingVertical: 12 }]}
              placeholder="0.00"
              placeholderTextColor={colors.textDisabled}
            />
          </View>
        </View>

        {/* Calculate button */}
        <TouchableOpacity
          onPress={loadShifts}
          disabled={isLoading || hourlyRate <= 0}
          style={[styles.calcButton, { backgroundColor: hourlyRate > 0 ? colors.primary : colors.border, borderRadius: radius.lg }]}
        >
          <Text style={[typography.body1, { color: '#FFFFFF', fontWeight: '700' }]}>
            {isLoading ? 'Loading shifts...' : 'Compare'}
          </Text>
        </TouchableOpacity>

        {/* Results */}
        {hasLoaded && (
          <>
            {/* Calculated pay */}
            <View style={[styles.resultsCard, { backgroundColor: colors.surface1, borderRadius: radius.xl }]}>
              <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing[3] }]}>
                Calculated Pay — {format(selectedMonthDate, 'MMMM yyyy')}
              </Text>

              <ResultRow label="Hours worked" value={minutesToHoursLabel(totalMins)} colors={colors} typography={typography} />
              <ResultRow label="Base rate" value={`£${hourlyRate.toFixed(2)}/hr`} colors={colors} typography={typography} />
              <ResultRow label="Basic pay" value={`£${basicPay.toFixed(2)}`} colors={colors} typography={typography} />
              <ResultRow label="Unsocial enhancements" value={`+£${enhancement.toFixed(2)}`} colors={colors} typography={typography} highlight />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <ResultRow label="Calculated gross" value={`£${calculatedGross.toFixed(2)}`} colors={colors} typography={typography} bold />
            </View>

            {/* Comparison */}
            {payslipAmount > 0 && (
              <View style={[
                styles.compCard,
                {
                  backgroundColor: isPotentialUnderpayment ? colors.error + '10' : colors.success + '10',
                  borderColor: isPotentialUnderpayment ? colors.error : colors.success,
                  borderRadius: radius.xl,
                },
              ]}>
                <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>
                  {isPotentialUnderpayment ? '🚨' : discrepancyPct > 5 ? '✅' : '✅'}
                </Text>

                <Text style={[typography.heading3, { color: colors.textPrimary, textAlign: 'center', fontWeight: '700' }]}>
                  {isPotentialUnderpayment ? 'Potential Underpayment' : 'Looks Good'}
                </Text>

                <View style={styles.compGrid}>
                  <CompItem label="Your payslip" value={`£${payslipAmount.toFixed(2)}`} typography={typography} colors={colors} />
                  <CompItem label="Calculated" value={`£${calculatedGross.toFixed(2)}`} typography={typography} colors={colors} />
                  <CompItem
                    label="Difference"
                    value={`${discrepancy >= 0 ? '+' : ''}£${discrepancy.toFixed(2)}`}
                    typography={typography}
                    colors={colors}
                    highlight={isPotentialUnderpayment}
                  />
                  <CompItem
                    label="% difference"
                    value={`${discrepancyPct.toFixed(1)}%`}
                    typography={typography}
                    colors={colors}
                  />
                </View>

                {isPotentialUnderpayment && (
                  <View style={[styles.underpayAlert, { backgroundColor: colors.error + '20', borderRadius: radius.md }]}>
                    <Text style={[typography.body2, { color: colors.error, fontWeight: '700', marginBottom: 4 }]}>
                      ⚠️ You may have been underpaid by £{Math.abs(discrepancy).toFixed(2)}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, lineHeight: 18 }]}>
                      This could be due to unpaid overtime, incorrect enhancement calculations, or a payroll error. 
                      Contact your payroll department with your shift records. Always check your employment contract for exact enhancement rates.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {shifts.length === 0 && (
              <Text style={[typography.body2, { color: colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>
                No paid shifts found for {format(selectedMonthDate, 'MMMM yyyy')}.
              </Text>
            )}

            {/* Disclaimer */}
            <View style={[styles.disclaimerCard, { backgroundColor: colors.surface2, borderRadius: radius.md }]}>
              <Text style={[typography.caption, { color: colors.textSecondary, lineHeight: 18 }]}>
                ⚠️ This comparison is an estimate. It does not account for tax, NI, pension, or all contractual variations. For accurate pay queries, contact your payroll department. Not financial or legal advice.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultRow({ label, value, colors, typography, highlight, bold }: any) {
  return (
    <View style={styles.resultRow}>
      <Text style={[typography.body2, { color: colors.textSecondary, flex: 1 }]}>{label}</Text>
      <Text style={[typography.body2, {
        color: highlight ? colors.success : bold ? colors.primary : colors.textPrimary,
        fontWeight: bold ? '800' : highlight ? '600' : '400',
      }]}>{value}</Text>
    </View>
  );
}

function CompItem({ label, value, typography, colors, highlight }: any) {
  return (
    <View style={styles.compItem}>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.heading3, { color: highlight ? colors.error : colors.textPrimary, fontWeight: '700' }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: 16, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  card: { padding: 16, marginBottom: 12 },
  monthRow: { flexDirection: 'row', gap: 8 },
  monthChip: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  rateHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  rateToggle: { flexDirection: 'row', gap: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: 4 },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  bandScroll: { gap: 8 },
  bandChip: { paddingHorizontal: 12, paddingVertical: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
  calcButton: { paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  resultsCard: { padding: 16, marginBottom: 12 },
  compCard: { padding: 20, marginBottom: 12, borderWidth: 1.5, alignItems: 'center' },
  compGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, width: '100%' },
  compItem: { width: '50%', alignItems: 'center', paddingVertical: 8 },
  underpayAlert: { padding: 12, marginTop: 12, width: '100%' },
  divider: { height: 1, marginVertical: 10 },
  resultRow: { flexDirection: 'row', paddingVertical: 6 },
  disclaimerCard: { padding: 12, marginTop: 4 },
});
