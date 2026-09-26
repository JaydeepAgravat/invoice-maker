import { Check } from 'lucide-react-native';
import { useMemo, type Ref } from 'react';
import { View } from 'react-native';

import { Divider, Icon, ListRow, Sheet, type SheetRef } from '@/ui/primitives';

/** Currencies of our markets first, then other widely used ones. */
const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'MXN',
  'BRL',
  'CHF',
  'NZD',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
  'JPY',
  'CNY',
  'INR',
  'SGD',
  'HKD',
  'ZAR',
  'AED',
  'ARS',
  'CLP',
  'COP',
  'PEN',
];

const displayName = (code: string, locale: string) => {
  try {
    const DN = (
      Intl as unknown as {
        DisplayNames?: new (l: string, o: { type: string }) => {
          of(c: string): string;
        };
      }
    ).DisplayNames;
    return DN ? new DN(locale, { type: 'currency' }).of(code) : code;
  } catch {
    return code;
  }
};

export function CurrencySheet({
  ref,
  title,
  value,
  locale,
  onSelect,
}: {
  ref?: Ref<SheetRef>;
  title: string;
  value: string;
  locale: string;
  onSelect: (code: string) => void;
}) {
  const rows = useMemo(
    () => CURRENCIES.map(code => ({ code, name: displayName(code, locale) })),
    [locale],
  );
  return (
    <Sheet ref={ref} title={title} snapPoints={['70%']} scrollable>
      {rows.map((r, i) => (
        <View key={r.code}>
          {i > 0 ? <Divider inset={16} /> : null}
          <ListRow
            title={r.code}
            subtitle={r.name !== r.code ? r.name : undefined}
            selected={r.code === value}
            onPress={() => onSelect(r.code)}
            trailing={
              r.code === value ? (
                <Icon icon={Check} size={18} tone="accent" />
              ) : undefined
            }
          />
        </View>
      ))}
    </Sheet>
  );
}
