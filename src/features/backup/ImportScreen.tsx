import { Check, Contact, FileUp, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { clock, mutate } from '@/data/live';
import { importClients, importItems, undoImport } from '@/data/repositories/imports';
import { parseCsv, type CsvTable } from '@/domain/csvParse';
import {
  CLIENT_FIELDS,
  detectSource,
  guessClientMapping,
  guessItemMapping,
  ITEM_FIELDS,
  toClients,
  toItems,
  type ClientField,
  type ItemField,
} from '@/domain/importMapping';
import { useFormat } from '@/lib/format';
import NativeBackup from '@/specs/NativeBackup';
import NativeMedia from '@/specs/NativeMedia';
import { EmptyImport } from '@/ui/illustrations';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Badge,
  Button,
  Divider,
  EmptyState,
  Icon,
  IconButton,
  ListRow,
  Sheet,
  Surface,
  Text,
  type SheetRef,
} from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

type Field = ClientField | ItemField;

/**
 * Bring clients or items over from a spreadsheet or another invoicing app.
 * Columns are matched automatically; the person only checks and confirms.
 */
export function ImportScreen({ navigation, route }: RootScreenProps<'Import'>) {
  const { target } = route.params;
  const { t } = useTranslation();
  const f = useFormat();
  const insets = useSafeAreaInsets();
  const [table, setTable] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<Array<Field | null>>([]);
  const [column, setColumn] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const fieldSheet = useRef<SheetRef>(null);
  const fields: readonly Field[] = target === 'clients' ? CLIENT_FIELDS : ITEM_FIELDS;

  const choose = async () => {
    try {
      const uri = await NativeBackup!.pickFile(['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel']);
      if (!uri) {
        return;
      }
      const parsed = parseCsv(await NativeBackup!.readText(uri));
      if (!parsed.headers.length || !parsed.rows.length) {
        toast.show({ message: t('import.empty'), tone: 'danger' });
        return;
      }
      setTable(parsed);
      setMapping(target === 'clients' ? guessClientMapping(parsed.headers) : guessItemMapping(parsed.headers));
    } catch {
      toast.show({ message: t('import.unreadable'), tone: 'danger' });
    }
  };

  const fromContacts = async () => {
    const contact = await NativeMedia?.pickContact().catch(() => null);
    if (contact) {
      navigation.replace('ClientEditor', { name: contact.name, phone: contact.phone ?? undefined });
    }
  };

  const preview =
    table && target === 'clients'
      ? toClients(table.rows, mapping as Array<ClientField | null>)
      : table
      ? toItems(table.rows, mapping as Array<ItemField | null>)
      : null;
  const count = preview ? ('clients' in preview ? preview.clients.length : preview.items.length) : 0;
  const hasName = mapping.includes('name') || (target === 'clients' && mapping.includes('company'));

  const run = async () => {
    if (!table || !preview) {
      return;
    }
    setBusy(true);
    try {
      const result = await mutate(tx =>
        'clients' in preview
          ? importClients(tx, clock, preview.clients)
          : importItems(tx, clock, preview.items, { currency: f.currency, locale: f.locale }),
      );
      toast.show({
        message: [
          t(`import.done.${target}`, { count: result.created.length }),
          result.duplicates ? t('import.duplicates', { count: result.duplicates }) : null,
        ]
          .filter(Boolean)
          .join(' · '),
        tone: 'success',
        haptic: 'success',
        action: result.created.length
          ? {
              label: t('common.undo'),
              onPress: () => mutate(tx => undoImport(tx, clock, target, result.created)),
            }
          : undefined,
      });
      navigation.goBack();
    } finally {
      setBusy(false);
    }
  };

  const source = table ? detectSource(table.headers) : null;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={target === 'clients' ? t('import.clientsTitle') : t('import.itemsTitle')}
        left={<IconButton icon={X} label={t('common.close')} onPress={() => navigation.goBack()} />}
      />
      {!table ? (
        <View style={styles.intro}>
          <EmptyState
            illustration={<EmptyImport />}
            title={target === 'clients' ? t('import.introClients') : t('import.introItems')}
            body={t('import.introBody')}
          />
          <View style={styles.actions}>
            <Button
              testID="import-choose"
              variant="primary"
              size="lg"
              fullWidth
              leadingIcon={FileUp}
              label={t('import.chooseFile')}
              onPress={choose}
            />
            {target === 'clients' ? (
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                leadingIcon={Contact}
                label={t('import.fromContacts')}
                onPress={fromContacts}
              />
            ) : null}
          </View>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
            <View style={styles.head}>
              <Text variant="callout" tone="secondary">
                {t('import.found', { count: table.rows.length })}
              </Text>
              {source ? <Badge label={t('import.from', { app: source })} tone="info" /> : null}
            </View>
            <Text variant="caption" tone="tertiary" style={styles.hint}>
              {t('import.mapHint')}
            </Text>
            <Surface style={styles.card}>
              {table.headers.map((h, i) => (
                <View key={`${h}-${i}`}>
                  {i > 0 ? <Divider inset={16} /> : null}
                  <ListRow
                    title={h || t('import.column', { n: i + 1 })}
                    subtitle={table.rows.find(r => r[i])?.[i] ?? '—'}
                    value={mapping[i] ? t(`import.field.${mapping[i]}`) : t('import.skip')}
                    showChevron
                    onPress={() => {
                      setColumn(i);
                      fieldSheet.current?.present();
                    }}
                  />
                </View>
              ))}
            </Surface>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            {!hasName ? (
              <Text variant="caption" tone="danger" style={styles.center}>
                {t('import.needName')}
              </Text>
            ) : preview && preview.skipped ? (
              <Text variant="caption" tone="tertiary" style={styles.center}>
                {t('import.skipped', { count: preview.skipped })}
              </Text>
            ) : null}
            <Button
              testID="import-run"
              variant="primary"
              size="lg"
              fullWidth
              disabled={!hasName || count === 0 || busy}
              label={t(`import.action.${target}`, { count })}
              onPress={run}
            />
          </View>
        </>
      )}
      <Sheet ref={fieldSheet} title={column !== null && table ? table.headers[column] : ''}>
        {[null, ...fields].map((field, i) => (
          <View key={field ?? 'skip'}>
            {i > 0 ? <Divider inset={16} /> : null}
            <ListRow
              title={field ? t(`import.field.${field}`) : t('import.skip')}
              trailing={
                column !== null && mapping[column] === field ? (
                  <Icon icon={Check} size={18} tone="accent" />
                ) : undefined
              }
              onPress={() => {
                if (column === null) {
                  return;
                }
                setMapping(m =>
                  m.map((x, j) => (j === column ? field : field && x === field ? null : x)),
                );
                fieldSheet.current?.dismiss();
              }}
            />
          </View>
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.app,
  },
  intro: {
    flex: 1,
  },
  actions: {
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
  },
  content: {
    paddingTop: theme.space[2],
    maxWidth: theme.size.contentMax,
    width: '100%',
    alignSelf: 'center',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.size.gutter,
  },
  hint: {
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[1],
    paddingBottom: theme.space[3],
  },
  card: {
    marginHorizontal: theme.size.gutter,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.app,
  },
  center: {
    textAlign: 'center',
  },
}));
