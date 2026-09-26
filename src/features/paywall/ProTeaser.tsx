import { Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useProGate, type ProFeature } from '@/billing/useProGate';
import { Button, Icon, Text } from '@/ui/primitives';

/** Calm placeholder for a Pro-only screen: what it does and one way in. */
export function ProTeaser({
  feature,
  title,
  body,
}: {
  feature: ProFeature;
  title: string;
  body: string;
}) {
  const { t } = useTranslation();
  const { gate } = useProGate();
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <Icon icon={Sparkles} size={22} tone="accent" />
      </View>
      <Text variant="title2" style={styles.center}>
        {title}
      </Text>
      <Text variant="callout" tone="secondary" style={styles.center}>
        {body}
      </Text>
      <View style={styles.button}>
        <Button
          testID={`teaser-${feature}`}
          variant="primary"
          label={t('paywall.see')}
          onPress={() => gate(feature)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[2],
    paddingHorizontal: theme.space[8],
    paddingBottom: theme.space[16],
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent.subtle,
    marginBottom: theme.space[2],
  },
  center: {
    textAlign: 'center',
  },
  button: {
    marginTop: theme.space[4],
  },
}));
