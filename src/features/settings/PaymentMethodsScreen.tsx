import {
  ArrowLeft,
  Banknote,
  Link2,
  Plus,
  QrCode,
  ReceiptText,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { useLiveQuery } from '@/data/live';
import { useProfile } from '@/data/ProfileProvider';
import { listPaymentMethods } from '@/data/repositories/paymentMethods';
import {
  fieldsFor,
  formatField,
  qrFor,
  type PaymentKind,
  type PaymentMethod,
} from '@/domain/payments';
import { pdfLabels } from '@/pdf/labels';
import { EmptyPayments } from '@/ui/illustrations';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Badge,
  Divider,
  EmptyState,
  IconButton,
  ListRow,
  Surface,
  Text,
} from '@/ui/primitives';

export const KIND_ICONS: Record<PaymentKind, LucideIcon> = {
  BANK: Banknote,
  PIX: QrCode,
  PAYPAL: Wallet,
  LINK: Link2,
  OTHER: ReceiptText,
};

/** How clients can pay you, printed on every invoice. */
export function PaymentMethodsScreen({
  navigation,
}: RootScreenProps<'PaymentMethods'>) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const L = pdfLabels(i18n.language, profile.country);
  const { data: methods } = useLiveQuery(db => listPaymentMethods(db), []);

  const summary = (m: PaymentMethod) => {
    const first = fieldsFor(m.kind, profile.country).find(
      f => f !== 'accountName' && m.fields[f],
    );
    if (!first) {
      return m.fields.accountName ?? '';
    }
    return formatField(first, m.fields[first]!);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t('paymentDetails.title')}
        left={
          <IconButton
            icon={ArrowLeft}
            label={t('common.back')}
            onPress={() => navigation.goBack()}
          />
        }
        right={
          methods?.length ? (
            <IconButton
              testID="payment-methods-add"
              icon={Plus}
              label={t('paymentDetails.add')}
              onPress={() => navigation.push('PaymentMethodEditor')}
            />
          ) : undefined
        }
      />
      {methods && methods.length === 0 ? (
        <EmptyState
          illustration={<EmptyPayments />}
          title={t('paymentDetails.emptyTitle')}
          body={t('paymentDetails.emptyBody')}
          action={{
            label: t('paymentDetails.add'),
            leadingIcon: Plus,
            onPress: () => navigation.push('PaymentMethodEditor'),
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 48 },
          ]}
        >
          <Text variant="callout" tone="secondary" style={styles.intro}>
            {t('paymentDetails.intro')}
          </Text>
          <Surface style={styles.card}>
            {(methods ?? []).map((m, i) => (
              <View key={m.id}>
                {i > 0 ? <Divider inset={52} /> : null}
                <ListRow
                  testID={`payment-method-${i}`}
                  leadingIcon={KIND_ICONS[m.kind]}
                  title={m.label || L.kind[m.kind]}
                  subtitle={summary(m)}
                  trailing={
                    !m.isDefault ? (
                      <Badge label={t('paymentDetails.optional')} />
                    ) : qrFor(m, {
                        currency: m.kind === 'PIX' ? 'BRL' : profile.currency,
                        amount: 100,
                        reference: null,
                        businessName: profile.name ?? '-',
                      }) ? (
                      <Badge label="QR" tone="info" />
                    ) : undefined
                  }
                  showChevron
                  onPress={() =>
                    navigation.push('PaymentMethodEditor', { id: m.id })
                  }
                />
              </View>
            ))}
          </Surface>
        </ScrollView>
      )}
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
  intro: {
    paddingHorizontal: theme.size.gutter,
    paddingBottom: theme.space[4],
  },
  card: {
    marginHorizontal: theme.size.gutter,
  },
}));
