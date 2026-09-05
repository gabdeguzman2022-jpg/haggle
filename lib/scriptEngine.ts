/**
 * The script generation engine — the heart of Haggle.
 *
 * `generateScript` is a pure, synchronous function: {@link BillInput} in,
 * {@link ScriptResult} out, no I/O, no network, no randomness. The same
 * input always produces the same script, which is what makes it safe to
 * demo on camera and to unit-test exhaustively (see product-spec.md,
 * "script_architecture_decision").
 *
 * How it composes a script, in order:
 *  1. Look up the provider's real-world negotiation profile (lib/providers.ts),
 *     or fall back to a category-correct generic profile.
 *  2. Select a tactic family by branching on the inputs (see {@link selectTactic}) —
 *     different situations produce structurally different scripts, not one
 *     skeleton with swapped nouns.
 *  3. Compute the target ask from the provider's realistic discount range —
 *     never a hardcoded number.
 *  4. Fill the five fixed beats (opening, leverage, ask, objections, close)
 *     from small phrasing pools, each selected by a stable hash of
 *     provider + category, so output isn't visibly templated but is still
 *     100% reproducible.
 *
 * `Math.random()` is never used anywhere in this file — see {@link stableHash}.
 */

import type {
  BillInput,
  BillCategory,
  CallTrigger,
  CompetitorOffer,
  ObjectionPair,
  SavingsRange,
  ScriptResult,
  TacticFamily,
} from './types';
import {
  CATEGORY_VOCAB,
  findProvider,
  type CategoryVocabulary,
  type DiscountRange,
  type ProviderProfile,
} from './providers';

/** Any reported tenure at or above this many months counts as "long tenure" for tactic selection. */
export const LOYALTY_TENURE_THRESHOLD_MONTHS = 12;

// ---------------------------------------------------------------------------
// Deterministic hashing — the reproducibility engine's actual engine.
// ---------------------------------------------------------------------------

/**
 * A small, fast, deterministic string hash (32-bit FNV-1a). Given the same
 * string it always returns the same non-negative integer, on any platform,
 * forever — which is the property this whole product's testability and
 * demo-safety rests on. Never use Math.random() in this file; it would make
 * two calls with identical input produce different scripts.
 */
export function stableHash(text: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0; // force unsigned so callers never see a negative number
}

/** Deterministically choose `take` distinct indices out of `total`, in ascending order. */
function pickIndices(total: number, take: number, seed: string): number[] {
  const bounded = Math.max(0, Math.min(take, total));
  const scored = Array.from({ length: total }, (_, i) => ({ i, score: stableHash(`${seed}#${i}`) }));
  scored.sort((a, b) => a.score - b.score);
  return scored
    .slice(0, bounded)
    .map((s) => s.i)
    .sort((a, b) => a - b);
}

/** Deterministically pick one option from a pool, keyed by seed + slot name. */
function pick<T>(options: readonly T[], seed: string, slot: string): T {
  const [index] = pickIndices(options.length, 1, `${seed}:${slot}`);
  return options[index];
}

/** Deterministically pick `take` distinct options from a pool, preserving pool order. */
function pickMany<T>(options: readonly T[], take: number, seed: string, slot: string): T[] {
  return pickIndices(options.length, take, `${seed}:${slot}`).map((i) => options[i]);
}

// ---------------------------------------------------------------------------
// Small formatting helpers.
// ---------------------------------------------------------------------------

function formatMoney(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? `$${rounded}` : `$${rounded.toFixed(2)}`;
}

