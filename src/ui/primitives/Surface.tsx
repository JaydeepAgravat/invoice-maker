import { View, type ViewProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

/** A bordered, flat container. Structure comes from the hairline, not a shadow. */
export function Surface({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.surface, style]} />;
}

const styles = StyleSheet.create(theme => ({
  surface: {
    backgroundColor: theme.colors.bg.surface,
    borderRadius: theme.radius.lg,
    borderWidth: theme.stroke.thin,
    borderColor: theme.colors.border.subtle,
    overflow: 'hidden',
  },
}));
