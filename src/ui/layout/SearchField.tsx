import { Search, X } from 'lucide-react-native';
import { TextInput, View, type TextInputProps } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon, IconButton } from '@/ui/primitives';

/** Inline search with a clear button. */
export function SearchField({
  value,
  onChangeText,
  ...rest
}: TextInputProps & { value: string; onChangeText: (v: string) => void }) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.box}>
      <Icon icon={Search} size={18} tone="tertiary" />
      <TextInput
        {...rest}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={theme.colors.text.tertiary}
        selectionColor={theme.colors.accent.solid}
        style={styles.input}
        autoCorrect={false}
        returnKeyType="search"
        maxFontSizeMultiplier={1.6}
      />
      {value ? (
        <IconButton
          icon={X}
          size="sm"
          label="Clear"
          onPress={() => onChangeText('')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    height: 44,
    marginHorizontal: theme.size.gutter,
    marginVertical: theme.space[2],
    paddingLeft: theme.space[3],
    paddingRight: theme.space[1],
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.hover,
  },
  input: {
    flex: 1,
    ...theme.type.body,
    lineHeight: undefined,
    color: theme.colors.text.primary,
    paddingVertical: 0,
  },
}));