function formatTenure(months: number): string {
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  const yearText = `${years} year${years === 1 ? '' : 's'}`;
  if (remainder === 0) return yearText;
  return `${yearText} and ${remainder} month${remainder === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------
// Tactic selection.
// ---------------------------------------------------------------------------

/**
 * Picks the negotiation tactic family from the inputs. Order matters and is
 * deliberate:
 *  1. Insurance is always `insurance_shopping` — auto/home negotiation runs
 *     on shopping quotes, deductibles, and named discounts, a structurally
 *     different mechanism from telecom's retention-department call, so the
 *     category itself decides the family before anything else does.
 *  2. A competitor quote is the strongest leverage there is, so it wins
 *     over everything else for phone/internet.
 *  3. A rate increase or an expired promo is a concrete, current-moment
 *     grievance — stronger and more specific than plain tenure — so it
 *     takes the next tier.
 *  4. Long, uneventful tenure with no other leverage still counts for something.
 *  5. Otherwise there's no leverage at all: generic.
 */
export function selectTactic(input: BillInput): TacticFamily {
  if (input.category === 'insurance') return 'insurance_shopping';
  if (input.competitorOffer) return 'competitor_anchor';
  if (input.trigger === 'rate_increase' || input.trigger === 'promo_expired') return 'cancellation_signal';
  if (input.tenureMonths !== undefined && input.tenureMonths >= LOYALTY_TENURE_THRESHOLD_MONTHS) {
    return 'loyalty_tenure';
  }
  return 'generic';
}

// ---------------------------------------------------------------------------
// Computed numbers — never hardcoded.
// ---------------------------------------------------------------------------

/**
 * Computes the specific dollar figure the script asks for. Picks a discount
 * percentage inside the provider's realistic range (deterministically, via
 * `seed`), applies it to the current bill, and rounds to a whole dollar —
 * clamped so the target is always strictly less than the current amount.
 */
export function computeTargetMonthlyAmount(current: number, range: DiscountRange, seed: string): number {
  const safeCurrent = Math.max(0, current);
  if (safeCurrent === 0) return 0;
  const fraction = (stableHash(`${seed}:targetPercent`) % 1000) / 1000; // [0, 1)
  const percentOff = range.low + fraction * (range.high - range.low);
  const raw = safeCurrent * (1 - percentOff / 100);
  const rounded = Math.round(raw);
  return rounded < safeCurrent ? Math.max(0, rounded) : Math.max(0, Math.floor(safeCurrent) - 1);
}

/**
 * The projected annual savings, as a range — never a single guaranteed
 * number, per the product's honesty rule. This is the full realistic band
 * (current amount x the provider's whole discount range x 12 months), not
 * narrowed to whatever specific target this script happens to ask for.
 */
export function computeProjectedAnnualSavings(current: number, range: DiscountRange): SavingsRange {
  const safeCurrent = Math.max(0, current);
  const low = Math.round(safeCurrent * (range.low / 100) * 12);
  const high = Math.round(safeCurrent * (range.high / 100) * 12);
  return { low: Math.min(low, high), high: Math.max(low, high) };
}

const SOURCE_NOTES: Record<BillCategory, string> = {
  phone: 'Estimated from typical wireless retention-department outcomes reported by Consumer Reports and carrier-specific negotiation guides.',
  internet: 'Estimated from typical cable and internet retention-department outcomes reported by Consumer Reports and provider-specific negotiation guides.',
  insurance: 'Estimated from typical quote-comparison, deductible, and bundling savings reported by Consumer Reports, ValuePenguin, and insurer-published discount programs.',
};

// ---------------------------------------------------------------------------
// Shared context passed to every tactic builder.
// ---------------------------------------------------------------------------

interface Ctx {
  input: BillInput;
  vocab: CategoryVocabulary;
  provider: ProviderProfile;
  /** Stable hash seed: provider + category, exactly as product-spec.md specifies. */
  seed: string;
  target: number;
}

interface Beats {
  opening: string;
  leverage: string;
  ask: string;
  objections: ObjectionPair[];
  close: string;
}

// ---------------------------------------------------------------------------
// TELECOM (phone / internet) shared phrasing pools.
// ---------------------------------------------------------------------------

const TELECOM_ASK_POOL = (ctx: Ctx): string[] => {
  const { vocab, target } = ctx;
  return [
    `Can we get this down to ${formatMoney(target)} a month?`,
    `What can you do to bring my ${vocab.charge} down to around ${formatMoney(target)} a month?`,
    `Is there a way to get me to ${formatMoney(target)} a month from here?`,
    `I'd like to get this to ${formatMoney(target)} a month. What's possible?`,
  ];
};

const TELECOM_CLOSE_POOL = [
  'Before we hang up, can you email me a confirmation of the new rate and when it starts?',
  'Can you send written confirmation of this new rate and the effective date, so I have it on file?',
  'Can I get that in writing, the new monthly amount and the date it takes effect?',
  'One more thing: can you confirm this in writing, with the new rate and start date?',
];

// ---------------------------------------------------------------------------
// TACTIC: competitor_anchor (phone / internet, competing quote in hand).
// ---------------------------------------------------------------------------

function buildCompetitorAnchor(ctx: Ctx): Beats {
  const { input, vocab, provider, seed, target } = ctx;
  // selectTactic only returns this tactic when competitorOffer is present.
  const competitor: CompetitorOffer = input.competitorOffer!;
  const current = input.currentMonthlyAmount;

  const openings = [
    `Hi, I've been a ${provider.name} customer, but I got a quote from ${competitor.provider} for ${formatMoney(competitor.monthlyAmount)} a month for comparable service.`,
    `Hi, I'm calling about my ${provider.name} ${vocab.product}. I'm currently at ${formatMoney(current)} a month, but ${competitor.provider} just quoted me ${formatMoney(competitor.monthlyAmount)}.`,
    `Hi, before I switch to ${competitor.provider}, who quoted me ${formatMoney(competitor.monthlyAmount)} a month, I wanted to give you the chance to match it.`,
    `Hi, I have a written quote from ${competitor.provider} for ${formatMoney(competitor.monthlyAmount)} a month, and I wanted to see what you can do before I take it.`,
  ];

  const leverages = [
    `I'd genuinely rather stay with ${provider.name}. Can you match or beat ${formatMoney(competitor.monthlyAmount)} a month?`,
    `I don't want to switch, but ${formatMoney(competitor.monthlyAmount)} a month is hard to ignore. What can you do?`,
    `You keep customers by matching real offers, and I have one in hand from ${competitor.provider}.`,
    `I'll stay if you can get close to ${formatMoney(competitor.monthlyAmount)} a month; otherwise I'm switching this week.`,
  ];

  const asks = [
    `Can you get me to ${formatMoney(target)} a month, close to what ${competitor.provider} quoted?`,
    `Match me at ${formatMoney(target)} a month and I'll stay with ${provider.name} today.`,
    `Can we settle at ${formatMoney(target)} a month? That's fair given the ${competitor.provider} quote.`,
    `I'd like ${formatMoney(target)} a month. Beat the competing offer and I won't need to switch.`,
  ];

  const objectionPool: ObjectionPair[] = [
    {
      ifTheySay: '"That\'s the best rate we can offer."',
      youSay: `"I have a written quote for ${formatMoney(competitor.monthlyAmount)} a month from ${competitor.provider} for comparable service. Can you match or beat it?"`,
    },
    {
      ifTheySay: '"We can\'t match a competitor\'s promotional pricing."',
      youSay: `"I understand. What's the closest you can get to ${formatMoney(competitor.monthlyAmount)}, even without matching it exactly?"`,
    },
    {
      ifTheySay: '"You\'d need to switch to get that price."',
      youSay: '"I\'d rather not switch. Can you check with a supervisor before I do?"',
    },
    {
      ifTheySay: '"That offer is new-customer only."',
      youSay: `"I understand, but I'm asking ${provider.name} to compete for existing customers too, not just new ones."`,
    },
  ];

  const objectionCount = 2 + (stableHash(`${seed}:objcount`) % 2); // 2 or 3
  return {
    opening: pick(openings, seed, 'opening'),
    leverage: pick(leverages, seed, 'leverage'),
    ask: pick(asks, seed, 'ask'),
    objections: pickMany(objectionPool, objectionCount, seed, 'objections'),
    close: pick(TELECOM_CLOSE_POOL, seed, 'close'),
  };
}

