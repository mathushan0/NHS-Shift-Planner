/**
 * PayCalculatorScreen — NHS Pay Calculator (Premium)
 *
 * Calculates gross pay including Agenda for Change unsocial hours enhancements:
 *   Weekday nights (8pm–6am): +30%
 *   Saturday (all day):       +30%
 *   Sunday / Bank Holiday:    +60%
 *
 * AfC bands 1-9 with 2024/25 pay point rates.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { startOfWeek, endOfWeek, eachDayOfInterval, getDay, format } from 'date-fns';
import { useTheme } from '../hooks/useTheme';
import { useShiftStore } from '../stores/shiftStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { PremiumLockOverlay, PremiumBadge } from '../components/molecules/PremiumBadge';
import { ShiftWithType } from '../types';
import { minutesToHoursLabel } from '../utils/hoursCalculator';

type Props = NativeStackScreenProps<any, 'PayCalculator'>;

// AfC 2024/25 pay band minimum-maximum ranges (£/hour based on midpoint of scale)
// Source: NHS Employers AfC pay circular 2024/25
const AFC_BANDS: Array<{ band: string; label: string; minRate: number; maxRate: number }> = [
  { band: '1',  label: 'Band 1',  minRate: 11.45, maxRate: 11.67 },
  { band: '2',  label: 'Band 2',  minRate: 11.67, maxRate: 12.38 },
  { band: '3',  label: 'Band 3',  minRate: 12.38, maxRate: 13.07 },
  { band: '4',  label: 'Band 4',  minRate: 13.07, maxRate: 14.24 },
  { band: '5',  label: 'Band 5',  minRate: 14.24, maxRate: 17.09 },
  { band: '6',  label: 'Band 6',  minRate: 17.09, maxRate: 20.48 },
  { band: '7',  label: 'Band 7',  minRate: 20.48, maxRate: 24.40 },
  { band: '8a', label: 'Band 8a', minRate: 24.40, maxRate: 28.61 },
  { band: '8b', label: 'Band 8b', minRate: 28.61, maxRate: 34.36 },
  { band: '8c', label: 'Band 8c', minRate: 34.36, maxRate: 40.78 },
  { band: '8d', label: 'Band 8d', minRate: 40.78, maxRate: 47.77 },
  { band: '9',  label: 'Band 9',  minRate: 47.77, maxRate: 56.74 },
];

type InputMode = 'band' | 'custom';

interface PayBreakdown {
  basicMinutes: number;
  weekdayNightMinutes: number;
  saturdayMinutes: number;
  sundayBankHolMinutes: number;
  basicPay: number;
  weekdayNightEnhancement: number;
  saturdayEnhancement: number;
  sundayBankHolEnhancement: number;
  grossPay: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUnsocialMinutes(shift: ShiftWithType, bankHolidayDates: string[]): {
  basic: number;
  weekdayNight: number;
  saturday: number;
  sundayBankHol: number;
} {
  const start = new Date(shift.start_datetime);
  const end = new Date(shift.end_datetime);

  let basic = 0, weekdayNight = 0, saturday = 0, sundayBankHol = 0;

  // Walk minute-by-minute for accuracy (shifts ≤ 25h = ≤ 1500 iterations, fine)
  const cur = new Date(start);
  while (cur < end) {
    const day = getDay(cur); // 0=Sun, 6=Sat
    const hour = cur.getHours();
    const dateStr = format(cur, 'yyyy-MM-dd');
    const isBankHol = bankHolidayDates.includes(dateStr);

    if (isBankHol || day === 0) {
      sundayBankHol++;
    } else if (day === 6) {
      saturday++;
    } else if (hour >= 20 || hour < 6) {
      weekdayNight++;
    } else {
      basic++;
    }
    cur.setMinutes(cur.getMinutes() + 1);
  }

  return { basic, weekdayNight, saturday, sundayBankHol };
}

function calcPay(shifts: ShiftWithType[], hourlyRate: number, bankHolidayDates: string[]): PayBreakdown {
  let basicMinutes = 0, weekdayNightMinutes = 0, saturdayMinutes = 0, sundayBankHolMinutes = 0;

  for (const shift of shifts) {
    if (!shift.shift_type.is_paid) continue;
    const mins = getUnsocialMinutes(shift, bankHolidayDates);
    basicMinutes += mins.basic;
    weekdayNightMinutes += mins.weekdayNight;
    saturdayMinutes += mins.saturday;
    sundayBankHolMinutes += mins.sundayBankHol;
  }

  const ratePerMin = hourlyRate / 60;
  const basicPay = basicMinutes * ratePerMin;
  const weekdayNightEnhancement = weekdayNightMinutes * ratePerMin * 0.30;
  const saturdayEnhancement = saturdayMinutes * ratePerMin * 0.30;
  const sundayBankHolEnhancement = sundayBankHolMinutes * ratePerMin * 0.60;

  // Total: basic + enhancements (unsocial pay = basic rate + enhancement %, not replacement)
  const grossPay = basicPay + weekdayNightEnhancement + saturdayEnhancement + sundayBankHolEnhancement
    + (weekdayNightMinutes + saturdayMinutes + sundayBankHolMinutes) * ratePerMin; // base for unsocial hours

  return {
    basicMinutes,
    weekdayNightMinutes,
    saturdayMinutes,
    sundayBankHolMinutes,
    basicPay,
    weekdayNightEnhancement,
    saturdayEnhancement,
    sundayBankHolEnhancement,
    grossPay: basicPay
      + (weekdayNightMinutes * ratePerMin) + weekdayNightEnhancement
      + (saturdayMinutes * ratePerMin) + saturdayEnhancement
      + (sundayBankHolMinutes * ratePerMin) + sundayBankHolEnhancement,
  };
}

function fmt(amount: number) {
  return `£${amount.toFixed(2)}`;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function PayCalculatorScreen({ navigation }: Props) {
  const { colors, typography, spacing, radius, elevation } = useTheme();
  const isPremium = useSubscriptionStore(s => s.isPremium);
  const { loadShiftsForDateRange } = useShiftStore();
  const userId = useSettingsStore(s => s.userId) ?? 'local-user-1';
  const contractedHoursPerWeek = useSettingsStore(s => s.contractedHoursPerWeek) ?? 37.5;

  const [inputMode, setInputMode] = useState<InputMode>('band');
  const [selectedBand, setSelectedBand] = useState(AFC_BANDS[4]); // Band 5 default (nurses)
  const [customRate, setCustomRate] = useState('');
  const [periodType, setPeriodType] = useState<'week' | 'month' | '4week'>('month');
  const [shifts, setShifts] = useState<ShiftWithType[]>([]);
  const [bankHolidayDates] = useState<string[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const hourlyRate = useMemo(() => {
    if (inputMode === 'custom') {
      const r = parseFloat(customRate);
      return isNaN(r) || r <= 0 ? 0 : r;
    }
    // Use midpoint of band range
    return (selectedBand.minRate + selectedBand.maxRate) / 2;
  }, [inputMode, customRate, selectedBand]);

  async function loadShifts() {
    setIsLoading(true);
    const now = new Date();
    let start: Date, end: Date;

    if (periodType === 'week') {
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
    } else if (periodType === '4week') {
      start = new Date(now);
      start.setDate(now.getDate() - 28);
      end = now;
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const loaded = await loadShiftsForDateRange(
      userId,
      format(start, 'yyyy-MM-dd'),
      format(end, 'yyyy-MM-dd')
    );
    setShifts(loaded);
    setHasLoaded(true);
    setIsLoading(false);
  }

  const breakdown = useMemo(() => {
    if (!hasLoaded || hourlyRate <= 0 || shifts.length === 0) return null;
    return calcPay(shifts, hourlyRate, bankHolidayDates);
  }, [shifts, hourlyRate, bankHolidayDates, hasLoaded]);

  const totalMinutes = shifts.filter(s => s.shift_type.is_paid).reduce((a, s) => a + s.duration_minutes, 0);
  const contractedPayPeriod = (() => {
    if (hourlyRate <= 0) return 0;
    let hours = contractedHoursPerWeek;
    if (periodType === 'month') hours = contractedHoursPerWeek * 4.33;
    if (periodType === '4week') hours = contractedHoursPerWeek * 4;
    return hours * hourlyRate;
  })();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      {!isPremium && (
        <PremiumLockOverlay message="Pay Calculator is a Premium Feature" />
      )}
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: spacing[4] }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[typography.heading2, { color: colors.textPrimary }]}>Pay Calculator</Text>
          <PremiumBadge size="sm" />
        </View>
        <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: spacing[4] }]}>
          Calculate your NHS pay including unsocial hours enhancements (AfC 2024/25).
        </Text>

        {/* Input mode toggle */}
        <View style={[styles.modeRow, { backgroundColor: colors.surface1, borderRadius: radius.lg, padding: spacing[4] }]}>
          <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '600', flex: 1 }]}>
            Input mode
          </Text>
          <View style={styles.modeToggle}>
            {(['band', 'custom'] as InputMode[]).map(m => (
              <TouchableOpacity
                key={m}
                onPress={() => setInputMode(m)}
                style={[
                  styles.modeBtn,
                  {
                    backgroundColor: inputMode === m ? colors.primary : 'transparent',
                    borderRadius: radius.sm,
                  },
                ]}
              >
                <Text style={[typography.caption, { color: inputMode === m ? '#FFFFFF' : colors.textSecondary, fontWeight: '600' }]}>
                  {m === 'band' ? 'AfC Band' : 'Custom Rate'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Band selector */}
        {inputMode === 'band' && (
          <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
            <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: spacing[2] }]}>Select Band</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bandScroll}>
              {AFC_BANDS.map(b => (
                <TouchableOpacity
                  key={b.band}
                  onPress={() => setSelectedBand(b)}
                  style={[
                    styles.bandChip,
                    {
                      backgroundColor: b.band === selectedBand.band ? colors.primary : colors.surface2,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Text style={[typography.caption, { color: b.band === selectedBand.band ? '#FFFFFF' : colors.textPrimary, fontWeight: '700' }]}>
                    {b.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[typography.body2, { color: colors.textPrimary, marginTop: spacing[3] }]}>
              Approximate hourly rate: {fmt(hourlyRate)}/hr
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Based on midpoint of {selectedBand.label} range ({fmt(selectedBand.minRate)}–{fmt(selectedBand.maxRate)}/hr)
            </Text>
          </View>
        )}

        {inputMode === 'custom' && (
          <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
            <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: spacing[2] }]}>Hourly rate (£)</Text>
            <View style={[styles.rateInputRow, { borderColor: colors.border, borderRadius: radius.md }]}>
              <Text style={[typography.heading3, { color: colors.textSecondary, marginLeft: 12 }]}>£</Text>
              <TextInput
                style={[typography.heading3, { flex: 1, color: colors.textPrimary, paddingHorizontal: 8, paddingVertical: 12 }]}
                value={customRate}
                onChangeText={setCustomRate}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textDisabled}
              />
              <Text style={[typography.body2, { color: colors.textSecondary, marginRight: 12 }]}>/hr</Text>
            </View>
          </View>
        )}

        {/* Period selector */}
        <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
          <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: spacing[2] }]}>Pay period</Text>
          <View style={styles.periodRow}>
            {([
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: '4week', label: 'Last 4 Weeks' },
            ] as Array<{ key: typeof periodType; label: string }>).map(p => (
              <TouchableOpacity
                key={p.key}
                onPress={() => setPeriodType(p.key)}
                style={[
                  styles.periodBtn,
                  {
                    backgroundColor: periodType === p.key ? colors.primary : colors.surface2,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <Text style={[typography.caption, { color: periodType === p.key ? '#FFFFFF' : colors.textPrimary, fontWeight: '600' }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Calculate button */}
        <TouchableOpacity
          onPress={loadShifts}
          disabled={hourlyRate <= 0 || isLoading}
          style={[styles.calcButton, { backgroundColor: hourlyRate > 0 ? colors.primary : colors.border, borderRadius: radius.lg }]}
        >
          <Text style={[typography.body1, { color: '#FFFFFF', fontWeight: '700' }]}>
            {isLoading ? 'Calculating...' : 'Calculate Pay'}
          </Text>
        </TouchableOpacity>

        {/* Results */}
        {breakdown && (
          <>
            <View style={[styles.resultsCard, { backgroundColor: colors.primary, borderRadius: radius.xl, marginTop: spacing[4] }]}>
              <Text style={[typography.caption, { color: 'rgba(255,255,255,0.8)' }]}>ESTIMATED GROSS PAY</Text>
              <Text style={[typography.heading1, { color: '#FFFFFF', fontWeight: '800' }]}>
                {fmt(breakdown.grossPay)}
              </Text>
              <Text style={[typography.caption, { color: 'rgba(255,255,255,0.8)', marginTop: 4 }]}>
                {minutesToHoursLabel(totalMinutes)} worked · {fmt(hourlyRate)}/hr base rate
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
              <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing[3] }]}>
                Breakdown
              </Text>

              <PayRow label="Basic pay" minutes={breakdown.basicMinutes} amount={breakdown.basicPay} colors={colors} typography={typography} />
              {breakdown.weekdayNightMinutes > 0 && (
                <>
                  <PayRow label="Weekday nights (base)" minutes={breakdown.weekdayNightMinutes} amount={breakdown.weekdayNightMinutes / 60 * hourlyRate} colors={colors} typography={typography} />
                  <PayRow label="  +30% night enhancement" minutes={0} amount={breakdown.weekdayNightEnhancement} colors={colors} typography={typography} highlight />
                </>
              )}
              {breakdown.saturdayMinutes > 0 && (
                <>
                  <PayRow label="Saturday (base)" minutes={breakdown.saturdayMinutes} amount={breakdown.saturdayMinutes / 60 * hourlyRate} colors={colors} typography={typography} />
                  <PayRow label="  +30% Saturday enhancement" minutes={0} amount={breakdown.saturdayEnhancement} colors={colors} typography={typography} highlight />
                </>
              )}
              {breakdown.sundayBankHolMinutes > 0 && (
                <>
                  <PayRow label="Sunday/Bank Hol (base)" minutes={breakdown.sundayBankHolMinutes} amount={breakdown.sundayBankHolMinutes / 60 * hourlyRate} colors={colors} typography={typography} />
                  <PayRow label="  +60% Sun/BH enhancement" minutes={0} amount={breakdown.sundayBankHolEnhancement} colors={colors} typography={typography} highlight />
                </>
              )}

              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.totalRow}>
                <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700' }]}>Total gross</Text>
                <Text style={[typography.body1, { color: colors.primary, fontWeight: '800' }]}>{fmt(breakdown.grossPay)}</Text>
              </View>
            </View>

            {/* Contracted pay comparison */}
            {contractedPayPeriod > 0 && (
              <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
                <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing[2] }]}>
                  vs Contracted Pay
                </Text>
                <View style={styles.compRow}>
                  <Text style={[typography.body2, { color: colors.textSecondary, flex: 1 }]}>Contracted ({contractedHoursPerWeek}h/wk)</Text>
                  <Text style={[typography.body2, { color: colors.textPrimary, fontWeight: '600' }]}>{fmt(contractedPayPeriod)}</Text>
                </View>
                <View style={styles.compRow}>
                  <Text style={[typography.body2, { color: colors.textSecondary, flex: 1 }]}>Your calculated pay</Text>
                  <Text style={[typography.body2, { color: colors.primary, fontWeight: '600' }]}>{fmt(breakdown.grossPay)}</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.compRow}>
                  <Text style={[typography.body2, { color: colors.textSecondary, flex: 1 }]}>Difference</Text>
                  <Text style={[
                    typography.body2,
                    { fontWeight: '700', color: breakdown.grossPay >= contractedPayPeriod ? colors.success : colors.error },
                  ]}>
                    {breakdown.grossPay >= contractedPayPeriod ? '+' : ''}{fmt(breakdown.grossPay - contractedPayPeriod)}
                  </Text>
                </View>
              </View>
            )}

            <View style={[styles.disclaimerCard, { backgroundColor: colors.surface2, borderRadius: radius.md }]}>
              <Text style={[typography.caption, { color: colors.textSecondary, lineHeight: 18 }]}>
                ⚠️ These calculations are estimates only. They do not account for tax, NI, pension contributions, or all contractual details. Always refer to your payslip and employment contract. Not financial advice.
              </Text>
            </View>
          </>
        )}

        {hasLoaded && shifts.length === 0 && (
          <Text style={[typography.body2, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing[4] }]}>
            No paid shifts found for this period.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PayRow({ label, minutes, amount, colors, typography, highlight }: any) {
  return (
    <View style={styles.payRow}>
      <Text style={[typography.body2, { color: highlight ? colors.success : colors.textSecondary, flex: 1 }]}>{label}</Text>
      {minutes > 0 && (
        <Text style={[typography.caption, { color: colors.textDisabled, marginRight: 8 }]}>
          {minutesToHoursLabel(minutes)}
        </Text>
      )}
      <Text style={[typography.body2, { color: highlight ? colors.success : colors.textPrimary, fontWeight: '600' }]}>
        {amount > 0 ? `+${(amount).toFixed(2)}` : `£${amount.toFixed(2)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: 16, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  modeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  modeToggle: { flexDirection: 'row', gap: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: 4 },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  card: { padding: 16, marginBottom: 12 },
  bandScroll: { gap: 8 },
  bandChip: { paddingHorizontal: 12, paddingVertical: 8 },
  rateInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
  periodRow: { flexDirection: 'row', gap: 8 },
  periodBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  calcButton: { paddingVertical: 16, alignItems: 'center', marginBottom: 4 },
  resultsCard: { padding: 24, alignItems: 'center', marginBottom: 12 },
  divider: { height: 1, marginVertical: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  compRow: { flexDirection: 'row', paddingVertical: 6 },
  disclaimerCard: { padding: 12, marginTop: 8 },
});
