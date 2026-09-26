import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

/** Hairline separator. `inset` aligns it with row text (after a leading icon). */
export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.line, { marginLeft: inset }]} />;
}

const styles = StyleSheet.create(theme => ({
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border.subtle,
  },
}));
