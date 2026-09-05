/**
 * RevenueCat integration for Haggle — configuration, the `premium`
 * entitlement, and the React context screens read it through.
 *
 * Spec: docs/product-spec.md → paywall_design.
 *
 * This file has no JSX (kept as .ts, not .tsx) — `PremiumProvider` is built
 * with `React.createElement` instead.
 */
import { useCallback, useContext, useEffect, useMemo, useState, createContext, createElement } from 'react';
import type { ReactNode } from 'react';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import type { CustomerInfo, PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';

/** The single entitlement this app checks. Configured in the RevenueCat dashboard. */
export const PREMIUM_ENTITLEMENT_ID = 'premium';

// ---------------------------------------------------------------------------
// Configuration — guarded against Fast Refresh / StrictMode double-invocation
// ---------------------------------------------------------------------------

let didConfigure = false;

/** Thrown by `configurePurchases()` when no API key is present. Never swallow this silently. */
export class MissingRevenueCatKeyError extends Error {
  constructor() {
    super(
      'EXPO_PUBLIC_REVENUECAT_TEST_KEY is not set. Copy .env.example to .env and add a ' +
        'RevenueCat Test Store key — Haggle refuses to run the paywall without one rather ' +
        'than silently pretending purchases work.'
    );
    this.name = 'MissingRevenueCatKeyError';
  }
}

/**
 * Configures the RevenueCat SDK exactly once per app session. Safe to call
 * from multiple render passes (Fast Refresh, StrictMode's double-invoked
 * effects) — every call after the first is a no-op, so the SDK is never
 * reconfigured mid-session per the spec's explicit edge case.
 *
 * Throws `MissingRevenueCatKeyError` if the env key is absent so a missing
 * key fails loudly in dev instead of quietly no-opping.
 */
export function configurePurchases(): void {
  if (didConfigure) return;

  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY;
  if (!apiKey) {
    throw new MissingRevenueCatKeyError();
  }

  Purchases.configure({ apiKey });
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  didConfigure = true;
}

/** Whether `configurePurchases()` has already run this session. */
export function isPurchasesConfigured(): boolean {
  return didConfigure;
}

// ---------------------------------------------------------------------------
// Error shape
// ---------------------------------------------------------------------------

/** A user-facing purchases error. `retryable` drives whether a Retry button shows. */
export interface PurchasesErrorState {
  message: string;
  retryable: boolean;
}

function describeError(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message?: unknown }).message === 'string' &&
    (err as { message: string }).message.length > 0
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}

function wasUserCancelled(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { userCancelled?: boolean }).userCancelled);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface PurchaseOutcome {
  success: boolean;
  /** True when the user backed out of the store sheet — not an error to display. */
  cancelled: boolean;
  error?: string;
}

export interface RestoreOutcome {
  success: boolean;
  /** Human-readable result, e.g. "No purchases found." Always set, success or not. */
  message: string;
}

export interface PremiumContextValue {
  /** Driven by `customerInfo.entitlements.active['premium']`. */
  isPremium: boolean;
  /** True until the initial configure + customer info + offerings round-trip settles. */
  isLoading: boolean;
  offerings: PurchasesOfferings | null;
  error: PurchasesErrorState | null;
  purchase: (pkg: PurchasesPackage) => Promise<PurchaseOutcome>;
  restore: () => Promise<RestoreOutcome>;
  /** Re-fetches offerings — the paywall's Retry action after a network failure. */
  reloadOfferings: () => Promise<void>;
}

const PremiumContext = createContext<PremiumContextValue | null>(null);

export interface PremiumProviderProps {
  children: ReactNode;
}

/** Wraps the app (in the router layout) and owns all RevenueCat state. */
export function PremiumProvider({ children }: PremiumProviderProps) {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [error, setError] = useState<PurchasesErrorState | null>(null);

  const applyCustomerInfo = useCallback((info: CustomerInfo) => {
    setIsPremium(info.entitlements.active[PREMIUM_ENTITLEMENT_ID] != null);
  }, []);

  const loadOfferings = useCallback(async () => {
    try {
      const result = await Purchases.getOfferings();
      setOfferings(result);
      setError(null);
    } catch (err) {
      setOfferings(null);
      setError({
        message: describeError(err, 'Could not load the subscription offer. Check your connection.'),
        retryable: true,
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        configurePurchases();
      } catch (err) {
        if (__DEV__) {
          // Fail loudly: a missing key must never look like a working paywall.
          console.error('[haggle/purchases]', err);
        }
        if (!cancelled) {
          setError({ message: describeError(err, 'RevenueCat is not configured.'), retryable: false });
          setIsLoading(false);
        }
        return;
      }

      try {
        const info = await Purchases.getCustomerInfo();
        if (!cancelled) applyCustomerInfo(info);
      } catch (err) {
        if (!cancelled) {
          setError({
            message: describeError(err, 'Could not read subscription status. Check your connection.'),
            retryable: true,
          });
        }
      }

      await loadOfferings();
      if (!cancelled) setIsLoading(false);
    }

    bootstrap();

    // Flips `isPremium` in place on any customer info change (purchase,
    // restore, renewal) — no restart or manual refresh needed anywhere else.
    const listener = (info: CustomerInfo) => applyCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      cancelled = true;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [applyCustomerInfo, loadOfferings]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage): Promise<PurchaseOutcome> => {
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        applyCustomerInfo(customerInfo);
        setError(null);
        return { success: true, cancelled: false };
      } catch (err) {
        if (wasUserCancelled(err)) {
          return { success: false, cancelled: true };
        }
        const message = describeError(err, 'Purchase failed. Please try again.');
        setError({ message, retryable: true });
        return { success: false, cancelled: false, error: message };
      }
    },
    [applyCustomerInfo]
  );

  const restore = useCallback(async (): Promise<RestoreOutcome> => {
    try {
      const info = await Purchases.restorePurchases();
      applyCustomerInfo(info);
      const restored = info.entitlements.active[PREMIUM_ENTITLEMENT_ID] != null;
      return {
        success: restored,
        message: restored ? 'Premium restored.' : 'No purchases found for this account.',
      };
    } catch (err) {
      const message = describeError(err, 'Could not restore purchases. Check your connection.');
      setError({ message, retryable: true });
      return { success: false, message };
    }
  }, [applyCustomerInfo]);

  const value = useMemo<PremiumContextValue>(
    () => ({ isPremium, isLoading, offerings, error, purchase, restore, reloadOfferings: loadOfferings }),
    [isPremium, isLoading, offerings, error, purchase, restore, loadOfferings]
  );

  return createElement(PremiumContext.Provider, { value }, children);
}

/** Reads premium state and purchase actions. Must be called under `<PremiumProvider>`. */
export function usePremium(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) {
    throw new Error('usePremium() must be called within a <PremiumProvider>.');
  }
  return ctx;
}
