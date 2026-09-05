/**
 * Button — the app's one button component, in a primary (solid Corner fill)
 * and secondary (Corner outline) variant, covering disabled and the
 * grafted non-spinner loading state.
 *
 * LOADING, per docs/design-system.md's grafted mechanism: the label stays in
 * place, the fill dims to a flat neutral, and a 1px Corner line animates
 * left-to-right along the bottom edge on a ~900ms loop. There is no spinner
 * anywhere in this app. Reserved for the app's three RevenueCat calls
 * (getOfferings, purchasePackage, restorePurchases) — script generation is
 * synchronous and never shows this state.
 *
 * The secondary variant is not pictured in any of the design system's
 * wireframes (every screen_spec CTA is the primary fill button); it is
 * built here to the same visual language — binary radius, color+weight
 * focus, no shadow — as the sanctioned inferred "quiet" action style, for
 * screens that need one. Flagged for the architect to confirm.
 */

import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityState,
  Animated,
  Easing,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {
  BUTTON_LABEL_ON_CORNER,
  COLORS,
  DERIVED,
  FOCUS_RING,
  HAIRLINE_WIDTH,
  MOTION,
  RADII,
  SPACING,
  TOUCH_TARGET_MIN,
  useReducedMotion,
} from '../theme/tokens';
import { typography } from '../theme/typography';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  /** @default 'primary' */
  variant?: ButtonVariant;
  /** Required inputs invalid, or the action isn't currently available. */
  disabled?: boolean;
  /** A RevenueCat call is in flight. Takes precedence over `disabled`'s visual treatment. */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** @default label */
  accessibilityLabel?: string;
}

const CHARGING_LINE_WIDTH_PERCENT = 30;

export default function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const [focused, setFocused] = useState(false);
  const reducedMotion = useReducedMotion();
  const chargingLine = useRef(new Animated.Value(0)).current;

  const isInteractive = !disabled && !loading;

  useEffect(() => {
    if (!loading || reducedMotion) return;
    const loop = Animated.loop(
      Animated.timing(chargingLine, {
        toValue: 1,
        duration: MOTION.chargingLineLoopMs,
        easing: Easing.linear,
        useNativeDriver: false, // animating `left` as a percentage string
      })
    );
    loop.start();
    return () => loop.stop();
  }, [loading, reducedMotion, chargingLine]);

  const chargingLineLeft = chargingLine.interpolate({
    inputRange: [0, 1],
    outputRange: [`-${CHARGING_LINE_WIDTH_PERCENT}%`, '100%'],
  });

  const showWorkingLabel = loading && reducedMotion;
  const displayLabel = showWorkingLabel ? 'Working…' : label;

  const accessibilityState: AccessibilityState = { disabled: !isInteractive, busy: loading };

  return (
    <Pressable
      testID={testID}
      onPress={isInteractive ? onPress : undefined}
      disabled={!isInteractive}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={accessibilityState}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        loading && (variant === 'primary' ? styles.primaryLoading : styles.secondaryLoading),
        !loading && disabled && (variant === 'primary' ? styles.primaryDisabled : styles.secondaryDisabled),
        pressed && isInteractive && { opacity: 0.85 },
        style,
      ]}
    >
      <Text
        style={[
          typography.buttonLabel,
          variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel,
          loading && styles.loadingLabel,
          !loading && disabled && styles.disabledLabel,
        ]}
      >
        {displayLabel}
      </Text>

      {loading && !reducedMotion && (
        <View pointerEvents="none" style={styles.chargingTrack}>
          <Animated.View
            style={[styles.chargingLine, { left: chargingLineLeft, width: `${CHARGING_LINE_WIDTH_PERCENT}%` }]}
          />
        </View>
      )}

      {focused && isInteractive && <View pointerEvents="none" style={styles.focusWash} />}
      {focused && isInteractive && <View pointerEvents="none" style={styles.focusRing} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET_MIN,
    borderRadius: RADII.control,
    paddingHorizontal: SPACING.space24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  primary: {
    backgroundColor: COLORS.corner,
  },
  primaryLabel: {
    color: BUTTON_LABEL_ON_CORNER,
  },
  primaryDisabled: {
    backgroundColor: DERIVED.cornerDisabledFill,
  },
  primaryLoading: {
    backgroundColor: COLORS.rule,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: HAIRLINE_WIDTH,
    borderColor: COLORS.corner,
  },
  secondaryLabel: {
    color: COLORS.corner,
  },
  secondaryDisabled: {
    borderColor: COLORS.rule,
  },
  secondaryLoading: {
    borderColor: COLORS.rule,
  },
  disabledLabel: {
    color: DERIVED.inkDisabled,
  },
  loadingLabel: {
    color: DERIVED.inkDisabled,
  },
  chargingTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: HAIRLINE_WIDTH,
    overflow: 'hidden',
  },
  chargingLine: {
    position: 'absolute',
    height: HAIRLINE_WIDTH,
    backgroundColor: COLORS.corner,
  },
  focusWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: DERIVED.cornerFocusWash,
  },
  focusRing: {
    position: 'absolute',
    top: -FOCUS_RING.offset,
    left: -FOCUS_RING.offset,
    right: -FOCUS_RING.offset,
    bottom: -FOCUS_RING.offset,
    borderWidth: FOCUS_RING.width,
    borderColor: FOCUS_RING.color,
    borderRadius: RADII.control + FOCUS_RING.offset,
  },
});
