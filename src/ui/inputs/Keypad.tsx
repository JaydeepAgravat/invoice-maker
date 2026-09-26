import { Delete } from 'lucide-react-native';
import { memo } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, Text, Touchable } from '@/ui/primitives';

export type KeypadKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'dec'
  | 'back'
  | '+'
  | '−'
  | '×'
  | '÷';

/** Stable ids for tests; operator symbols are not regex-safe. */
const KEY_IDS: Partial<Record<KeypadKey, string>> = {
  '+': 'plus',
  '−': 'minus',
  '×': 'times',
  '÷': 'divide',
};

const ROWS: KeypadKey[][] = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '−'],
  ['dec', '0', 'back', '+'],
];

/**
 * Numeric keypad with calculator operators. Replaces the system keyboard for
 * money and quantity fields: bigger targets, a locale-correct decimal key,
 * and "2.5 × 45" without leaving the field.
 */
export const Keypad = memo(function KeypadView({
  onKey,
  decimalSeparator,
  allowDecimal = true,
}: {
  onKey: (key: KeypadKey) => void;
  decimalSeparator: string;
  allowDecimal?: boolean;
}) {
  return (
    <View style={styles.grid}>
      {ROWS.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map(key => {
            const isOp = ['+', '−', '×', '÷'].includes(key);
            const disabled = key === 'dec' && !allowDecimal;
            const label =
              key === 'dec'
                ? decimalSeparator
                : key === 'back'
                ? 'Delete'
                : key;
            return (
              <Touchable
                key={key}
                testID={`key-${KEY_IDS[key] ?? key}`}
                disabled={disabled}
                onPress={() => onKey(key)}
                onLongPress={key === 'back' ? () => onKey('back') : undefined}
                feedback="both"
                scaleTo={0.94}
                haptic="selection"
                accessibilityRole="keyboardkey"
                accessibilityLabel={label}
                style={[styles.key, isOp && styles.opKey]}
              >
                {key === 'back' ? (
                  <Icon icon={Delete} size={22} tone="secondary" />
                ) : (
                  <Text
                    variant="title2"
                    tone={isOp ? 'accent' : 'primary'}
                    maxFontSizeMultiplier={1.2}
                  >
                    {key === 'dec' ? decimalSeparator : key}
                  </Text>
                )}
              </Touchable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

/** Apply a key to an expression string. Pure, so it's trivially testable. */
export function applyKey(
  expr: string,
  key: KeypadKey,
  decimalSeparator: string,
): string {
  if (key === 'back') {
    return expr.slice(0, -1);
  }
  const lastNumber = expr.split(/[+−×÷]/).pop() ?? '';
  if (key === 'dec') {
    if (lastNumber.includes(decimalSeparator)) {
      return expr;
    }
    return (
      expr + (lastNumber === '' ? `0${decimalSeparator}` : decimalSeparator)
    );
  }
  if (['+', '−', '×', '÷'].includes(key)) {
    if (expr === '') {
      return key === '−' ? '−' : expr;
    }
    // Replace a trailing operator instead of stacking two.
    return /[+−×÷]$/.test(expr) ? expr.slice(0, -1) + key : expr + key;
  }
  // Digit: avoid leading zeros like "007".
  if (lastNumber === '0') {
    return expr.slice(0, -1) + key;
  }
  return expr + key;
}

const styles = StyleSheet.create(theme => ({
  grid: {
    gap: theme.space[1.5],
    paddingHorizontal: theme.space[3],
    paddingTop: theme.space[2],
  },
  row: {
    flexDirection: 'row',
    gap: theme.space[1.5],
  },
  key: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.surface,
    borderWidth: theme.stroke.hairline,
    borderColor: theme.colors.border.subtle,
  },
  opKey: {
    backgroundColor: theme.colors.accent.subtle,
    borderColor: theme.colors.accent.border,
  },
}));
