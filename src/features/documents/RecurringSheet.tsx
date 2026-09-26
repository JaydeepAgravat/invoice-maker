import { useEffect, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { PermissionsAndroid, Platform, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { clock, mutate } from '@/data/live';
import {
  setSchedule,
  stopSchedule,
  type Schedule,
} from '@/data/repositories/recurring';
import { addMonths, compareDates, type ISODate } from '@/domain/dates';
import { FREQUENCIES, occurrence, type Frequency } from '@/domain/recurrence';
import { useFormat } from '@/lib/format';
import {
  Button,
  Chip,
  SegmentedControl,
  Sheet,
  Text,
  type SheetRef,
} from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

type End = 'NEVER' | 'M6' | 'M12';

/** Ask for notification permission only when a reminder feature is switched on. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
    return true;
  }
  const result = await PermissionsAndroid.request(
    'android.permission.POST_NOTIFICATIONS' as never,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Repeat an invoice: a fresh draft appears on each date, ready to send in
 * one tap, and a reminder says so that morning.
 */
export function RecurringSheet({
  ref,
  documentId,
  issueDate,
  schedule,
}: {
  ref?: Ref<SheetRef>;
  documentId: string;
  issueDate: ISODate;
  schedule: Schedule | null;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const today = clock.today();
  const [frequency, setFrequency] = useState<Frequency>(schedule?.frequency ?? 'MONTHLY');
  const [end, setEnd] = useState<End>('NEVER');

  useEffect(() => {
    if (schedule) {
      setFrequency(schedule.frequency);
    }
  }, [schedule]);

  // First copy: the next date after today that lines up with this invoice.
  let n = 1;
  while (compareDates(occurrence(issueDate, frequency, 1, n), today) <= 0) {
    n++;
  }
  const start = occurrence(issueDate, frequency, 1, n);
  const endDate = end === 'NEVER' ? null : addMonths(start, end === 'M6' ? 6 : 12);

  const close = () => {
    if (ref && typeof ref === 'object' && ref.current) {
      ref.current.dismiss();
    }
  };

  const save = async () => {
    await mutate(tx => setSchedule(tx, clock, documentId, { frequency, start, endDate }));
    await ensureNotificationPermission();
    toast.show({
      message: t('recurring.saved', { date: f.date(start) }),
      tone: 'success',
      haptic: 'success',
    });
    close();
  };

  return (
    <Sheet ref={ref} title={t('recurring.title')}>
      <View style={styles.body}>
        <SegmentedControl
          segments={FREQUENCIES.map(v => ({ value: v, label: t(`recurring.freq.${v}`) }))}
          value={frequency}
          onChange={setFrequency}
          accessibilityLabel={t('recurring.title')}
        />
        <View style={styles.row}>
          <Text variant="callout" tone="secondary">
            {t('recurring.first')}
          </Text>
          <Text variant="calloutMedium" tabular>
            {f.date(start)}
          </Text>
        </View>
        <Text variant="label" tone="secondary">
          {t('recurring.ends')}
        </Text>
        <View style={styles.chips}>
          {(['NEVER', 'M6', 'M12'] as const).map(e => (
            <Chip
              key={e}
              label={t(`recurring.end.${e}`)}
              selected={end === e}
              onPress={() => setEnd(e)}
            />
          ))}
        </View>
        <Text variant="caption" tone="tertiary">
          {t('recurring.hint')}
        </Text>
        <Button
          testID="recurring-save"
          variant="primary"
          size="lg"
          fullWidth
          label={t('recurring.save')}
          onPress={save}
        />
        {schedule?.active ? (
          <Button
            variant="ghost"
            fullWidth
            label={t('recurring.stop')}
            onPress={async () => {
              await mutate(tx => stopSchedule(tx, clock, documentId));
              toast.show({ message: t('recurring.stopped') });
              close();
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create(theme => ({
  body: {
    gap: theme.space[4],
    paddingHorizontal: theme.size.gutter,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chips: {
    flexDirection: 'row',
    gap: theme.space[2],
    marginTop: -theme.space[2],
  },
}));
