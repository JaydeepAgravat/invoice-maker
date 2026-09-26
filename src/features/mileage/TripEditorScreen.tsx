import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { ArrowLeftRight, CalendarDays, Gauge, Trash2, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { clock, getDatabase } from '@/data/database';
import { mutate, useLiveQuery } from '@/data/live';
import {
  createTrip,
  deleteTrip,
  getTrip,
  recentPlaces,
  restoreTrip,
  updateTrip,
} from '@/data/repositories/mileage';
import { updateProfile } from '@/data/repositories/profile';
import { toEditableText } from '@/domain/expression';
import { mileageAmount } from '@/domain/mileage';
import {
  currencyDigits,
  decimalSeparator,
  parseMoney,
  parseQuantity,
} from '@/domain/money';
import { useFormat } from '@/lib/format';
import { CalendarSheet } from '@/ui/inputs/CalendarSheet';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Button,
  Chip,
  Divider,
  IconButton,
  ListRow,
  SegmentedControl,
  Sheet,
  Surface,
  Switch,
  Text,
  TextField,
  type SheetRef,
} from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

import { formatDistance } from './MileageScreen';
import { useMileageRate } from './useMileageRate';

export function TripEditorScreen({
  navigation,
  route,
}: RootScreenProps<'TripEditor'>) {
  const id = route.params?.id;
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const f = useFormat();
  const insets = useSafeAreaInsets();
  const today = clock.today();
  const defaults = useMileageRate();
  const sep = decimalSeparator(f.locale);

  const [date, setDate] = useState(today);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [focus, setFocus] = useState<'from' | 'to' | null>(null);
  const [distanceText, setDistanceText] = useState('');
  const [roundTrip, setRoundTrip] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [unit, setUnit] = useState(defaults.unit);
  const [rate, setRate] = useState(defaults.rate);
  const [currency, setCurrency] = useState(defaults.currency);
  const [error, setError] = useState<string | null>(null);
  const dateSheet = useRef<SheetRef>(null);
  const rateSheet = useRef<SheetRef>(null);
  const [rateText, setRateText] = useState('');
  const { data: places } = useLiveQuery(db => recentPlaces(db), []);

  useEffect(() => {
    if (!id) {
      return;
    }
    getDatabase().then(async db => {
      const tr = await getTrip(db, id);
      if (tr) {
        setDate(tr.date);
        setFrom(tr.from ?? '');
        setTo(tr.to ?? '');
        setDistanceText(toEditableText(tr.distance, 3, sep));
        setPurpose(tr.purpose ?? '');
        setUnit(tr.unit);
        setRate(tr.rate);
        setCurrency(tr.currency);
      }
    });
  }, [id, sep]);

  const oneWay = parseQuantity(distanceText, f.locale);
  const distance = oneWay && oneWay > 0 ? oneWay * (roundTrip ? 2 : 1) : null;

  const save = async () => {
    if (!distance) {
      setError(t('mileage.distanceRequired'));
      return;
    }
    const input = {
      date,
      from,
      to,
      distance,
      unit,
      rate,
      currency,
      purpose,
      clientId: null,
    };
    await mutate(tx =>
      id ? updateTrip(tx, clock, id, input) : createTrip(tx, clock, input),
    );
    toast.show({ message: t('mileage.saved'), tone: 'success' });
    navigation.goBack();
  };

  const suggestions = (places ?? []).filter(
    p => p.toLowerCase() !== (focus === 'from' ? from : to).trim().toLowerCase(),
  );
  const rateLabel = `${f.money(rate, currency)} / ${unit}`;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <ScreenHeader
        title={id ? t('mileage.edit') : t('mileage.new')}
        left={
          <IconButton
            icon={X}
            label={t('common.close')}
            onPress={() => navigation.goBack()}
          />
        }
        right={
          <Button
            testID="trip-save"
            variant="primary"
            size="sm"
            label={t('common.save')}
            onPress={save}
          />
        }
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
      >
        <View style={styles.fields}>
          <TextField
            testID="trip-from"
            label={t('mileage.from')}
            value={from}
            onChangeText={setFrom}
            onFocus={() => setFocus('from')}
            autoCapitalize="words"
          />
          <TextField
            testID="trip-to"
            label={t('mileage.to')}
            value={to}
            onChangeText={setTo}
            onFocus={() => setFocus('to')}
            autoCapitalize="words"
          />
          {focus && suggestions.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.chips}
            >
              {suggestions.map(p => (
                <Chip
                  key={p}
                  label={p}
                  onPress={() => (focus === 'from' ? setFrom(p) : setTo(p))}
                />
              ))}
            </ScrollView>
          ) : null}
          <TextField
            testID="trip-distance"
            label={t('mileage.distance', { unit })}
            value={distanceText}
            onChangeText={v => {
              setDistanceText(v.replace(/[^\d.,]/g, ''));
              setError(null);
            }}
            keyboardType="decimal-pad"
            error={error ?? undefined}
          />
        </View>

        <Surface style={styles.card}>
          <ListRow
            leadingIcon={ArrowLeftRight}
            title={t('mileage.roundTrip')}
            subtitle={
              roundTrip && oneWay
                ? t('mileage.roundTripHint', {
                    distance: formatDistance(oneWay * 2, unit, f.locale),
                  })
                : undefined
            }
            onPress={() => setRoundTrip(!roundTrip)}
            trailing={
              <Switch
                value={roundTrip}
                onValueChange={setRoundTrip}
                accessibilityLabel={t('mileage.roundTrip')}
              />
            }
          />
          <Divider inset={52} />
          <ListRow
            leadingIcon={CalendarDays}
            title={t('expenses.date')}
            value={f.date(date)}
            onPress={() => dateSheet.current?.present()}
          />
          <Divider inset={52} />
          <ListRow
            leadingIcon={Gauge}
            title={t('mileage.rate')}
            value={rateLabel}
            meta={defaults.source ?? undefined}
            onPress={() => {
              setRateText(toEditableText(rate, currencyDigits(currency), sep));
              rateSheet.current?.present();
            }}
          />
        </Surface>

        <View style={styles.fields}>
          <TextField
            label={t('mileage.purpose')}
            value={purpose}
            onChangeText={setPurpose}
            placeholder={t('mileage.purposePlaceholder')}
          />
        </View>

        <View style={styles.total}>
          <Text variant="caption" tone="secondary">
            {t('mileage.worth')}
          </Text>
          <Text variant="title1" tabular>
            {f.money(distance ? mileageAmount(distance, rate) : 0, currency)}
          </Text>
        </View>

        {id ? (
          <View style={styles.danger}>
            <Divider />
            <ListRow
              leadingIcon={Trash2}
              title={t('mileage.delete')}
              destructive
              onPress={async () => {
                await mutate(tx => deleteTrip(tx, clock, id));
                toast.show({
                  message: t('mileage.deleted'),
                  action: {
                    label: t('common.undo'),
                    onPress: () => mutate(tx => restoreTrip(tx, id)),
                  },
                });
                navigation.goBack();
              }}
            />
          </View>
        ) : null}
      </ScrollView>

      <CalendarSheet
        ref={dateSheet}
        title={t('expenses.date')}
        value={date}
        today={today}
        locale={f.locale}
        quickPicks={[{ label: t('dates.today'), date: today }]}
        onChange={d => {
          setDate(d);
          dateSheet.current?.dismiss();
        }}
      />
      <Sheet
        ref={rateSheet}
        title={t('mileage.rate')}
        headerRight={
          <Button
            variant="primary"
            size="sm"
            label={t('common.done')}
            onPress={async () => {
              const next = parseMoney(rateText || '0', currency, f.locale);
              if (next === null || next < 0) {
                return;
              }
              setRate(next);
              rateSheet.current?.dismiss();
              await mutate(tx =>
                updateProfile(tx, clock, { mileageRate: next, mileageUnit: unit }),
              );
            }}
          />
        }
      >
        <View style={styles.sheet}>
          <SegmentedControl
            segments={[
              { value: 'km', label: t('units.km') },
              { value: 'mi', label: t('units.mi') },
            ]}
            value={unit}
            onChange={setUnit}
            accessibilityLabel={t('mileage.unit')}
          />
          <BottomSheetTextInput
            value={rateText}
            onChangeText={v => setRateText(v.replace(/[^\d.,]/g, ''))}
            keyboardType="decimal-pad"
            style={[styles.input, { color: theme.colors.text.primary }]}
            accessibilityLabel={t('mileage.rate')}
          />
          <Text variant="caption" tone="tertiary">
            {t('mileage.rateHint')}
          </Text>
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.app,
  },
  content: {
    paddingTop: theme.space[2],
    maxWidth: theme.size.contentMax,
    width: '100%',
    alignSelf: 'center',
  },
  fields: {
    gap: theme.space[4],
    paddingHorizontal: theme.size.gutter,
    paddingVertical: theme.space[4],
  },
  chips: {
    gap: theme.space[2],
  },
  card: {
    marginHorizontal: theme.size.gutter,
  },
  total: {
    alignItems: 'center',
    gap: theme.space[1],
    paddingVertical: theme.space[4],
  },
  danger: {
    marginTop: theme.space[6],
  },
  sheet: {
    gap: theme.space[4],
    paddingHorizontal: theme.size.gutter,
  },
  input: {
    ...theme.type.title2,
    lineHeight: undefined,
    height: 56,
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radius.md,
    borderWidth: theme.stroke.thin,
    borderColor: theme.colors.border.default,
    backgroundColor: theme.colors.bg.surface,
  },
}));