// ---------------------------------------------------------------------------
// TACTIC: loyalty_tenure (phone / internet, long tenure, no competing quote).
// ---------------------------------------------------------------------------

function buildLoyaltyTenure(ctx: Ctx): Beats {
  const { input, vocab, provider, seed, target } = ctx;
  const current = input.currentMonthlyAmount;
  // selectTactic only returns this tactic when tenureMonths is set and long.
  const tenureText = formatTenure(input.tenureMonths!);

  const openings = [
    `Hi, I've been a ${provider.name} customer for ${tenureText}, and I wanted to talk about my ${vocab.charge}.`,
    `Hi, I'm calling about my ${vocab.product}. I've had it for ${tenureText} and I'm paying ${formatMoney(current)} a month.`,
    `Hi, I've stuck with ${provider.name} for ${tenureText} now, and I wanted to see what loyalty can get me on my ${vocab.charge}.`,
    `Hi, after ${tenureText} as a customer, I wanted to check whether there's anything better than ${formatMoney(current)} a month for me.`,
  ];

  const leverages = [
    `I've never missed a payment in ${tenureText}, and I'd like that to count for something on my rate.`,
    `${tenureText} is a long time to stay with one ${vocab.org}. I'd like a loyalty discount that reflects that.`,
    `I'm not shopping around, I like ${provider.name}, but ${tenureText} of being a customer should be worth a better rate.`,
    `A new customer gets a promo rate I don't have. After ${tenureText}, I'd like the same consideration.`,
  ];

  const asks = TELECOM_ASK_POOL(ctx);

  const objectionPool: ObjectionPair[] = [
    {
      ifTheySay: '"We don\'t have a loyalty discount available right now."',
      youSay: `"Can you check what's available in the ${provider.department} specifically? I'd rather not have to ask twice."`,
    },
    {
      ifTheySay: '"Your current plan already includes our best pricing."',
      youSay: `"After ${tenureText}, is there really nothing available that a new customer wouldn't get instead?"`,
    },
    {
      ifTheySay: '"I can offer you a different plan, but not a discount."',
      youSay: `"Would that plan get me close to ${formatMoney(target)} a month? If so, let's do that."`,
    },
    {
      ifTheySay: '"I don\'t see anything I can do on this call."',
      youSay: '"Can you transfer me to someone who handles loyalty accounts specifically?"',
    },
  ];

  const objectionCount = 2 + (stableHash(`${seed}:objcount`) % 2);
  return {
    opening: pick(openings, seed, 'opening'),
    leverage: pick(leverages, seed, 'leverage'),
    ask: pick(asks, seed, 'ask'),
    objections: pickMany(objectionPool, objectionCount, seed, 'objections'),
    close: pick(TELECOM_CLOSE_POOL, seed, 'close'),
  };
}

