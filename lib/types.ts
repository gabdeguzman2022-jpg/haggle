/**
 * Shared type contract for Haggle.
 *
 * Every module codes against these types: the script engine produces a
 * ScriptResult, storage persists Bills, and the screens render both.
 */

/** The three bill categories Haggle supports. */
export type BillCategory = 'phone' | 'internet' | 'insurance';

/**
 * Why the user is calling. This selects the negotiation tactic, so it is a
 * required input rather than an optional detail.
 */
export type CallTrigger = 'rate_increase' | 'promo_expired' | 'just_checking';

/** A competing offer the user can quote on the call — the strongest leverage there is. */
export interface CompetitorOffer {
  provider: string;
  monthlyAmount: number;
}

/** What the user types into the Add Bill form. */
export interface BillInput {
  category: BillCategory;
  provider: string;
  currentMonthlyAmount: number;
  trigger: CallTrigger;
  /** How long they have been a customer. Drives the loyalty tactic. */
  tenureMonths?: number;
  competitorOffer?: CompetitorOffer;
}

/** What the user reports back after actually making the call. */
export interface BillOutcome {
  newMonthlyAmount: number;
  /** ISO 8601 timestamp. */
  loggedAt: string;
}

/** A saved bill, as persisted to AsyncStorage. */
export interface Bill extends BillInput {
  id: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
  outcome?: BillOutcome;
}

/**
 * Which negotiation strategy the engine selected. Different families produce
 * structurally different scripts, not the same skeleton with swapped nouns.
 */
export type TacticFamily =
  | 'competitor_anchor'
  | 'loyalty_tenure'
  | 'cancellation_signal'
  | 'insurance_shopping'
  | 'generic';

/** An "if they say X, you say Y" pair the user can fall back on mid-call. */
export interface ObjectionPair {
  ifTheySay: string;
  youSay: string;
}

/** A savings estimate, always a range and always attributed — never a promise. */
export interface SavingsRange {
  low: number;
  high: number;
}

/**
 * The generated script. Maps onto the five fixed beats of the Script Result
 * screen: Ask for -> What to say -> Your target ask -> If they push back ->
 * Before you hang up. No sixth beat ships.
 */
export interface ScriptResult {
  /** Beat 1: the department with authority to discount. */
  department: string;
  /** Beat 1: how to get past the phone menu to that department. */
  ivrTip?: string;
  /** Beat 2 + 3: which strategy this script is built on. */
  tactic: TacticFamily;
  /** Beat 2: opening line that identifies the user and their situation. */
  opening: string;
  /** Beat 2: the leverage statement — why they should say yes. */
  leverage: string;
  /** Beat 3: the specific ask, in the user's own numbers. */
  ask: string;
  currentMonthlyAmount: number;
  /** Computed, never hardcoded. */
  targetMonthlyAmount: number;
  projectedAnnualSavings: SavingsRange;
  /** Beat 4: 2-3 rebuttals for the pushback they will actually get. */
  objections: ObjectionPair[];
  /** Beat 5: get the new rate confirmed in writing before hanging up. */
  close: string;
  /** Attribution for the savings range. Displayed as a footnote. */
  sourceNote: string;
}
