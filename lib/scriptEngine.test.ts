/// <reference types="node" />
// The triple-slash reference above pulls in @types/node's ambient module
// declarations for 'node:test' and 'node:assert/strict' under the app's
// bundler-mode tsconfig (which has no explicit `types` array) without
// touching tsconfig.json, which is owned by the architect.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateScript,
  selectTactic,
  computeTargetMonthlyAmount,
  computeProjectedAnnualSavings,
  anchorTargetToCompetitor,
  stableHash,
  LOYALTY_TENURE_THRESHOLD_MONTHS,
} from './scriptEngine';
import { PROVIDERS, findProvider, isKnownProvider, CATEGORY_VOCAB } from './providers';
import type { BillInput, BillCategory, TacticFamily } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function allBeatText(result: ReturnType<typeof generateScript>): string {
  return [
    result.department,
    result.ivrTip ?? '',
    result.opening,
    result.leverage,
    result.ask,
    ...result.objections.flatMap((o) => [o.ifTheySay, o.youSay]),
    result.close,
  ]
    .join(' \n ')
    .toLowerCase();
}

const CONFIRMATION_CLOSE = /confirm|writing|written|declarations|email/i;

/** Whole-word containment check, so "planning" doesn't false-positive on "plan". */
function containsWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`, 'i').test(text);
}

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('determinism', () => {
  test('the same input produces a deep-equal script every time', () => {
    const input: BillInput = {
      category: 'internet',
      provider: 'Xfinity',
      currentMonthlyAmount: 89,
      trigger: 'just_checking',
      tenureMonths: 36,
    };
    const first = generateScript(input);
    const second = generateScript({ ...input });
    assert.deepStrictEqual(first, second);
  });

  test('stableHash is deterministic and non-negative', () => {
    assert.strictEqual(stableHash('xfinity|internet'), stableHash('xfinity|internet'));
    assert.ok(stableHash('xfinity|internet') >= 0);
    assert.ok(Number.isInteger(stableHash('xfinity|internet')));
  });

  test('different providers within the same category tend to produce different phrasing', () => {
    const base: Omit<BillInput, 'provider'> = {
      category: 'phone',
      currentMonthlyAmount: 90,
      trigger: 'just_checking',
    };
    const a = generateScript({ ...base, provider: 'AT&T' });
    const b = generateScript({ ...base, provider: 'Verizon' });
    // Not a strict requirement of the hash, but with 7 real providers and
    // several independently-seeded slots, at least one beat should differ.
    const somethingDiffers =
      a.opening !== b.opening || a.leverage !== b.leverage || a.ask !== b.ask || a.close !== b.close;
    assert.ok(somethingDiffers);
  });
});

// ---------------------------------------------------------------------------
// Tactic selection — every category x tactic-branch combination.
// ---------------------------------------------------------------------------

describe('selectTactic', () => {
  test('insurance is always insurance_shopping, regardless of other leverage', () => {
    const variants: BillInput[] = [
      { category: 'insurance', provider: 'GEICO', currentMonthlyAmount: 150, trigger: 'just_checking' },
      {
        category: 'insurance',
        provider: 'GEICO',
        currentMonthlyAmount: 150,
        trigger: 'rate_increase',
        tenureMonths: 60,
        competitorOffer: { provider: 'Progressive', monthlyAmount: 120 },
      },
    ];
    for (const input of variants) {
      assert.strictEqual(selectTactic(input), 'insurance_shopping');
    }
  });

  test('a competitor quote wins for phone/internet even with a triggering event and long tenure', () => {
    const input: BillInput = {
      category: 'phone',
      provider: 'AT&T',
      currentMonthlyAmount: 100,
      trigger: 'rate_increase',
      tenureMonths: 48,
      competitorOffer: { provider: 'T-Mobile', monthlyAmount: 80 },
    };
    assert.strictEqual(selectTactic(input), 'competitor_anchor');
  });

  test('rate_increase and promo_expired both select cancellation_signal when there is no competitor quote', () => {
    for (const trigger of ['rate_increase', 'promo_expired'] as const) {
      const input: BillInput = {
        category: 'internet',
        provider: 'Spectrum',
        currentMonthlyAmount: 90,
        trigger,
        tenureMonths: 24, // even with long tenure, the concrete trigger wins
      };
      assert.strictEqual(selectTactic(input), 'cancellation_signal');
    }
  });

  test('long uneventful tenure with no quote and no trigger selects loyalty_tenure', () => {
    const input: BillInput = {
      category: 'phone',
      provider: 'Verizon',
      currentMonthlyAmount: 90,
      trigger: 'just_checking',
      tenureMonths: LOYALTY_TENURE_THRESHOLD_MONTHS,
    };
    assert.strictEqual(selectTactic(input), 'loyalty_tenure');
  });

  test('tenure just under the threshold does not qualify for loyalty_tenure', () => {
    const input: BillInput = {
      category: 'phone',
      provider: 'Verizon',
      currentMonthlyAmount: 90,
      trigger: 'just_checking',
      tenureMonths: LOYALTY_TENURE_THRESHOLD_MONTHS - 1,
    };
    assert.strictEqual(selectTactic(input), 'generic');
  });

  test('no leverage at all selects generic', () => {
    const input: BillInput = {
      category: 'internet',
      provider: 'Cox',
      currentMonthlyAmount: 75,
      trigger: 'just_checking',
    };
    assert.strictEqual(selectTactic(input), 'generic');
  });
});

// ---------------------------------------------------------------------------
// Full category x tactic-branch coverage through generateScript.
// ---------------------------------------------------------------------------

const TELECOM_CATEGORIES: Extract<BillCategory, 'phone' | 'internet'>[] = ['phone', 'internet'];

describe('generateScript covers every category x tactic-branch combination', () => {
  for (const category of TELECOM_CATEGORIES) {
    const provider = PROVIDERS[category][0].name;

    test(`${category}: competitor_anchor`, () => {
      const result = generateScript({
        category,
        provider,
        currentMonthlyAmount: 100,
        trigger: 'just_checking',
        competitorOffer: { provider: 'Rival Co', monthlyAmount: 80 },
      });
      assert.strictEqual(result.tactic, 'competitor_anchor');
      assert.match(allBeatText(result), /rival co/);
    });

    test(`${category}: loyalty_tenure`, () => {
      const result = generateScript({
        category,
        provider,
        currentMonthlyAmount: 100,
        trigger: 'just_checking',
        tenureMonths: 36,
      });
      assert.strictEqual(result.tactic, 'loyalty_tenure');
    });

    test(`${category}: cancellation_signal (rate_increase)`, () => {
      const result = generateScript({
        category,
        provider,
        currentMonthlyAmount: 100,
        trigger: 'rate_increase',
      });
      assert.strictEqual(result.tactic, 'cancellation_signal');
    });

    test(`${category}: cancellation_signal (promo_expired)`, () => {
      const result = generateScript({
        category,
        provider,
        currentMonthlyAmount: 100,
        trigger: 'promo_expired',
      });
      assert.strictEqual(result.tactic, 'cancellation_signal');
    });

    test(`${category}: generic`, () => {
      const result = generateScript({
        category,
        provider,
        currentMonthlyAmount: 100,
        trigger: 'just_checking',
      });
      assert.strictEqual(result.tactic, 'generic');
    });
  }

  test('insurance: insurance_shopping with a competing quote', () => {
    const result = generateScript({
      category: 'insurance',
      provider: 'GEICO',
      currentMonthlyAmount: 150,
      trigger: 'just_checking',
      competitorOffer: { provider: 'Progressive', monthlyAmount: 130 },
    });
    assert.strictEqual(result.tactic, 'insurance_shopping');
    assert.match(allBeatText(result), /progressive/);
  });

  test('insurance: insurance_shopping with long claim-free tenure', () => {
    const result = generateScript({
      category: 'insurance',
      provider: 'State Farm',
      currentMonthlyAmount: 150,
      trigger: 'just_checking',
      tenureMonths: 60,
    });
    assert.strictEqual(result.tactic, 'insurance_shopping');
  });

  test('insurance: insurance_shopping on a renewal increase', () => {
    const result = generateScript({
      category: 'insurance',
      provider: 'Allstate',
      currentMonthlyAmount: 150,
      trigger: 'rate_increase',
    });
    assert.strictEqual(result.tactic, 'insurance_shopping');
  });

  test('insurance: insurance_shopping with no leverage at all', () => {
    const result = generateScript({
      category: 'insurance',
      provider: 'Farmers',
      currentMonthlyAmount: 150,
      trigger: 'just_checking',
    });
    assert.strictEqual(result.tactic, 'insurance_shopping');
  });
});

// ---------------------------------------------------------------------------
// Computed-ask math.
// ---------------------------------------------------------------------------

describe('computed ask math', () => {
  test('computeTargetMonthlyAmount matches the documented formula and is always below current', () => {
    const range = { low: 10, high: 30 };
    const seed = 'test-seed';
    const current = 120;
    const fraction = (stableHash(`${seed}:targetPercent`) % 1000) / 1000;
    const percentOff = range.low + fraction * (range.high - range.low);
    const expectedRaw = Math.round(current * (1 - percentOff / 100));
    const expected = expectedRaw < current ? expectedRaw : current - 1;
    assert.strictEqual(computeTargetMonthlyAmount(current, range, seed), expected);
  });

  test('target is always strictly less than a positive current amount, across many seeds', () => {
    const range = { low: 10, high: 30 };
    for (let i = 0; i < 50; i++) {
      const seed = `seed-${i}`;
      const target = computeTargetMonthlyAmount(100, range, seed);
      assert.ok(target < 100, `target ${target} should be < 100 for seed ${seed}`);
      assert.ok(target >= 0);
    }
  });

  test('current amount of 0 produces a target of 0, never negative or NaN', () => {
    assert.strictEqual(computeTargetMonthlyAmount(0, { low: 10, high: 30 }, 'seed'), 0);
  });

  test('computeProjectedAnnualSavings is a low <= high range derived from the full discount range', () => {
    const range = { low: 10, high: 30 };
    const current = 100;
    const result = computeProjectedAnnualSavings(current, range);
    assert.strictEqual(result.low, Math.round(current * (range.low / 100) * 12));
    assert.strictEqual(result.high, Math.round(current * (range.high / 100) * 12));
    assert.ok(result.low <= result.high);
  });

  test('generateScript wires the computed target and savings onto the result', () => {
    const input: BillInput = {
      category: 'phone',
      provider: 'AT&T',
      currentMonthlyAmount: 100,
      trigger: 'just_checking',
    };
    const result = generateScript(input);
    const provider = findProvider('phone', 'AT&T').profile;
    assert.strictEqual(
      result.targetMonthlyAmount,
      computeTargetMonthlyAmount(100, provider.discountPercent, 'at&t|phone')
    );
    assert.deepStrictEqual(result.projectedAnnualSavings, computeProjectedAnnualSavings(100, provider.discountPercent));
    assert.strictEqual(result.currentMonthlyAmount, 100);
    assert.ok(result.targetMonthlyAmount < result.currentMonthlyAmount);
  });
});

// ---------------------------------------------------------------------------
// Vocabulary isolation: insurance and telecom scripts never cross-contaminate.
// ---------------------------------------------------------------------------

describe('category-correct vocabulary never leaks', () => {
  const INSURANCE_ONLY_WORDS = ['policy', 'premium', 'deductible', 'insurer'];
  const TELECOM_ONLY_WORDS = ['carrier', 'provider', 'plan'];

  test('insurance scripts never contain telecom vocabulary', () => {
    for (const provider of PROVIDERS.insurance) {
      const result = generateScript({
        category: 'insurance',
        provider: provider.name,
        currentMonthlyAmount: 140,
        trigger: 'just_checking',
        tenureMonths: 24,
      });
      const text = allBeatText(result);
      for (const word of TELECOM_ONLY_WORDS) {
        assert.ok(!containsWord(text, word), `insurance script for ${provider.name} leaked telecom word "${word}"`);
      }
    }
  });

  test('phone and internet scripts never contain insurance vocabulary', () => {
    for (const category of TELECOM_CATEGORIES) {
      for (const provider of PROVIDERS[category]) {
        const result = generateScript({
          category,
          provider: provider.name,
          currentMonthlyAmount: 90,
          trigger: 'just_checking',
          tenureMonths: 24,
        });
        const text = allBeatText(result);
        for (const word of INSURANCE_ONLY_WORDS) {
          assert.ok(!containsWord(text, word), `${category} script for ${provider.name} leaked insurance word "${word}"`);
        }
      }
    }
  });

  test('category vocabulary tables themselves stay category-correct', () => {
    assert.strictEqual(CATEGORY_VOCAB.phone.product, 'plan');
    assert.strictEqual(CATEGORY_VOCAB.internet.product, 'plan');
    assert.strictEqual(CATEGORY_VOCAB.insurance.product, 'policy');
    assert.strictEqual(CATEGORY_VOCAB.insurance.charge, 'premium');
    assert.notStrictEqual(CATEGORY_VOCAB.phone.agent, CATEGORY_VOCAB.insurance.agent);
  });
});

// ---------------------------------------------------------------------------
// Structural guarantees on every script.
// ---------------------------------------------------------------------------

describe('every script satisfies the fixed five-beat structure', () => {
  const ALL_CATEGORIES: BillCategory[] = ['phone', 'internet', 'insurance'];

  for (const category of ALL_CATEGORIES) {
    for (const provider of PROVIDERS[category]) {
      test(`${category} / ${provider.name}: has 2-3 objection pairs and a written-confirmation close`, () => {
        const result = generateScript({
          category,
          provider: provider.name,
          currentMonthlyAmount: 110,
          trigger: 'just_checking',
        });
        assert.ok(result.objections.length >= 2 && result.objections.length <= 3);
        for (const pair of result.objections) {
          assert.ok(pair.ifTheySay.length > 0);
          assert.ok(pair.youSay.length > 0);
        }
        assert.match(result.close, CONFIRMATION_CLOSE);
        assert.ok(result.department.length > 0);
        assert.ok(result.opening.length > 0);
        assert.ok(result.leverage.length > 0);
        assert.ok(result.ask.length > 0);
        assert.ok(result.sourceNote.length > 0);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Provider dataset shape and the unknown-provider fallback path.
// ---------------------------------------------------------------------------

describe('provider dataset', () => {
  const ALL_CATEGORIES: BillCategory[] = ['phone', 'internet', 'insurance'];

  test('every category has between 6 and 8 curated providers', () => {
    for (const category of ALL_CATEGORIES) {
      const count = PROVIDERS[category].length;
      assert.ok(count >= 6 && count <= 8, `${category} has ${count} providers`);
    }
  });

  test('every provider carries a department, an IVR tip, a valid discount range, and discount levers', () => {
    for (const category of ALL_CATEGORIES) {
      for (const provider of PROVIDERS[category]) {
        assert.ok(provider.department.length > 0);
        assert.ok(provider.ivrTip.length > 0);
        assert.ok(provider.discountPercent.low > 0);
        assert.ok(provider.discountPercent.high > provider.discountPercent.low);
        assert.ok(provider.discountLevers.length > 0);
      }
    }
  });

  test('findProvider matches case- and punctuation-insensitively, including aliases', () => {
    const direct = findProvider('internet', 'xfinity');
    assert.strictEqual(direct.matched, true);
    assert.strictEqual(direct.profile.name, 'Xfinity');

    const viaAlias = findProvider('internet', 'COMCAST');
    assert.strictEqual(viaAlias.matched, true);
    assert.strictEqual(viaAlias.profile.name, 'Xfinity');

    const viaPunctuation = findProvider('phone', 'at & t');
    assert.strictEqual(viaPunctuation.matched, true);
    assert.strictEqual(viaPunctuation.profile.name, 'AT&T');
  });

  test('an unlisted provider falls back to a category-correct generic profile without breaking generation', () => {
    for (const category of ALL_CATEGORIES) {
      const lookup = findProvider(category, 'Totally Unknown Provider Co');
      assert.strictEqual(lookup.matched, false);
      assert.strictEqual(isKnownProvider(category, 'Totally Unknown Provider Co'), false);

      const result = generateScript({
        category,
        provider: 'Totally Unknown Provider Co',
        currentMonthlyAmount: 95,
        trigger: 'just_checking',
      });
      assert.strictEqual(result.department, lookup.profile.department);
      assert.ok(result.opening.length > 0);
      assert.ok(result.targetMonthlyAmount < result.currentMonthlyAmount);
    }
  });
});

// ---------------------------------------------------------------------------
// Competitor anchoring: the ask must never contradict the quote it cites.
// ---------------------------------------------------------------------------

describe('competitor anchoring', () => {
  test('a quote below the computed target becomes the ask, rather than leaving money on the table', () => {
    assert.strictEqual(anchorTargetToCompetitor(89, 74, { provider: 'Fios', monthlyAmount: 55 }), 55);
  });

  test('a quote above the computed target leaves the computed target alone, since we already beat it', () => {
    assert.strictEqual(anchorTargetToCompetitor(89, 62, { provider: 'Fios', monthlyAmount: 80 }), 62);
  });

  test('an implausible quote is floored so the ask stays credible', () => {
    // 40% of 89 is 35.6 -> 36. A $5 quote must not produce a $5 ask.
    assert.strictEqual(anchorTargetToCompetitor(89, 74, { provider: 'Fios', monthlyAmount: 5 }), 36);
  });

  test('no quote, or a nonsense quote, leaves the computed target untouched', () => {
    assert.strictEqual(anchorTargetToCompetitor(89, 74, undefined), 74);
    assert.strictEqual(anchorTargetToCompetitor(89, 74, { provider: 'Fios', monthlyAmount: 0 }), 74);
    assert.strictEqual(anchorTargetToCompetitor(89, 74, { provider: 'Fios', monthlyAmount: -10 }), 74);
  });

  test('the generated ask never claims to match a number it is not asking for', () => {
    const result = generateScript({
      category: 'internet',
      provider: 'Xfinity',
      currentMonthlyAmount: 89,
      trigger: 'promo_expired',
      tenureMonths: 38,
      competitorOffer: { provider: 'Verizon Fios', monthlyAmount: 55 },
    });

    assert.strictEqual(result.tactic, 'competitor_anchor');
    assert.strictEqual(result.targetMonthlyAmount, 55);
    // Whichever phrasing the hash picks, the asked-for number must appear and
    // must not be undercut by a promise to beat a lower figure.
    assert.match(result.ask, /\$55\b/);
    assert.doesNotMatch(result.ask, /beat/i);
  });

  test('an insurance script with a competing quote keeps its own tactic and computed target', () => {
    const result = generateScript({
      category: 'insurance',
      provider: 'Progressive',
      currentMonthlyAmount: 142,
      trigger: 'rate_increase',
      tenureMonths: 60,
      competitorOffer: { provider: 'GEICO', monthlyAmount: 90 },
    });

    assert.strictEqual(result.tactic, 'insurance_shopping');
    assert.notStrictEqual(result.targetMonthlyAmount, 90);
    assert.ok(result.targetMonthlyAmount < result.currentMonthlyAmount);
  });
});
