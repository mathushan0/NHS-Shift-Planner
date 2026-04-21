// @ts-nocheck — V2 premium screen: not active in MVP build
/**
 * Subscription Store — Zustand
 * Tracks subscription status, plan, expiry and persists locally via MMKV / AsyncStorage.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscriptionService, SubscriptionStatus, PlanId, PremiumFeature } from '../services/subscription';

interface SubscriptionStoreState {
  // Status
  isPremium: boolean;
  plan: PlanId;
  expiryDate: string | null;  // ISO string (serializable)
  isInTrialPeriod: boolean;
  trialEndsAt: string | null; // ISO string
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: (userId?: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
  purchase: (productId: string) => Promise<boolean>;
  restorePurchases: () => Promise<void>;
  canUseFeature: (feature: PremiumFeature) => boolean;

  // Dev helpers
  _setDevPremium: (premium: boolean) => void;
}

function statusToStore(s: SubscriptionStatus) {
  return {
    isPremium: s.isPremium,
    plan: s.plan,
    expiryDate: s.expiryDate?.toISOString() ?? null,
    isInTrialPeriod: s.isInTrialPeriod,
    trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
  };
}

export const useSubscriptionStore = create<SubscriptionStoreState>()(
  persist(
    (set, get) => ({
      isPremium: false,
      plan: 'free',
      expiryDate: null,
      isInTrialPeriod: false,
      trialEndsAt: null,
      isLoading: false,
      error: null,

      initialize: async (userId?: string) => {
        set({ isLoading: true, error: null });
        try {
          await subscriptionService.initialize(userId);
          const status = await subscriptionService.refreshStatus();
          set({ ...statusToStore(status), isLoading: false });
        } catch (err: any) {
          set({ isLoading: false, error: err?.message ?? 'Failed to initialize subscription' });
        }
      },

      refreshStatus: async () => {
        set({ isLoading: true, error: null });
        try {
          const status = await subscriptionService.refreshStatus();
          set({ ...statusToStore(status), isLoading: false });
        } catch (err: any) {
          set({ isLoading: false, error: err?.message ?? 'Failed to refresh subscription' });
        }
      },

      purchase: async (productId: string) => {
        set({ isLoading: true, error: null });
        try {
          const success = await subscriptionService.purchase(productId);
          if (success) {
            const status = subscriptionService.getStatus();
            set({ ...statusToStore(status), isLoading: false });
          } else {
            set({ isLoading: false }); // user cancelled
          }
          return success;
        } catch (err: any) {
          set({ isLoading: false, error: err?.message ?? 'Purchase failed' });
          throw err;
        }
      },

      restorePurchases: async () => {
        set({ isLoading: true, error: null });
        try {
          const status = await subscriptionService.restorePurchases();
          set({ ...statusToStore(status), isLoading: false });
        } catch (err: any) {
          set({ isLoading: false, error: err?.message ?? 'Restore failed' });
          throw err;
        }
      },

      canUseFeature: (feature: PremiumFeature) => {
        // Use the live service (reflects refreshed state)
        return subscriptionService.canUseFeature(feature);
      },

      _setDevPremium: (premium: boolean) => {
        if (__DEV__) {
          subscriptionService.setDevPremium(premium);
          const status = subscriptionService.getStatus();
          set(statusToStore(status));
        }
      },
    }),
    {
      name: 'subscription-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist status fields, not loading/error
      partialize: (state) => ({
        isPremium: state.isPremium,
        plan: state.plan,
        expiryDate: state.expiryDate,
        isInTrialPeriod: state.isInTrialPeriod,
        trialEndsAt: state.trialEndsAt,
      }),
    }
  )
);
