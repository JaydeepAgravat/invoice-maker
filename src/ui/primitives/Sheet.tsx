import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useCallback, type Ref } from 'react';
import { View } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Text } from './Text';

export type SheetRef = BottomSheetModal;

export type SheetProps = {
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  /** Fixed snap points; omit to size to content. */
  snapPoints?: Array<string | number>;
  ref?: Ref<SheetRef>;
};

/**
 * Bottom sheet with the app's surface, handle and scrim. Content-sized by
 * default; keyboard-aware; dismissed by swipe, back gesture or scrim tap.
 */
export function Sheet({ title, children, onDismiss, snapPoints, ref }: SheetProps) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={1}
        pressBehavior="close"
        style={[props.style, { backgroundColor: theme.colors.overlay.scrim }]}
      />
    ),
    [theme.colors.overlay.scrim],
  );

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onDismiss}
      snapPoints={snapPoints}
      enableDynamicSizing={!snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      overrideReduceMotion={ReduceMotion.System}
      accessibilityLabel={title}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + theme.space[4] }]}>
        {title ? (
          <View style={styles.header}>
            <Text variant="headline" accessibilityRole="header">
              {title}
            </Text>
          </View>
        ) : null}
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create(theme => ({
  background: {
    backgroundColor: theme.colors.bg.elevated,
    borderTopLeftRadius: theme.radius.xxl,
    borderTopRightRadius: theme.radius.xxl,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: theme.colors.border.strong,
  },
  content: {
    paddingTop: theme.space[1],
  },
  header: {
    paddingHorizontal: theme.size.gutter,
    paddingBottom: theme.space[3],
  },
}));