// ---------------------------------------------------------------------------
// TACTIC: cancellation_signal (phone / internet, rate increase or expired promo).
// ---------------------------------------------------------------------------

function buildCancellationSignal(ctx: Ctx): Beats {
  const { input, vocab, provider, seed, target } = ctx;
  const current = input.currentMonthlyAmount;
  const isRateIncrease = input.trigger === 'rate_increase';

  const openings = isRateIncrease
    ? [
        `Hi, my ${vocab.charge} just jumped to ${formatMoney(current)} a month, and I wanted to understand why before I decide whether to stay.`,
        `Hi, I noticed my ${vocab.charge} went up to ${formatMoney(current)}. That's more than I signed up for.`,
      ]
    : [
        `Hi, my promotional rate just ended and my ${vocab.charge} jumped to ${formatMoney(current)} a month.`,
        `Hi, I think my promo rate expired. I'm now at ${formatMoney(current)} a month, and that's a big jump.`,
      ];

  const leverages = [
    `I wasn't planning to make this call, but at ${formatMoney(current)} a month I'm ready to ${vocab.switchVerb}.`,
    'This increase is the reason people leave. I\'d rather you fix it than lose me over it.',
    `I'm calling before I ${vocab.switchVerb}, not after. I'd like a chance to fix this first.`,
    `I understand costs change, but this jump is enough that I'm actively comparing other ${vocab.org}s.`,
  ];

  const asks = TELECOM_ASK_POOL(ctx);

  const objectionPool: ObjectionPair[] = [
    {
      ifTheySay: '"Rates went up across the board. There\'s nothing I can do."',
      youSay: `"I understand costs change, but I'd like to see what ${provider.name} can offer to keep me at a rate closer to what I was paying."`,
    },
    {
      ifTheySay: '"I can offer a small credit, but not a full reversal."',
      youSay: '"What\'s the largest credit available before I decide whether to keep this service?"',
    },
    {
      ifTheySay: '"The promotional rate can\'t be extended."',
      youSay: '"Is there a different current promotion I\'d qualify for instead?"',
    },
    {
      ifTheySay: '"You\'d need to downgrade to lower the price."',
      youSay: `"Walk me through what changes with a downgrade to ${formatMoney(target)} a month. I want to compare it to just leaving."`,
    },
  ];

  const objectionCount = 2 + (stableHash(`${seed}:objcount`) % 2);
  return {
    opening: pick(openings, seed, 'opening'),
    leverage: pick(leverages, seed, 'leverage'),
    ask: pick(asks, seed, 'ask'),
    objections: pickMany(objectionPool, objectionCount, seed, 'objections'),
    close: pick(TELECOM_CLOSE_POOL, seed, 'close'),
  };
}

