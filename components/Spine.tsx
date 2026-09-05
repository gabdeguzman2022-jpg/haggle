/**
 * Spine — Haggle's signature vertical device.
 *
 * Two things live in this file:
 *
 * - `Spine`, the tall multi-segment stroke that runs beside the Script
 *   Result's beats (What to say / If they push back / Before you hang up),
 *   turning Friction-red for exactly an "if they say" line and back to
 *   Corner for "say back."
 * - `SpineTick`, the small fixed-height tick used for a selected category
 *   row, a radio row, an empty-state brand mark, or the paywall's feature
 *   list — the same device at a glance, in miniature, with none of the
 *   segment/animation machinery the full Spine needs.
 *
 * Both render as ONE continuous stroke (a single background-filled column),
 * never a stack of separately-bordered lines, per the design system's
 * implementation note. Both are sighted-user aids that duplicate information
 * already present in the surrounding text, so both hide from screen readers.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { COLORS, MOTION, SPACING, SPINE_WIDTH, useReducedMotion } from '../theme/tokens';

export type SpineColor = 'corner' | 'friction';

function resolveSpineColor(color: SpineColor): string {
  return color === 'friction' ? COLORS.friction : COLORS.corner;
}

// ---------------------------------------------------------------------------
// Spine — the full multi-segment stroke
// ---------------------------------------------------------------------------

export interface SpineSegment {
  color: SpineColor;
  /** Relative length versus sibling segments (a flex-basis weight, not a pixel height). @default 1 */
  flex?: number;
}

export interface SpineProps {
  /** Top-to-bottom color segments, e.g. one `corner` segment per beat, `friction` for an "if they say" line. */
  segments: SpineSegment[];
  /**
   * Skip the ~400ms draw-down and render fully drawn immediately. Pass
   * `AccessibilityInfo.isReduceMotionEnabled()`'s result (or the
   * `useReducedMotion` hook re-exported from theme/tokens) — screens decide
   * when the cascade fires, Spine just obeys.
   */
  reducedMotion?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Absolutely positioned within a `position: 'relative'` parent that already
 * has its final height from its own (already-laid-out) content — the Spine
 * draws down as a percentage of that height, so it never needs to measure
 * anything itself.
 */
export default function Spine({ segments, reducedMotion, style }: SpineProps) {
  const systemReducedMotion = useReducedMotion();
  const reduceMotion = reducedMotion ?? systemReducedMotion;
  const growth = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      growth.setValue(1);
      return;
    }
    growth.setValue(0);
    Animated.timing(growth, {
      toValue: 1,
      duration: MOTION.spineDrawMs,
      useNativeDriver: false, // animating `height`, which the native driver can't do
    }).start();
  }, [reduceMotion, growth]);

  const animatedHeight = growth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={[styles.wrapper, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.column, { height: animatedHeight }]}>
        {segments.map((segment, index) => (
          <View
            key={index}
            style={{ flex: segment.flex ?? 1, backgroundColor: resolveSpineColor(segment.color) }}
          />
        ))}
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SpineTick — the small selection/brand-mark tick
// ---------------------------------------------------------------------------

export interface SpineTickProps {
  /**
   * Whether the tick is filled in. When `false` it renders transparent (not
   * unmounted) so the row's layout never shifts on selection — selection
   * must read as an instant fill change, never a fade or a reflow.
   */
  visible: boolean;
  /** @default 'corner' */
  color?: SpineColor;
  style?: StyleProp<ViewStyle>;
}

export function SpineTick({ visible, color = 'corner', style }: SpineTickProps) {
  return (
    <View
      style={[styles.tick, { backgroundColor: visible ? resolveSpineColor(color) : 'transparent' }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // top+bottom (no explicit height) stretches this to the parent's real,
    // already-laid-out height — the Animated child below then has a
    // concrete height to animate a percentage of, rather than a circular
    // "auto" sizing against its own animated child.
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SPINE_WIDTH,
  },
  column: {
    width: SPINE_WIDTH,
  },
  tick: {
    width: SPINE_WIDTH,
    height: SPACING.space16, // 16dp tall, per design-system.md's category-tick spec
  },
});
