import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Rect } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Text } from '@/ui/primitives';

/**
 * Income vs expenses per month. Bars share one scale; the tallest value
 * gets a faint gridline so magnitudes read at a glance.
 */
export function MonthBars({
  months,
  locale,
  format,
}: {
  months: { month: string; income: number; expenses: number }[];
  locale: string;
  format: (minor: number) => string;
}) {
  const { theme } = useUnistyles();
  const [width, setWidth] = useState(0);
  const height = 132;
  const max = Math.max(1, ...months.flatMap(m => [m.income, m.expenses]));
  const slot = months.length ? width / months.length : 0;
  const bar = Math.max(3, Math.min(14, slot / 3.2));
  const monthName = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
  const labelEvery = Math.ceil(months.length / 6);

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={months
        .map(m => `${m.month}: ${format(m.income)} / ${format(m.expenses)}`)
        .join(', ')}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line
            x1={0}
            x2={width}
            y1={height - 0.5}
            y2={height - 0.5}
            stroke={theme.colors.border.subtle}
            strokeWidth={1}
          />
          <Line
            x1={0}
            x2={width}
            y1={8.5}
            y2={8.5}
            stroke={theme.colors.border.subtle}
            strokeDasharray="3 4"
            strokeWidth={1}
          />
          {months.map((m, i) => {
            const x = i * slot + slot / 2;
            const h = (v: number) => (v / max) * (height - 12);
            return (
              <G key={m.month}>
                <Rect
                  x={x - bar - 1}
                  y={height - h(m.income)}
                  width={bar}
                  height={h(m.income)}
                  rx={Math.min(3, bar / 2)}
                  fill={theme.colors.accent.solid}
                />
                <Rect
                  x={x + 1}
                  y={height - h(m.expenses)}
                  width={bar}
                  height={h(m.expenses)}
                  rx={Math.min(3, bar / 2)}
                  fill={theme.colors.border.strong}
                />
              </G>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <View style={styles.labels}>
        {months.map((m, i) => (
          <Text
            key={m.month}
            variant="caption"
            tone="tertiary"
            style={[styles.label, { width: slot }]}
            numberOfLines={1}
          >
            {i % labelEvery === 0
              ? monthName.format(new Date(`${m.month}-01T00:00:00Z`))
              : ''}
          </Text>
        ))}
      </View>
      <Text variant="caption" tone="tertiary" style={styles.max} tabular>
        {format(max)}
      </Text>
    </View>
  );
}

/** Ranked rows with a proportional bar under each label. */
export function RankBars({
  rows,
}: {
  rows: { key: string; label: string; value: number; display: string }[];
}) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <View style={styles.rank}>
      {rows.map(r => (
        <View key={r.key} style={styles.rankRow}>
          <View style={styles.rankText}>
            <Text variant="callout" numberOfLines={1} style={styles.flex}>
              {r.label}
            </Text>
            <Text variant="calloutMedium" tabular>
              {r.display}
            </Text>
          </View>
          <View style={styles.track}>
            <View
              style={[styles.fill, { width: `${Math.max(2, (r.value / max) * 100)}%` }]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** One bar split into segments, with a legend below. */
export function StackBar({
  segments,
}: {
  segments: { key: string; label: string; value: number; display: string; color: string }[];
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <View style={styles.stack}>
      <View style={styles.stackBar}>
        {total > 0 ? (
          segments
            .filter(s => s.value > 0)
            .map(s => (
              <View
                key={s.key}
                style={{ flex: s.value / total, backgroundColor: s.color }}
              />
            ))
        ) : (
          <View style={styles.flex} />
        )}
      </View>
      <View style={styles.legend}>
        {segments.map(s => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text variant="caption" tone="secondary" style={styles.flex} numberOfLines={1}>
              {s.label}
            </Text>
            <Text variant="captionMedium" tabular>
              {s.display}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  flex: {
    flex: 1,
  },
  labels: {
    flexDirection: 'row',
    marginTop: theme.space[1],
  },
  label: {
    textAlign: 'center',
  },
  max: {
    position: 'absolute',
    top: -6,
    right: 0,
    backgroundColor: theme.colors.bg.surface,
    paddingLeft: theme.space[1],
  },
  rank: {
    gap: theme.space[3],
  },
  rankRow: {
    gap: theme.space[1.5],
  },
  rankText: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.bg.subtle,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accent.solid,
  },
  stack: {
    gap: theme.space[3],
  },
  stackBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    gap: 2,
    backgroundColor: theme.colors.bg.subtle,
  },
  legend: {
    gap: theme.space[2],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
}));
