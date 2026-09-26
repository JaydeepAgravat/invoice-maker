import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useEffect, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { getDatabase } from '@/data/database';
import { mutate } from '@/data/live';
import {
  getSequence,
  NumberingError,
  updateSequence,
} from '@/data/repositories/sequences';
import { yearOf, type ISODate } from '@/domain/dates';
import type { DocType } from '@/domain/docTypes';
import {
  formatDocumentNumber,
  type NumberingStyle,
} from '@/domain/numbering';
import {
  Button,
  SegmentedControl,
  Sheet,
  Text,
  type SheetRef,
} from '@/ui/primitives';

/**
 * Change how numbers look before the first one is used: prefix, yearly or
 * continuous counting, and where to start (for people coming from another
 * app). Numbers already issued are never touched.
 */
export function NumberingSheet({
  ref,
  type,
  issueDate,
  onSaved,
}: {
  ref?: Ref<SheetRef>;
  type: DocType;
  issueDate: ISODate;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [prefix, setPrefix] = useState('');
  const [style, setStyle] = useState<NumberingStyle>('SEQUENTIAL');
  const [next, setNext] = useState('1');
  const [initialNext, setInitialNext] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const year = yearOf(issueDate);

  useEffect(() => {
    getDatabase().then(async db => {
      const seq = await getSequence(db, type);
      const key = seq.style === 'YEARLY' ? `${type}:${year}` : type;
      const { rows } = await db.execute(
        'SELECT next_value FROM number_sequences WHERE key = ?',
        [key],
      );
      const value = rows[0] ? Number(rows[0].next_value) : 1;
      setPrefix(seq.prefix);
      setStyle(seq.style);
      setNext(String(value));
      setInitialNext(value);
    });
  }, [type, year]);

  const nextValue = Number.parseInt(next, 10);
  const preview =
    Number.isInteger(nextValue) && nextValue > 0
      ? formatDocumentNumber({ prefix, pad: 4, style }, nextValue, year)
      : '—';

  const save = async () => {
    setError(null);
    try {
      await mutate(tx =>
        updateSequence(
          tx,
          type,
          {
            prefix,
            style,
            ...(nextValue !== initialNext ? { nextValue } : {}),
          },
          year,
        ),
      );
      onSaved?.();
      if (ref && typeof ref === 'object' && ref.current) {
        ref.current.dismiss();
      }
    } catch (e) {
      setError(
        e instanceof NumberingError && e.code === 'NEXT_NUMBER_TOO_LOW'
          ? t('numbering.tooLow')
          : t('numbering.invalid'),
      );
    }
  };

  const input = [styles.input, { color: theme.colors.text.primary }];

  return (
    <Sheet
      ref={ref}
      title={t('numbering.title')}
      headerRight={
        <Button
          testID="numbering-save"
          variant="primary"
          size="sm"
          label={t('common.save')}
          onPress={save}
        />
      }
    >
      <View style={styles.body}>
        <View style={styles.preview}>
          <Text variant="caption" tone="tertiary">
            {t('numbering.next')}
          </Text>
          <Text variant="title2" tabular testID="numbering-preview">
            {preview}
          </Text>
        </View>
        <SegmentedControl
          segments={[
            { value: 'SEQUENTIAL', label: t('numbering.sequential') },
            { value: 'YEARLY', label: t('numbering.yearly') },
          ]}
          value={style}
          onChange={setStyle}
          accessibilityLabel={t('numbering.style')}
        />
        <View style={styles.row}>
          <View style={styles.field}>
            <Text variant="label" tone="secondary">
              {t('numbering.prefix')}
            </Text>
            <BottomSheetTextInput
              testID="numbering-prefix"
              value={prefix}
              onChangeText={v => setPrefix(v.replace(/\s/g, '').slice(0, 12))}
              autoCapitalize="characters"
              autoCorrect={false}
              style={input}
              maxFontSizeMultiplier={1.6}
              accessibilityLabel={t('numbering.prefix')}
            />
          </View>
          <View style={styles.field}>
            <Text variant="label" tone="secondary">
              {t('numbering.startAt')}
            </Text>
            <BottomSheetTextInput
              testID="numbering-next"
              value={next}
              onChangeText={v => setNext(v.replace(/\D/g, '').slice(0, 9))}
              keyboardType="number-pad"
              style={input}
              maxFontSizeMultiplier={1.6}
              accessibilityLabel={t('numbering.startAt')}
            />
          </View>
        </View>
        <Text variant="caption" tone={error ? 'danger' : 'tertiary'}>
          {error ?? t('numbering.hint')}
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create(theme => ({
  body: {
    gap: theme.space[4],
    paddingHorizontal: theme.size.gutter,
  },
  preview: {
    alignItems: 'center',
    gap: theme.space[1],
    paddingVertical: theme.space[2],
  },
  row: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  field: {
    flex: 1,
    gap: theme.space[1.5],
  },
  input: {
    ...theme.type.body,
    lineHeight: undefined,
    height: 48,
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radius.md,
    borderWidth: theme.stroke.thin,
    borderColor: theme.colors.border.default,
    backgroundColor: theme.colors.bg.surface,
  },
}));
