/**
 * TextInputUnderline — Haggle's one text-input shape: a label above, typed
 * text, and a 1px Rule underline (never a bordered box). Focus thickens the
 * underline to 2px Corner and brightens the label from Ink 65% to full Ink —
 * color AND weight/thickness together, never color alone. An `error` turns
 * the underline 2px Friction and renders an inline caption beneath it.
 *
 * `variant="amount"` switches the typed text to the mono amount style (IBM
 * Plex Mono Medium, 20px) and prefixes a static "$" — used for a bill's
 * monthly amount, a competitor quote, and a logged outcome's new rate.
 */

import { useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { COLORS, DERIVED, FOCUS_RING, HAIRLINE_WIDTH, SPACING, TOUCH_TARGET_MIN } from '../theme/tokens';
import { typography } from '../theme/typography';

export type TextInputUnderlineVariant = 'text' | 'amount';

export interface TextInputUnderlineProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** @default 'text' */
  variant?: TextInputUnderlineVariant;
  placeholder?: string;
  /** Inline validation message. Presence alone triggers the Friction underline + caption. */
  error?: string;
  autoFocus?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  /** Overrides the variant's default (`decimal-pad` for amount, `default` otherwise) — e.g. `number-pad` for a tenure field. */
  keyboardType?: TextInputProps['keyboardType'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export default function TextInputUnderline({
  label,
  value,
  onChangeText,
  variant = 'text',
  placeholder,
  error,
  autoFocus,
  autoCapitalize,
  keyboardType,
  returnKeyType,
  onSubmitEditing,
  containerStyle,
  testID,
}: TextInputUnderlineProps) {
  const [focused, setFocused] = useState(false);
  const isAmount = variant === 'amount';
  const hasError = Boolean(error);

  const underlineColor = hasError ? COLORS.friction : focused ? COLORS.corner : COLORS.rule;
  const underlineWidth = hasError || focused ? FOCUS_RING.width : HAIRLINE_WIDTH;
  const labelColor = focused ? COLORS.ink : DERIVED.inkSecondary;

  return (
    <View style={containerStyle}>
      <Text style={[typography.meta, { color: labelColor }]}>{label}</Text>
      <View style={styles.fieldRow}>
        {isAmount && <Text style={[typography.inputAmountText, styles.amountPrefix]}>$</Text>}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={DERIVED.inkSecondary}
          autoFocus={autoFocus}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType ?? (isAmount ? 'decimal-pad' : 'default')}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          underlineColorAndroid="transparent"
          style={[isAmount ? typography.inputAmountText : typography.inputText, styles.input]}
        />
      </View>
      <View style={[styles.underline, { backgroundColor: underlineColor, height: underlineWidth }]} />
      {hasError && <Text style={[typography.meta, styles.errorText]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: TOUCH_TARGET_MIN,
  },
  amountPrefix: {
    marginRight: SPACING.space4,
  },
  input: {
    flex: 1,
    padding: 0,
  },
  underline: {
    width: '100%',
  },
  errorText: {
    color: COLORS.friction,
    marginTop: SPACING.space4,
  },
});
