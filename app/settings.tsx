/**
 * Settings — restore purchases, the renegotiation reminder, an honest
 * accounting of what the savings numbers mean, and the on-device/no-account
 * explanation that is a genuine trust asset for this product (product-spec.md
 * -> screens; assignment brief for this file).
 *
 * The reminder here is scheduled against the most recently added bill.
 * `lib/notifications.ts` schedules one reminder per bill, and this MVP has no
 * per-bill reminder-management UI outside of this screen (Bill Detail's own
 * spec only adds an outcome-logging block) — so "the bill I most recently
 * asked Haggle about" is the one sensible default without inventing a bill
 * picker the design system never specifies. See CONCERNS in the hand-off.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';

import CategoryRow from '../components/CategoryRow';
import Hairline from '../components/Hairline';
import { SpineTick } from '../components/Spine';
import {
  cancelRenegotiationReminder,
  DEFAULT_REMINDER_MONTHS,
  getRenegotiationReminder,
  scheduleRenegotiationReminder,
} from '../lib/notifications';
import { usePremium } from '../lib/purchases';
import { getBills } from '../lib/storage';
import type { ReminderState } from '../lib/storage';
import type { Bill } from '../lib/types';
import {
  COLORS,
  DERIVED,
  HAIRLINE_WIDTH,
  LAYOUT,
  RADII,
  SPACING,
  TOUCH_TARGET_MIN,
} from '../theme/tokens';
import { FONT_FAMILY, MAX_FONT_SCALE, typography } from '../theme/typography';

type ReminderMonths = 6 | 12;
const REMINDER_MONTH_OPTIONS: { value: ReminderMonths; description: string }[] = [
  { value: 6, description: 'Good if your bill resets on a shorter promo cycle.' },
  { value: 12, description: 'Matches most annual contract renewals.' },
];

/** Ties this screen's two offered intervals back to lib/notifications.ts's own default. */
const DEFAULT_MONTHS: ReminderMonths =
  REMINDER_MONTH_OPTIONS.find((option) => option.value === DEFAULT_REMINDER_MONTHS)?.value ?? 12;

