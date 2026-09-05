/**
 * Add a Bill — the form that turns "I pay too much for X" into a
 * `BillInput` the script engine can act on.
 *
 * Layout follows docs/design-system.md's SCREEN 2 wireframe exactly: a
 * border-free category picker (three full-bleed rows on hairlines, selection
 * shown by the Spine tick + a label weight shift), two underline inputs, and
 * an optional-detail disclosure that keeps the default form short. Nothing
 * here is async in a way the user should ever notice — script generation
 * itself is synchronous, and the AsyncStorage round-trips around it resolve
 * well under a frame, so there is deliberately no loading state on the
 * button (that treatment is reserved for the app's three RevenueCat calls).
 */

import { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';

import Button from '../components/Button';
import CategoryRow from '../components/CategoryRow';
import Hairline from '../components/Hairline';
import TextInputUnderline from '../components/TextInputUnderline';
import { generateScript } from '../lib/scriptEngine';
import { addBill, hasUsedFreeScript, markFreeScriptUsed } from '../lib/storage';
import { usePremium } from '../lib/purchases';
import type { BillCategory, BillInput, CallTrigger, CompetitorOffer } from '../lib/types';
import { COLORS, LAYOUT, SPACING } from '../theme/tokens';
import { MAX_FONT_SCALE, typography } from '../theme/typography';

// ---------------------------------------------------------------------------
// Static copy tables — kept as data, not scattered string literals, so the
// three category rows and three trigger rows are each one glance to audit.
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS: { value: BillCategory; label: string; description: string }[] = [
  { value: 'phone', label: 'Phone', description: 'Cell or landline service' },
  { value: 'internet', label: 'Internet or cable', description: 'Broadband, TV, or bundle' },
  {
    value: 'insurance',
    label: 'Auto or home insurance',
    description: 'Vehicle, renters, or homeowners. Not health insurance.',
  },
];

const TRIGGER_OPTIONS: { value: CallTrigger; label: string; description: string }[] = [
  { value: 'rate_increase', label: 'My rate went up', description: 'The bill increased recently.' },
  { value: 'promo_expired', label: 'A promo rate ended', description: 'An introductory price expired.' },
  { value: 'just_checking', label: 'Just checking', description: 'No particular reason yet.' },
];

/** The trigger CallTrigger requires when the user never opens "Add more detail." */
const DEFAULT_TRIGGER: CallTrigger = 'just_checking';

const PROVIDER_PLACEHOLDER: Record<BillCategory, string> = {
  phone: 'Verizon',
  internet: 'Xfinity',
  insurance: 'Progressive',
};

// Sanity ceilings — not business rules, just the floor under "an overlong or
// garbage input must never reach the script engine or break a layout."
const MAX_NAME_LENGTH = 60;
const MAX_AMOUNT = 100_000;
const MAX_TENURE_MONTHS = 1200; // 100 years

function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export default function AddBillScreen() {
  const router = useRouter();
  const { isPremium } = usePremium();

  const [category, setCategory] = useState<BillCategory | null>(null);
  const [provider, setProvider] = useState('');
  const [amountText, setAmountText] = useState('');

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tenureText, setTenureText] = useState('');
  const [trigger, setTrigger] = useState<CallTrigger>(DEFAULT_TRIGGER);
  const [competitorProvider, setCompetitorProvider] = useState('');
  const [competitorAmountText, setCompetitorAmountText] = useState('');

  // Guards against a second tap landing mid-await (storage round-trips are
  // fast, but not synchronous) — never surfaces in the UI, since generation
  // itself has no loading state by design.
  const isSubmittingRef = useRef(false);

  // -- Validation --------------------------------------------------------
  // Every error below is real-time (no separate "touched" tracking): a
  // blank field is simply incomplete, communicated by the disabled button,
  // while a field the user has actually typed into can be actively wrong.

  const trimmedProvider = provider.trim();
  const providerError =
    provider.length > 0 && trimmedProvider.length > MAX_NAME_LENGTH
      ? `Keep it under ${MAX_NAME_LENGTH} characters.`
      : undefined;

  const amount = useMemo(() => parseAmount(amountText), [amountText]);
  const amountError =
    amountText.trim().length === 0
      ? undefined
      : amount === null
        ? 'Enter a valid amount.'
        : amount <= 0
          ? 'Enter an amount greater than $0.'
          : amount > MAX_AMOUNT
            ? 'Enter an amount under $100,000.'
            : undefined;

  const tenureTrimmed = tenureText.trim();
  let tenureMonths: number | undefined;
  let tenureError: string | undefined;
  if (tenureTrimmed.length > 0) {
    const parsed = Number(tenureTrimmed);
    if (!Number.isInteger(parsed) || parsed < 0) {
      tenureError = 'Enter a whole number of months.';
    } else if (parsed > MAX_TENURE_MONTHS) {
      tenureError = `Enter a number under ${MAX_TENURE_MONTHS}.`;
    } else {
      tenureMonths = parsed;
    }
  }

  const competitorProviderTrimmed = competitorProvider.trim();
  const competitorAmount = parseAmount(competitorAmountText);
  const hasCompetitorProvider = competitorProviderTrimmed.length > 0;
  const hasCompetitorAmount = competitorAmountText.trim().length > 0;

  let competitorProviderError: string | undefined;
  let competitorAmountError: string | undefined;
  if (hasCompetitorProvider && competitorProviderTrimmed.length > MAX_NAME_LENGTH) {
    competitorProviderError = `Keep it under ${MAX_NAME_LENGTH} characters.`;
  } else if (hasCompetitorAmount && !hasCompetitorProvider) {
    competitorProviderError = "Enter the competitor's name too.";
  }
  if (hasCompetitorAmount && (competitorAmount === null || competitorAmount <= 0 || competitorAmount > MAX_AMOUNT)) {
    competitorAmountError = 'Enter a valid price.';
  } else if (hasCompetitorProvider && !hasCompetitorAmount) {
    competitorAmountError = 'Enter their quoted price too.';
  }

  const competitorOffer: CompetitorOffer | undefined =
    hasCompetitorProvider && hasCompetitorAmount && !competitorProviderError && !competitorAmountError
      ? { provider: competitorProviderTrimmed, monthlyAmount: competitorAmount as number }
      : undefined;

  const canSubmit =
    category !== null &&
    trimmedProvider.length > 0 &&
    trimmedProvider.length <= MAX_NAME_LENGTH &&
    amount !== null &&
    amount > 0 &&
    amount <= MAX_AMOUNT &&
    tenureError === undefined &&
    competitorProviderError === undefined &&
    competitorAmountError === undefined;

  // -- Actions -------------------------------------------------------------

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  async function handleSubmit() {
    if (!canSubmit || category === null || amount === null) return;
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    try {
      const input: BillInput = {
        category,
        provider: trimmedProvider,
        currentMonthlyAmount: amount,
        trigger,
        ...(tenureMonths !== undefined ? { tenureMonths } : {}),
        ...(competitorOffer !== undefined ? { competitorOffer } : {}),
      };

      const alreadyUsedFreeScript = await hasUsedFreeScript();
      if (alreadyUsedFreeScript && !isPremium) {
        router.push('/paywall');
        return;
      }

      // Pure and synchronous — if this were ever going to throw on bad
      // input, it does so here, before anything is persisted.
      generateScript(input);

      const bill = await addBill(input);
      await markFreeScriptUsed();
      router.push({ pathname: '/script/[id]', params: { id: bill.id, fresh: '1' } });
    } finally {
      isSubmittingRef.current = false;
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={SPACING.space12}
              style={styles.backButton}
            >
              <Text style={styles.backGlyph}>{'←'}</Text>
            </Pressable>
            <Text
              style={typography.h1}
              maxFontSizeMultiplier={MAX_FONT_SCALE.h1}
              accessibilityRole="header"
            >
              Add a bill
            </Text>
          </View>

          <View style={styles.block}>
            <Text style={typography.body}>Which bill is this?</Text>
            <View accessibilityRole="radiogroup">
              {CATEGORY_OPTIONS.map((option, index) => (
                <View key={option.value}>
                  {index > 0 && <Hairline />}
                  <CategoryRow
                    label={option.label}
                    description={option.description}
                    selected={category === option.value}
                    onPress={() => setCategory(option.value)}
                    testID={`category-${option.value}`}
                  />
                </View>
              ))}
            </View>
          </View>

          <TextInputUnderline
            label="Provider"
            value={provider}
            onChangeText={setProvider}
            placeholder={category ? PROVIDER_PLACEHOLDER[category] : 'Provider name'}
            error={providerError}
            autoCapitalize="words"
            returnKeyType="next"
            containerStyle={styles.block}
            testID="provider-input"
          />

          <TextInputUnderline
            label="Current monthly amount"
            value={amountText}
            onChangeText={setAmountText}
            variant="amount"
            placeholder="0.00"
            error={amountError}
            returnKeyType="done"
            containerStyle={styles.block}
            testID="amount-input"
          />

          <Pressable
            onPress={() => setDetailsOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: detailsOpen }}
            accessibilityLabel="Add more detail, optional"
            style={styles.disclosureRow}
          >
            <Text style={styles.disclosureGlyph}>{detailsOpen ? '⌃' : '⌄'}</Text>
            <Text style={[typography.body, styles.disclosureLabel]}>Add more detail (optional)</Text>
          </Pressable>

          {detailsOpen && (
            <View style={styles.detailsBlock}>
              <TextInputUnderline
                label="How long have you been a customer? (months)"
                value={tenureText}
                onChangeText={setTenureText}
                placeholder="e.g. 18"
                keyboardType="number-pad"
                error={tenureError}
                containerStyle={styles.block}
                testID="tenure-input"
              />

              <View style={styles.block}>
                <Text style={typography.body}>Why are you calling?</Text>
                <View accessibilityRole="radiogroup">
                  {TRIGGER_OPTIONS.map((option, index) => (
                    <View key={option.value}>
                      {index > 0 && <Hairline />}
                      <CategoryRow
                        label={option.label}
                        description={option.description}
                        selected={trigger === option.value}
                        onPress={() => setTrigger(option.value)}
                        testID={`trigger-${option.value}`}
                      />
                    </View>
                  ))}
                </View>
              </View>

              <TextInputUnderline
                label="Competitor (optional)"
                value={competitorProvider}
                onChangeText={setCompetitorProvider}
                placeholder="e.g. AT&T"
                autoCapitalize="words"
                error={competitorProviderError}
                containerStyle={styles.block}
                testID="competitor-provider-input"
              />

              <TextInputUnderline
                label="Their quoted price"
                value={competitorAmountText}
                onChangeText={setCompetitorAmountText}
                variant="amount"
                placeholder="0.00"
                error={competitorAmountError}
                returnKeyType="done"
                containerStyle={styles.block}
                testID="competitor-amount-input"
              />
            </View>
          )}

          <Button
            label="Generate script"
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={styles.block}
            testID="generate-script-button"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT.screenMargin,
    paddingTop: SPACING.space16,
    paddingBottom: SPACING.space48,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.space12,
    marginBottom: LAYOUT.formBlockGap,
  },
  backButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Deliberately NOT one of the two locked type families: this is a
  // navigation glyph, not text content, and Public Sans / IBM Plex Mono (as
  // Google's static Latin subsets) are not guaranteed to include U+2190 —
  // the system font is guaranteed to render it correctly on both platforms.
  backGlyph: {
    fontSize: 20,
    color: COLORS.ink,
  },
  block: {
    marginTop: LAYOUT.formBlockGap,
  },
  detailsBlock: {
    marginTop: SPACING.space8,
  },
  disclosureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.space8,
    marginTop: LAYOUT.formBlockGap,
    minHeight: SPACING.space48,
  },
  disclosureGlyph: {
    fontSize: 16,
    color: COLORS.corner,
  },
  disclosureLabel: {
    color: COLORS.corner,
  },
});
