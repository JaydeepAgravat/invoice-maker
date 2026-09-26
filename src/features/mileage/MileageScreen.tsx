import { Car, Menu, Trash2 } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import type { DrawerProps } from '@/app/navigation';
import { useProGate } from '@/billing/useProGate';
import { clock, mutate, useLiveQuery } from '@/data/live';
import {
  deleteTrip,
  listTrips,
  restoreTrip,
  type Trip,
} from '@/data/repositories/mileage';
import { mileageAmount } from '@/domain/mileage';
import { QTY_SCALE } from '@/domain/money';
import { NewButton } from '@/features/inbox/NewButton';
import { useFormat } from '@/lib/format';
import { EmptyMileage } from '@/ui/illustrations';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Divider,
  EmptyState,
  IconButton,
  ListRow,
  Surface,
  SwipeRow,
  Text,
} from '@/ui/primitives';
import { breakpoints } from '@/ui/theme';
import { toast } from '@/ui/toast/store';

import { useMileageRate } from './useMileageRate';

export const formatDistance = (milli: number, unit: string, locale: string) =>
  `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    milli / QTY_SCALE,
  )} ${unit}`;

function Separator() {
  return (
    <View style={styles.sep}>
      <Divider inset={52} />
    </View>
  );
}

/** Business trips and what they are worth as a deduction this year. */
export function MileageScreen({ navigation }: DrawerProps<'Mileage'>) {
  const { t } = useTranslation();
  const f = useFormat();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const rate = useMileageRate();
  const year = clock.today().slice(0, 4);
  const { data: trips } = useLiveQuery(db => listTrips(db), []);
  const root = navigation.getParent();
  const { gate } = useProGate();

  const totals = useMemo(() => {
    const thisYear = (trips ?? []).filter(
      tr => tr.date.startsWith(year) && tr.unit === rate.unit,
    );
    return {
      distance: thisYear.reduce((a, tr) => a + tr.distance, 0),
      amount: thisYear
        .filter(tr => tr.currency === f.currency)
        .reduce((a, tr) => a + mileageAmount(tr.distance, tr.rate), 0),
      count: thisYear.length,
    };
  }, [trips, year, rate.unit, f.currency]);

  const remove = async (trip: Trip) => {
    await mutate(tx => deleteTrip(tx, clock, trip.id));
    toast.show({
      message: t('mileage.deleted'),
      action: {
        label: t('common.undo'),
        onPress: () => mutate(tx => restoreTrip(tx, trip.id)),
      },
    });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t('nav.mileage')}
        left={
          width >= breakpoints.lg ? undefined : (
            <IconButton
              testID="open-menu"
              icon={Menu}
              label={t('common.openMenu')}
              onPress={navigation.openDrawer}
            />
          )
        }
      />
      {trips && trips.length === 0 ? (
        <EmptyState
          illustration={<EmptyMileage />}
          title={t('mileage.emptyTitle')}
          body={t('mileage.emptyBody')}
        />
      ) : (
        <FlatList
          data={trips ?? []}
          keyExtractor={tr => tr.id}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 96 },
          ]}
          ListHeaderComponent={
            <Surface style={styles.summary}>
              <Text variant="caption" tone="secondary">
                {t('mileage.yearTotal', { year })}
              </Text>
              <Text variant="title1" tabular numberOfLines={1} adjustsFontSizeToFit>
                {f.money(totals.amount)}
              </Text>
              <Text variant="callout" tone="secondary" tabular>
                {t('mileage.tripsSummary', {
                  count: totals.count,
                  distance: formatDistance(totals.distance, rate.unit, f.locale),
                })}
              </Text>
            </Surface>
          }
          ItemSeparatorComponent={Separator}
          ListHeaderComponentStyle={styles.headerSpace}
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.row,
                index === 0 && styles.first,
                index === (trips?.length ?? 0) - 1 && styles.last,
              ]}
            >
              <SwipeRow
                right={{
                  label: t('actions.delete'),
                  icon: Trash2,
                  tone: 'danger',
                  onTrigger: () => remove(item),
                }}
              >
                <ListRow
                  leadingIcon={Car}
                  title={
                    item.from || item.to
                      ? [item.from, item.to].filter(Boolean).join(' → ')
                      : item.purpose ?? t('mileage.trip')
                  }
                  subtitle={[
                    f.date(item.date, 'short'),
                    formatDistance(item.distance, item.unit, f.locale),
                    item.from || item.to ? item.purpose : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  value={f.money(mileageAmount(item.distance, item.rate), item.currency)}
                  onPress={() => root?.navigate('TripEditor', { id: item.id })}
                />
              </SwipeRow>
            </View>
          )}
        />
      )}
      <NewButton
        testID="new-trip"
        label={t('mileage.new')}
        onPress={() => gate('mileage') && root?.navigate('TripEditor')}
      />
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.app,
  },
  content: {
    maxWidth: theme.size.contentMax,
    width: '100%',
    alignSelf: 'center',
  },
  summary: {
    marginHorizontal: theme.size.gutter,
    marginTop: theme.space[2],
    marginBottom: theme.space[6],
    padding: theme.space[4],
    gap: theme.space[1],
  },
  headerSpace: {
    marginBottom: 0,
  },
  row: {
    marginHorizontal: theme.size.gutter,
    backgroundColor: theme.colors.bg.surface,
    borderLeftWidth: theme.stroke.thin,
    borderRightWidth: theme.stroke.thin,
    borderColor: theme.colors.border.subtle,
    overflow: 'hidden',
  },
  first: {
    borderTopWidth: theme.stroke.thin,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
  },
  last: {
    borderBottomWidth: theme.stroke.thin,
    borderBottomLeftRadius: theme.radius.lg,
    borderBottomRightRadius: theme.radius.lg,
  },
  sep: {
    marginHorizontal: theme.size.gutter,
    backgroundColor: theme.colors.bg.surface,
    borderLeftWidth: theme.stroke.thin,
    borderRightWidth: theme.stroke.thin,
    borderColor: theme.colors.border.subtle,
  },
}));
