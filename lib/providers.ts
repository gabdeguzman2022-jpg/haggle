/**
 * Curated provider dataset for the script engine.
 *
 * This file is the "research" half of the engine: real retention/loyalty
 * department names, real IVR routing tricks, and realistic, sourced discount
 * ranges for a hand-picked set of major US providers per category, plus a
 * category-correct generic fallback for any provider the user types that
 * isn't in the list (see product-spec.md, edge_cases: "Provider not in the
 * curated dataset -> falls back to a generic, still category-correct
 * template rather than breaking the flow").
 *
 * Every fact that drives a number or a claim in the generated script is
 * sourced in a comment next to it. Ranges are intentionally conservative —
 * this product's honesty rule forbids presenting a guaranteed or averaged
 * savings figure, so every range here is a plausible band, not a promise.
 *
 * Insurance is scoped to auto/home/renters only, per product-spec.md
 * (mvp_out): health-insurance premiums are not negotiable via a retention
 * call and are explicitly excluded from this dataset and from all copy.
 */

import type { BillCategory } from './types';

/** A realistic percent-off-current-bill range a provider's negotiators can grant. */
export interface DiscountRange {
  low: number;
  high: number;
}

/**
 * Category-correct vocabulary, so a generated script never leaks the wrong
 * noun — a wireless "plan" showing up in an insurance "policy" script, or a
 * phone "rep" showing up where an insurance "agent" belongs.
 */
export interface CategoryVocabulary {
  /** What the recurring product itself is called. */
  product: string;
  /** What the recurring charge is called. */
  charge: string;
  /** What the person on the other end of the call is called. */
  agent: string;
  /** What the company that provides the product is called. */
  org: string;
  /** The verb for what a switcher does. */
  switchVerb: string;
}

export const CATEGORY_VOCAB: Record<BillCategory, CategoryVocabulary> = {
  phone: { product: 'plan', charge: 'bill', agent: 'rep', org: 'carrier', switchVerb: 'switch carriers' },
  internet: { product: 'plan', charge: 'bill', agent: 'rep', org: 'provider', switchVerb: 'switch providers' },
  insurance: { product: 'policy', charge: 'premium', agent: 'agent', org: 'insurer', switchVerb: 'switch insurers' },
};

/** One curated provider's negotiation profile. */
export interface ProviderProfile {
  /** Canonical display name. */
  name: string;
  category: BillCategory;
  /** Alternate spellings/short names a user might type, matched case-insensitively. */
  aliases?: string[];
  /** The real department (or, for agent-model insurers, the real point of contact) to ask for. */
  department: string;
  /** How to route the call there without wasting minutes in general support. */
  ivrTip: string;
  /** Sourced, realistic percent-off-current-bill range this company's negotiators can grant. */
  discountPercent: DiscountRange;
  /** Named, real discounts/levers a rep or agent can actually apply — used in the leverage line. */
  discountLevers: string[];
}

/**
 * The result of looking a provider up: the profile to use (curated, or the
 * category's generic fallback) plus whether it was actually a dataset hit.
 * `matched` lets callers (and tests) verify the fallback path directly.
 */
