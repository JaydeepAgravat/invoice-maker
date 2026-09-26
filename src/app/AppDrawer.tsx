import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import {
  Car,
  ChartColumn,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  ClipboardList,
  FilePen,
  Layers,
  Package,
  Receipt,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { Avatar, Icon, Text, Touchable, type IconTone } from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

import type { DrawerParamList, InboxView } from './navigation';

const VIEWS: ReadonlyArray<{
  view: InboxView;
  icon: LucideIcon;
  tone?: IconTone;
}> = [
  { view: 'all', icon: Layers },
  { view: 'drafts', icon: FilePen },
  { view: 'unpaid', icon: CircleDashed },
  { view: 'overdue', icon: CircleAlert, tone: 'danger' },
  { view: 'estimates', icon: ClipboardList },
  { view: 'paid', icon: CircleCheck, tone: 'success' },
];

type Destination = Exclude<keyof DrawerParamList, 'Inbox' | 'Settings'>;

const WORKSPACE: ReadonlyArray<{ route: Destination; icon: LucideIcon }> = [
  { route: 'Clients', icon: Users },
  { route: 'Items', icon: Package },
];

const MONEY: ReadonlyArray<{ route: Destination; icon: LucideIcon }> = [
  { route: 'Expenses', icon: Receipt },
  { route: 'Mileage', icon: Car },
  { route: 'Reports', icon: ChartColumn },
];

function NavItem({
  label,
  icon,
  tone,
  active,
  count,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  tone?: IconTone;
  active: boolean;
  count?: number;
  onPress: () => void;
}) {
  return (
    <Touchable
      onPress={onPress}
      feedback="highlight"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={count ? `${label}, ${count}` : label}
      style={[styles.item, active && styles.itemActive]}
    >
      <Icon
        icon={icon}
        size={18}
        tone={active ? 'primary' : tone ?? 'secondary'}
      />
      <Text
        variant="calloutMedium"
        tone={active ? 'primary' : 'secondary'}
        style={styles.itemLabel}
        numberOfLines={1}
      >
        {label}
      </Text>
      {count ? (
        <Text variant="caption" tone="tertiary" tabular>
          {count}
        </Text>
      ) : null}
    </Touchable>
  );
}

export function AppDrawer({ state, navigation }: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index];
  const currentView =
    current?.name === 'Inbox'
      ? (current.params as DrawerParamList['Inbox'])?.view ?? 'all'
      : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Avatar name="Your Business" size={28} />
        <Text variant="bodyMedium" numberOfLines={1} style={styles.flex}>
          Your Business
        </Text>
      </View>

      <Touchable
        feedback="highlight"
        onPress={() => toast.show({ message: t('common.comingSoon') })}
        accessibilityRole="search"
        accessibilityLabel={t('common.search')}
        style={styles.search}
      >
        <Icon icon={Search} size={16} tone="tertiary" />
        <Text variant="callout" tone="tertiary">
          {t('common.search')}
        </Text>
      </Touchable>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="overline" tone="tertiary" style={styles.group}>
          {t('nav.views')}
        </Text>
        {VIEWS.map(v => (
          <NavItem
            key={v.view}
            label={t(`views.${v.view}`)}
            icon={v.icon}
            tone={v.tone}
            active={currentView === v.view}
            onPress={() => navigation.navigate('Inbox', { view: v.view })}
          />
        ))}

        <Text variant="overline" tone="tertiary" style={styles.group}>
          {t('nav.workspace')}
        </Text>
        {WORKSPACE.map(d => (
          <NavItem
            key={d.route}
            label={t(`nav.${d.route.toLowerCase() as 'clients' | 'items'}`)}
            icon={d.icon}
            active={current?.name === d.route}
            onPress={() => navigation.navigate(d.route)}
          />
        ))}

        <Text variant="overline" tone="tertiary" style={styles.group}>
          {t('nav.money')}
        </Text>
        {MONEY.map(d => (
          <NavItem
            key={d.route}
            label={t(
              `nav.${
                d.route.toLowerCase() as 'expenses' | 'mileage' | 'reports'
              }`,
            )}
            icon={d.icon}
            active={current?.name === d.route}
            onPress={() => navigation.navigate(d.route)}
          />
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <NavItem
          label={t('nav.settings')}
          icon={Settings}
          active={current?.name === 'Settings'}
          onPress={() => navigation.navigate('Settings')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg.subtle,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    height: 56,
    paddingHorizontal: theme.space[4],
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    height: 40,
    marginHorizontal: theme.space[3],
    marginBottom: theme.space[2],
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radius.md,
    borderWidth: theme.stroke.thin,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.surface,
  },
  scroll: {
    paddingHorizontal: theme.space[2],
    paddingBottom: theme.space[4],
  },
  group: {
    paddingHorizontal: theme.space[3],
    paddingTop: theme.space[5],
    paddingBottom: theme.space[1.5],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    minHeight: 44,
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radius.md,
  },
  itemActive: {
    backgroundColor: theme.colors.bg.pressed,
  },
  itemLabel: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: theme.space[2],
    paddingTop: theme.space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.subtle,
  },
}));