// ---------------------------------------------------------------------------
// TACTIC: generic (phone / internet, no leverage at all).
// ---------------------------------------------------------------------------

function buildGeneric(ctx: Ctx): Beats {
  const { input, vocab, provider, seed, target } = ctx;
  const current = input.currentMonthlyAmount;

  const openings = [
    `Hi, I'm calling about my ${provider.name} ${vocab.product}. I'm paying ${formatMoney(current)} a month and wanted to see what's available.`,
    `Hi, I wanted to check on my ${vocab.charge}. It's ${formatMoney(current)} a month right now.`,
    `Hi, quick question about my ${vocab.product}: is ${formatMoney(current)} a month still the best you can do?`,
    `Hi, I'm reviewing my bills and wanted to ask about my ${provider.name} ${vocab.charge} of ${formatMoney(current)} a month.`,
  ];

  const leverages = [
    'I don\'t have another offer in hand, but I\'d like to know if there\'s anything better available to me.',
    `I'm a straightforward customer, no complaints, just checking whether ${formatMoney(current)} a month is really the best rate.`,
    'I\'m not threatening to leave, I just don\'t want to be paying more than I need to.',
    `Before I keep paying ${formatMoney(current)} a month, I wanted to ask what else might be available.`,
  ];

  const asks = TELECOM_ASK_POOL(ctx);

  const objectionPool: ObjectionPair[] = [
    {
      ifTheySay: '"You\'re already on our best available rate."',
      youSay: '"Is there a retention or loyalty offer that wouldn\'t show up on the standard rate list?"',
    },
    {
      ifTheySay: '"I don\'t have anything special to offer today."',
      youSay: '"That\'s alright, can you check if there\'s a different plan that costs less for what I actually use?"',
    },
    {
      ifTheySay: '"We can\'t lower the price, but we could add features."',
      youSay: `"I'd rather keep it simple, is a straightforward price reduction to ${formatMoney(target)} possible instead?"`,
    },
    {
      ifTheySay: '"There\'s a promotion, but it\'s for new customers only."',
      youSay: '"Understood, is there anything comparable available to an existing customer like me?"',
    },
  ];

  const objectionCount = 2 + (stableHash(`${seed}:objcount`) % 2);
  return {
    opening: pick(openings, seed, 'opening'),
    leverage: pick(leverages, seed, 'leverage'),
    ask: pick(asks, seed, 'ask'),
    objections: pickMany(objectionPool, objectionCount, seed, 'objections'),
    close: pick(TELECOM_CLOSE_POOL, seed, 'close'),
  };
}

// ---------------------------------------------------------------------------
// TACTIC: insurance_shopping — a structurally different family.
//
// No retention department, no "say cancel" IVR trick: auto/home premiums
// move through shopping competing quotes, adjusting the deductible,
// bundling policies, and named per-carrier discounts. The opening and
// leverage still branch on the same inputs (a competing quote, long
// claim-free tenure, or a renewal increase) so the script stays responsive
// to what the user entered, but the mechanism throughout — the ask, the
// objections, the close — is insurance-shaped, never telecom-shaped.
// ---------------------------------------------------------------------------

