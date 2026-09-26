import { type Ref } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button } from './Button';
import { Sheet, type SheetRef } from './Sheet';
import { Text } from './Text';

/**
 * Confirmation for consequential actions (void, remove). States the effect
 * plainly; the destructive button names the action, never just "OK".
 */
export function ConfirmSheet({
  ref,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
}: {
  ref?: Ref<SheetRef>;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  const close = () => {
    if (ref && typeof ref === 'object' && ref.current) {
      ref.current.dismiss();
    }
  };
  return (
    <Sheet ref={ref} title={title}>
      <Text variant="callout" tone="secondary" style={styles.body}>
        {body}
      </Text>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button fullWidth size="lg" label={cancelLabel} onPress={close} />
        </View>
        <View style={styles.flex}>
          <Button
            testID="confirm-action"
            fullWidth
            size="lg"
            variant={destructive ? 'danger' : 'primary'}
            haptic={destructive ? 'warning' : 'light'}
            label={confirmLabel}
            onPress={() => {
              close();
              onConfirm();
            }}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create(theme => ({
  body: {
    paddingHorizontal: theme.size.gutter,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[5],
  },
  flex: {
    flex: 1,
  },
}));
