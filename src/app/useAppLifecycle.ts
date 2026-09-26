import { useEffect } from 'react';
import { AppState, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';

import { maybeAutoBackup } from '@/backup/service';
import { clock } from '@/data/database';
import { mutate, onDataChanged } from '@/data/live';
import { createDraft } from '@/data/repositories/documents';
import { processDueSchedules } from '@/data/repositories/recurring';
import { syncReminders } from '@/notifications/reminders';
import { toast } from '@/ui/toast/store';

import { navigationRef } from './navigationRef';
import { updateWidget } from './widget';

/**
 * Work that runs whenever the app is opened or brought back: recurring
 * invoices that fell due become drafts, the weekly Drive backup runs if it
 * is time, and scheduled reminders are rebuilt after any data change.
 */
export function useAppLifecycle(onboarded: boolean) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!onboarded) {
      return;
    }
    let busy = false;
    const onActive = async () => {
      if (busy) {
        return;
      }
      busy = true;
      try {
        const created = await mutate(tx => processDueSchedules(tx, clock));
        if (created.length) {
          toast.show({
            message: t('reminders.recurringCreated', { count: created.length }),
            tone: 'success',
          });
        }
        await syncReminders(clock.today());
        await updateWidget(clock.today());
        await maybeAutoBackup();
      } catch {
        // Never block the app on background housekeeping.
      } finally {
        busy = false;
      }
    };
    onActive();
    const sub = AppState.addEventListener('change', s => s === 'active' && onActive());

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = onDataChanged(() => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        syncReminders(clock.today()).catch(() => undefined);
        updateWidget(clock.today()).catch(() => undefined);
      }, 1500);
    });

    // Widget "New invoice": start a draft and open the editor.
    const openUrl = async (url: string | null | undefined) => {
      if (!url?.startsWith('invoiceapp://new/')) {
        return;
      }
      const draft = await mutate(tx => createDraft(tx, clock, 'INVOICE'));
      const go = () => navigationRef.navigate('DocumentEditor', { id: draft.id, isNew: true });
      if (navigationRef.isReady()) {
        go();
      } else {
        setTimeout(go, 300);
      }
    };
    Linking.getInitialURL().then(openUrl);
    const linkSub = Linking.addEventListener('url', e => openUrl(e.url));
    return () => {
      sub.remove();
      linkSub.remove();
      unsubscribe();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [onboarded, t]);
}
