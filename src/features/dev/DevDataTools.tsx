import { Bell, Database as DatabaseIcon, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { clock, getDatabase } from '@/data/database';
import { listDocuments, viewCounts } from '@/data/repositories/inbox';
import {
  applyCountryPreset,
  markOnboarded,
  profileExists,
} from '@/data/repositories/profile';
import { seedSampleData } from '@/data/seed';
import { presetForLocale } from '@/domain/presets';
import { deviceLocale, resolveLanguage } from '@/i18n';
import NativeReminders from '@/specs/NativeReminders';
import { Divider, ListRow } from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

/** Dev-only: seed data and measure real on-device query speed. */
export function DevDataTools() {
  const [stats, setStats] = useState<string>('…');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const db = await getDatabase();
    const started = Date.now();
    const counts = await viewCounts(db, clock.today());
    await listDocuments(db, {
      today: clock.today(),
      view: 'unpaid',
      limit: 50,
    });
    await listDocuments(db, { today: clock.today(), search: 'tap' });
    const fts = await db.execute(
      'SELECT COUNT(*) AS n FROM documents_fts WHERE documents_fts MATCH \'"tap"*\'',
    );
    setStats(
      `${counts.all} docs · ${counts.unpaid} unpaid · ${
        fts.rows[0]?.n ?? 0
      } match "tap" · ${Date.now() - started} ms`,
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const seed = async () => {
    setBusy(true);
    try {
      const db = await getDatabase();
      if (!(await profileExists(db))) {
        const locale = deviceLocale();
        await applyCountryPreset(db, clock, {
          country: presetForLocale(locale).code,
          language: resolveLanguage(),
          locale,
        });
        await markOnboarded(db);
      }
      const started = Date.now();
      await seedSampleData(db, clock, { documents: 1000 });
      toast.show({
        message: `Seeded 1,000 documents in ${Date.now() - started} ms`,
        tone: 'success',
        haptic: 'success',
      });
      await refresh();
    } catch (e) {
      toast.show({ message: String(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const wipe = async () => {
    const db = await getDatabase();
    await db.transaction(async tx => {
      for (const t of [
        'documents_fts',
        'payments',
        'document_line_taxes',
        'document_lines',
        'activity_log',
        'documents',
        'client_emails',
        'clients',
        'item_taxes',
        'items',
      ]) {
        await tx.execute(`DELETE FROM ${t}`);
      }
      await tx.execute('UPDATE number_sequences SET next_value = 1');
    });
    toast.show({ message: 'Sample data removed' });
    await refresh();
  };

  return (
    <View>
      <ListRow
        title="Database"
        subtitle={stats}
        leadingIcon={DatabaseIcon}
        onPress={refresh}
      />
      <Divider inset={52} />
      <ListRow
        title={busy ? 'Seeding…' : 'Load 1,000 sample documents'}
        leadingIcon={DatabaseIcon}
        onPress={busy ? undefined : seed}
      />
      <Divider inset={52} />
      <ListRow
        testID="dev-test-reminder"
        title="Test reminder in 5 seconds"
        subtitle="Opens the Overdue view when tapped"
        leadingIcon={Bell}
        onPress={() =>
          NativeReminders?.setAll([
            {
              id: 'dev-test',
              at: Date.now() + 5000,
              title: 'INV-0001 is overdue',
              body: '£77.85 from Acme Ltd was due yesterday.',
              url: 'invoiceapp://inbox/overdue',
            },
          ])
        }
      />
      <Divider inset={52} />
      <ListRow
        title="Remove all data"
        leadingIcon={Trash2}
        destructive
        onPress={wipe}
      />
    </View>
  );
}
