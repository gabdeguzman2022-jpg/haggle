/**
 * Script Result — the hero screen. This is also Bill Detail (design-system.md's
 * screen 5): a saved bill and a fresh one render through the exact same route
 * and component tree, since a script is never stored, only recomputed. That's
 * safe because `generateScript` is pure and deterministic (lib/scriptEngine.ts) —
 * the same bill always regenerates the same script, byte for byte.
 *
 * The five fixed beats ship in this exact order and no others: Ask for ->
 * What to say -> Your target ask -> If they push back -> Before you hang up.
 * "Your target ask" has no section of its own — its number is folded into the
 * before/after readout at the top, per design-system.md's screen_specs.
 *
 * Reached as `/script/<billId>` from Home or Bill Detail (settled instantly),
 * or as `/script/<billId>?fresh=1` right after "Generate script" (plays the
 * one hero reveal: a 150ms Corner-teal curtain sweep, then the beats and the
 * Spine cascade in, fully settled by ~650ms — see hero_moment_spec /
 * motion_spec). Reduced-motion skips straight to the settled state.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import Hairline from '../../components/Hairline';
import Spine, { type SpineSegment } from '../../components/Spine';
import TextInputUnderline from '../../components/TextInputUnderline';
import { generateScript } from '../../lib/scriptEngine';
import { getBills, logBillOutcome } from '../../lib/storage';
import { usePremium } from '../../lib/purchases';
import type { Bill, BillCategory, ScriptResult } from '../../lib/types';
import {
  COLORS,
  DERIVED,
  HAIRLINE_WIDTH,
  LAYOUT,
  RADII,
  SPACING,
  TOUCH_TARGET_MIN,
  useReducedMotion,
} from '../../theme/tokens';
import { FONT_FAMILY, MAX_FONT_SCALE, SCRIPT_LINE_MAX_CHARS, typography } from '../../theme/typography';

// ---------------------------------------------------------------------------
// The reveal timing. Fixed per hero_moment_spec: a 150ms curtain sweep, then a
// ~500ms cascade so the whole page is settled by ~650ms. These constants live
// here (not theme/tokens.ts) because this exact orchestration is a one-off,
// screen-specific sequence, not a reusable motion role.
// ---------------------------------------------------------------------------
const SWEEP_DURATION_MS = 150;
const CASCADE_STAGGER_MS = 100;
const CASCADE_FADE_MS = 160;
/** readout, ask-for, what-to-say, if-they-push-back, before-you-hang-up, footnote. */
const SECTION_COUNT = 6;
const [SECTION_READOUT, SECTION_ASK_FOR, SECTION_WHAT_TO_SAY, SECTION_PUSHBACK, SECTION_HANG_UP, SECTION_FOOTNOTE] = [
  0, 1, 2, 3, 4, 5,
];
/** Arms the Spine's own draw once the "What to say" section starts fading in, so the two read as one motion instead of the Spine finishing its draw while still invisible. */
const SPINE_ARM_DELAY_MS = SECTION_WHAT_TO_SAY * CASCADE_STAGGER_MS;

/** Rough monospace advance width for 17px IBM Plex Mono — just enough to cap the script column near the spec's ~38-char arm's-length line length without hand-wrapping text ourselves. */
const SCRIPT_COLUMN_MAX_WIDTH = SCRIPT_LINE_MAX_CHARS * 10.5;

const CATEGORY_DISPLAY_NAME: Record<BillCategory, string> = {
  phone: 'Phone',
  internet: 'Internet or cable',
  insurance: 'Auto or home insurance',
};

// ---------------------------------------------------------------------------
// Small display-only helpers. These format numbers for reading, not for the
// engine's own logic — lib/scriptEngine.ts owns the actual money math.
// ---------------------------------------------------------------------------

function formatAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? `$${rounded}` : `$${rounded.toFixed(2)}`;
}

function spokenAmount(amount: number): string {
  return `${formatAmount(amount).replace('$', '')} dollars`;
}

function estimateLines(text: string): number {
  return Math.max(1, Math.ceil(text.length / SCRIPT_LINE_MAX_CHARS));
}

/**
 * The Spine's color segments, sized proportionally to how much text each part
 * of the script renders. It turns Friction for exactly an "if they say" line
 * and back to Corner for the "say back" response, per hero_moment_spec — and
 * stays Corner through "Before you hang up," the mandatory close.
 */
function buildSpineSegments(script: ScriptResult): SpineSegment[] {
  const segments: SpineSegment[] = [];

  segments.push({
    color: 'corner',
    flex: 1 + estimateLines(script.opening) + estimateLines(script.leverage) + estimateLines(script.ask),
  });

  script.objections.forEach((pair, index) => {
    const headingLines = index === 0 ? 1 : 0; // the "If they push back" heading precedes only the first pair
    segments.push({ color: 'friction', flex: headingLines + estimateLines(pair.ifTheySay) });
    segments.push({ color: 'corner', flex: estimateLines(pair.youSay) });
  });

  segments.push({ color: 'corner', flex: 1 + estimateLines(script.close) });

  return segments;
}

