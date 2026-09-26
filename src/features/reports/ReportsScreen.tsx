import { FileSpreadsheet, FileText, Menu, Share2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { DrawerProps } from '@/app/navigation';
import { clock, useLiveQuery } from '@/data/live';
import { useProfile } from '@/data/ProfileProvider';
import { loadReport, reportCurrencies } from '@/data/repositories/reports';
import { isExpenseCategory } from '@/domain/expenses';
import { formatMoney, RATE_SCALE } from '@/domain/money';
import { periodFor, previousPeriod, type PeriodKey } from '@/domain/reports';
import { useFormat } from '@/lib/format';
import { useIsPro } from '@/billing/entitlement';
import { ProTeaser } from '@/features/paywall/ProTeaser';
import { renderReportHtml, type ReportLabels } from '@/pdf/reportHtml';
import NativePdf from '@/specs/NativePdf';
import NativeShare from '@/specs/NativeShare';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Chip,
  Divider,
  EmptyState,
  IconButton,
  ListRow,
  SectionHeader,
  Sheet,
  Surface,
  Text,
  type SheetRef,
} from '@/ui/primitives';
import { breakpoints } from '@/ui/theme';
import { toast } from '@/ui/toast/store';

import { MonthBars, RankBars, StackBar } from './Charts';
import { EXPORT_KINDS, exportCsv, type ExportKind } from './exports';

const PERIOD_ORDER: readonly PeriodKey[] = [
  'THIS_YEAR',
  'THIS_QUARTER',
  'THIS_MONTH',
  'LAST_MONTH',
  'LAST_YEAR',
];

