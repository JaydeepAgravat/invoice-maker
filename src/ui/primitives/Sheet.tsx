import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import { BackHandler, View } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Text } from './Text';

/**
 * The handle screens get. Deliberately small: dismissing a sheet that was never
 * presented puts @gorhom's modal into a stuck state where the next present()
 * is ignored, so dismiss() here is a no-op unless the sheet is open.
 */
export type SheetRef = { present: () => void; dismiss: () => void };

export type SheetProps = {
  title?: string;
  /** Right side of the title row (e.g. a Done button). */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  onDismiss?: () => void;
  /** Fixed snap points; omit to size to content. */
  snapPoints?: Array<string | number>;
  /** Scrollable body for tall content (use with snapPoints). */
  scrollable?: boolean;
  /** Sticky footer below the body. */
  footer?: React.ReactNode;
  ref?: Ref<SheetRef>;
};

/**
 * Bottom sheet with the app's surface, handle and scrim. Content-sized by
 * default; keyboard-aware; dismissed by swipe, back gesture or scrim tap.
 */
export function Sheet({
  title,
  headerRight,
  children,
  onDismiss,
  snapPoints,
  scrollable,
  footer,
  ref,
}: SheetProps) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const modal = useRef<BottomSheetModal>(null);
  const isOpen = useRef(false);
  const [open, setOpen] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);

  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        isOpen.current = true;
        modal.current?.present();
      },
      dismiss: () => {
        if (isOpen.current) {
          modal.current?.dismiss();
        }
      },
    }),
    [],
  );

  // Android back (including the predictive back gesture) closes the sheet
  // first instead of leaving the screen.
  useEffect(() => {
    if (!open) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      modal.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [open]);

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

  // Footer of scrollable sheets rides above the keyboard (gorhom footer), so
  // a Save button is never hidden while typing.
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <View
          onLayout={e => setFooterHeight(e.nativeEvent.layout.height)}
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + theme.space[3] },
          ]}
        >
          {footer}
        </View>
      </BottomSheetFooter>
    ),
    [footer, insets.bottom, theme.space],
  );

  const header = title ? (
    <View style={styles.header}>
      <Text
        variant="headline"
        accessibilityRole="header"
        style={styles.title}
        numberOfLines={1}
      >
        {title}
      </Text>
      {headerRight}
    </View>
  ) : null;

  return (
    <BottomSheetModal
      ref={modal}
      onChange={index => setOpen(index >= 0)}
      onDismiss={() => {
        isOpen.current = false;
        setOpen(false);
        onDismiss?.();
      }}
      snapPoints={snapPoints}
      enableDynamicSizing={!snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      // Edge-to-edge windows never resize for the keyboard, so the sheet
      // must offset itself (and its footer) instead.
      android_keyboardInputMode="adjustPan"
      overrideReduceMotion={ReduceMotion.System}
      accessibilityLabel={title}
      footerComponent={scrollable && footer ? renderFooter : undefined}
      topInset={insets.top + theme.space[2]}
    >
      {scrollable ? (
        <>
          <View style={styles.content}>{header}</View>
          <BottomSheetScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scroll,
              footer ? { paddingBottom: footerHeight + theme.space[4] } : null,
            ]}
          >
            {children}
          </BottomSheetScrollView>
        </>
      ) : (
        <BottomSheetView
          style={[
            styles.content,
            { paddingBottom: insets.bottom + theme.space[4] },
          ]}
        >
          {header}
          {children}
          {footer ? <View style={styles.footerInline}>{footer}</View> : null}
        </BottomSheetView>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    minHeight: 40,
    paddingHorizontal: theme.size.gutter,
    paddingBottom: theme.space[3],
  },
  title: {
    flex: 1,
  },
  scroll: {
    paddingBottom: theme.space[4],
  },
  footer: {
    flexDirection: 'row',
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  footerInline: {
    flexDirection: 'row',
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[4],
  },
}));
