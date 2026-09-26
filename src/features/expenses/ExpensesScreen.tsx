import { Menu, Paperclip, Trash2 } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import type { DrawerProps } from '@/app/navigation';
import { clock, mutate, useLiveQuery } from '@/data/live';
import {
  deleteExpense,
  listExpenses,
  restoreExpense,
  type Expense,
} from '@/data/repositories/expenses';
import { isExpenseCategory } from '@/domain/expenses';
import { NewButton } from '@/features/inbox/NewButton';
import { useFormat } from '@/lib/format';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Divider,
  EmptyState,
  Icon,
  IconButton,
  ListRow,
  Surface,
  SwipeRow,
  Text,
} from '@/ui/primitives';
import { breakpoints } from '@/ui/theme';
import { toast } from '@/ui/toast/store';

import { CATEGORY_ICONS } from './categories';

type Section = { key: string; title: string; total: string; data: Expense[] };

/** Money out: one list, grouped by month, newest first. */
export function ExpensesScreen({ navigation }: DrawerProps<'Expenses'>) {
  const { t } = useTranslation();
  const f = useFormat();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const today = clock.today();
  const { data: expenses } = useLiveQuery(db => listExpenses(db), []);
  const root = navigation.getParent();

  const { sections, month, year } = useMemo(() => {
    const byMonth = new Map<string, Expense[]>();
    for (const e of expenses ?? []) {
      const key = e.date.slice(0, 7);
      byMonth.set(key, [...(byMonth.get(key) ?? []), e]);
    }
    const sum = (xs: Expense[]) =>
      xs.filter(e => e.currency === f.currency).reduce((a, e) => a + e.amount, 0);
    const monthName = new Intl.DateTimeFormat(f.locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return {
      sections: [...byMonth.entries()].map(
        ([key, data]): Section => ({
          key,
          title: monthName.format(new Date(`${key}-01T00:00:00Z`)),
          total: f.money(sum(data)),
          data,
        }),
      ),
      month: sum(byMonth.get(today.slice(0, 7)) ?? []),
      year: sum((expenses ?? []).filter(e => e.date.startsWith(today.slice(0, 4)))),
    };
  }, [expenses, f, today]);

  const remove = async (e: Expense) => {
    await mutate(tx => deleteExpense(tx, clock, e.id));
    toast.show({
      message: t('expenses.deleted'),
      action: {
        label: t('common.undo'),
        onPress: () => mutate(tx => restoreExpense(tx, e.id)),
      },
    });
  };

  const categoryLabel = (c: string) =>
    isExpenseCategory(c) ? t(`expenseCategory.${c}`) : c;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t('nav.expenses')}
        left={
          width >= breakpoints.lg ? undefined : (
            <IconButton
              icon={Menu}
              label={t('common.openMenu')}
              onPress={navigation.openDrawer}
            />
          )
        }
      />
      {expenses && expenses.length === 0 ? (
        <EmptyState
          title={t('expenses.emptyTitle')}
          body={t('expenses.emptyBody')}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={e => e.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 96 },
          ]}
          ListHeaderComponent={
            <View style={styles.summary}>
              <Surface style={styles.stat}>
                <Text variant="caption" tone="secondary">
                  {t('expenses.thisMonth')}
                </Text>
                <Text variant="title2" tabular numberOfLines={1} adjustsFontSizeToFit>
                  {f.money(month)}
                </Text>
              </Surface>
              <Surface style={styles.stat}>
                <Text variant="caption" tone="secondary">
                  {t('expenses.thisYear')}
                </Text>
                <Text variant="title2" tabular numberOfLines={1} adjustsFontSizeToFit>
                  {f.money(year)}
                </Text>
              </Surface>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text variant="overline" tone="tertiary">
                {section.title}
              </Text>
              <Text variant="captionMedium" tone="secondary" tabular>
                {section.total}
              </Text>
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <View
              style={[
                styles.row,
                index === 0 && styles.first,
                index === section.data.length - 1 && styles.last,
              ]}
            >
              {index > 0 ? <Divider inset={52} /> : null}
              <SwipeRow
                right={{
                  label: t('actions.delete'),
                  icon: Trash2,
                  tone: 'danger',
                  onTrigger: () => remove(item),
                }}
              >
                <ListRow
                  testID={`expense-${item.id}`}
                  leadingIcon={
                    isExpenseCategory(item.category)
                      ? CATEGORY_ICONS[item.category]
                      : CATEGORY_ICONS.OTHER
                  }
                  title={item.vendor ?? categoryLabel(item.category)}
                  subtitle={[
                    f.date(item.date, 'short'),
                    item.vendor ? categoryLabel(item.category) : null,
                    item.note,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  value={f.money(item.amount, item.currency)}
                  trailing={
                    item.receiptPath ? (
                      <Icon icon={Paperclip} size={14} tone="tertiary" />
                    ) : undefined
                  }
                  onPress={() => root?.navigate('ExpenseEditor', { id: item.id })}
                />
              </SwipeRow>
            </View>
          )}
        />
      )}
      <NewButton
        testID="new-expense"
        label={t('expenses.new')}
        onPress={() => root?.navigate('ExpenseEditor')}
      />
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.app,
  },
  content: {
    maxWidth: theme.size.contentMax,
    width: '100%',
    alignSelf: 'center',
  },
  summary: {
    flexDirection: 'row',
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[2],
  },
  stat: {
    flex: 1,
    padding: theme.space[3],
    gap: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[6],
    paddingBottom: theme.space[2],
  },
  row: {
    marginHorizontal: theme.size.gutter,
    backgroundColor: theme.colors.bg.surface,
    borderLeftWidth: theme.stroke.thin,
    borderRightWidth: theme.stroke.thin,
    borderColor: theme.colors.border.subtle,
    overflow: 'hidden',
  },
  first: {
    borderTopWidth: theme.stroke.thin,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
  },
  last: {
    borderBottomWidth: theme.stroke.thin,
    borderBottomLeftRadius: theme.radius.lg,
    borderBottomRightRadius: theme.radius.lg,
  },
}));
