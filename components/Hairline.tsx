/**
 * Hairline — the 1px Rule divider that marks a real content/section boundary.
 * Never decorative, never drawn as a box around a group.
 *
 * Also covers the Script Result's "mandatory close boundary" divider (the
 * heavier rule above "Before you hang up" in the wireframe) via
 * `weight="heavy"`, rather than introducing a second, near-identical
 * component for one thicker line.
 */

import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { COLORS, HAIRLINE_WIDTH } from '../theme/tokens';

export type HairlineWeight = 'hairline' | 'heavy';

export interface HairlineProps {
  /** @default 'hairline' */
  weight?: HairlineWeight;
  style?: StyleProp<ViewStyle>;
}

/** A heavier rule is 3x the hairline width — still Rule-colored; the escalation is weight, not a new color. */
const HEAVY_MULTIPLIER = 3;

export default function Hairline({ weight = 'hairline', style }: HairlineProps) {
  const height = weight === 'heavy' ? HAIRLINE_WIDTH * HEAVY_MULTIPLIER : HAIRLINE_WIDTH;
  return <View style={[styles.base, { height }, style]} />;
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    backgroundColor: COLORS.rule,
  },
});
