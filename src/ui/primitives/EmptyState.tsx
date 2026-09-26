import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, type ButtonProps } from './Button';
import { Text } from './Text';

/**
 * One illustration, one sentence, one action. Empty states teach the next step
 * instead of just saying "nothing here".
 */
export function EmptyState({
  illustration,
  title,
  body,
  action,
}: {
  illustration?: React.ReactNode;
  title: string;
  body?: string;
  action?: Pick<ButtonProps, 'label' | 'onPress' | 'leadingIcon'>;
}) {
  return (
    <View style={styles.container}>
      {illustration ? <View style={styles.art}>{illustration}</View> : null}
      <Text variant="headline" align="center">
        {title}
      </Text>
      {body ? (
        <Text
          variant="callout"
          tone="secondary"
          align="center"
          style={styles.body}
        >
          {body}
        </Text>
      ) : null}
      {action ? (
        <View style={styles.action}>
          <Button variant="primary" {...action} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    alignItems: 'center',
    paddingHorizontal: theme.space[10],
    paddingVertical: theme.space[12],
    gap: theme.space[2],
  },
  art: {
    marginBottom: theme.space[4],
  },
  body: {
    maxWidth: 300,
  },
  action: {
    marginTop: theme.space[4],
  },
}));
