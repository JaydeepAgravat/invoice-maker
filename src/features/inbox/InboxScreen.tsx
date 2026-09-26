import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { Menu, Search } from 'lucide-react-native';

import type { DrawerProps, InboxView } from '@/app/navigation';
import { NewDocumentSheet } from '@/features/documents/NewDocumentSheet';
import { EmptyDocuments } from '@/ui/illustrations';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import { Chip, EmptyState, IconButton, type SheetRef } from '@/ui/primitives';
import { breakpoints } from '@/ui/theme';
import { toast } from '@/ui/toast/store';

import { NewButton } from './NewButton';

const VIEWS: readonly InboxView[] = [
  'all',
  'drafts',
  'unpaid',
  'overdue',
  'estimates',
  'paid',
];

export function InboxScreen({ navigation, route }: DrawerProps<'Inbox'>) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const permanentDrawer = width >= breakpoints.lg;
  const view = route.params?.view ?? 'all';
  const sheet = useRef<SheetRef>(null);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t('nav.inbox')}
        scrollY={scrollY}
        left={
          permanentDrawer ? undefined : (
            <IconButton
              icon={Menu}
              label={t('common.openMenu')}
              onPress={navigation.openDrawer}
            />
          )
        }
        right={
          <IconButton
            icon={Search}
            label={t('common.search')}
            onPress={() => toast.show({ message: t('common.comingSoon') })}
          />
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsBar}
        accessibilityRole="tablist"
      >
        {VIEWS.map(v => (
          <Chip
            key={v}
            label={t(`views.${v}`)}
            selected={v === view}
            onPress={() => navigation.setParams({ view: v })}
          />
        ))}
      </ScrollView>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
      >
        <EmptyState
          illustration={<EmptyDocuments />}
          title={t('inbox.emptyTitle')}
          body={t('inbox.emptyBody')}
          action={{
            label: t('inbox.emptyAction'),
            onPress: () => sheet.current?.present(),
          }}
        />
      </Animated.ScrollView>

      <NewButton onPress={() => sheet.current?.present()} />
      <NewDocumentSheet ref={sheet} />
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.app,
  },
  chipsBar: {
    flexGrow: 0,
  },
  chips: {
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingVertical: theme.space[2],
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 120,
  },
}));
