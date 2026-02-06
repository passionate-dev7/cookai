import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PurchasesOffering,
} from 'react-native-purchases';
import { zustandStorage } from './storage';

const ENTITLEMENT_ID = 'premium';

interface SubscriptionState {
  isInitialized: boolean;
  isPremium: boolean;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOffering | null;
  packages: PurchasesPackage[];
  isLoading: boolean;
  error: string | null;

  // Limits for free tier
  freeRecipeLimit: number;
  freeCookbookLimit: number;
  freeExtractionsPerMonth: number;

  // Actions
  initialize: () => Promise<void>;
  checkPremiumStatus: () => Promise<boolean>;
  fetchOfferings: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  setError: (error: string | null) => void;

  // Helpers
  canAddRecipe: (currentCount: number) => boolean;
  canAddCookbook: (currentCount: number) => boolean;
  canExtractRecipe: (currentMonthlyCount: number) => boolean;
  getRemainingExtractions: (currentMonthlyCount: number) => number;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      isInitialized: false,
      isPremium: false,
      customerInfo: null,
      offerings: null,
      packages: [],
      isLoading: false,
      error: null,

      // Free tier limits
      freeRecipeLimit: 50,
      freeCookbookLimit: 3,
      freeExtractionsPerMonth: 5,

      initialize: async () => {
        if (get().isInitialized) return;

        try {
          const apiKey = Platform.select({
            ios: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS,
            android: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID,
          });

          if (!apiKey) {
            console.warn('RevenueCat API key not configured');
            set({ isInitialized: true });
            return;
          }

          await Purchases.configure({ apiKey });
          set({ isInitialized: true });

          // Check premium status
          await get().checkPremiumStatus();

          // Fetch offerings
          await get().fetchOfferings();

          // Listen for customer info updates
          Purchases.addCustomerInfoUpdateListener((info) => {
            const isPremium = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
            set({ customerInfo: info, isPremium });
          });
        } catch (error) {
          console.warn('RevenueCat init error (expected in dev):', error);
          set({ isInitialized: true, error: null });
        }
      },

      checkPremiumStatus: async () => {
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
          set({ customerInfo, isPremium });
          return isPremium;
        } catch (error) {
          console.error('Failed to check premium status:', error);
          return false;
        }
      },

      fetchOfferings: async () => {
        set({ isLoading: true });
        try {
          const offerings = await Purchases.getOfferings();
          const currentOffering = offerings.current;

          if (currentOffering) {
            set({
              offerings: currentOffering,
              packages: currentOffering.availablePackages,
            });
          }
        } catch (error) {
          console.warn('Failed to fetch offerings (expected in dev):', error);
          set({ error: null });
        } finally {
          set({ isLoading: false });
        }
      },

      purchasePackage: async (pkg) => {
        set({ isLoading: true, error: null });
        try {
          const { customerInfo } = await Purchases.purchasePackage(pkg);
          const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
          set({ customerInfo, isPremium });
          return isPremium;
        } catch (error: any) {
          if (!error.userCancelled) {
            console.error('Purchase failed:', error);
            set({ error: 'Purchase failed. Please try again.' });
          }
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      restorePurchases: async () => {
        set({ isLoading: true, error: null });
        try {
          const customerInfo = await Purchases.restorePurchases();
          const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
          set({ customerInfo, isPremium });
          return isPremium;
        } catch (error) {
          console.error('Failed to restore purchases:', error);
          set({ error: 'Failed to restore purchases' });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      setError: (error) => set({ error }),

      canAddRecipe: (currentCount) => {
        const { isPremium, freeRecipeLimit } = get();
        return isPremium || currentCount < freeRecipeLimit;
      },

      canAddCookbook: (currentCount) => {
        const { isPremium, freeCookbookLimit } = get();
        return isPremium || currentCount < freeCookbookLimit;
      },

      canExtractRecipe: (currentMonthlyCount) => {
        const { isPremium, freeExtractionsPerMonth } = get();
        return isPremium || currentMonthlyCount < freeExtractionsPerMonth;
      },

      getRemainingExtractions: (currentMonthlyCount) => {
        const { isPremium, freeExtractionsPerMonth } = get();
        if (isPremium) return Infinity;
        return Math.max(0, freeExtractionsPerMonth - currentMonthlyCount);
      },
    }),
    {
      name: 'subscription-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        isPremium: state.isPremium,
      }),
    }
  )
);
