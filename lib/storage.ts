/**
 * AsyncStorage persistence for Haggle.
 *
 * Every function here is safe to call from the UI without a try/catch: a
 * missing key, a corrupted JSON blob, or a write failure all resolve to a
 * sane empty default instead of throwing. The one thing that must never
 * happen is the free-tier flag resetting because storage hiccuped — see
 * `hasUsedFreeScript` / `markFreeScriptUsed` below.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Bill, BillInput, BillOutcome } from './types';

const KEYS = {
  bills: '@haggle/bills',
  freeScriptUsed: '@haggle/freeScriptUsed',
  reminders: '@haggle/reminders',
} as const;

// ---------------------------------------------------------------------------
// Id generation
// ---------------------------------------------------------------------------

// A per-session counter makes two ids generated in the same millisecond
// distinct without needing a real UUID library (expo-crypto isn't
// installed). Ids are timestamp-prefixed, so they also sort chronologically.
let sessionCounter = 0;

/** Generates a collision-safe id: `<prefix>_<timestamp36>_<counter36>`. */
export function generateId(prefix: string = 'id'): string {
  sessionCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${sessionCounter.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Low-level read/write helpers — every failure mode collapses to a fallback
// value rather than propagating, per the module's error-handling contract.
// ---------------------------------------------------------------------------

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupted or unreadable value: behave as if nothing was ever stored.
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

/** Loads every saved bill. Returns `[]` on a fresh install or a read error. */
export async function getBills(): Promise<Bill[]> {
  const stored = await readJson<Bill[]>(KEYS.bills, []);
  return Array.isArray(stored) ? stored : [];
}

async function saveBills(bills: Bill[]): Promise<void> {
  await writeJson(KEYS.bills, bills);
}

/** Builds a full `Bill` from form input, persists it, and returns it. */
export async function addBill(input: BillInput): Promise<Bill> {
  const bill: Bill = {
    ...input,
    id: generateId('bill'),
    createdAt: new Date().toISOString(),
  };
  const bills = await getBills();
  await saveBills([...bills, bill]);
  return bill;
}

/**
 * Records what actually happened on the call. This is the write that feeds
 * the self-reported savings tracker — see `summarizeSelfReportedSavings`.
 * Returns the updated list; a bill id that no longer exists is a no-op.
 */
export async function logBillOutcome(billId: string, outcome: BillOutcome): Promise<Bill[]> {
  const bills = await getBills();
  const next = bills.map((bill) => (bill.id === billId ? { ...bill, outcome } : bill));
  await saveBills(next);
  return next;
}

/** Removes a saved bill (e.g. from Bill Detail). Returns the updated list. */
export async function deleteBill(billId: string): Promise<Bill[]> {
  const bills = await getBills();
  const next = bills.filter((bill) => bill.id !== billId);
  await saveBills(next);
  return next;
}

// ---------------------------------------------------------------------------
// Free-script gating
//
// This flag is the entire enforcement mechanism for "first script free,
// second bill paywalled." It MUST survive a force-quit, so it lives in its
// own key (never derived from the bills list, which a future "clear my
// data" feature might reasonably wipe on its own).
// ---------------------------------------------------------------------------

/** True once the user has generated their one free script. Durable across relaunch. */
export async function hasUsedFreeScript(): Promise<boolean> {
  return (await readJson<boolean>(KEYS.freeScriptUsed, false)) === true;
}

/** Marks the free script as used. Idempotent. */
export async function markFreeScriptUsed(): Promise<void> {
  await writeJson(KEYS.freeScriptUsed, true);
}

// ---------------------------------------------------------------------------
// Self-reported savings tracker
// ---------------------------------------------------------------------------

export interface SavingsSummary {
  /** How many bills have a logged outcome. */
  loggedCount: number;
  /** Sum of (old - new) * 12 across every logged outcome. Self-reported, never projected. */
  totalAnnualSavings: number;
}

/**
 * Pure aggregation over already-loaded bills — no I/O. Kept here, next to
 * the data it summarizes, so the tracker's math has exactly one home.
 */
export function summarizeSelfReportedSavings(bills: Bill[]): SavingsSummary {
  let loggedCount = 0;
  let totalAnnualSavings = 0;
  for (const bill of bills) {
    if (!bill.outcome) continue;
    loggedCount += 1;
    totalAnnualSavings += (bill.currentMonthlyAmount - bill.outcome.newMonthlyAmount) * 12;
  }
  return { loggedCount, totalAnnualSavings };
}

// ---------------------------------------------------------------------------
// Renegotiation reminders
//
// Scheduling and permission logic live in lib/notifications.ts; this module
// only persists the resulting state, keyed by bill id, so "reminder set" is
// still true in-app even if the OS notification itself couldn't be granted.
// ---------------------------------------------------------------------------

export interface ReminderState {
  billId: string;
  /** ISO 8601 timestamp the reminder is scheduled for. */
  scheduledForIso: string;
  /** expo-notifications identifier, or null if no OS notification could be scheduled. */
  notificationId: string | null;
  /** False when the user denied notification permission — the app-state flag stays true regardless. */
  osNotificationsEnabled: boolean;
  /** ISO 8601 timestamp the reminder was created/updated. */
  createdAt: string;
  /** Set when scheduling the OS notification threw, for diagnostics only — never shown as-is to the user. */
  lastError?: string;
}

type ReminderMap = Record<string, ReminderState>;

/** All reminders, keyed by bill id. Returns `{}` on a fresh install or a read error. */
export async function getReminders(): Promise<ReminderMap> {
  const stored = await readJson<ReminderMap>(KEYS.reminders, {});
  return stored && typeof stored === 'object' ? stored : {};
}

/** The reminder for one bill, or null if none is scheduled. */
export async function getReminder(billId: string): Promise<ReminderState | null> {
  const reminders = await getReminders();
  return reminders[billId] ?? null;
}

/** Upserts a reminder's persisted state. */
export async function saveReminder(reminder: ReminderState): Promise<void> {
  const reminders = await getReminders();
  reminders[reminder.billId] = reminder;
  await writeJson(KEYS.reminders, reminders);
}

/** Clears a bill's reminder state (e.g. after the OS notification is cancelled). */
export async function deleteReminder(billId: string): Promise<void> {
  const reminders = await getReminders();
  if (!(billId in reminders)) return;
  delete reminders[billId];
  await writeJson(KEYS.reminders, reminders);
}
