/**
 * CategoryRow — a full-bleed, selectable row for the Add a Bill category
 * picker (Phone / Internet or cable / Auto or home insurance). No enclosing
 * box, no fill, no card: selection reads entirely from a Spine tick at the
 * left edge plus a weight shift on the label (Regular -> SemiBold).
 *
 * Rows are meant to be stacked with a `Hairline` between them (not drawn by
 * this component) so the group reads as one bordered list without a
 * surrounding rectangle.
 */

import { useState } from 'react';
import { AccessibilityState, Pressable, StyleSheet, Text, View } from 'react-native';
import { DERIVED, FOCUS_RING, LAYOUT, SPACING, TOUCH_TARGET_MIN } from '../theme/tokens';
import { FONT_FAMILY, typography } from '../theme/typography';
import { SpineTick } from './Spine';

export interface CategoryRowProps {
  /** e.g. "Phone" */
  label: string;
  /** e.g. "Cell or landline service" */
  description: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

// The design system's list-row hit-target floor (SPACING.space48) sits above TOUCH_TARGET_MIN; take whichever is larger.
const MIN_ROW_HEIGHT = Math.max(SPACING.space48, TOUCH_TARGET_MIN);

export default function CategoryRow({
  label,
  description,
  selected,
  onPress,
  disabled = false,
  testID,
}: CategoryRowProps) {
  const [focused, setFocused] = useState(false);

  const accessibilityState: AccessibilityState = { selected, disabled };

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="radio"
      accessibilityState={accessibilityState}
      accessibilityLabel={`${label}, ${description}`}
      style={({ pressed }) => [styles.row, pressed && !disabled && { opacity: 0.85 }]}
    >
      <View style={styles.tickColumn}>
        <SpineTick visible={selected} />
      </View>
      <View style={styles.textColumn}>
        <Text
          style={[
            typography.body,
            { fontFamily: selected ? FONT_FAMILY.publicSansSemiBold : FONT_FAMILY.publicSansRegular },
            disabled && styles.disabledLabel,
          ]}
        >
          {label}
        </Text>
        <Text style={[typography.meta, disabled && styles.disabledLabel]}>{description}</Text>
      </View>
      {focused && <View pointerEvents="none" style={styles.focusWash} />}
      {focused && <View pointerEvents="none" style={styles.focusRing} />}
    </Pressable>
  );
}

const TICK_COLUMN_WIDTH = SPACING.space16;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: MIN_ROW_HEIGHT,
    paddingVertical: SPACING.space12,
    position: 'relative',
  },
  disabledLabel: {
    color: DERIVED.inkDisabled,
  },
  tickColumn: {
    width: TICK_COLUMN_WIDTH,
    alignItems: 'flex-start',
    paddingTop: SPACING.space4,
  },
  textColumn: {
    flex: 1,
    gap: SPACING.space4,
    paddingRight: LAYOUT.screenMargin,
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
  },
});