function buildInsuranceShopping(ctx: Ctx): Beats {
  const { input, vocab, provider, seed, target } = ctx;
  const current = input.currentMonthlyAmount;
  const lever = pick(provider.discountLevers, seed, 'lever');

  let openings: string[];
  let leverages: string[];

  if (input.competitorOffer) {
    const competitor = input.competitorOffer;
    openings = [
      `Hi, I got a quote from ${competitor.provider} for ${formatMoney(competitor.monthlyAmount)} a month for similar coverage, and I wanted to talk about my ${provider.name} ${vocab.product} first.`,
      `Hi, I'm comparing my ${provider.name} ${vocab.product} against a ${formatMoney(competitor.monthlyAmount)}-a-month quote from ${competitor.provider}.`,
      `Hi, before I move my ${vocab.product} to ${competitor.provider} at ${formatMoney(competitor.monthlyAmount)} a month, I wanted to see what ${provider.name} can do.`,
    ];
    leverages = [
      `I got a quote from ${competitor.provider} for ${formatMoney(competitor.monthlyAmount)} a month for similar coverage. I'd rather stay with ${provider.name} if you can get close.`,
      `I'm comparing a ${formatMoney(competitor.monthlyAmount)}-a-month quote against my current ${vocab.product}. What can you do to keep my business?`,
      `I have a competing quote in hand at ${formatMoney(competitor.monthlyAmount)} a month. Can we look at discounts before I switch?`,
    ];
  } else if (input.tenureMonths !== undefined && input.tenureMonths >= LOYALTY_TENURE_THRESHOLD_MONTHS) {
    const tenureText = formatTenure(input.tenureMonths);
    openings = [
      `Hi, I've been insured with ${provider.name} for ${tenureText} without a claim, and I wanted to go over my ${vocab.product}.`,
      `Hi, I'm calling about my ${provider.name} ${vocab.product}. I've had it for ${tenureText} at ${formatMoney(current)} a month.`,
      `Hi, after ${tenureText} as a policyholder, I wanted to check whether I'm getting every discount I qualify for.`,
    ];
    leverages = [
      `I've been insured with ${provider.name} for ${tenureText} without a claim. I'd like that reflected in my ${vocab.charge}.`,
      `${tenureText} of on-time payments and no claims should count toward a better rate.`,
      `I'm a long-term, claim-free customer of ${tenureText}. I'd like a full discount review.`,
    ];
  } else if (input.trigger === 'rate_increase' || input.trigger === 'promo_expired') {
    openings = [
      `Hi, my ${vocab.charge} just went up to ${formatMoney(current)} a month at renewal, and I wanted to see why before I keep it.`,
      `Hi, I noticed my ${vocab.product} renewed at ${formatMoney(current)} a month, that's higher than I expected.`,
      `Hi, my ${vocab.charge} increased to ${formatMoney(current)} a month this renewal, and I'd like to go over it.`,
    ];
    leverages = [
      'An increase like this is exactly when people start shopping other insurers, I\'d rather fix it here.',
      'I wasn\'t planning to shop my policy, but this increase means I will if nothing changes.',
      'I\'d like to understand the increase and see whether a discount review brings it back down.',
    ];
  } else {
    openings = [
      `Hi, I wanted to go over my ${provider.name} ${vocab.product}. My ${vocab.charge} is ${formatMoney(current)} a month right now.`,
      `Hi, I'd like a full discount review on my ${provider.name} ${vocab.product}, currently ${formatMoney(current)} a month.`,
      `Hi, before my ${vocab.product} renews, I wanted to check my ${vocab.charge} of ${formatMoney(current)} a month against what else is out there.`,
    ];
    leverages = [
      "I'm shopping my policy this year and want to make sure I'm not missing any discounts.",
      "I haven't had this policy reviewed in a while, I'd like to see what discounts apply.",
      `Before I renew, I want to check that every discount I qualify for is actually on my ${vocab.product}.`,
    ];
  }

  const asks = [
    `Can we get this to ${formatMoney(target)} a month with the ${lever}?`,
    `What would it take to bring this down to ${formatMoney(target)} a month, starting with the ${lever}?`,
    `I'd like to get to ${formatMoney(target)} a month. Can we apply the ${lever} and look at my deductible?`,
    `Is ${formatMoney(target)} a month realistic if we apply the ${lever}?`,
  ];

  const objectionPool: ObjectionPair[] = [
    {
      ifTheySay: '"You\'re already getting our standard discounts."',
      youSay: `"Can you check specifically for the ${lever}? I want to make sure it's actually applied, not just eligible."`,
    },
    {
      ifTheySay: '"Raising your deductible would only save a little."',
      youSay: '"Can you run the numbers for both a $1,000 and a $500 deductible so I can compare?"',
    },
    {
      ifTheySay: '"Bundling doesn\'t apply to your situation."',
      youSay: '"What would need to change for it to apply, a different policy type, or a different underwriter?"',
    },
    {
      ifTheySay: '"We can\'t lower an in-force premium mid-term."',
      youSay: '"Understood, can we lock this in now for the renewal instead of waiting?"',
    },
    {
      ifTheySay: '"That discount is only for new policyholders."',
      youSay: '"Is there an equivalent for a renewing customer, even if it\'s not the same program?"',
    },
  ];

  const closes = [
    'Can you send me an updated declarations page showing the new premium and effective date?',
    'Before we hang up, can you confirm the new premium and effective date in writing?',
    'Can I get written confirmation, the new premium and when it takes effect?',
    'Can you email the updated policy documents with the new premium and start date?',
  ];

  const objectionCount = 2 + (stableHash(`${seed}:objcount`) % 2);
  return {
    opening: pick(openings, seed, 'opening'),
    leverage: pick(leverages, seed, 'leverage'),
    ask: pick(asks, seed, 'ask'),
    objections: pickMany(objectionPool, objectionCount, seed, 'objections'),
    close: pick(closes, seed, 'close'),
  };
}