/** Most recently added bill, or null if none exist yet — the reminder's target. */
function latestOf(bills: Bill[]): Bill | null {
  if (bills.length === 0) return null;
  return [...bills].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/**
 * `ReminderState` only stores when it fires, not which of the two offered
 * intervals the user picked — this reconstructs the closer of the two so the
 * month picker reflects a real prior choice instead of always resetting to
 * the default.
 */
function estimateReminderMonths(reminder: ReminderState): ReminderMonths {
  const daysPerMonth = 30.44;
  const elapsedDays =
    (new Date(reminder.scheduledForIso).getTime() - new Date(reminder.createdAt).getTime()) /
    (1000 * 60 * 60 * 24);
  const months = elapsedDays / daysPerMonth;
  return Math.abs(months - 6) <= Math.abs(months - 12) ? 6 : 12;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { isPremium, restore } = usePremium();

  const [bills, setBills] = useState<Bill[] | null>(null);
  const [reminder, setReminder] = useState<ReminderState | null>(null);
  const [reminderMonths, setReminderMonths] = useState<ReminderMonths>(DEFAULT_MONTHS);
  const [reminderBusy, setReminderBusy] = useState(false);

  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  const latestBill = useMemo(() => (bills ? latestOf(bills) : null), [bills]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loadedBills = await getBills();
      if (cancelled) return;
      setBills(loadedBills);

      const bill = latestOf(loadedBills);
      if (!bill) return;
      const existing = await getRenegotiationReminder(bill.id);
      if (cancelled || !existing) return;
      setReminder(existing);
      setReminderMonths(estimateReminderMonths(existing));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  async function handleToggleReminder() {
    if (!latestBill || reminderBusy) return;
    setReminderBusy(true);
    if (reminder) {
      await cancelRenegotiationReminder(latestBill.id);
      setReminder(null);
    } else {
      const saved = await scheduleRenegotiationReminder(latestBill, { monthsFromNow: reminderMonths });
      setReminder(saved);
    }
    setReminderBusy(false);
  }

  async function handleChooseMonths(months: ReminderMonths) {
    if (!latestBill || reminderBusy || months === reminderMonths) return;
    setReminderMonths(months);
    if (!reminder) return; // Nothing scheduled yet — this just sets what the toggle will use.
    setReminderBusy(true);
    await cancelRenegotiationReminder(latestBill.id);
    const saved = await scheduleRenegotiationReminder(latestBill, { monthsFromNow: months });
    setReminder(saved);
    setReminderBusy(false);
  }

  async function handleRestore() {
    if (restoring) return;
    setRestoring(true);
    setRestoreMessage(null);
    const result = await restore();
    setRestoring(false);
    setRestoreMessage(result.message);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
          <Text style={typography.h1} maxFontSizeMultiplier={MAX_FONT_SCALE.h1} accessibilityRole="header">
            Settings
          </Text>
        </View>

        <Text style={[typography.body, styles.sectionHeader]}>About Haggle</Text>
        <Text style={[typography.body, styles.paragraph]}>
          Haggle turns the bill details you enter into a ready-to-read negotiation script. The
          script is written on this device, by this app — there's no account, no sign-in, and
          nothing you type is ever sent anywhere.
        </Text>

        <Hairline style={styles.sectionDivider} />

        <Pressable
          onPress={handleRestore}
          disabled={restoring}
          accessibilityRole="button"
          style={styles.row}
          testID="settings-restore"
        >
          <Text style={typography.body}>{restoring ? 'Restoring…' : 'Restore purchases'}</Text>
        </Pressable>
        {restoreMessage && <Text style={[typography.meta, styles.rowNote]}>{restoreMessage}</Text>}

        <Hairline />

        {isPremium ? (
          <>
            <Pressable
              onPress={handleToggleReminder}
              disabled={!latestBill || reminderBusy}
              accessibilityRole="switch"
              accessibilityState={{ disabled: !latestBill || reminderBusy, checked: reminder != null }}
              accessibilityLabel="Renegotiation reminder"
              style={styles.row}
              testID="settings-reminder-toggle"
            >
              <View style={styles.rowLabelGroup}>
                <SpineTick visible={reminder != null} />
                <Text style={[typography.body, !latestBill && styles.disabledLabel]}>
                  Renegotiation reminder
                </Text>
              </View>
              <Text style={[typography.body, reminder ? styles.onLabel : styles.offLabel]}>
                {reminder ? 'On' : 'Off'}
              </Text>
            </Pressable>

            {!latestBill && (
              <Text style={[typography.meta, styles.rowNote]}>
                Add a bill first. The reminder is tied to your most recent one.
              </Text>
            )}
            {reminder && !reminder.osNotificationsEnabled && (
              <Text style={[typography.meta, styles.rowNote]}>
                Notifications are off for Haggle on this phone, so this will only show inside the
                app.
              </Text>
            )}

            <View style={styles.monthPicker} accessibilityRole="radiogroup">
              {REMINDER_MONTH_OPTIONS.map((option, index) => (
                <View key={option.value}>
                  {index > 0 && <Hairline />}
                  <CategoryRow
                    label={`${option.value} months`}
                    description={option.description}
                    selected={reminderMonths === option.value}
                    onPress={() => handleChooseMonths(option.value)}
                    disabled={!latestBill || reminderBusy}
                    testID={`settings-reminder-months-${option.value}`}
                  />
                </View>
              ))}
            </View>
          </>
        ) : (
          <Pressable
            onPress={() => router.push('/paywall')}
            accessibilityRole="button"
            accessibilityLabel="Renegotiation reminder, Premium"
            style={styles.lockedRow}
            testID="settings-reminder-locked"
          >
            <Text style={[typography.body, styles.disabledLabel]}>Renegotiation reminder</Text>
            <Text style={[typography.body, styles.disabledLabel]}>— Premium</Text>
          </Pressable>
        )}

        <Hairline />

        <Text style={[typography.body, styles.sectionHeader]}>Savings estimates</Text>
        <Text style={[typography.body, styles.paragraph]}>
          The range on every script is a sourced estimate of what similar callers have
          negotiated, never a promise for your bill specifically. The total in your savings
          tracker is entirely self-reported: it's what you told us your bill was, minus what you
          told us it became, times twelve. Haggle doesn't verify it and doesn't project it forward.
        </Text>
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
  // Deliberately NOT one of the two locked type families — a navigation
  // glyph, not text content, so it renders from the guaranteed system font
  // (same reasoning as Add a Bill's back glyph).
  backGlyph: {
    fontSize: 20,
    color: COLORS.ink,
  },
  sectionHeader: {
    fontFamily: FONT_FAMILY.publicSansSemiBold,
  },
  paragraph: {
    marginTop: SPACING.space8,
  },
  sectionDivider: {
    marginTop: LAYOUT.formBlockGap,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Math.max(SPACING.space48, TOUCH_TARGET_MIN),
    paddingVertical: SPACING.space12,
  },
  rowLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.space12,
  },
  rowNote: {
    marginTop: -SPACING.space4,
    marginBottom: SPACING.space8,
  },
  onLabel: {
    color: COLORS.corner,
  },
  offLabel: {
    color: DERIVED.inkSecondary,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TOUCH_TARGET_MIN,
    borderWidth: HAIRLINE_WIDTH,
    borderColor: COLORS.rule,
    borderRadius: RADII.control,
    paddingHorizontal: SPACING.space16,
    marginVertical: SPACING.space12,
  },
  disabledLabel: {
    color: DERIVED.inkDisabled,
  },
  monthPicker: {
    marginTop: SPACING.space4,
  },
});
