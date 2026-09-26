import { Menu } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View, useWindowDimensions } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { DrawerParamList } from '@/app/navigation';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import { EmptyState, IconButton } from '@/ui/primitives';
import { breakpoints } from '@/ui/theme';
import type { DrawerNavigationProp } from '@react-navigation/drawer';

/** Temporary screen for sections built in later phases. */
export function PlaceholderScreen({
  title,
  navigation,
}: {
  title: string;
  navigation: DrawerNavigationProp<DrawerParamList>;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={title}
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
      <View style={styles.body}>
        <EmptyState title={title} body={t('common.comingSoon')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.app,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
}));
