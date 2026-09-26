import { useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { applyBackup, type OpenedBackup } from '@/backup/service';
import { useFormat } from '@/lib/format';
import {
  Button,
  SegmentedControl,
  Sheet,
  Surface,
  Text,
  type SheetRef,
} from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

/**
 * Shows what a backup contains before anything changes, then restores it.
 * "Add missing" is the safe default; "Replace everything" asks twice.
 */
export function RestoreSheet({
  ref,
  opened,
}: {
  ref?: Ref<SheetRef>;
  opened: OpenedBackup | null;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const s = opened?.summary;

  const close = () => {
    if (ref && typeof ref === 'object' && ref.current) {
      ref.current.dismiss();
    }
  };

  const restore = async () => {
    if (!opened) {
      return;
    }
    if (mode === 'replace' && !armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    try {
      await applyBackup(opened, mode);
      toast.show({ message: t('backup.restored'), tone: 'success', haptic: 'success' });
      close();
    } catch {
      toast.show({ message: t('backup.failed'), tone: 'danger' });
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  const rows: Array<[string, number]> = s
    ? [
        [t('backup.count.documents', { count: s.documents }), s.documents],
        [t('backup.count.clients', { count: s.clients }), s.clients],
        [t('backup.count.items', { count: s.items }), s.items],
        [t('backup.count.expenses', { count: s.expenses }), s.expenses],
        [t('backup.count.trips', { count: s.trips }), s.trips],
        [t('backup.count.files', { count: s.files }), s.files],
      ]
    : [];

  return (
    <Sheet
      ref={ref}
      title={t('backup.restoreTitle')}
      onDismiss={() => {
        setArmed(false);
        setMode('merge');
      }}
    >
      {s ? (
        <View style={styles.body}>
          <Surface style={styles.summary}>
            <Text variant="headline">{s.businessName ?? t('business.title')}</Text>
            <Text variant="caption" tone="secondary">
              {t('backup.madeOn', {
                date: new Intl.DateTimeFormat(f.locale, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(s.createdAt),
              })}
            </Text>
            <View style={styles.counts}>
              {rows
                .filter(([, n]) => n > 0)
                .map(([label]) => (
                  <Text key={label} variant="callout" tabular>
                    {label}
                  </Text>
                ))}
            </View>
          </Surface>
          <SegmentedControl
            segments={[
              { value: 'merge', label: t('backup.merge') },
              { value: 'replace', label: t('backup.replace') },
            ]}
            value={mode}
            onChange={m => {
              setMode(m);
              setArmed(false);
            }}
            accessibilityLabel={t('backup.restoreTitle')}
          />
          <Text variant="caption" tone={mode === 'replace' ? 'danger' : 'secondary'}>
            {mode === 'merge' ? t('backup.mergeHint') : t('backup.replaceHint')}
          </Text>
          <Button
            testID="restore-confirm"
            variant={mode === 'replace' ? 'danger' : 'primary'}
            size="lg"
            fullWidth
            disabled={busy}
            label={
              armed
                ? t('backup.replaceConfirm')
                : mode === 'merge'
                ? t('backup.mergeAction')
                : t('backup.replaceAction')
            }
            onPress={restore}
          />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create(theme => ({
  body: {
    gap: theme.space[4],
    paddingHorizontal: theme.size.gutter,
  },
  summary: {
    padding: theme.space[4],
    gap: theme.space[1],
  },
  counts: {
    marginTop: theme.space[2],
    gap: 2,
  },
}));
