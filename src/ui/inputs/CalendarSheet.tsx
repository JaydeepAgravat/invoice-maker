import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState, type Ref } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { addDays, addMonths, type ISODate } from '@/domain/dates';
import { haptics } from '@/ui/haptics';
import {
  Chip,
  IconButton,
  Sheet,
  Text,
  Touchable,
  type SheetRef,
} from '@/ui/primitives';

/** Locales whose week starts on Sunday (US, CA, MX, BR, JP…); everyone else Monday. */
const SUNDAY_FIRST = new Set([
  'US',
  'CA',
  'MX',
  'BR',
  'JP',
  'IL',
  'PH',
  'SA',
  'KR',
  'TW',
  'HK',
  'IN',
  'ZA',
]);

const firstDayOfWeek = (locale: string) =>
  SUNDAY_FIRST.has(locale.split('-')[1]?.toUpperCase() ?? '') ? 0 : 1;

const utc = (d: ISODate) => new Date(`${d}T00:00:00Z`);

export type QuickPick = { label: string; date: ISODate };

/**
 * Month calendar in a sheet. Quick picks (e.g. "In 14 days") sit on top
 * because most dates are relative to today.
 */
export function CalendarSheet({
  ref,
  title,
  value,
  today,
  locale,
  quickPicks = [],
  onChange,
  min,
}: {
  ref?: Ref<SheetRef>;
  title: string;
  value: ISODate;
  today: ISODate;
  locale: string;
  quickPicks?: QuickPick[];
  onChange: (date: ISODate) => void;
  min?: ISODate;
}) {
  const [month, setMonth] = useState(value.slice(0, 7) + '-01');
  const weekStart = firstDayOfWeek(locale);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(utc(month)),
    [locale, month],
  );
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, {
      weekday: 'narrow',
      timeZone: 'UTC',
    });
    // 2023-01-01 was a Sunday.
    return Array.from({ length: 7 }, (_, i) =>
      f.format(utc(addDays('2023-01-01', (i + weekStart) % 7))),
    );
  }, [locale, weekStart]);

  const cells = useMemo(() => {
    const first = utc(month).getUTCDay();
    const lead = (first - weekStart + 7) % 7;
    const start = addDays(month, -lead);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month, weekStart]);

  const dayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }),
    [locale],
  );

  const pick = (d: ISODate) => {
    haptics.play('selection');
    onChange(d);
    if (ref && typeof ref === 'object' && ref.current) {
      ref.current.dismiss();
    }
  };

  return (
    <Sheet ref={ref} title={title}>
      {quickPicks.length ? (
        <View style={styles.quick}>
          {quickPicks.map(q => (
            <Chip
              key={q.label}
              label={q.label}
              selected={q.date === value}
              onPress={() => pick(q.date)}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.monthBar}>
        <IconButton
          icon={ChevronLeft}
          label="Previous month"
          onPress={() => setMonth(addMonths(month, -1))}
        />
        <Text
          variant="headline"
          style={styles.monthLabel}
          accessibilityLiveRegion="polite"
        >
          {monthLabel}
        </Text>
        <IconButton
          icon={ChevronRight}
          label="Next month"
          onPress={() => setMonth(addMonths(month, 1))}
        />
      </View>

      <View style={styles.grid}>
        {weekdays.map((w, i) => (
          <Text
            key={i}
            variant="caption"
            tone="tertiary"
            align="center"
            style={styles.cell}
          >
            {w}
          </Text>
        ))}
        {cells.map(d => {
          const inMonth = d.slice(0, 7) === month.slice(0, 7);
          const selected = d === value;
          const isToday = d === today;
          const disabled = !!min && d < min;
          return (
            <Touchable
              key={d}
              disabled={disabled}
              onPress={() => pick(d)}
              feedback="scale"
              scaleTo={0.9}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={dayLabel.format(utc(d))}
              style={[
                styles.cell,
                styles.day,
                selected && styles.selected,
                isToday && !selected && styles.today,
              ]}
            >
              <Text
                variant={selected || isToday ? 'calloutMedium' : 'callout'}
                tone={selected ? 'onAccent' : inMonth ? 'primary' : 'disabled'}
                tabular
                maxFontSizeMultiplier={1.3}
              >
                {Number(d.slice(8))}
              </Text>
            </Touchable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create(theme => ({
  quick: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingBottom: theme.space[3],
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[2],
  },
  monthLabel: {
    flex: 1,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.space[3],
    paddingTop: theme.space[1],
  },
  cell: {
    width: `${100 / 7}%`,
    height: 44,
    lineHeight: 44,
  },
  day: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
  },
  selected: {
    backgroundColor: theme.colors.accent.solid,
  },
  today: {
    borderWidth: theme.stroke.thin,
    borderColor: theme.colors.accent.border,
  },
}));
