import {
  ArrowLeft,
  CloudDownload,
  CloudUpload,
  Download,
  FileSpreadsheet,
  FolderOpen,
  Share2,
  Users,
  Package,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import {
  backupToDrive,
  createBackupZip,
  lastBackup,
  listDriveBackups,
  markBackedUp,
  openBackup,
  openDriveBackup,
  type OpenedBackup,
} from '@/backup/service';
import { BackupError } from '@/backup/snapshot';
import { useProGate } from '@/billing/useProGate';
import { EXPORT_KINDS, exportCsv } from '@/features/reports/exports';
import { useFormat } from '@/lib/format';
import { PrefKeys, prefs } from '@/lib/storage';
import NativeBackup from '@/specs/NativeBackup';
import type { DriveFile } from '@/specs/NativeDrive';
import NativeShare from '@/specs/NativeShare';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Divider,
  IconButton,
  ListRow,
  SectionHeader,
  Sheet,
  Surface,
  Switch,
  Text,
  type SheetRef,
} from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

import { RestoreSheet } from './RestoreSheet';

const ALL_TIME = { from: '0000-01-01', to: '9999-12-31' };

/** Keep a copy of everything, somewhere other than this phone. */
export function BackupScreen({ navigation }: RootScreenProps<'Backup'>) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const f = useFormat();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<string | null>(null);
  const [auto, setAuto] = useState(prefs.getBoolean(PrefKeys.autoDriveBackup) ?? false);
  const [last, setLast] = useState(lastBackup);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [opened, setOpened] = useState<OpenedBackup | null>(null);
  const restoreSheet = useRef<SheetRef>(null);
  const { gate } = useProGate();
  const driveSheet = useRef<SheetRef>(null);
  const exportSheet = useRef<SheetRef>(null);
  const driveError = prefs.getString(PrefKeys.driveError);

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) {
      return;
    }
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      toast.show({
        message:
          e instanceof BackupError
            ? t(`backup.error.${e.code}`)
            : code === 'E_DRIVE_AUTH'
            ? t('backup.driveUnavailable')
            : code === 'E_CANCELLED'
            ? t('common.cancel')
            : t('backup.failed'),
        tone: code === 'E_CANCELLED' ? 'neutral' : 'danger',
      });
    } finally {
      setBusy(null);
      setLast(lastBackup());
    }
  };

  const saveFile = () =>
    run('save', async () => {
      const zip = await createBackupZip();
      const saved = await NativeShare!.saveToDownloads(zip.path, zip.name, 'application/zip');
      await markBackedUp('file');
      toast.show({ message: t('share.saved', { name: saved.name }), tone: 'success', haptic: 'success' });
    });

  const shareFile = () =>
    run('share', async () => {
      const zip = await createBackupZip();
      await NativeShare!.share({
        path: zip.path,
        mime: 'application/zip',
        target: 'any',
        subject: zip.name,
        text: '',
        emails: [],
        phone: '',
        chooserTitle: t('backup.shareTitle'),
      });
      await markBackedUp('file');
    });

  const restoreFile = () =>
    run('restore', async () => {
      const uri = await NativeBackup!.pickFile(['application/zip', 'application/octet-stream']);
      if (!uri) {
        return;
      }
      setOpened(await openBackup(uri));
      restoreSheet.current?.present();
    });

  const driveNow = () =>
    run('drive', async () => {
      if (await backupToDrive(true)) {
        toast.show({ message: t('backup.driveDone'), tone: 'success', haptic: 'success' });
      }
    });

  const driveRestore = () =>
    run('driveList', async () => {
      const files = await listDriveBackups();
      if (!files) {
        return;
      }
      setDriveFiles(files);
      driveSheet.current?.present();
    });

  const toggleAuto = (value: boolean) =>
    run('auto', async () => {
      if (value && !gate('autoBackup')) {
        return;
      }
      if (value && !(await backupToDrive(true))) {
        return;
      }
      prefs.set(PrefKeys.autoDriveBackup, value);
      setAuto(value);
    });

  const spinner = (key: string) =>
    busy === key ? <ActivityIndicator color={theme.colors.text.tertiary} /> : undefined;

  const lastText = last
    ? t('backup.lastAt', {
        when: new Intl.DateTimeFormat(f.locale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(last.at),
        where: t(last.kind === 'drive' ? 'backup.whereDrive' : 'backup.whereFile'),
      })
    : t('backup.never');

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t('backup.title')}
        left={
          <IconButton icon={ArrowLeft} label={t('common.back')} onPress={() => navigation.goBack()} />
        }
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}>
        <Surface style={[styles.status, !last && styles.statusWarn]}>
          <Text variant="headline">{last ? t('backup.protected') : t('backup.notProtected')}</Text>
          <Text variant="callout" tone="secondary">
            {last ? lastText : t('backup.neverHint')}
          </Text>
          {driveError && auto ? (
            <Text variant="caption" tone="danger">
              {t('backup.autoFailed')}
            </Text>
          ) : null}
        </Surface>

        <SectionHeader title={t('backup.drive')} />
        <Surface style={styles.card}>
          <ListRow
            testID="backup-auto"
            title={t('backup.weekly')}
            subtitle={t('backup.weeklyHint')}
            onPress={() => toggleAuto(!auto)}
            trailing={spinner('auto') ?? <Switch value={auto} onValueChange={toggleAuto} accessibilityLabel={t('backup.weekly')} />}
          />
          <Divider inset={16} />
          <ListRow
            leadingIcon={CloudUpload}
            title={t('backup.driveNow')}
            onPress={driveNow}
            trailing={spinner('drive')}
          />
          <Divider inset={52} />
          <ListRow
            leadingIcon={CloudDownload}
            title={t('backup.driveRestore')}
            onPress={driveRestore}
            trailing={spinner('driveList')}
          />
        </Surface>

        <SectionHeader title={t('backup.file')} />
        <Surface style={styles.card}>
          <ListRow
            testID="backup-save"
            leadingIcon={Download}
            title={t('backup.save')}
            subtitle={t('backup.saveHint')}
            onPress={saveFile}
            trailing={spinner('save')}
          />
          <Divider inset={52} />
          <ListRow
            leadingIcon={Share2}
            title={t('backup.share')}
            onPress={shareFile}
            trailing={spinner('share')}
          />
          <Divider inset={52} />
          <ListRow
            testID="backup-restore"
            leadingIcon={FolderOpen}
            title={t('backup.restore')}
            onPress={restoreFile}
            trailing={spinner('restore')}
          />
        </Surface>

        <SectionHeader title={t('backup.moveData')} />
        <Surface style={styles.card}>
          <ListRow
            testID="import-clients"
            leadingIcon={Users}
            title={t('import.clientsTitle')}
            subtitle={t('import.clientsHint')}
            showChevron
            onPress={() => navigation.push('Import', { target: 'clients' })}
          />
          <Divider inset={52} />
          <ListRow
            leadingIcon={Package}
            title={t('import.itemsTitle')}
            showChevron
            onPress={() => navigation.push('Import', { target: 'items' })}
          />
          <Divider inset={52} />
          <ListRow
            leadingIcon={FileSpreadsheet}
            title={t('backup.csv')}
            subtitle={t('reports.export.csvHint')}
            onPress={() => exportSheet.current?.present()}
          />
        </Surface>
        <Text variant="caption" tone="tertiary" style={styles.note}>
          {t('backup.androidNote')}
        </Text>
      </ScrollView>

      <RestoreSheet ref={restoreSheet} opened={opened} />

      <Sheet ref={driveSheet} title={t('backup.driveRestore')}>
        {driveFiles.length === 0 ? (
          <Text variant="callout" tone="secondary" style={styles.empty}>
            {t('backup.driveEmpty')}
          </Text>
        ) : (
          driveFiles.map((file, i) => (
            <View key={file.id}>
              {i > 0 ? <Divider inset={52} /> : null}
              <ListRow
                leadingIcon={CloudDownload}
                title={new Intl.DateTimeFormat(f.locale, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(file.modified))}
                value={`${Math.max(1, Math.round(file.size / 1024))} KB`}
                onPress={() =>
                  run('driveOpen', async () => {
                    driveSheet.current?.dismiss();
                    setOpened(await openDriveBackup(file.id));
                    restoreSheet.current?.present();
                  })
                }
              />
            </View>
          ))
        )}
      </Sheet>

      <Sheet ref={exportSheet} title={t('backup.csv')}>
        {EXPORT_KINDS.map((k, i) => (
          <View key={k}>
            {i > 0 ? <Divider inset={52} /> : null}
            <ListRow
              leadingIcon={FileSpreadsheet}
              title={t(`reports.export.${k}`)}
              onPress={() =>
                run('csv', async () => {
                  exportSheet.current?.dismiss();
                  await exportCsv({ kind: k, period: ALL_TIME, locale: f.locale, t });
                })
              }
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
  content: {
    paddingTop: theme.space[2],
    maxWidth: theme.size.contentMax,
    width: '100%',
    alignSelf: 'center',
  },
  status: {
    marginHorizontal: theme.size.gutter,
    padding: theme.space[4],
    gap: theme.space[1],
  },
  statusWarn: {
    backgroundColor: theme.colors.status.warning.bg,
    borderColor: theme.colors.status.warning.border,
  },
  card: {
    marginHorizontal: theme.size.gutter,
  },
  note: {
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[4],
  },
  empty: {
    paddingHorizontal: theme.size.gutter,
    paddingBottom: theme.space[4],
  },
}));
