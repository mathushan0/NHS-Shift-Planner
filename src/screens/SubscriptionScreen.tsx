// @ts-nocheck — V2 premium screen: not active in MVP build
/**
 * SubscriptionScreen — Premium upsell & subscription management.
 * Shows plan comparison, feature list, pricing, and purchase/restore buttons.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../hooks/useTheme';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { subscriptionService } from '../services/subscription';
import { PrimaryButton } from '../components/atoms/PrimaryButton';
import { SecondaryButton } from '../components/atoms/SecondaryButton';

type Props = NativeStackScreenProps<any, 'Subscription'>;

const PREMIUM_FEATURES = [
  { icon: '💷', name: 'Pay Calculator', desc: 'Calculate NHS pay with unsocial hours enhancements' },
  { icon: '📊', name: 'Analytics', desc: 'Work pattern analysis, fatigue risk, hours trends' },
  { icon: '📅', name: 'Calendar Sync', desc: 'Export shifts to your device calendar' },
  { icon: '🌴', name: 'Annual Leave Tracker', desc: 'Track entitlement, taken days and balance' },
  { icon: '⏱️', name: 'Overtime Monitor', desc: 'WTD compliance and overtime trend charts' },
  { icon: '📋', name: 'Shift Templates', desc: 'Save & reuse common shift patterns' },
  { icon: '🔔', name: 'Multiple Reminders', desc: 'Up to 5 reminders per shift' },
  { icon: '📄', name: 'PDF & CSV Export', desc: 'Professional shift history reports' },
  { icon: '🧾', name: 'Payslip Comparison', desc: 'Spot underpayments vs your calculated pay' },
];

const FREE_FEATURES = [
  { icon: '📅', name: 'Shift Calendar', desc: 'Visual monthly calendar view' },
  { icon: '⏰', name: 'Hours Summary', desc: 'Basic worked hours tracking' },
  { icon: '🔔', name: '1 Reminder per shift', desc: 'Basic shift reminders' },
  { icon: '📱', name: 'Shift History', desc: 'View past shifts' },
];

export function SubscriptionScreen({ navigation }: Props) {
  const { colors, typography, spacing, radius, elevation } = useTheme();
  const { isPremium, plan, expiryDate, isInTrialPeriod, trialEndsAt, isLoading, purchase, restorePurchases } =
    useSubscriptionStore();

  const [offerings, setOfferings] = useState<{
    monthly: { productId: string; price: string; description: string } | null;
    annual: { productId: string; price: string; description: string } | null;
  }>({ monthly: null, annual: null });
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [loadingOfferings, setLoadingOfferings] = useState(true);

  useEffect(() => {
    loadOfferings();
  }, []);

  async function loadOfferings() {
    setLoadingOfferings(true);
    try {
      const o = await subscriptionService.getOfferings();
      setOfferings(o);
    } catch {
      // fallback prices shown
    } finally {
      setLoadingOfferings(false);
    }
  }

  async function handlePurchase() {
    const productId = selectedPlan === 'annual'
      ? 'myshifts_premium_annual'
      : 'myshifts_premium_monthly';
    try {
      const success = await purchase(productId);
      if (success) {
        Alert.alert('Welcome to Premium! 🎉', 'You now have access to all premium features. Enjoy!', [
          { text: 'Get Started', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Purchase Failed', err?.message ?? 'Something went wrong. Please try again.');
    }
  }

  async function handleRestore() {
    try {
      await restorePurchases();
      Alert.alert(
        isPremium ? 'Purchases Restored ✓' : 'No Active Subscription',
        isPremium
          ? 'Your Premium subscription has been restored.'
          : 'No active Premium subscription found on this Apple ID.'
      );
    } catch (err: any) {
      Alert.alert('Restore Failed', err?.message ?? 'Could not restore purchases.');
    }
  }

  const monthlyPrice = offerings.monthly?.price ?? '£2.99/month';
  const annualPrice = offerings.annual?.price ?? '£24.99/year';
  const annualMonthlyEquiv = '£2.08/month';

  if (isPremium) {
    // Already subscribed view
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
        <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: spacing[4] }]}>
          <View style={[styles.heroBanner, { backgroundColor: '#FFB81C', borderRadius: radius.xl }]}>
            <Text style={styles.heroEmoji}>👑</Text>
            <Text style={[typography.heading2, { color: '#231F20', fontWeight: '800' }]}>
              You're Premium!
            </Text>
            <Text style={[typography.body2, { color: '#231F20', marginTop: 4, opacity: 0.8 }]}>
              {isInTrialPeriod
                ? `Free trial active · ends ${trialEndsAt ? new Date(trialEndsAt).toLocaleDateString('en-GB') : '—'}`
                : plan === 'premium_annual'
                ? `Annual plan · renews ${expiryDate ? new Date(expiryDate).toLocaleDateString('en-GB') : '—'}`
                : `Monthly plan · renews ${expiryDate ? new Date(expiryDate).toLocaleDateString('en-GB') : '—'}`}
            </Text>
          </View>

          <Text style={[typography.heading3, { color: colors.textPrimary, marginTop: spacing[6], marginBottom: spacing[3] }]}>
            Your Premium Features
          </Text>
          {PREMIUM_FEATURES.map((f, i) => (
            <FeatureRow key={i} icon={f.icon} name={f.name} desc={f.desc} included />
          ))}

          <SecondaryButton
            label="Restore Purchases"
            onPress={handleRestore}
            style={{ marginTop: spacing[6], marginBottom: spacing[4] }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: spacing[4] }]}>
        {/* Hero */}
        <View style={[styles.heroBanner, { backgroundColor: '#FFB81C', borderRadius: radius.xl }]}>
          <Text style={styles.heroEmoji}>👑</Text>
          <Text style={[typography.heading2, { color: '#231F20', fontWeight: '800' }]}>
            MyShifts Premium
          </Text>
          <Text style={[typography.body2, { color: '#231F20', opacity: 0.8, marginTop: 4, textAlign: 'center' }]}>
            Unlock powerful tools built for NHS workers
          </Text>
          <View style={[styles.trialBadge, { backgroundColor: '#231F20' }]}>
            <Text style={[typography.caption, { color: '#FFB81C', fontWeight: '700' }]}>
              🎁 7-DAY FREE TRIAL
            </Text>
          </View>
        </View>

        {/* Plan selector */}
        <Text style={[typography.heading3, { color: colors.textPrimary, marginTop: spacing[5], marginBottom: spacing[3] }]}>
          Choose your plan
        </Text>
        <View style={styles.planRow}>
          <PlanCard
            title="Monthly"
            price={monthlyPrice}
            subtext="Cancel anytime"
            selected={selectedPlan === 'monthly'}
            onPress={() => setSelectedPlan('monthly')}
            colors={colors}
            typography={typography}
            radius={radius}
          />
          <PlanCard
            title="Annual"
            price={annualPrice}
            subtext={`${annualMonthlyEquiv} — save 30%`}
            selected={selectedPlan === 'annual'}
            onPress={() => setSelectedPlan('annual')}
            colors={colors}
            typography={typography}
            radius={radius}
            badge="BEST VALUE"
          />
        </View>

        {/* Purchase button */}
        <PrimaryButton
          label={isLoading ? 'Processing...' : `Start Free Trial → ${selectedPlan === 'annual' ? annualPrice : monthlyPrice}`}
          onPress={handlePurchase}
          isLoading={isLoading}
          style={{ marginTop: spacing[4], backgroundColor: '#FFB81C' }}
        />
        <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing[2] }]}>
          7-day free trial, then billed {selectedPlan === 'annual' ? 'annually' : 'monthly'}. Cancel anytime in Settings → Subscriptions.
        </Text>

        {/* Feature comparison */}
        <Text style={[typography.heading3, { color: colors.textPrimary, marginTop: spacing[6], marginBottom: spacing[3] }]}>
          What you get
        </Text>

        <View style={[styles.compareSection, { backgroundColor: colors.surface1, borderRadius: radius.lg, padding: spacing[4] }]}>
          <Text style={[typography.body1, { color: colors.primary, fontWeight: '700', marginBottom: spacing[3] }]}>
            👑 Premium
          </Text>
          {PREMIUM_FEATURES.map((f, i) => (
            <FeatureRow key={i} icon={f.icon} name={f.name} desc={f.desc} included />
          ))}
        </View>

        <View style={[styles.compareSection, { backgroundColor: colors.surface1, borderRadius: radius.lg, padding: spacing[4], marginTop: spacing[3] }]}>
          <Text style={[typography.body1, { color: colors.textSecondary, fontWeight: '700', marginBottom: spacing[3] }]}>
            Free
          </Text>
          {FREE_FEATURES.map((f, i) => (
            <FeatureRow key={i} icon={f.icon} name={f.name} desc={f.desc} included />
          ))}
        </View>

        {/* Restore */}
        <SecondaryButton
          label="Restore Purchases"
          onPress={handleRestore}
          style={{ marginTop: spacing[5], marginBottom: spacing[2] }}
        />
        <Text style={[typography.caption, { color: colors.textDisabled, textAlign: 'center', marginBottom: spacing[8] }]}>
          Already subscribed? Restore your purchases above.
          {'\n'}Payment handled securely by Apple. Prices in GBP.
          {'\n'}Privacy Policy · Terms of Use
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanCard({
  title, price, subtext, selected, onPress, colors, typography, radius, badge,
}: {
  title: string;
  price: string;
  subtext: string;
  selected: boolean;
  onPress: () => void;
  colors: any;
  typography: any;
  radius: any;
  badge?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.planCard,
        {
          borderColor: selected ? '#FFB81C' : colors.border,
          backgroundColor: selected ? '#FFF8E1' : colors.surface1,
          borderRadius: radius.lg,
          borderWidth: selected ? 2 : 1.5,
        },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      {badge ? (
        <View style={[styles.planBadge, { backgroundColor: '#FFB81C' }]}>
          <Text style={{ fontSize: 9, fontWeight: '800', color: '#231F20' }}>{badge}</Text>
        </View>
      ) : null}
      <Text style={[typography.body1, { fontWeight: '700', color: selected ? '#231F20' : colors.textPrimary }]}>
        {title}
      </Text>
      <Text style={[typography.heading3, { color: selected ? '#E6A000' : colors.textPrimary, marginTop: 4 }]}>
        {price}
      </Text>
      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
        {subtext}
      </Text>
      <View style={[styles.radioCircle, { borderColor: selected ? '#FFB81C' : colors.border }]}>
        {selected ? <View style={[styles.radioFill, { backgroundColor: '#FFB81C' }]} /> : null}
      </View>
    </TouchableOpacity>
  );
}

function FeatureRow({ icon, name, desc, included }: { icon: string; name: string; desc: string; included: boolean }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <View style={styles.featureText}>
        <Text style={{ fontWeight: '600', fontSize: 14, color: '#231F20' }}>{name}</Text>
        <Text style={{ fontSize: 12, color: '#768692', marginTop: 1 }}>{desc}</Text>
      </View>
      <Text style={{ fontSize: 16 }}>{included ? '✅' : '❌'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: 16, paddingBottom: 40 },
  heroBanner: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  heroEmoji: { fontSize: 48, marginBottom: 8 },
  trialBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  planRow: {
    flexDirection: 'row',
    gap: 12,
  },
  planCard: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  planBadge: {
    position: 'absolute',
    top: -10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  compareSection: {},
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 10,
  },
  featureIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  featureText: { flex: 1 },
});
