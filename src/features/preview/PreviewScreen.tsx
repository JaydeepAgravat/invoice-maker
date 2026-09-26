import { Send, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelRatio, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { useIsPro } from '@/billing/entitlement';
import { clock, mutate, useLiveQuery } from '@/data/live';
import { useProfile } from '@/data/ProfileProvider';
import { getDocument, setAppearance } from '@/data/repositories/documents';
import { updateProfile } from '@/data/repositories/profile';
import { isTemplateId } from '@/pdf/model';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import { Button, IconButton, Text, Touchable } from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

import { ShareSheet, type ShareSheetRef } from '../share/ShareSheet';

import { AppearanceBar, ACCENTS, type AppearanceValue } from './AppearanceBar';
import { PdfPages } from './PdfPages';
import { usePdfPreview } from './usePdfPreview';

/**
 * The document exactly as the client will receive it: real PDF pages from
 * the same engine that writes the file, updated as details change. Template,
 * colour and paper can be changed right here.
 */
export function PreviewScreen({
  navigation,
  route,
}: RootScreenProps<'DocumentPreview'>) {
  const { id } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile } = useProfile();
  const pro = useIsPro();
  const share = useRef<ShareSheetRef>(null);

  const { data: doc } = useLiveQuery(db => getDocument(db, id), [id]);
  const [local, setLocal] = useState<Partial<AppearanceValue>>({});

  const value: AppearanceValue = {
    template:
      local.template ??
      (isTemplateId(doc?.templateId) ? doc!.templateId : null) ??
      (isTemplateId(profile.templateId) ? profile.templateId : 'classic'),
    accent: local.accent ?? doc?.accentColor ?? profile.accentColor ?? ACCENTS[0],
    paper: local.paper ?? doc?.paperSize ?? profile.paperSize,
  };

  const pixels = Math.min(
    1600,
    Math.round(Math.min(width, 720) * PixelRatio.get()),
  );
  const preview = usePdfPreview(
    id,
    { template: value.template, accentColor: value.accent, paperSize: value.paper },
    pixels,
  );

  const change = async (patch: Partial<AppearanceValue>) => {
    setLocal(l => ({ ...l, ...patch }));
    await mutate(tx =>
      setAppearance(tx, clock, id, {
        templateId: patch.template,
        accentColor: patch.accent,
        paperSize: patch.paper,
      }),
    );
  };

  const differsFromDefault =
    value.template !== profile.templateId ||
    value.accent !== (profile.accentColor ?? ACCENTS[0]) ||
    value.paper !== profile.paperSize;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t('preview.title')}
        left={
          <IconButton
            testID="preview-close"
            icon={X}
            label={t('common.close')}
            onPress={() => navigation.goBack()}
          />
        }
        right={
          <Button
            testID="preview-send"
            variant="primary"
            size="sm"
            leadingIcon={Send}
            label={t('share.send')}
            onPress={() => share.current?.present(id)}
          />
        }
      />
      <View style={styles.flex}>
        <PdfPages
          pages={preview.pages}
          paper={value.paper}
          pageLabel={(n, total) => t('preview.page', { n, total })}
        />
        {preview.rendering && preview.pages ? (
          <Animated.View
            entering={FadeIn.delay(250)}
            exiting={FadeOut}
            style={styles.updating}
            pointerEvents="none"
          >
            <Text variant="captionMedium" tone="secondary">
              {t('preview.updating')}
            </Text>
          </Animated.View>
        ) : null}
        {preview.error ? (
          <View style={styles.updating}>
            <Text variant="captionMedium" tone="danger">
              {t('preview.failed')}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.panel, { paddingBottom: insets.bottom }]}>
        <AppearanceBar value={value} isPro={pro} onChange={change} />
        <View style={styles.defaultRow}>
          {differsFromDefault ? (
            <Touchable
              testID="preview-make-default"
              feedback="highlight"
              style={styles.defaultButton}
              accessibilityRole="button"
              onPress={async () => {
                await mutate(tx =>
                  updateProfile(tx, clock, {
                    templateId: value.template,
                    accentColor: value.accent,
                    paperSize: value.paper,
                  }),
                );
                toast.show({ message: t('preview.defaultSaved'), tone: 'success' });
              }}
            >
              <Text variant="captionMedium" tone="accent">
                {t('preview.makeDefault')}
              </Text>
            </Touchable>
          ) : (
            <Text variant="caption" tone="tertiary">
              {t('preview.isDefault')}
            </Text>
          )}
        </View>
      </View>
      <ShareSheet
        ref={share}
        onShared={() => {
          navigation.popToTop();
          navigation.navigate('DocumentDetail', { id });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.subtle,
  },
  flex: {
    flex: 1,
  },
  updating: {
    position: 'absolute',
    top: theme.space[3],
    alignSelf: 'center',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bg.elevated,
    ...theme.elevation.raised,
  },
  panel: {
    backgroundColor: theme.colors.bg.app,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.subtle,
  },
  defaultRow: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -theme.space[1],
  },
  defaultButton: {
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1.5],
    borderRadius: theme.radius.full,
  },
}));
