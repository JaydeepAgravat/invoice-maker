import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { PRO_TEMPLATES, TEMPLATE_IDS, type TemplateId } from '@/pdf/model';
import {
  Chip,
  Icon,
  SegmentedControl,
  Text,
  Touchable,
} from '@/ui/primitives';

/** Curated accents that print well and pass contrast with their ink. */
export const ACCENTS = [
  '#3E63DD',
  '#6E56CF',
  '#E93D82',
  '#F76B15',
  '#FFC53D',
  '#30A46C',
  '#12A594',
  '#1C2024',
] as const;

export type AppearanceValue = {
  template: TemplateId;
  accent: string;
  paper: 'A4' | 'LETTER';
};

export function AppearanceBar({
  value,
  isPro,
  onChange,
}: {
  value: AppearanceValue;
  isPro: boolean;
  onChange: (patch: Partial<AppearanceValue>) => void;
}) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {TEMPLATE_IDS.map(id => (
          <Chip
            key={id}
            label={
              PRO_TEMPLATES.includes(id) && !isPro
                ? `${t(`preview.template.${id}`)} · Pro`
                : t(`preview.template.${id}`)
            }
            selected={value.template === id}
            onPress={() => onChange({ template: id })}
          />
        ))}
      </ScrollView>
      <View style={styles.bottom}>
        <View style={styles.swatches} accessibilityRole="radiogroup">
          {ACCENTS.map(color => {
            const selected = value.accent.toUpperCase() === color;
            return (
              <Touchable
                key={color}
                feedback="scale"
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t('preview.accent')}
                hitSlop={4}
                haptic="selection"
                onPress={() => onChange({ accent: color })}
                style={[
                  styles.swatch,
                  { backgroundColor: color },
                  selected && {
                    borderColor: theme.colors.bg.elevated,
                    outlineColor: color,
                  },
                  selected && styles.swatchSelected,
                ]}
              >
                {selected ? (
                  <Icon
                    icon={Check}
                    size={14}
                    color={color === '#FFC53D' ? '#111113' : '#FFFFFF'}
                    strokeWidth={2.5}
                  />
                ) : null}
              </Touchable>
            );
          })}
        </View>
      </View>
      <View style={styles.paper}>
        <Text variant="label" tone="secondary">
          {t('preview.paper')}
        </Text>
        <View style={styles.segment}>
          <SegmentedControl
            segments={[
              { value: 'A4', label: 'A4' },
              { value: 'LETTER', label: t('preview.letter') },
            ]}
            value={value.paper}
            onChange={paper => onChange({ paper })}
            accessibilityLabel={t('preview.paper')}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    gap: theme.space[3],
    paddingVertical: theme.space[3],
  },
  row: {
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
  },
  bottom: {
    paddingHorizontal: theme.size.gutter,
  },
  swatches: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    // Keeps dark swatches visible on the dark theme.
    borderColor: theme.colors.border.subtle,
  },
  swatchSelected: {
    outlineWidth: 2,
    outlineStyle: 'solid',
  },
  paper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space[4],
    paddingHorizontal: theme.size.gutter,
  },
  segment: {
    width: 180,
  },
}));