// ---------------------------------------------------------------------------
// Orchestration.
// ---------------------------------------------------------------------------

/**
 * Generates a complete negotiation script for one bill. Pure and
 * synchronous: no I/O, no network, no `Math.random()`. Calling it twice
 * with an identical `input` always returns a deep-equal result.
 */
export function generateScript(input: BillInput): ScriptResult {
  const vocab = CATEGORY_VOCAB[input.category];
  const { profile: provider } = findProvider(input.category, input.provider);
  const tactic = selectTactic(input);
  // Hash seed is provider + category, exactly as product-spec.md's
  // script_architecture_decision specifies for phrasing-pool selection.
  const seed = `${input.provider.trim().toLowerCase()}|${input.category}`;
  const target = computeTargetMonthlyAmount(input.currentMonthlyAmount, provider.discountPercent, seed);
  const ctx: Ctx = { input, vocab, provider, seed, target };

  let beats: Beats;
  switch (tactic) {
    case 'competitor_anchor':
      beats = buildCompetitorAnchor(ctx);
      break;
    case 'loyalty_tenure':
      beats = buildLoyaltyTenure(ctx);
      break;
    case 'cancellation_signal':
      beats = buildCancellationSignal(ctx);
      break;
    case 'insurance_shopping':
      beats = buildInsuranceShopping(ctx);
      break;
    case 'generic':
      beats = buildGeneric(ctx);
      break;
  }

  return {
    department: provider.department,
    ivrTip: provider.ivrTip,
    tactic,
    opening: beats.opening,
    leverage: beats.leverage,
    ask: beats.ask,
    currentMonthlyAmount: input.currentMonthlyAmount,
    targetMonthlyAmount: target,
    projectedAnnualSavings: computeProjectedAnnualSavings(input.currentMonthlyAmount, provider.discountPercent),
    objections: beats.objections,
    close: beats.close,
    sourceNote: SOURCE_NOTES[input.category],
  };
}
