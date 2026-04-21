// @ts-nocheck — V2 cloud sync: requires supabase, not active in MVP build
/**
 * Subscription service — RevenueCat integration
 *
 * RevenueCat is the industry-standard SDK for iOS/Android subscriptions.
 * It wraps StoreKit (iOS) / Google Play Billing (Android) and provides a
 * unified API for purchase, restore, and entitlement verification.
 *
 * Install with: npx expo install react-native-purchases
 *
 * Usage pattern:
 *   import { subscriptionService } from './subscription';
 *   await subscriptionService.initialize();
 *   const premium = await subscriptionService.isPremium();
 */

// ─── RevenueCat types (from react-native-purchases) ──────────────────────────
// We import dynamically so the app still runs without the native module in dev.
let Purchases: any = null;

async function getPurchases() {
  if (!Purchases) {
    try {
      Purchases = (await import('react-native-purchases')).default;
    } catch {
      console.warn('[Subscription] react-native-purchases not available (Expo Go / dev)');
      Purchases = null;
    }
  }
  return Purchases;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Replace with your real RevenueCat API keys
const REVENUECAT_API_KEY_IOS = 'appl_XXXXXXXXXXXXXX';
const REVENUECAT_API_KEY_ANDROID = 'goog_XXXXXXXXXXXXXX';

// RevenueCat product identifiers (configure in your RC dashboard)
export const PRODUCT_IDS = {
  PREMIUM_MONTHLY: 'myshifts_premium_monthly',   // £2.99/month
  PREMIUM_ANNUAL:  'myshifts_premium_annual',    // £24.99/year
} as const;

// RevenueCat entitlement identifier
const PREMIUM_ENTITLEMENT = 'premium';

export type PlanId = 'free' | 'premium_monthly' | 'premium_annual';

export type SubscriptionStatus = {
  isPremium: boolean;
  plan: PlanId;
  expiryDate: Date | null;
  isInTrialPeriod: boolean;
  trialEndsAt: Date | null;
};

// Feature keys used for `canUseFeature()`
export type PremiumFeature =
  | 'pay_calculator'
  | 'analytics'
  | 'calendar_sync'
  | 'annual_leave'
  | 'overtime'
  | 'shift_templates'
  | 'multiple_reminders'
  | 'pdf_export'
  | 'csv_export'
  | 'payslip_comparison';

// Features available on free plan
const FREE_FEATURES: PremiumFeature[] = [];

// ─── Subscription Service ─────────────────────────────────────────────────────

class SubscriptionService {
  private initialized = false;
  private _status: SubscriptionStatus = {
    isPremium: false,
    plan: 'free',
    expiryDate: null,
    isInTrialPeriod: false,
    trialEndsAt: null,
  };

  async initialize(userId?: string): Promise<void> {
    if (this.initialized) return;

    const SDK = await getPurchases();
    if (!SDK) {
      // Dev mode: no native SDK — default to free
      this.initialized = true;
      return;
    }

    try {
      const { Platform } = await import('react-native');
      const apiKey = Platform.OS === 'ios'
        ? REVENUECAT_API_KEY_IOS
        : REVENUECAT_API_KEY_ANDROID;

      await SDK.configure({ apiKey });

      if (userId) {
        await SDK.logIn(userId);
      }

      this.initialized = true;
      await this.refreshStatus();
    } catch (err) {
      console.error('[Subscription] Init error:', err);
      this.initialized = true; // don't block app
    }
  }

  async refreshStatus(): Promise<SubscriptionStatus> {
    const SDK = await getPurchases();
    if (!SDK) return this._status;

    try {
      const customerInfo = await SDK.getCustomerInfo();
      this._status = this._parseCustomerInfo(customerInfo);
    } catch (err) {
      console.warn('[Subscription] Could not refresh status:', err);
    }
    return this._status;
  }

  private _parseCustomerInfo(info: any): SubscriptionStatus {
    const entitlement = info?.entitlements?.active?.[PREMIUM_ENTITLEMENT];

    if (!entitlement) {
      return { isPremium: false, plan: 'free', expiryDate: null, isInTrialPeriod: false, trialEndsAt: null };
    }

    const expiryDate = entitlement.expirationDate ? new Date(entitlement.expirationDate) : null;
    const isInTrialPeriod: boolean = entitlement.periodType === 'trial';
    const trialEndsAt = isInTrialPeriod ? expiryDate : null;

    let plan: PlanId = 'free';
    const productId: string = entitlement.productIdentifier ?? '';
    if (productId.includes('annual')) plan = 'premium_annual';
    else if (productId.includes('monthly')) plan = 'premium_monthly';

    return { isPremium: true, plan, expiryDate, isInTrialPeriod, trialEndsAt };
  }

  /** Returns cached premium status. Call refreshStatus() to update first. */
  isPremium(): boolean {
    return this._status.isPremium;
  }

  canUseFeature(feature: PremiumFeature): boolean {
    if (this._status.isPremium) return true;
    return FREE_FEATURES.includes(feature);
  }

  getStatus(): SubscriptionStatus {
    return { ...this._status };
  }

  /** Override for development / testing */
  setDevPremium(premium: boolean): void {
    if (__DEV__) {
      this._status = {
        isPremium: premium,
        plan: premium ? 'premium_monthly' : 'free',
        expiryDate: premium ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
        isInTrialPeriod: false,
        trialEndsAt: null,
      };
    }
  }

  /**
   * Purchase a product by product ID.
   * Returns true on success, false on cancellation, throws on real errors.
   */
  async purchase(productId: string): Promise<boolean> {
    const SDK = await getPurchases();
    if (!SDK) throw new Error('RevenueCat not available');

    try {
      const offerings = await SDK.getOfferings();
      const current = offerings?.current;
      if (!current) throw new Error('No offerings available');

      const pkg = current.availablePackages.find(
        (p: any) => p.product?.productIdentifier === productId
      );
      if (!pkg) throw new Error(`Package not found: ${productId}`);

      const { customerInfo } = await SDK.purchasePackage(pkg);
      this._status = this._parseCustomerInfo(customerInfo);
      return true;
    } catch (err: any) {
      if (err?.userCancelled) return false;
      throw err;
    }
  }

  /** Restore previous purchases (required by App Store guidelines). */
  async restorePurchases(): Promise<SubscriptionStatus> {
    const SDK = await getPurchases();
    if (!SDK) return this._status;

    const customerInfo = await SDK.restorePurchases();
    this._status = this._parseCustomerInfo(customerInfo);
    return this._status;
  }

  /**
   * Fetch available offerings/packages for display in UI.
   * Returns null if unavailable.
   */
  async getOfferings(): Promise<{
    monthly: { productId: string; price: string; description: string } | null;
    annual: { productId: string; price: string; description: string } | null;
  }> {
    const SDK = await getPurchases();
    if (!SDK) {
      return {
        monthly: { productId: PRODUCT_IDS.PREMIUM_MONTHLY, price: '£2.99/month', description: 'Premium Monthly' },
        annual:  { productId: PRODUCT_IDS.PREMIUM_ANNUAL,  price: '£24.99/year', description: 'Premium Annual' },
      };
    }

    try {
      const offerings = await SDK.getOfferings();
      const pkgs: any[] = offerings?.current?.availablePackages ?? [];

      const monthly = pkgs.find((p: any) =>
        p.product?.productIdentifier === PRODUCT_IDS.PREMIUM_MONTHLY
      );
      const annual = pkgs.find((p: any) =>
        p.product?.productIdentifier === PRODUCT_IDS.PREMIUM_ANNUAL
      );

      return {
        monthly: monthly
          ? {
              productId: PRODUCT_IDS.PREMIUM_MONTHLY,
              price: monthly.product?.priceString ?? '£2.99',
              description: monthly.product?.description ?? 'Premium Monthly',
            }
          : null,
        annual: annual
          ? {
              productId: PRODUCT_IDS.PREMIUM_ANNUAL,
              price: annual.product?.priceString ?? '£24.99',
              description: annual.product?.description ?? 'Premium Annual',
            }
          : null,
      };
    } catch {
      return { monthly: null, annual: null };
    }
  }
}

export const subscriptionService = new SubscriptionService();
