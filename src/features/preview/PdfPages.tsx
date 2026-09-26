import { useState } from 'react';
import { Image, ScrollView, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { PageImage } from '@/specs/NativePdf';
import { Skeleton, Text } from '@/ui/primitives';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

/**
 * Document pages as paper on a desk. Pinch or double-tap to zoom; zoom is
 * committed to layout at the end of the gesture so both scroll directions
 * work naturally while zoomed in.
 */
export function PdfPages({
  pages,
  paper,
  pageLabel,
  bottomInset = 0,
}: {
  pages: PageImage[] | null;
  paper: 'A4' | 'LETTER';
  pageLabel: (page: number, total: number) => string;
  bottomInset?: number;
}) {
  const { theme } = useUnistyles();
  const window = useWindowDimensions();
  // Measure the container: this may be a side pane, not the whole window.
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? window.width;
  const [zoom, setZoom] = useState(1);
  const pinch = useSharedValue(1);

  const baseWidth = Math.min(width - theme.size.gutter * 2, 720);
  const pageWidth = baseWidth * zoom;
  const ratio = paper === 'LETTER' ? 11 / 8.5 : 297 / 210;

  const commit = (next: number) =>
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)));

  const pinchGesture = Gesture.Pinch()
    .onUpdate(e => {
      pinch.value = Math.min(
        MAX_ZOOM / zoom,
        Math.max(MIN_ZOOM / zoom, e.scale),
      );
    })
    .onEnd(() => {
      const next = zoom * pinch.value;
      pinch.value = 1;
      scheduleOnRN(commit, next);
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scheduleOnRN(commit, zoom > 1 ? 1 : 2.2);
    });
  const gesture = Gesture.Simultaneous(pinchGesture, doubleTap);

  const live = useAnimatedStyle(() => ({
    transform: [{ scale: pinch.value }],
  }));

  const content = pages?.length ? (
    pages.map((p, i) => (
      <View key={p.uri} style={styles.pageWrap}>
        <Image
          source={{ uri: p.uri }}
          style={[
            styles.page,
            { width: pageWidth, height: (pageWidth * p.height) / p.width },
          ]}
          fadeDuration={0}
          accessibilityLabel={pageLabel(i + 1, pages.length)}
        />
        {pages.length > 1 ? (
          <Text variant="caption" tone="tertiary" style={styles.pageNo}>
            {pageLabel(i + 1, pages.length)}
          </Text>
        ) : null}
      </View>
    ))
  ) : (
    <View style={[styles.page, { width: pageWidth, height: pageWidth * ratio }]}>
      <View style={styles.skeleton}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="25%" height={10} />
        <View style={styles.gap} />
        <Skeleton width="100%" height={8} />
        <Skeleton width="100%" height={8} />
        <Skeleton width="100%" height={8} />
        <Skeleton width="60%" height={8} />
      </View>
    </View>
  );

  return (
    <GestureDetector gesture={gesture}>
      <ScrollView
        style={styles.flex}
        onLayout={e => setMeasured(e.nativeEvent.layout.width)}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomInset + theme.space[6] },
        ]}
      >
        <ScrollView
          horizontal
          scrollEnabled={zoom > 1}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.row,
            { minWidth: width, paddingHorizontal: (width - baseWidth) / 2 },
          ]}
        >
          <Animated.View style={[styles.column, live]}>{content}</Animated.View>
        </ScrollView>
      </ScrollView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create(theme => ({
  flex: {
    flex: 1,
  },
  scroll: {
    paddingTop: theme.space[4],
  },
  row: {
    justifyContent: 'center',
  },
  column: {
    gap: theme.space[4],
  },
  pageWrap: {
    alignItems: 'center',
    gap: theme.space[2],
  },
  page: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
    ...theme.elevation.raised,
  },
  pageNo: {
    alignSelf: 'center',
  },
  skeleton: {
    padding: theme.space[6],
    gap: theme.space[2],
  },
  gap: {
    height: theme.space[6],
  },
}));
