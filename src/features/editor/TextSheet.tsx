import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useEffect, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, Sheet, type SheetRef } from '@/ui/primitives';

/** Edit a longer text (notes, terms, reference) in a sheet. */
export function TextSheet({
  ref,
  title,
  value,
  placeholder,
  multiline = true,
  onSave,
}: {
  ref?: Ref<SheetRef>;
  title: string;
  value: string | null;
  placeholder?: string;
  multiline?: boolean;
  onSave: (value: string | null) => void;
}) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [text, setText] = useState(value ?? '');
  useEffect(() => setText(value ?? ''), [value]);

  const done = () => {
    onSave(text.trim() ? text.trim() : null);
    if (ref && typeof ref === 'object' && ref.current) {
      ref.current.dismiss();
    }
  };

  return (
    <Sheet
      ref={ref}
      title={title}
      headerRight={
        <Button
          variant="primary"
          size="sm"
          label={t('common.done')}
          onPress={done}
        />
      }
    >
      <BottomSheetTextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.text.tertiary}
        multiline={multiline}
        autoFocus
        style={[styles.input, multiline && styles.multiline]}
        textAlignVertical="top"
        maxFontSizeMultiplier={1.6}
        onSubmitEditing={multiline ? undefined : done}
        accessibilityLabel={title}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create(theme => ({
  input: {
    ...theme.type.body,
    lineHeight: undefined,
    color: theme.colors.text.primary,
    marginHorizontal: theme.size.gutter,
    padding: theme.space[3],
    borderRadius: theme.radius.md,
    borderWidth: theme.stroke.thin,
    borderColor: theme.colors.border.default,
    backgroundColor: theme.colors.bg.surface,
  },
  multiline: {
    minHeight: 140,
    maxHeight: 280,
  },
}));
