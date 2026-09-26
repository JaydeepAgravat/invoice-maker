import {
  BadgeCheck,
  Camera,
  ChartColumn,
  CloudUpload,
  Files,
  Palette,
  Receipt,
  Send,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { buyPro, proPrice, restorePro } from '@/billing/store';
import type { ProFeature } from '@/billing/useProGate';
import { FREE_SENDS_PER_MONTH, PRO_PRICE_FALLBACK } from '@/config';
import { Button, Icon, IconButton, Text } from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

type RowKey = 'sends' | 'look' | 'photos' | 'reports' | 'money' | 'docs' | 'backup' | 'footer';
type Row = { key: RowKey; icon: LucideIcon; features: ProFeature[] };

const ROWS: Row[] = [
  { key: 'sends', icon: Send, features: ['sends'] },
  { key: 'look', icon: Palette, features: ['templates', 'colors'] },
  { key: 'photos', icon: Camera, features: ['photos', 'signature'] },
  { key: 'reports', icon: ChartColumn, features: ['reports'] },
  { key: 'money', icon: Receipt, features: ['expenses', 'mileage'] },
  { key: 'docs', icon: Files, features: ['docTypes'] },
  { key: 'backup', icon: CloudUpload, features: ['autoBackup'] },
  { key: 'footer', icon: BadgeCheck, features: [] },
];

/**
 * One honest screen: what Pro adds, one price, paid once. Shown only when
 * the person reaches for a Pro feature or their sixth send of the month.
 */
export function PaywallScreen({ navigation, route }: RootScreenProps<'Paywall'>) {
  const feature = route.params?.feature;
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const [price, setPrice] = useState(PRO_PRICE_FALLBACK);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  useEffect(() => {
    proPrice().then(setPrice);
  }, []);

  const buy = async () => {
    setBusy('buy');
    const result = await buyPro();
    setBusy(null);
    if (result === 'purchased') {
      toast.show({ message: t('paywall.thanks'), tone: 'success', haptic: 'success' });
      navigation.goBack();
    } else if (result === 'unavailable') {
      toast.show({ message: t('paywall.unavailable'), tone: 'danger' });
    } else if (result === 'failed') {
      toast.show({ message: t('paywall.failed'), tone: 'danger' });
    }
  };

  const restore = async () => {
    setBusy('restore');
    const active = await restorePro();
    setBusy(null);
    if (active) {
      toast.show({ message: t('paywall.restored'), tone: 'success', haptic: 'success' });
      navigation.goBack();
    } else {
      toast.show({ message: active === null ? t('paywall.unavailable') : t('paywall.nothingToRestore') });
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <IconButton icon={X} label={t('common.close')} onPress={() => navigation.goBack()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Icon icon={Sparkles} size={26} tone="accent" />
        </View>
        <Text variant="title1" style={styles.center}>
          {t('paywall.title')}
        </Text>
        <Text variant="callout" tone="secondary" style={styles.center}>
          {feature === 'sends'
            ? t('paywall.sendsReached', { count: FREE_SENDS_PER_MONTH })
            : t('paywall.subtitle')}
        </Text>

        <View style={styles.list}>
          {ROWS.map(row => {
            const active = !!feature && row.features.includes(feature);
            return (
              <View key={row.key} style={[styles.row, active && styles.rowActive]}>
                <Icon icon={row.icon} size={20} tone={active ? 'accent' : 'secondary'} />
                <View style={styles.flex}>
                  <Text variant="bodyMedium">{t(`paywall.rows.${row.key}.title`)}</Text>
                  <Text variant="caption" tone="secondary">
                    {t(`paywall.rows.${row.key}.body`, { count: FREE_SENDS_PER_MONTH })}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + theme.space[3] }]}>
        <Button
          testID="paywall-buy"
          variant="primary"
          size="lg"
          fullWidth
          haptic="medium"
          disabled={!!busy}
          label={busy === 'buy' ? t('paywall.buying') : t('paywall.buy', { price })}
          onPress={buy}
        />
        <Text variant="caption" tone="tertiary" style={styles.center}>
          {t('paywall.once')}
        </Text>
        <View style={styles.center}>
          <Button
            variant="ghost"
            size="sm"
            disabled={!!busy}
            label={t('paywall.restore')}
            onPress={restore}
          />
        </View>
        <Text variant="caption" tone="tertiary" style={styles.center}>
          {t('paywall.dataPromise')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.app,
  },
  top: {
    paddingHorizontal: theme.space[2],
    height: 56,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: theme.size.gutter,
    paddingBottom: theme.space[6],
    gap: theme.space[2],
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent.subtle,
    marginBottom: theme.space[3],
  },
  center: {
    textAlign: 'center',
    alignItems: 'center',
  },
  list: {
    marginTop: theme.space[5],
    gap: theme.space[1],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[4],
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radius.lg,
  },
  rowActive: {
    backgroundColor: theme.colors.accent.subtle,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  footer: {
    gap: theme.space[2],
    alignItems: 'center',
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.subtle,
  },
}));
