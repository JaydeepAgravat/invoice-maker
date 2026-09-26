import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from './Text';

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.row} accessibilityRole="header">
      <Text variant="overline" tone="tertiary">
        {title}
      </Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[6],
    paddingBottom: theme.space[2],
  },
}));