function parseOutcomeAmount(text: string): number | null {
  const value = Number(text.trim());
  return text.trim().length > 0 && Number.isFinite(value) && value > 0 ? value : null;
}

function parseOutcomeDate(text: string): string | null {
  if (!text.trim()) return null;
  const parsed = new Date(text.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function todayForInput(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD — least ambiguous for the parser above
}

function formatLoggedDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ScriptResultScreen() {
  const { id: rawId, fresh } = useLocalSearchParams<{ id?: string | string[]; fresh?: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const isFreshReveal = fresh === '1';

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { isPremium } = usePremium();

  // `undefined` = still loading, `null` = no bill with this id exists.
  const [bill, setBill] = useState<Bill | null | undefined>(undefined);
  const script = useMemo(() => (bill ? generateScript(bill) : null), [bill]);
  const spineSegments = useMemo(() => (script ? buildSpineSegments(script) : []), [script]);

  useEffect(() => {
    let cancelled = false;
    getBills().then((bills) => {
      if (!cancelled) setBill(bills.find((b) => b.id === id) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // --- The one hero reveal: curtain sweep, then the cascade. ---------------
  const sweepAnim = useRef(new Animated.Value(isFreshReveal ? 0 : 1)).current;
  const sectionAnims = useRef(
    Array.from({ length: SECTION_COUNT }, () => new Animated.Value(isFreshReveal ? 0 : 1))
  ).current;
  const [spineReady, setSpineReady] = useState(!isFreshReveal);
  const [settled, setSettled] = useState(!isFreshReveal);

  useEffect(() => {
    if (!isFreshReveal || !script) return;

    if (reducedMotion) {
      sweepAnim.setValue(1);
      sectionAnims.forEach((value) => value.setValue(1));
      setSpineReady(true);
      setSettled(true);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setSpineReady(true), SWEEP_DURATION_MS + SPINE_ARM_DELAY_MS));

    Animated.timing(sweepAnim, {
      toValue: 1,
      duration: SWEEP_DURATION_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false, // animating `top` as a percentage, same technique Spine uses for `height`
    }).start(() => {
      Animated.stagger(
        CASCADE_STAGGER_MS,
        sectionAnims.map((value) =>
          Animated.timing(value, { toValue: 1, duration: CASCADE_FADE_MS, useNativeDriver: true })
        )
      ).start(() => setSettled(true));
    });

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sweepAnim/sectionAnims are stable refs
  }, [isFreshReveal, reducedMotion, script]);

  function sectionStyle(index: number) {
    return {
      opacity: sectionAnims[index],
      transform: [{ translateY: sectionAnims[index].interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
    };
  }

  // --- Outcome logging (premium; feeds the self-reported savings tracker). -
  const [editingOutcome, setEditingOutcome] = useState(false);
  const [newRateText, setNewRateText] = useState('');
  const [dateText, setDateText] = useState(todayForInput());
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [outcomeJustSaved, setOutcomeJustSaved] = useState(false);
  const [headerJustSaved, setHeaderJustSaved] = useState(false);

  const parsedRate = parseOutcomeAmount(newRateText);
  const parsedDate = parseOutcomeDate(dateText);
  const canSaveOutcome = parsedRate != null && parsedDate != null && !savingOutcome;
  const showOutcomeForm = editingOutcome || !bill?.outcome;

  async function handleSaveOutcome() {
    if (!bill || parsedRate == null || parsedDate == null) return;
    setSavingOutcome(true);
    const updated = await logBillOutcome(bill.id, { newMonthlyAmount: parsedRate, loggedAt: parsedDate });
    setBill(updated.find((b) => b.id === bill.id) ?? bill);
    setSavingOutcome(false);
    setEditingOutcome(false);
    setOutcomeJustSaved(true);
    setTimeout(() => setOutcomeJustSaved(false), 1200); // SUCCESS spec: label swap holds 1.2s
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  // --- Loading / not-found -------------------------------------------------

  if (bill === undefined) {
    // Cold reads never show a spinner in this app — a bare Paper frame for
    // the brief moment AsyncStorage takes to answer is the same ethos as the
    // app's own cold-start rule.
    return <View style={styles.root} />;
  }

  if (bill === null || !script) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.notFound, { paddingTop: insets.top + SPACING.space24 }]}>
          <Text style={typography.body}>This bill couldn't be found.</Text>
          <Button label="Back to bills" onPress={() => router.replace('/')} style={styles.notFoundButton} />
        </View>
      </View>
    );
  }

  const categoryLabel = CATEGORY_DISPLAY_NAME[bill.category];

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + SPACING.space16 }]}>
        <Pressable
          onPress={goBack}
          hitSlop={SPACING.space8}
          style={styles.headerControl}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backGlyph}>←</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setHeaderJustSaved(true);
            setTimeout(() => setHeaderJustSaved(false), 1200);
          }}
          hitSlop={SPACING.space8}
          style={styles.headerControl}
          accessibilityRole="button"
          accessibilityLabel="Save"
        >
          <Text style={[typography.body, styles.saveLink]}>{headerJustSaved ? 'Saved' : 'Save'}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TOUCH_TARGET_MIN + SPACING.space48 + insets.bottom },
        ]}
      >
        <View style={styles.providerBlock}>
          <Text style={typography.h1} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.h1}>
            {bill.provider}
          </Text>
          <Text style={typography.meta}>{categoryLabel}</Text>
        </View>

        <Animated.View style={[styles.readoutBlock, sectionStyle(SECTION_READOUT)]}>
          <View
            style={styles.readoutRow}
            accessible
            accessibilityLabel={`Current bill ${spokenAmount(script.currentMonthlyAmount)} a month, target ${spokenAmount(
              script.targetMonthlyAmount
            )} a month`}
          >
            <Text style={typography.beforeAmount}>{formatAmount(script.currentMonthlyAmount)}</Text>
            <Text style={styles.readoutArrow}> → </Text>
            <Text style={typography.heroNumber} maxFontSizeMultiplier={MAX_FONT_SCALE.heroNumber}>
              {formatAmount(script.targetMonthlyAmount)}
            </Text>
            <Text style={styles.readoutUnit}>/mo</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.beatBlock, sectionStyle(SECTION_ASK_FOR)]}>
          <Text style={typography.h2} accessibilityRole="header">{`Ask for the ${script.department}`}</Text>
          {script.ivrTip ? <Text style={[typography.body, styles.beatBody]}>{script.ivrTip}</Text> : null}
        </Animated.View>

        <Hairline style={styles.hairlineSpacing} />

        <View style={styles.spineParent}>
          <Spine segments={spineSegments} reducedMotion={!spineReady} style={styles.spineOffset} />

          <Animated.View style={[styles.spineContent, sectionStyle(SECTION_WHAT_TO_SAY)]}>
            <Text style={typography.h2} accessibilityRole="header">
              What to say
            </Text>
            <Text style={[typography.scriptLine, styles.beatBody, styles.scriptColumn]}>
              {`"${script.opening} ${script.leverage} ${script.ask}"`}
            </Text>
          </Animated.View>

          <Animated.View style={[styles.spineContent, styles.spineContentSpacing, sectionStyle(SECTION_PUSHBACK)]}>
            <Text style={typography.h2} accessibilityRole="header">
              If they push back
            </Text>
            {script.objections.map((pair, index) => (
              <View key={index} style={styles.objectionPair}>
                <Text style={[typography.scriptLine, styles.scriptColumn]}>{`If they say: ${pair.ifTheySay}`}</Text>
                <Text style={[typography.scriptLine, styles.scriptColumn, styles.sayBack]}>
                  {`Say back: ${pair.youSay}`}
                </Text>
              </View>
            ))}
          </Animated.View>

          <Hairline weight="heavy" style={styles.heavyDividerSpacing} />

          <Animated.View style={[styles.spineContent, sectionStyle(SECTION_HANG_UP)]}>
            <Text style={typography.h2} accessibilityRole="header">
              Before you hang up
            </Text>
            <Text style={[typography.scriptLine, styles.beatBody, styles.scriptColumn]}>{`"${script.close}"`}</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.footnoteBlock, sectionStyle(SECTION_FOOTNOTE)]}>
          <Text style={typography.meta}>
            {`Projected savings ${formatAmount(script.projectedAnnualSavings.low)}–${formatAmount(
              script.projectedAnnualSavings.high
            )}/yr. ${script.sourceNote}`}
          </Text>
        </Animated.View>

        <Hairline style={styles.hairlineSpacing} />

        {isFreshReveal ? null : isPremium ? (
          <View style={styles.outcomeBlock}>
            {showOutcomeForm ? (
              <>
                <Text style={typography.h2} accessibilityRole="header">
                  What did you actually get?
                </Text>
                <TextInputUnderline
                  label="New monthly amount"
                  variant="amount"
                  value={newRateText}
                  onChangeText={setNewRateText}
                  placeholder="0.00"
                  containerStyle={styles.outcomeField}
                  testID="outcome-new-rate"
                />
                <TextInputUnderline
                  label="Date"
                  value={dateText}
                  onChangeText={setDateText}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                  containerStyle={styles.outcomeField}
                  testID="outcome-date"
                />
                <Button
                  label={outcomeJustSaved ? 'Saved' : 'Save outcome'}
                  onPress={handleSaveOutcome}
                  disabled={!canSaveOutcome}
                  style={styles.outcomeSaveButton}
                  testID="outcome-save"
                />
              </>
            ) : (
              bill.outcome && (
                <View>
                  <Text style={typography.h2} accessibilityRole="header">
                    What you got
                  </Text>
                  <Text style={[typography.body, styles.beatBody]}>
                    {`Logged ${formatAmount(bill.outcome.newMonthlyAmount)}/mo on ${formatLoggedDate(
                      bill.outcome.loggedAt
                    )}.`}
                  </Text>
                  <Pressable
                    onPress={() => setEditingOutcome(true)}
                    hitSlop={SPACING.space8}
                    style={styles.editLinkTouch}
                    accessibilityRole="button"
                    accessibilityLabel="Edit logged outcome"
                  >
                    <Text style={[typography.body, styles.saveLink]}>Edit</Text>
                  </Pressable>
                </View>
              )
            )}
          </View>
        ) : (
          <Pressable
            onPress={() => router.push('/paywall')}
            style={styles.gatedCta}
            accessibilityRole="button"
            accessibilityLabel="Log what you got, Premium. Opens subscription."
          >
            <Text style={[typography.buttonLabel, styles.gatedCtaLabel]}>Log what you got (Premium)</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + SPACING.space16 }]}>
        <Button label="I made the call" onPress={() => router.replace('/')} testID="made-the-call" />
      </View>

      {isFreshReveal && !settled && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sweepOverlay,
            { top: sweepAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.paper,
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.screenMargin,
    paddingBottom: SPACING.space8,
  },
  headerControl: {
    minHeight: TOUCH_TARGET_MIN,
    minWidth: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    fontFamily: FONT_FAMILY.publicSansSemiBold,
    fontSize: 20,
    color: COLORS.ink,
  },
  saveLink: {
    color: COLORS.corner,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT.screenMargin,
  },
  notFound: {
    flex: 1,
    paddingHorizontal: LAYOUT.screenMargin,
    alignItems: 'flex-start',
  },
  notFoundButton: {
    marginTop: SPACING.space24,
    alignSelf: 'stretch',
  },
  providerBlock: {
    marginBottom: SPACING.space24,
  },
  readoutBlock: {
    marginBottom: LAYOUT.beatGap,
  },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  readoutArrow: {
    fontFamily: FONT_FAMILY.plexMonoRegular,
    fontSize: 20,
    color: COLORS.ink,
  },
  readoutUnit: {
    fontFamily: FONT_FAMILY.plexMonoRegular,
    fontSize: 16,
    color: COLORS.ink,
    marginLeft: SPACING.space4,
  },
  beatBlock: {
    marginBottom: LAYOUT.beatGap,
  },
  beatBody: {
    marginTop: SPACING.space8,
  },
  hairlineSpacing: {
    marginBottom: LAYOUT.beatGap,
  },
  heavyDividerSpacing: {
    marginTop: SPACING.space24,
    marginBottom: SPACING.space24,
  },
  spineParent: {
    position: 'relative',
  },
  spineOffset: {
    // Spine positions itself at left:0 of this exact parent — no padding here.
  },
  spineContent: {
    paddingLeft: SPACING.space16,
  },
  spineContentSpacing: {
    marginTop: SPACING.space24,
  },
  scriptColumn: {
    maxWidth: SCRIPT_COLUMN_MAX_WIDTH,
  },
  objectionPair: {
    marginTop: SPACING.space16,
  },
  sayBack: {
    marginTop: SPACING.space8,
  },
  footnoteBlock: {
    marginTop: SPACING.space24,
  },
  outcomeBlock: {
    marginBottom: SPACING.space24,
  },
  outcomeField: {
    marginTop: SPACING.space16,
  },
  outcomeSaveButton: {
    marginTop: SPACING.space24,
  },
  editLinkTouch: {
    marginTop: SPACING.space8,
    minHeight: TOUCH_TARGET_MIN,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  gatedCta: {
    minHeight: TOUCH_TARGET_MIN,
    borderRadius: RADII.control,
    borderWidth: HAIRLINE_WIDTH,
    borderColor: COLORS.rule,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.space24,
    marginBottom: SPACING.space24,
  },
  gatedCtaLabel: {
    color: DERIVED.inkDisabled,
  },
  stickyFooter: {
    paddingHorizontal: LAYOUT.screenMargin,
    paddingTop: SPACING.space16,
    backgroundColor: COLORS.paper,
  },
  sweepOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '100%',
    backgroundColor: COLORS.corner,
  },
});
