/**
 * Local renegotiation reminder (expo-notifications).
 *
 * Verified against the SDK 57 versioned docs
 * (https://docs.expo.dev/versions/v57.0.0/sdk/notifications/) and the
 * installed package's own .d.ts files: a one-shot future notification uses
 * `SchedulableTriggerInputTypes.DATE` with a `date`, not the older
 * `{ seconds }`-only trigger shape from pre-SDK-53 docs.
 */
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';

import {
  deleteReminder as deleteStoredReminder,
  getReminder as getStoredReminder,
  saveReminder,
  type ReminderState,
} from './storage';
import type { Bill } from './types';

/** Product-spec default: remind the user to renegotiate a year after this call. */
export const DEFAULT_REMINDER_MONTHS = 12;

export interface ScheduleReminderOptions {
  /** How many months out to schedule the reminder. Defaults to `DEFAULT_REMINDER_MONTHS`. */
  monthsFromNow?: number;
  /**
   * Dev-only escape hatch: schedule this many seconds from now instead, so the
   * reminder can fire on camera without waiting a year. Ignored outside
   * `__DEV__` so a demo build can never ship a real reminder this short.
   */
  devIntervalSeconds?: number;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setMonth(result.getMonth() + months);
  return result;
}

function resolveTargetDate(options?: ScheduleReminderOptions): Date {
  if (__DEV__ && options?.devIntervalSeconds && options.devIntervalSeconds > 0) {
    return new Date(Date.now() + options.devIntervalSeconds * 1000);
  }
  return addMonths(new Date(), options?.monthsFromNow ?? DEFAULT_REMINDER_MONTHS);
}

/**
 * Checks current permission, requesting it if the user hasn't been asked
 * (or hasn't been denied outright). Never throws — a permissions API error
 * is treated the same as "not granted."
 */
async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

/**
 * Schedules the renegotiation reminder for a bill and persists its state.
 *
 * If the user denies (or has denied) notification permission, this still
 * returns and saves a `ReminderState` with `osNotificationsEnabled: false`
 * and `notificationId: null` — the reminder is recorded as scheduled in app
 * state per the spec's edge case, rather than failing silently or throwing.
 */
export async function scheduleRenegotiationReminder(
  bill: Bill,
  options?: ScheduleReminderOptions
): Promise<ReminderState> {
  const targetDate = resolveTargetDate(options);
  const granted = await ensureNotificationPermission();

  let notificationId: string | null = null;
  let lastError: string | undefined;

  if (granted) {
    try {
      notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time to renegotiate',
          body: `Your ${bill.provider} bill may have crept back up. Give them another call.`,
          data: { billId: bill.id },
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: targetDate,
        },
      });
    } catch (err) {
      // Permission was granted but the OS call itself failed (rare). Record
      // it as "OS notifications off" for this reminder rather than crashing
      // the flow the user was in — the reminder still exists in-app.
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  const reminder: ReminderState = {
    billId: bill.id,
    scheduledForIso: targetDate.toISOString(),
    notificationId,
    osNotificationsEnabled: granted && notificationId != null,
    createdAt: new Date().toISOString(),
    ...(lastError ? { lastError } : {}),
  };

  await saveReminder(reminder);
  return reminder;
}

/** Reads the persisted reminder state for a bill, or null if none is set. */
export async function getRenegotiationReminder(billId: string): Promise<ReminderState | null> {
  return getStoredReminder(billId);
}

/**
 * Cancels a bill's reminder: unschedules the OS notification (if one was
 * successfully scheduled) and clears the persisted state.
 */
export async function cancelRenegotiationReminder(billId: string): Promise<void> {
  const reminder = await getStoredReminder(billId);
  if (reminder?.notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
    } catch {
      // Nothing left to reconcile — proceed to clear local state regardless.
    }
  }
  await deleteStoredReminder(billId);
}
