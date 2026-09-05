/**
 * Paywall — Haggle's one purchase screen, hand-built so its design lives in
 * this open-source repo rather than RevenueCat's dashboard (product-spec.md
 * -> paywall_design). Triggered when a free user tries to add a second bill,
 * or taps a premium-gated row (the reminder or the savings tracker).
 *
 * Every price on screen comes from `usePremium().offerings` — nothing here
 * is a hardcoded string. The only asynchronous calls in the whole app happen
 * from this screen and from Settings: `purchasePackage` and
 * `restorePurchases`, both routed through `lib/purchases.ts` so this file
 * never touches the RevenueCat SDK directly.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import type { PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';

import Button from '../components/Button';
import CategoryRow from '../components/CategoryRow';
import Hairline from '../components/Hairline';
import { SpineTick } from '../components/Spine';
import { usePremium } from '../lib/purchases';
import { COLORS, LAYOUT, SPACING, useReducedMotion } from '../theme/tokens';
import { MAX_FONT_SCALE, typography } from '../theme/typography';

// ---------------------------------------------------------------------------
// What premium unlocks — stated plainly, in the exact order design-system.md
// lists them, so the Spine feature list and the paywall's own promise never
// drift apart. The first script stays free; this screen never implies
// otherwise.
// ---------------------------------------------------------------------------

const PREMIUM_FEATURES = [
  'Unlimited bills and scripts',
  'Renegotiation reminder in 6–12 months',
  'Your total savings, tracked',
] as const;

/** How long the success state holds before the screen dismisses (motion_spec). */
const SUCCESS_HOLD_MS = 600;

type PlanId = 'monthly' | 'annual';

interface PlanOption {
  id: PlanId;
  pkg: PurchasesPackage;
  label: string;
  description: string;
  /** e.g. "$4.99/mo" — reused verbatim in the Subscribe button's label. */
  priceSuffix: string;
}

/**
 * Turns whatever the dashboard has configured into the plan rows this screen
 * shows. Reads only `monthly` / `annual` (RevenueCat's own predefined package
 * types) rather than guessing from `availablePackages`, and falls back to
 * whatever single package exists if neither predefined slot is set — so a
 * differently-configured Test Store offering still renders something real
 * instead of a blank paywall.
 */
function buildPlanOptions(offerings: PurchasesOfferings | null): PlanOption[] {
  const offering = offerings?.current ?? Object.values(offerings?.all ?? {})[0] ?? null;
  if (!offering) return [];

  const options: PlanOption[] = [];
  const { monthly, annual } = offering;

  if (monthly) {
    options.push({
      id: 'monthly',
      pkg: monthly,
      label: 'Monthly',
      description: `${monthly.product.priceString} a month.`,
      priceSuffix: `${monthly.product.priceString}/mo`,
    });
  }

  if (annual) {
    const perMonth = annual.product.pricePerMonthString;
    // A real computed comparison of two live prices, not a projection — the
    // "ranged, attributed estimate" honesty rule governs bill-savings claims,
    // not straightforward subscription-price arithmetic.
    const savingsPercent =
      monthly && annual.product.pricePerMonth != null
        ? Math.round((1 - annual.product.pricePerMonth / monthly.product.price) * 100)
        : null;
    const description =
      perMonth == null
        ? `${annual.product.priceString} a year.`
        : savingsPercent != null && savingsPercent > 0
          ? `Best value. ${annual.product.priceString} a year (about ${perMonth} a month), ${savingsPercent}% less than paying monthly.`
          : `Best value. ${annual.product.priceString} a year (about ${perMonth} a month).`;
    options.push({
      id: 'annual',
      pkg: annual,
      label: 'Annual',
      description,
      priceSuffix: `${annual.product.priceString}/yr`,
    });
  }

  if (options.length === 0 && offering.availablePackages.length > 0) {
    const pkg = offering.availablePackages[0];
    options.push({
      id: 'monthly',
      pkg,
      label: pkg.product.title || 'Haggle Premium',
      description: pkg.product.priceString,
      priceSuffix: pkg.product.priceString,
    });
  }

  return options;
}

