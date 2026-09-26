import { useNavigation } from '@react-navigation/native';
import { CloudUpload } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { dismissNudge, shouldNudge } from '@/backup/service';
import { useLiveQuery } from '@/data/live';
import { Button, Icon, Text } from '@/ui/primitives';

/** A quiet card that appears only when unprotected work has piled up. */
export function BackupNudge() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [hidden, setHidden] = useState(false);
  const { data: show } = useLiveQuery(() => shouldNudge(), []);

  if (!show || hidden) {
    return null;
  }
  return (
    <Animated.View exiting={FadeOut} style={styles.card}>
      <View style={styles.icon}>
        <Icon icon={CloudUpload} size={18} tone="accent" />
      </View>
      <View style={styles.text}>
        <Text variant="bodyMedium">{t('backup.nudgeTitle')}</Text>
        <Text variant="caption" tone="secondary">
          {t('backup.nudgeBody')}
        </Text>
        <View style={styles.actions}>
          <Button
            testID="nudge-backup"
            variant="primary"
            size="sm"
            label={t('backup.nudgeAction')}
            onPress={() => navigation.navigate('Backup')}
          />
          <Button
            variant="ghost"
            size="sm"
            label={t('backup.nudgeLater')}
            onPress={() => {
              dismissNudge();
              setHidden(true);
            }}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create(theme => ({
  card: {
    flexDirection: 'row',
    gap: theme.space[3],
    marginHorizontal: theme.size.gutter,
    marginTop: theme.space[2],
    padding: theme.space[4],
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.bg.surface,
    borderWidth: theme.stroke.thin,
    borderColor: theme.colors.accent.border,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent.subtle,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.space[2],
    marginTop: theme.space[2],
  },
}));
