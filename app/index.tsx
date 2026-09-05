/**
 * Home / Bill List — docs/design-system.md, SCREEN 1.
 *
 * The savings tracker (locked-outline when not premium, Brass-Large total
 * once unlocked), a hairline-separated bill list with no cards or shadows,
 * the empty state, and a sticky full-width "Add a bill" button. No screen
 * owns its own header chrome in this app — this one draws it inline, per the
 * design system's flat, hairline-based visual system.
 */
import { useCallback, useMemo, useState } from 'react';
import { FlatList, ListRenderItem, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../components/Button';
import Hairline from '../components/Hairline';
import { SpineTick } from '../components/Spine';
import { getBills, summarizeSelfReportedSavings } from '../lib/storage';
import { usePremium } from '../lib/purchases';
import type { Bill, BillCategory } from '../lib/types';
import {
  COLORS,
  DERIVED,
  FOCUS_RING,
  HAIRLINE_WIDTH,
  LAYOUT,
  OPACITY,
  RADII,
  SPACING,
  TOUCH_TARGET_MIN,
} from '../theme/tokens';
import { FONT_FAMILY, MAX_FONT_SCALE, typography } from '../theme/typography';

/** Category picker copy, verbatim from design-system.md's SCREEN 2 wireframe — the one canonical source for these three labels. */
const CATEGORY_LABELS: Record<BillCategory, string> = {
  phone: 'Phone',
  internet: 'Internet or cable',
  insurance: 'Auto or home insurance',
};

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** No Intl dependency, so rendering can't vary with a device's ICU data — same output everywhere. */
function formatShortDate(iso: string): string {
  const date = new Date(iso);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Whole-dollar formatting with thousands separators, hand-rolled for the same reason as `formatShortDate`. */
function formatWholeDollars(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const grouped = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${grouped}`;
}

export default function Home() {
  const router = useRouter();
  const { isPremium } = usePremium();

  // `null` means "not loaded yet" — distinct from `[]`, a real empty list —
  // so the empty state never flashes on screen before storage has answered.
  const [bills, setBills] = useState<Bill[] | null>(null);

  const loadBills = useCallback(() => {
    getBills().then(setBills);
  }, []);

  // Reloads every time Home gains focus, not just on mount, so a bill added
  // or an outcome logged on another screen shows up the moment the user
  // comes back here.
  useFocusEffect(
    useCallback(() => {
      loadBills();
    }, [loadBills])
  );

  const savings = useMemo(() => summarizeSelfReportedSavings(bills ?? []), [bills]);

  const renderBillRow: ListRenderItem<Bill> = useCallback(
    ({ item }) => <BillRow bill={item} onPress={() => router.push(`/script/${item.id}`)} />,
    [router]
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <FlatList
        data={bills ?? []}
        keyExtractor={(bill) => bill.id}
        renderItem={renderBillRow}
        ItemSeparatorComponent={() => <Hairline />}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.h1} style={typography.h1}>
                Haggle
              </Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Settings"
                hitSlop={SPACING.space8}
                onPress={() => router.push('/settings')}
                style={({ pressed }) => [styles.settingsLink, pressed && styles.pressed]}
              >
                <Text style={[typography.body, styles.settingsLabel]}>Settings</Text>
              </Pressable>
            </View>

            <SavingsTrackerRow
              isPremium={isPremium}
              totalAnnualSavings={savings.totalAnnualSavings}
              onPressLocked={() => router.push('/paywall')}
            />

            <Hairline style={styles.trackerHairline} />
          </View>
        }
        ListEmptyComponent={bills === null ? null : <EmptyState />}
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.footer}>
        <Button label="Add a bill" onPress={() => router.push('/add-bill')} testID="add-bill-button" />
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Savings tracker row
// ---------------------------------------------------------------------------

interface SavingsTrackerRowProps {
  isPremium: boolean;
  totalAnnualSavings: number;
  onPressLocked: () => void;
}

function SavingsTrackerRow({ isPremium, totalAnnualSavings, onPressLocked }: SavingsTrackerRowProps) {
  const [focused, setFocused] = useState(false);

  if (isPremium) {
    return (
      <View style={styles.trackerUnlocked}>
        <Text style={[typography.body, styles.trackerLabel]}>Money saved so far</Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.heroNumber} style={typography.heroNumber}>
          {formatWholeDollars(totalAnnualSavings)}
        </Text>
      </View>
    );
  }

  // Locked: per accessibility_floor's DISABLED rule, the row stays fully
  // visible and tappable (it opens the paywall) rather than being hidden —
  // only its color/weight read as "quiet," never its presence.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Money saved so far. Premium feature."
      accessibilityHint="Opens Haggle Premium"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPressLocked}
      style={({ pressed }) => [styles.trackerLocked, pressed && styles.pressed]}
    >
      <View style={styles.trackerLockedTopRow}>
        <Text style={[typography.body, styles.trackerLabelDisabled]}>Money saved so far</Text>
        <Text style={[typography.body, styles.trackerLabelDisabled]}>— Premium</Text>
      </View>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE.heroNumber}
        style={[typography.heroNumber, styles.trackerAmountDisabled]}
      >
        $0
      </Text>
      {focused && <View pointerEvents="none" style={styles.focusWash} />}
      {focused && <View pointerEvents="none" style={styles.focusRing} />}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Bill list row
// ---------------------------------------------------------------------------

function BillRow({ bill, onPress }: { bill: Bill; onPress: () => void }) {
  const [focused, setFocused] = useState(false);
  const categoryLabel = CATEGORY_LABELS[bill.category];
  const dateLabel = bill.outcome
    ? `called ${formatShortDate(bill.outcome.loggedAt)}`
    : `added ${formatShortDate(bill.createdAt)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${bill.provider}, ${categoryLabel}, ${dateLabel}`}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={({ pressed }) => [styles.billRow, pressed && styles.pressed]}
    >
      <Text style={[typography.body, styles.billProvider]}>{bill.provider}</Text>
      <Text style={typography.meta}>{`${categoryLabel}, ${dateLabel}`}</Text>
      {focused && <View pointerEvents="none" style={styles.focusWash} />}
      {focused && <View pointerEvents="none" style={styles.focusRing} />}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <SpineTick visible color="corner" />
      <Text style={typography.body}>No bills yet.</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  listContent: {
    paddingHorizontal: LAYOUT.screenMargin,
    // Leaves room for the sticky footer so the last row is never hidden
    // beneath it, without the footer having to overlay the list itself.
    paddingBottom: SPACING.space24,
    flexGrow: 1,
  },
  pressed: {
    opacity: OPACITY.pressed,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: SPACING.space16,
  },
  settingsLink: {
    minHeight: TOUCH_TARGET_MIN,
    justifyContent: 'center',
  },
  settingsLabel: {
    color: COLORS.corner,
  },

  trackerUnlocked: {
    marginTop: LAYOUT.formBlockGap,
    gap: SPACING.space8,
  },
  trackerLabel: {
    color: COLORS.ink,
  },
  trackerLocked: {
    marginTop: LAYOUT.formBlockGap,
    borderWidth: HAIRLINE_WIDTH,
    borderColor: COLORS.rule,
    borderRadius: RADII.control,
    padding: SPACING.space16,
    gap: SPACING.space8,
    position: 'relative',
  },
  trackerLockedTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trackerLabelDisabled: {
    color: DERIVED.inkDisabled,
  },
  trackerAmountDisabled: {
    color: DERIVED.inkDisabled,
  },
  trackerHairline: {
    marginTop: LAYOUT.formBlockGap,
  },

  billRow: {
    minHeight: SPACING.space48,
    justifyContent: 'center',
    paddingVertical: SPACING.space12,
    gap: SPACING.space4,
    position: 'relative',
  },
  billProvider: {
    fontFamily: FONT_FAMILY.publicSansSemiBold,
  },

  emptyState: {
    marginTop: LAYOUT.formBlockGap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.space8,
  },
  footer: {
    paddingHorizontal: LAYOUT.screenMargin,
    paddingTop: SPACING.space16,
    paddingBottom: SPACING.space16,
  },

  focusWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: DERIVED.cornerFocusWash,
  },
  focusRing: {
    position: 'absolute',
    top: -FOCUS_RING.offset,
    left: -FOCUS_RING.offset,
    right: -FOCUS_RING.offset,
    bottom: -FOCUS_RING.offset,
    borderWidth: FOCUS_RING.width,
    borderColor: FOCUS_RING.color,
  },
});
