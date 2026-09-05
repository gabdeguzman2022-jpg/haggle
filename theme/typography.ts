/**
 * Haggle type scale.
 *
 * Two font families only — Public Sans (Regular 400, SemiBold 600) and IBM
 * Plex Mono (Regular 400, Medium 500) — four static weight files, loaded via
 * `useFonts` at app boot from `@expo-google-fonts/public-sans` and
 * `@expo-google-fonts/ibm-plex-mono`. The strings in {@link FONT_FAMILY} are
 * the exact export names those packages use, and MUST be the exact keys
 * passed to `useFonts` (e.g. `useFonts({ PublicSans_400Regular, ... })`) —
 * whichever file wires that up should import the same four keys.
 *
 * Every text role from docs/design-system.md's TYPOGRAPHY section is a named
 * export below with its exact size / line-height / letter-spacing baked in.
 * Money-colored roles call `getBrassColor` internally (see theme/tokens.ts)
 * so the Brass-Large/Brass-Small split is automatic and can't be gotten
 * wrong by a screen just picking a token.
 */

import { TextStyle } from 'react-native';
import { COLORS, DERIVED, getBrassColor } from './tokens';

export const FONT_FAMILY = {
  publicSansRegular: 'PublicSans_400Regular',
  publicSansSemiBold: 'PublicSans_600SemiBold',
  plexMonoRegular: 'IBMPlexMono_400Regular',
  plexMonoMedium: 'IBMPlexMono_500Medium',
} as const;

/**
 * `maxFontSizeMultiplier` values for the two roles the accessibility floor
 * caps at 1.3x growth (hero number, H1) so the Script Result's ~38-char mono
 * column never wraps mid-word at extreme Dynamic Type scale. Pass the value
 * as a prop on the `<Text>` element itself — RN has no style-level
 * equivalent. Every other role keeps default (uncapped) font scaling.
 *
 * @example
 * <Text style={typography.heroNumber} maxFontSizeMultiplier={MAX_FONT_SCALE.heroNumber}>
 *   $62/mo
 * </Text>
 */
export const MAX_FONT_SCALE = {
  heroNumber: 1.3,
  h1: 1.3,
} as const;

/** ~38-char column cap for script lines inside the Spine (tighter than the general 58-char body ceiling). */
export const SCRIPT_LINE_MAX_CHARS = 38;
/** General product-wide body-copy line-length ceiling. */
export const BODY_LINE_MAX_CHARS = 58;

export const typography = {
  /** Target-ask hero number, tracker total headline. Brass-Large (44px clears the floor). */
  heroNumber: {
    fontFamily: FONT_FAMILY.plexMonoMedium,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -0.5,
    color: getBrassColor(44),
  } satisfies TextStyle,

  /** Struck-through "before" amount beside the hero number. Never Brass — Ink at reduced opacity is sanctioned here because it is a superseded value, not content the user must read under stress. */
  beforeAmount: {
    fontFamily: FONT_FAMILY.plexMonoRegular,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0,
    color: DERIVED.inkSecondary,
    textDecorationLine: 'line-through',
  } satisfies TextStyle,

  /** Screen title. Capped at 1.3x font scale — see {@link MAX_FONT_SCALE}. */
  h1: {
    fontFamily: FONT_FAMILY.publicSansSemiBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: COLORS.ink,
  } satisfies TextStyle,

  /** Section header — one of the five fixed Script Result beats only. */
  h2: {
    fontFamily: FONT_FAMILY.publicSansSemiBold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: 0,
    color: COLORS.ink,
  } satisfies TextStyle,

  /** Default body text. */
  body: {
    fontFamily: FONT_FAMILY.publicSansRegular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.1,
    color: COLORS.ink,
  } satisfies TextStyle,

  /** Verbatim script line inside the Spine. Cap rendered width to {@link SCRIPT_LINE_MAX_CHARS}. */
  scriptLine: {
    fontFamily: FONT_FAMILY.plexMonoRegular,
    fontSize: 17,
    lineHeight: 26,
    letterSpacing: 0,
    color: COLORS.ink,
  } satisfies TextStyle,

  /** Inline dollar figure inside running text/footnotes. Brass-Small (15px is below the Brass-Large floor). */
  inlineAmount: {
    fontFamily: FONT_FAMILY.plexMonoMedium,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0,
    color: getBrassColor(15),
  } satisfies TextStyle,

  /** Paywall price line ("$4.99/mo"). Brass-Small — 20px is below the Brass-Large floor, per the small-size rule. */
  priceAmount: {
    fontFamily: FONT_FAMILY.plexMonoMedium,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0,
    color: getBrassColor(20),
  } satisfies TextStyle,

  /**
   * Helper/footnote/source-citation text, and the secondary line of a
   * two-line provider/category stack. The ONLY sanctioned reduced-opacity
   * role in the system — never use for script body, objections, or money.
   */
  meta: {
    fontFamily: FONT_FAMILY.publicSansRegular,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.15,
    color: DERIVED.inkSecondary,
  } satisfies TextStyle,

  /** Button label. Color is set by the Button component per variant/state, not baked in here — never append an arrow glyph. */
  buttonLabel: {
    fontFamily: FONT_FAMILY.publicSansSemiBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.2,
  } satisfies TextStyle,

  /** Standard text-input value/typed text. */
  inputText: {
    fontFamily: FONT_FAMILY.publicSansRegular,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: 0,
    color: COLORS.ink,
  } satisfies TextStyle,

  /** Amount-field typed text (the "$ 89.00" input, not a rendered result — stays Ink, not Brass). */
  inputAmountText: {
    fontFamily: FONT_FAMILY.plexMonoMedium,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0,
    color: COLORS.ink,
  } satisfies TextStyle,
} as const;

export type TypographyRole = keyof typeof typography;