/**
 * The price line's loading placeholder. Per interaction_states: a Rule-grey
 * bar that pulses opacity once (~1.2s) then holds — never an infinite
 * shimmer, never a spinner.
 */
function PriceSkeleton() {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) return;
    const pulse = Animated.sequence([
      Animated.timing(opacity, { toValue: 0.4, duration: 600, easing: Easing.ease, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 600, easing: Easing.ease, useNativeDriver: true }),
    ]);
    pulse.start();
    return () => pulse.stop();
  }, [reducedMotion, opacity]);

  return (
    <View style={styles.skeletonBlock}>
      <Animated.View style={[styles.skeletonBar, styles.skeletonBarWide, { opacity }]} />
      <Animated.View style={[styles.skeletonBar, styles.skeletonBarNarrow, { opacity }]} />
    </View>
  );
}

export default function PaywallScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { isPremium, offerings, error, purchase, restore, reloadOfferings } = usePremium();

  const plans = useMemo(() => buildPlanOptions(offerings), [offerings]);

  const [selectedPlanId, setSelectedPlanId] = useState<PlanId | null>(null);
  const [phase, setPhase] = useState<'idle' | 'purchasing' | 'success'>('idle');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [reloadingOfferings, setReloadingOfferings] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  // Default to the best-value plan (annual, when the store has one) the
  // first time real plans arrive — never overwrites a choice the user made.
  useEffect(() => {
    if (selectedPlanId !== null || plans.length === 0) return;
    const preferred = plans.find((plan) => plan.id === 'annual') ?? plans[0];
    setSelectedPlanId(preferred.id);
  }, [plans, selectedPlanId]);

  const activePlan = plans.find((plan) => plan.id === selectedPlanId) ?? null;

  function handleClose() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  async function handleSubscribe() {
    if (!activePlan || phase !== 'idle') return;
    setPurchaseError(null);
    setPhase('purchasing');

    const outcome = await purchase(activePlan.pkg);

    if (outcome.success) {
      setPhase('success');
      if (reducedMotion) {
        handleClose();
      } else {
        setTimeout(handleClose, SUCCESS_HOLD_MS);
      }
      return;
    }

    setPhase('idle');
    if (!outcome.cancelled) {
      // The interface's own voice, not a raw SDK error string — states what
      // happened and what to do, per the ERROR interaction state.
      setPurchaseError("That didn't go through. Try again, or use Restore Purchases if you were already charged.");
    }
  }

  async function handleRetryOfferings() {
    setReloadingOfferings(true);
    await reloadOfferings();
    setReloadingOfferings(false);
  }

  async function handleRestore() {
    if (restoring) return;
    setRestoring(true);
    setRestoreMessage(null);
    const result = await restore();
    setRestoring(false);
    setRestoreMessage(result.message);
    if (result.success) {
      setTimeout(handleClose, reducedMotion ? 0 : SUCCESS_HOLD_MS);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={SPACING.space12}
          style={styles.closeButton}
        >
          <Text style={styles.closeGlyph}>{'✕'}</Text>
        </Pressable>

        {isPremium ? (
          <View style={styles.alreadyPremiumBlock}>
            <Text style={typography.h1} maxFontSizeMultiplier={MAX_FONT_SCALE.h1} accessibilityRole="header">
              You already have Premium.
            </Text>
            <Text style={[typography.body, styles.paragraph]}>
              Unlimited bills, your renegotiation reminder, and the savings tracker are unlocked.
            </Text>
            <Button label="Done" onPress={handleClose} style={styles.block} testID="paywall-done" />
          </View>
        ) : (
          <>
            <Text style={typography.h1} maxFontSizeMultiplier={MAX_FONT_SCALE.h1} accessibilityRole="header">
              Your next bill is worth negotiating too.
            </Text>
            <Text style={[typography.body, styles.paragraph]}>
              Your first script was free. Premium removes the one-bill limit.
            </Text>

            <View style={styles.featureList} accessibilityRole="list">
              {PREMIUM_FEATURES.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <SpineTick visible style={styles.featureTick} />
                  <Text style={[typography.body, styles.featureText]}>{feature}</Text>
                </View>
              ))}
            </View>

            <Hairline style={styles.block} />

            <Text style={[typography.h2, styles.block]}>Haggle Premium</Text>

            {plans.length > 0 ? (
              <View style={styles.planList} accessibilityRole="radiogroup">
                {plans.map((plan, index) => (
                  <View key={plan.id}>
                    {index > 0 && <Hairline />}
                    <CategoryRow
                      label={plan.label}
                      description={plan.description}
                      selected={selectedPlanId === plan.id}
                      onPress={() => setSelectedPlanId(plan.id)}
                      testID={`paywall-plan-${plan.id}`}
                    />
                  </View>
                ))}
              </View>
            ) : error ? (
              <View style={styles.block}>
                <Text style={[typography.body, styles.errorText]}>{error.message}</Text>
                {error.retryable && (
                  <Button
                    variant="secondary"
                    label="Try again"
                    onPress={handleRetryOfferings}
                    loading={reloadingOfferings}
                    style={styles.block}
                    testID="paywall-retry-offerings"
                  />
                )}
              </View>
            ) : (
              <PriceSkeleton />
            )}

            {plans.length > 0 && <Text style={[typography.meta, styles.cancelNote]}>Cancel anytime.</Text>}

            {purchaseError && <Text style={[typography.body, styles.errorText, styles.block]}>{purchaseError}</Text>}

            {plans.length > 0 && (
              <Button
                label={phase === 'success' ? `✓ Subscribed` : `Subscribe — ${activePlan?.priceSuffix ?? ''}`}
                onPress={handleSubscribe}
                loading={phase === 'purchasing'}
                disabled={!activePlan}
                style={styles.block}
                testID="paywall-subscribe"
              />
            )}

            <Pressable
              onPress={handleRestore}
              disabled={restoring}
              accessibilityRole="button"
              style={styles.restoreLink}
              testID="paywall-restore"
            >
              <Text style={[typography.body, styles.restoreLabel]}>
                {restoring ? 'Restoring…' : 'Restore purchases'}
              </Text>
            </Pressable>
            {restoreMessage && (
              <Text style={[typography.meta, styles.restoreMessage]}>{restoreMessage}</Text>
            )}

            <Text style={[typography.meta, styles.hardshipNote]}>
              Some subscriptions fund free access for people in financial hardship.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT.screenMargin,
    paddingTop: SPACING.space16,
    paddingBottom: SPACING.space48,
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LAYOUT.formBlockGap,
  },
  // Deliberately NOT one of the two locked type families, matching the same
  // reasoning as Add a Bill's back glyph: this is a navigation symbol, not
  // text content, so it renders from the guaranteed system font.
  closeGlyph: {
    fontSize: 18,
    color: COLORS.ink,
  },
  paragraph: {
    marginTop: SPACING.space8,
  },
  block: {
    marginTop: LAYOUT.formBlockGap,
  },
  alreadyPremiumBlock: {
    marginTop: SPACING.space24,
  },
  featureList: {
    marginTop: LAYOUT.formBlockGap,
    gap: SPACING.space12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.space12,
  },
  featureTick: {
    marginTop: SPACING.space4,
  },
  featureText: {
    flex: 1,
  },
  planList: {
    marginTop: SPACING.space8,
  },
  skeletonBlock: {
    marginTop: SPACING.space16,
    gap: SPACING.space8,
  },
  skeletonBar: {
    height: 20,
    backgroundColor: COLORS.rule,
  },
  skeletonBarWide: {
    width: '70%',
  },
  skeletonBarNarrow: {
    width: '45%',
  },
  cancelNote: {
    marginTop: SPACING.space8,
  },
  errorText: {
    color: COLORS.friction,
  },
  restoreLink: {
    alignSelf: 'center',
    marginTop: LAYOUT.formBlockGap,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: SPACING.space12,
  },
  restoreLabel: {
    color: COLORS.corner,
    textAlign: 'center',
  },
  restoreMessage: {
    textAlign: 'center',
    marginTop: SPACING.space4,
  },
  hardshipNote: {
    textAlign: 'center',
    marginTop: SPACING.space16,
  },
});