/** How the business is doing, in one scroll. Cash basis, one currency. */
export function ReportsScreen({ navigation }: DrawerProps<'Reports'>) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const f = useFormat();
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const today = clock.today();
  const [periodKey, setPeriodKey] = useState<PeriodKey>('THIS_YEAR');
  const [picked, setPicked] = useState<string | null>(null);
  const exportSheet = useRef<SheetRef>(null);
  const pro = useIsPro();

  const { data: currencies } = useLiveQuery(db => reportCurrencies(db), []);
  const currency = picked ?? profile.currency;
  const period = periodFor(periodKey, today);
  const { data } = useLiveQuery(
    async db => {
      const current = await loadReport(db, { currency, period, asOf: today });
      const before = await loadReport(db, {
        currency,
        period: previousPeriod(period),
        asOf: today,
      });
      return { current, before };
    },
    [currency, period.from, period.to, today],
  );

  const money = (minor: number) =>
    formatMoney(minor, { locale: f.locale, currency });
  const pct = (ppm: number) =>
    new Intl.NumberFormat(f.locale, {
      style: 'percent',
      maximumFractionDigits: 3,
    }).format(ppm / RATE_SCALE);
  const monthName = (key: string) =>
    new Intl.DateTimeFormat(f.locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${key}-01T00:00:00Z`));
  const r = data?.current;
  const delta =
    r && data.before.profit !== 0
      ? (r.profit - data.before.profit) / Math.abs(data.before.profit)
      : null;
  const empty =
    r &&
    r.income === 0 &&
    r.expenses === 0 &&
    r.mileage === 0 &&
    r.outstanding === 0 &&
    r.invoiced === 0;

  const agingColors = [
    theme.colors.status.success.solid,
    theme.colors.status.warning.solid,
    '#F76B15',
    theme.colors.status.danger.solid,
    '#A1253F',
  ];
  const agingLabels: ReportLabels['agingBuckets'] = [
    t('reports.aging.current'),
    t('reports.aging.d30'),
    t('reports.aging.d60'),
    t('reports.aging.d90'),
    t('reports.aging.d90plus'),
  ];

  const exportPdf = async () => {
    if (!r) {
      return;
    }
    const labels: ReportLabels = {
      title: t('reports.pdfTitle'),
      period: `${f.date(period.from)} – ${f.date(period.to)} · ${currency}`,
      generated: t('reports.generated', { date: f.date(today) }),
      profit: t('reports.profit'),
      income: t('reports.income'),
      expenses: t('reports.expenses'),
      mileage: t('reports.mileage'),
      invoiced: t('reports.invoiced'),
      credited: t('reports.credited'),
      outstanding: t('reports.outstanding'),
      byMonth: t('reports.byMonth'),
      month: t('reports.month'),
      byClient: t('reports.byClient'),
      client: t('csv.client'),
      noClient: t('document.noClient'),
      taxCollected: t('reports.taxCollected'),
      tax: t('csv.tax'),
      byCategory: t('reports.byCategory'),
      category: t('csv.category'),
      aging: t('reports.agingTitle'),
      amount: t('csv.amount'),
      agingBuckets: agingLabels,
      categoryName: c => (isExpenseCategory(c) ? t(`expenseCategory.${c}`) : c),
      monthName,
      taxName: (name, rate) => `${name} ${pct(rate)}`,
    };
    const html = renderReportHtml({
      report: r,
      labels,
      business: profile.name ?? '',
      money,
      paper: profile.paperSize,
    });
    const name = `${t('reports.pdfTitle')} ${period.from} ${period.to}.pdf`;
    const pdf = await NativePdf!.toPdf(html, profile.paperSize, name);
    await NativeShare!.share({
      path: pdf.path,
      mime: 'application/pdf',
      target: 'any',
      subject: name.replace(/\.pdf$/, ''),
      text: '',
      emails: [],
      phone: '',
      chooserTitle: t('reports.exportTitle'),
    });
  };

  const run = async (fn: () => Promise<void>) => {
    exportSheet.current?.dismiss();
    try {
      await fn();
    } catch {
      toast.show({ message: t('share.failed'), tone: 'danger' });
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t('nav.reports')}
        left={
          width >= breakpoints.lg ? undefined : (
            <IconButton
              icon={Menu}
              label={t('common.openMenu')}
              onPress={navigation.openDrawer}
            />
          )
        }
        right={
          !pro ? undefined : (
            <IconButton
              testID="reports-export"
              icon={Share2}
              label={t('reports.exportTitle')}
              onPress={() => exportSheet.current?.present()}
            />
          )
        }
      />
      {!pro ? (
        <ProTeaser
          feature="reports"
          title={t('paywall.reportsTitle')}
          body={t('paywall.reportsBody')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 48 },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {PERIOD_ORDER.map(k => (
              <Chip
                key={k}
                label={t(`reports.period.${k}`)}
                selected={periodKey === k}
                onPress={() => setPeriodKey(k)}
              />
            ))}
            {(currencies ?? []).length > 1
              ? currencies!.map(c => (
                  <Chip
                    key={c}
                    label={c}
                    selected={currency === c}
                    onPress={() => setPicked(c)}
                  />
                ))
              : null}
          </ScrollView>

          {!r ? null : empty ? (
            <EmptyState
              title={t('reports.emptyTitle')}
              body={t('reports.emptyBody')}
            />
          ) : (
            <>
              <View style={styles.hero}>
                <Text variant="captionMedium" tone="secondary">
                  {t('reports.profit')}
                </Text>
                <Text
                  variant="display"
                  tabular
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  testID="report-profit"
                >
                  {money(r.profit)}
                </Text>
                {delta !== null ? (
                  <Text
                    variant="callout"
                    tone={delta >= 0 ? 'secondary' : 'danger'}
                    tabular
                  >
                    {t('reports.vsBefore', {
                      change: new Intl.NumberFormat(f.locale, {
                        style: 'percent',
                        maximumFractionDigits: 0,
                        signDisplay: 'exceptZero',
                      }).format(delta),
                    })}
                  </Text>
                ) : null}
              </View>

              <View style={styles.kpis}>
                {(
                  [
                    ['income', r.income],
                    ['expenses', r.expenses],
                    ['mileage', r.mileage],
                  ] as const
                ).map(([k, v]) => (
                  <Surface key={k} style={styles.kpi}>
                    <Text variant="caption" tone="secondary" numberOfLines={1}>
                      {t(`reports.${k}`)}
                    </Text>
                    <Text
                      variant="headline"
                      tabular
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {money(v)}
                    </Text>
                  </Surface>
                ))}
              </View>

              <SectionHeader title={t('reports.byMonth')} />
              <Surface style={styles.card}>
                <MonthBars months={r.months} locale={f.locale} format={money} />
                <View style={styles.legendRow}>
                  <View
                    style={[
                      styles.swatch,
                      { backgroundColor: theme.colors.accent.solid },
                    ]}
                  />
                  <Text variant="caption" tone="secondary">
                    {t('reports.income')}
                  </Text>
                  <View
                    style={[
                      styles.swatch,
                      { backgroundColor: theme.colors.border.strong },
                    ]}
                  />
                  <Text variant="caption" tone="secondary">
                    {t('reports.expenses')}
                  </Text>
                </View>
              </Surface>

              {r.byClient.length ? (
                <>
                  <SectionHeader title={t('reports.byClient')} />
                  <Surface style={styles.card}>
                    <RankBars
                      rows={r.byClient.slice(0, 6).map(c => ({
                        key: c.clientId ?? '-',
                        label: c.name ?? t('document.noClient'),
                        value: c.income,
                        display: money(c.income),
                      }))}
                    />
                  </Surface>
                </>
              ) : null}

              <SectionHeader title={t('reports.agingTitle')} />
              <Surface style={styles.card}>
                <Text variant="headline" tabular>
                  {money(r.outstanding)}
                </Text>
                <StackBar
                  segments={(
                    [
                      r.aging.current,
                      r.aging.days1to30,
                      r.aging.days31to60,
                      r.aging.days61to90,
                      r.aging.days90plus,
                    ] as number[]
                  ).map((v, i) => ({
                    key: String(i),
                    label: agingLabels[i]!,
                    value: v,
                    display: money(v),
                    color: agingColors[i]!,
                  }))}
                />
              </Surface>

              {r.taxCollected.length ? (
                <>
                  <SectionHeader title={t('reports.taxCollected')} />
                  <Surface style={styles.list}>
                    {r.taxCollected.map((tx, i) => (
                      <View key={`${tx.name}-${tx.rate}-${tx.withholding}`}>
                        {i > 0 ? <Divider inset={16} /> : null}
                        <ListRow
                          title={`${tx.name} ${pct(tx.rate)}`}
                          subtitle={
                            tx.withholding ? t('reports.withheld') : undefined
                          }
                          value={money(tx.amount)}
                        />
                      </View>
                    ))}
                  </Surface>
                </>
              ) : null}

              {r.expensesByCategory.length ? (
                <>
                  <SectionHeader title={t('reports.byCategory')} />
                  <Surface style={styles.card}>
                    <RankBars
                      rows={r.expensesByCategory.map(c => ({
                        key: c.category,
                        label: isExpenseCategory(c.category)
                          ? t(`expenseCategory.${c.category}`)
                          : c.category,
                        value: c.amount,
                        display: money(c.amount),
                      }))}
                    />
                  </Surface>
                </>
              ) : null}

              <Text variant="caption" tone="tertiary" style={styles.note}>
                {t('reports.cashBasis', {
                  invoiced: money(r.invoiced),
                  mileage: t('reports.mileageDistance', {
                    distance: new Intl.NumberFormat(f.locale, {
                      maximumFractionDigits: 1,
                    }).format(r.mileageDistance / 1000),
                  }),
                })}
              </Text>
            </>
          )}
        </ScrollView>
      )}

      <Sheet ref={exportSheet} title={t('reports.exportTitle')}>
        <ListRow
          testID="export-pdf"
          leadingIcon={FileText}
          title={t('reports.export.pdf')}
          subtitle={t('reports.export.pdfHint')}
          onPress={() => run(exportPdf)}
        />
        {EXPORT_KINDS.map((k: ExportKind) => (
          <View key={k}>
            <Divider inset={52} />
            <ListRow
              testID={`export-${k}`}
              leadingIcon={FileSpreadsheet}
              title={t(`reports.export.${k}`)}
              subtitle={t('reports.export.csvHint')}
              onPress={() =>
                run(() => exportCsv({ kind: k, period, locale: f.locale, t }))
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
    maxWidth: theme.size.contentMax,
    width: '100%',
    alignSelf: 'center',
  },
  chips: {
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingVertical: theme.space[2],
  },
  hero: {
    gap: theme.space[1],
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[4],
    paddingBottom: theme.space[4],
  },
  kpis: {
    flexDirection: 'row',
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
  },
  kpi: {
    flex: 1,
    padding: theme.space[3],
    gap: 2,
  },
  card: {
    marginHorizontal: theme.size.gutter,
    padding: theme.space[4],
    gap: theme.space[3],
  },
  list: {
    marginHorizontal: theme.size.gutter,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[1.5],
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginLeft: theme.space[2],
  },
  note: {
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[6],
  },
}));
