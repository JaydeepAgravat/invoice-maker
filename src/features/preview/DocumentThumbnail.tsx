import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, PixelRatio, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, Skeleton, Text, Touchable } from '@/ui/primitives';

import { usePdfPreview } from './usePdfPreview';

const THUMB_WIDTH = 92;

/** First page of the real PDF, as a card that opens the full preview. */
export function DocumentThumbnail({
  id,
  onPress,
}: {
  id: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const preview = usePdfPreview(
    id,
    {},
    Math.round(THUMB_WIDTH * PixelRatio.get() * 1.5),
  );
  const page = preview.pages?.[0];
  const m = preview.model;
  const ratio = page ? page.height / page.width : 297 / 210;
  const pages = preview.pages?.length ?? 0;

  return (
    <Touchable
      testID="detail-preview"
      feedback="highlight"
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={t('preview.open')}
    >
      <View style={[styles.thumb, { height: THUMB_WIDTH * ratio }]}>
        {page ? (
          <Image source={{ uri: page.uri }} style={styles.image} fadeDuration={120} />
        ) : (
          <View style={styles.placeholder}>
            <Skeleton width="60%" height={6} />
            <Skeleton width="100%" height={4} />
            <Skeleton width="100%" height={4} />
          </View>
        )}
      </View>
      <View style={styles.text}>
        <Text variant="bodyMedium">{t('preview.open')}</Text>
        <Text variant="caption" tone="secondary">
          {m
            ? [
                t(`preview.template.${m.template}`),
                m.paper === 'A4' ? 'A4' : t('preview.letter'),
                pages > 1 ? t('preview.pages', { count: pages }) : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : ' '}
        </Text>
      </View>
      <Icon icon={ChevronRight} size={18} tone="tertiary" />
    </Touchable>
  );
}

const styles = StyleSheet.create(theme => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[4],
    padding: theme.space[3],
    marginHorizontal: theme.size.gutter,
    marginBottom: theme.space[4],
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.bg.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
  },
  thumb: {
    width: THUMB_WIDTH,
    borderRadius: theme.radius.xs,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.default,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    padding: theme.space[2],
    gap: theme.space[1],
  },
  text: {
    flex: 1,
    gap: 2,
  },
}));