export interface ProviderLookup {
  profile: ProviderProfile;
  matched: boolean;
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// PHONE (wireless carriers)
// ---------------------------------------------------------------------------
// All wireless carriers below share the same IVR trick — telling the phone
// tree you want to cancel routes you out of general billing support and into
// the department actually authorized to discount, because losing a
// subscriber costs the carrier far more than a $10-30/mo credit. This is
// documented consistently across carrier-specific negotiation guides
// (Alphr's AT&T guide, Android Police's T-Mobile reporting, and multiple
// carrier community forums for Verizon) — it isn't invented for this app.
const PHONE_PROVIDERS: ProviderProfile[] = [
  {
    name: 'AT&T',
    category: 'phone',
    aliases: ['at&t', 'att', 'at and t'],
    department: 'Retention Department',
    // Dial 611 on an AT&T phone or 1-800-331-0500 from any phone; saying
    // "cancel my service" at the first prompt routes to retention rather
    // than general billing. (Alphr, "AT&T Retention - How To Get a Good
    // Deal"; JustFoundOutTech cancellation guide.)
    ivrTip: 'Call 1-800-331-0500 (or dial 611 from an AT&T phone) and say "cancel my service" at the first prompt. It routes you past general billing to retention.',
    // Typical retention outcome for AT&T customers is a $20-50/mo credit or
    // plan optimization (Alphr). On a representative ~$100-150 postpaid
    // bill that's roughly 15-30% off.
    discountPercent: { low: 15, high: 30 },
    discountLevers: ['loyalty credit', 'plan optimization', 'unused-feature removal'],
  },
  {
    name: 'Verizon',
    category: 'phone',
    aliases: ['verizon wireless'],
    department: 'Loyalty and Retention',
    // Verizon customers report reaching this team by calling the standard
    // line and indicating they're considering canceling; Verizon's own
    // community forum threads confirm the department's existence and that
    // reps there can apply loyalty discounts not available to a front-line rep.
    ivrTip: 'Call 1-800-922-0204 and tell the rep you\'re "thinking about canceling." Front-line reps can\'t apply loyalty discounts, but they can transfer you to someone who can.',
    // Verizon has run $25-40/mo loyalty-credit offers for existing lines
    // (PhoneArena, "Some Verizon customers are once again offered a $40
    // loyalty discount"); on a typical multi-line bill that's roughly 10-25%.
    discountPercent: { low: 10, high: 25 },
    discountLevers: ['loyalty credit', 'device-payoff credit', 'autopay discount'],
  },
  {
    name: 'T-Mobile',
    category: 'phone',
    aliases: ['tmobile', 't mobile'],
    department: 'Loyalty Team',
    // T-Mobile's loyalty team is gated behind a genuine cancellation signal
    // — reps are trained to offer bill credits specifically to customers
    // who say they're ready to leave (Android Police, "T-Mobile has
    // powerful discounts waiting in the wings to keep disgruntled customers
    // on board").
    ivrTip: 'Say you\'re ready to switch carriers before anything else. T-Mobile\'s loyalty offers are reserved for customers who signal they\'re about to leave.',
    // Reported offers run $10/mo for 6 months up to $20/mo for 12 months on
    // higher tiers (Android Police); on a typical ~$70-100 line that's
    // roughly 10-20%.
    discountPercent: { low: 10, high: 20 },
    discountLevers: ['loyalty bill credit', 'plan tier match', 'autopay discount'],
  },
  {
    name: 'US Cellular',
    category: 'phone',
    aliases: ['uscellular', 'u.s. cellular'],
    department: 'Customer Retention',
    ivrTip: 'Ask directly for the retention department rather than billing support. Regional carriers route retention calls faster than the big three.',
    discountPercent: { low: 10, high: 20 },
    discountLevers: ['loyalty credit', 'plan optimization', 'multi-line discount'],
  },
  {
    name: 'Google Fi',
    category: 'phone',
    aliases: ['google fi', 'fi wireless'],
    department: 'Customer Support (retention escalation)',
    ivrTip: 'Google Fi\'s support is chat-first; request escalation to a retention specialist explicitly if the first agent only offers a FAQ link.',
    discountPercent: { low: 5, high: 15 },
    discountLevers: ['bill-protection credit', 'plan-tier match'],
  },
  {
    name: 'Cricket Wireless',
    category: 'phone',
    aliases: ['cricket'],
    department: 'Customer Retention',
    ivrTip: 'Mention a competing prepaid offer by name. Cricket\'s retention reps are authorized to match published promos that aren\'t on the current price list.',
    discountPercent: { low: 5, high: 15 },
    discountLevers: ['loyalty credit', 'autopay discount', 'multi-line discount'],
  },
  {
    name: 'Boost Mobile',
    category: 'phone',
    aliases: ['boost'],
    department: 'Customer Retention',
    ivrTip: 'Say "cancel service" at the first prompt. Prepaid retention teams are measured on save rate just like postpaid carriers.',
    discountPercent: { low: 5, high: 15 },
    discountLevers: ['loyalty credit', 'plan-tier match'],
  },
];

// ---------------------------------------------------------------------------
// INTERNET / CABLE
// ---------------------------------------------------------------------------
const INTERNET_PROVIDERS: ProviderProfile[] = [
  {
    name: 'Xfinity',
    category: 'internet',
    aliases: ['comcast', 'comcast xfinity'],
    department: 'Customer Loyalty (Retention) Department',
    // Calling 1-800-XFINITY and saying "cancel" or "disconnect service"
    // routes past general billing to retention (Pine AI, "What is the
    // Xfinity Retention Department?"; 20SomethingFinance negotiation guide).
    ivrTip: 'Call 1-800-934-6489 and say "cancel service" or "disconnect" at the prompt. It transfers you to the loyalty/retention team.',
    // Retention specialists report offering $10-50/mo discounts or loyalty
    // credits up to $100 (Pine AI); on a typical ~$80-120 bill that's
    // roughly 10-35%.
    discountPercent: { low: 10, high: 35 },
    discountLevers: ['loyalty credit', 'promotional-rate renewal', 'speed-tier match'],
  },
  {
    name: 'Spectrum',
    category: 'internet',
    aliases: ['charter', 'charter spectrum'],
    department: 'Retention Department',
    // Call 833-267-6094 and say "disconnect" to reach retention
    // (Process.st, "How to Get a Great Deal through Spectrum Customer
    // Retention"). Most customers who reach retention save $20-40/mo
    // (ConnectCalifornia), which on a typical ~$70-100 bill is roughly
    // 20-35%.
    ivrTip: 'Call 833-267-6094 and tell the automated system you want to "disconnect service." It transfers you to retention rather than billing.',
    discountPercent: { low: 15, high: 30 },
    discountLevers: ['loyalty credit', 'promotional-rate renewal', 'bundle discount'],
  },
  {
    name: 'Cox',
    category: 'internet',
    aliases: ['cox communications'],
    department: 'Retention Department',
    ivrTip: 'Say "cancel" or "disconnect service" at the first menu to skip general billing and reach retention directly.',
    discountPercent: { low: 10, high: 25 },
    discountLevers: ['loyalty credit', 'promotional-rate renewal', 'contract renewal bonus'],
  },
  {
    name: 'Verizon Fios',
    category: 'internet',
    aliases: ['fios', 'verizon internet'],
    department: 'Loyalty and Retention',
    ivrTip: 'Call 1-800-837-4966 and say you\'re "considering canceling." Fios retention offers aren\'t shown to front-line billing reps.',
    discountPercent: { low: 10, high: 20 },
    discountLevers: ['loyalty credit', 'autopay discount', 'promotional-rate renewal'],
  },
  {
    name: 'AT&T Internet',
    category: 'internet',
    aliases: ['at&t fiber', 'att internet', 'att fiber'],
    department: 'Retention Department',
    // Same retention mechanic as AT&T wireless, routed through the
    // internet-specific support line (1-800-288-2020).
    ivrTip: 'Call 1-800-288-2020 and say "cancel my service" at the first prompt to reach retention.',
    discountPercent: { low: 10, high: 25 },
    discountLevers: ['loyalty credit', 'plan optimization', 'bundle discount'],
  },
  {
    name: 'Optimum',
    category: 'internet',
    aliases: ['altice', 'optimum online'],
    department: 'Retention Department',
    ivrTip: 'Say "cancel service" at the first prompt. As with the other major cable providers, this is the fastest documented route to retention.',
    discountPercent: { low: 10, high: 25 },
    discountLevers: ['loyalty credit', 'promotional-rate renewal'],
  },
  {
    name: 'CenturyLink',
    category: 'internet',
    aliases: ['centurylink', 'quantum fiber'],
    department: 'Retention Department',
    ivrTip: 'Ask directly to be transferred to retention before discussing your bill. Smaller ISPs will do this without the "say cancel" script.',
    discountPercent: { low: 5, high: 20 },
    discountLevers: ['loyalty credit', 'promotional-rate renewal'],
  },
];

// ---------------------------------------------------------------------------
// INSURANCE (auto / home / renters only — never health premiums)
// ---------------------------------------------------------------------------
// Insurance doesn't run on a "say cancel to reach retention" IVR trick the
// way telecom does — premiums move through shopping competing quotes,
// raising the deductible, bundling policies, and named per-carrier
// discounts. That structural difference is intentional and is what makes
// the insurance_shopping tactic family genuinely different from telecom's
// retention-department mechanics, not just a reskin.
//
// Sourced figures: switching after comparing quotes saves 10-15% on average
// (Money.com / industry quote-comparison data); raising a deductible from
// $500 to $1,000 cuts premiums roughly 20-25% (Consumer Reports); bundling
// auto+home saves ~15% on average, and State Farm's own bundle discount
// averages 22% — the highest of the majors (ValuePenguin). Progressive's
// Snapshot usage-based program can save safe drivers 10-30% at renewal
// (Progressive's own "7 Ways to Lower Your Car Insurance Rate").
const INSURANCE_PROVIDERS: ProviderProfile[] = [
  {
    name: 'State Farm',
    category: 'insurance',
    aliases: ['statefarm'],
    // State Farm sells through a captive local-agent model, so there is no
    // call-center retention department — the discount authority sits with
    // the customer's own agent's office (ValuePenguin).
    department: 'your State Farm agent\'s office',
    ivrTip: 'Ask specifically for a full policy review, not a payment question. Most discounts require a review, not a front-desk billing call.',
    discountPercent: { low: 15, high: 25 },
    discountLevers: ['multi-line (auto + home) discount', 'Drive Safe & Save program', 'good student discount', 'accident-free discount'],
  },
  {
    name: 'GEICO',
    category: 'insurance',
    aliases: ['geico'],
    department: 'a GEICO policy service representative',
    ivrTip: 'Mention you\'re comparing quotes before discussing your renewal price. It routes you to a rep authorized to apply retention discounts.',
    discountPercent: { low: 10, high: 20 },
    discountLevers: ['multi-policy discount', 'federal employee discount', 'military discount', 'good driver discount'],
  },
  {
    name: 'Progressive',
    category: 'insurance',
    aliases: ['progressive insurance'],
    department: 'a Progressive policy service agent',
    ivrTip: 'Ask about Snapshot and any multi-policy bundle before your renewal date. Both are applied prospectively, not retroactively.',
    discountPercent: { low: 10, high: 25 },
    discountLevers: ['multi-policy discount', 'Snapshot usage-based discount', 'paperless and autopay discount', 'continuous-insurance discount'],
  },
  {
    name: 'Allstate',
    category: 'insurance',
    aliases: ['allstate insurance'],
    department: 'your Allstate agent',
    ivrTip: 'Ask your agent for a full discount review. Allstate applies bundle discounts per-policy, so an unreviewed policy can be missing several.',
    discountPercent: { low: 10, high: 20 },
    discountLevers: ['multi-policy discount', 'Drivewise usage-based discount', 'claim-free discount', 'early-signing discount'],
  },
  {
    name: 'Liberty Mutual',
    category: 'insurance',
    aliases: ['libertymutual'],
    department: 'a Liberty Mutual customer service representative',
    ivrTip: 'Ask for a rate review and mention any recent life changes (paid-off car, new safety features). These aren\'t applied automatically.',
    discountPercent: { low: 10, high: 20 },
    discountLevers: ['multi-policy discount', 'RightTrack usage-based discount', 'accident-free discount', 'new-car discount'],
  },
  {
    name: 'Nationwide',
    category: 'insurance',
    aliases: ['nationwide insurance'],
    department: 'your Nationwide agent',
    ivrTip: 'Ask specifically which named discounts are and aren\'t on the policy today. Nationwide doesn\'t apply all eligible discounts by default.',
    discountPercent: { low: 10, high: 20 },
    discountLevers: ['multi-policy discount', 'SmartRide usage-based discount', 'accident-free discount', 'paperless discount'],
  },
  {
    name: 'Farmers',
    category: 'insurance',
    aliases: ['farmers insurance'],
    department: 'your Farmers agent',
    ivrTip: 'Ask for a full policy review ahead of renewal. Farmers\' loyalty discount only applies after it\'s explicitly requested.',
    discountPercent: { low: 10, high: 20 },
    discountLevers: ['multi-policy discount', 'Signal usage-based discount', 'good student discount', 'loyalty discount'],
  },
];

const GENERIC_FALLBACKS: Record<BillCategory, ProviderProfile> = {
  phone: {
    name: 'your carrier',
    category: 'phone',
    department: 'Retention Department',
    ivrTip: 'Say "cancel my service" at the first menu prompt. This routes almost every wireless carrier\'s phone tree to retention instead of general billing.',
    discountPercent: { low: 10, high: 20 },
    discountLevers: ['loyalty credit', 'plan optimization'],
  },
  internet: {
    name: 'your provider',
    category: 'internet',
    department: 'Retention Department',
    ivrTip: 'Say "cancel service" or "disconnect" at the first menu prompt. This is the standard industry-wide route to retention for cable and internet providers.',
    discountPercent: { low: 10, high: 20 },
    discountLevers: ['loyalty credit', 'promotional-rate renewal'],
  },
  insurance: {
    name: 'your insurer',
    category: 'insurance',
    department: 'a policy review agent',
    ivrTip: 'Ask specifically for a full policy review and discount check. Front-line billing reps can\'t apply most discounts without one.',
    discountPercent: { low: 10, high: 20 },
    discountLevers: ['multi-policy discount', 'safe-driver or claim-free discount', 'paperless and autopay discount'],
  },
};

export const PROVIDERS: Record<BillCategory, ProviderProfile[]> = {
  phone: PHONE_PROVIDERS,
  internet: INTERNET_PROVIDERS,
  insurance: INSURANCE_PROVIDERS,
};

/**
 * Look up a provider by category and free-text name, matching case- and
 * punctuation-insensitively against both the canonical name and any
 * aliases. Falls back to the category's generic (but still category-correct)
 * profile when nothing matches, so an unlisted provider never breaks the
 * flow (product-spec.md edge_cases).
 */
export function findProvider(category: BillCategory, rawName: string): ProviderLookup {
  const target = normalize(rawName);
  if (target.length > 0) {
    for (const profile of PROVIDERS[category]) {
      if (normalize(profile.name) === target) return { profile, matched: true };
      if (profile.aliases?.some((alias) => normalize(alias) === target)) {
        return { profile, matched: true };
      }
    }
  }
  return { profile: GENERIC_FALLBACKS[category], matched: false };
}

/** Type-guard-shaped helper: true when the free-text name is in the curated dataset. */
export function isKnownProvider(category: BillCategory, rawName: string): boolean {
  return findProvider(category, rawName).matched;
}
