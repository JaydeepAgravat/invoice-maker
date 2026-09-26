import { Eraser, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedProps,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { clock, getDatabase } from '@/data/database';
import { mutate } from '@/data/live';
import { setClientSignature } from '@/data/repositories/attachments';
import {
  applyAction,
  getDocument,
  statusOf,
  type DocumentRecord,
} from '@/data/repositories/documents';
import { updateProfile } from '@/data/repositories/profile';
import { useProfile } from '@/data/ProfileProvider';
import { allowedActions } from '@/domain/status';
import { docTypeKey } from '@/features/documents/statusMeta';
import { useFormat } from '@/lib/format';
import NativeMedia from '@/specs/NativeMedia';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import { Button, IconButton, Text, TextField } from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const INK = '#1C2024';
const STROKE = 2.6;

/**
 * Signature pad. Strokes are drawn on the UI thread (smoothed with
 * quadratic curves through midpoints) and saved as a small vector SVG,
 * cropped to the ink, so it prints crisply at any size.
 */
export function SignatureScreen({
  navigation,
  route,
}: RootScreenProps<'Signature'>) {
  const { documentId } = route.params;
  const isBusiness = !documentId;
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const f = useFormat();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [name, setName] = useState('');
  const [hasInk, setHasInk] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [saving, setSaving] = useState(false);

  const d = useSharedValue('');
  const last = useSharedValue({ x: 0, y: 0 });
  const bounds = useSharedValue({ x1: 1e9, y1: 1e9, x2: -1e9, y2: -1e9 });

  useEffect(() => {
    if (documentId) {
      getDatabase().then(db => getDocument(db, documentId).then(setDoc));
    }
  }, [documentId]);

  const grow = (x: number, y: number) => {
    'worklet';
    const b = bounds.value;
    bounds.value = {
      x1: Math.min(b.x1, x),
      y1: Math.min(b.y1, y),
      x2: Math.max(b.x2, x),
      y2: Math.max(b.y2, y),
    };
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .onBegin(e => {
      const x = Math.round(e.x * 10) / 10;
      const y = Math.round(e.y * 10) / 10;
      d.value = `${d.value} M${x} ${y} L${x + 0.1} ${y + 0.1}`;
      last.value = { x, y };
      grow(x, y);
    })
    .onUpdate(e => {
      const x = Math.round(e.x * 10) / 10;
      const y = Math.round(e.y * 10) / 10;
      const p = last.value;
      const mx = Math.round(((p.x + x) / 2) * 10) / 10;
      const my = Math.round(((p.y + y) / 2) * 10) / 10;
      d.value = `${d.value} Q${p.x} ${p.y} ${mx} ${my}`;
      last.value = { x, y };
      grow(x, y);
    })
    .onFinalize(() => {
      const p = last.value;
      d.value = `${d.value} L${p.x} ${p.y}`;
      scheduleOnRN(setHasInk, true);
    });

  const animatedProps = useAnimatedProps(() => ({ d: d.value || 'M0 0' }));

  const clear = () => {
    d.value = '';
    bounds.value = { x1: 1e9, y1: 1e9, x2: -1e9, y2: -1e9 };
    setHasInk(false);
  };

  const save = async () => {
    if (!hasInk || saving) {
      return;
    }
    setSaving(true);
    try {
      const b = bounds.value;
      const pad = 8;
      const x = Math.max(0, Math.floor(b.x1 - pad));
      const y = Math.max(0, Math.floor(b.y1 - pad));
      const w = Math.ceil(b.x2 - b.x1 + pad * 2);
      const h = Math.ceil(b.y2 - b.y1 + pad * 2);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}"><path d="${d.value.trim()}" fill="none" stroke="${INK}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      const file = `${documentId ?? 'business'}-${Date.now()}.svg`;
      const path = await NativeMedia!.writeFile('signatures', file, svg);

      if (isBusiness) {
        const previous = profile.signaturePath;
        await mutate(tx => updateProfile(tx, clock, { signaturePath: path }));
        if (previous) {
          NativeMedia?.deleteFile(previous);
        }
        toast.show({ message: t('signature.businessSaved'), tone: 'success', haptic: 'success' });
      } else if (doc) {
        await mutate(async tx => {
          await setClientSignature(tx, clock, doc.id, { path, name });
          // Signing is how the client accepts an estimate or receives goods.
          const status = statusOf(doc, clock.today());
          const allowed = allowedActions(doc.type, status);
          if (allowed.includes('ACCEPT')) {
            await applyAction(tx, clock, doc.id, 'ACCEPT');
          } else if (allowed.includes('MARK_DELIVERED')) {
            await applyAction(tx, clock, doc.id, 'MARK_DELIVERED');
          }
        });
        toast.show({
          message: name.trim()
            ? t('signature.signedBy', { name: name.trim() })
            : t('signature.signed'),
          tone: 'success',
          haptic: 'success',
        });
      }
      navigation.goBack();
    } catch {
      toast.show({ message: t('signature.failed'), tone: 'danger' });
      setSaving(false);
    }
  };

  const subtitle = doc
    ? [t(docTypeKey(doc.type)), doc.number, f.money(doc.totals.total, doc.currency)]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={isBusiness ? t('signature.businessTitle') : t('signature.title')}
        left={
          <IconButton
            icon={X}
            label={t('common.close')}
            onPress={() => navigation.goBack()}
          />
        }
        right={
          <IconButton
            testID="signature-clear"
            icon={Eraser}
            label={t('signature.clear')}
            disabled={!hasInk}
            onPress={clear}
          />
        }
      />
      {subtitle ? (
        <Text variant="callout" tone="secondary" style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}

      <View
        style={styles.pad}
        onLayout={(e: LayoutChangeEvent) =>
          setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }
      >
        <GestureDetector gesture={pan}>
          <View style={StyleSheet.absoluteFill} testID="signature-pad" collapsable={false}>
            <Svg width={size.w} height={size.h}>
              <Line
                x1={24}
                x2={size.w - 24}
                y1={size.h * 0.72}
                y2={size.h * 0.72}
                stroke={theme.colors.border.default}
                strokeWidth={1}
                strokeDasharray="4 5"
              />
              <AnimatedPath
                animatedProps={animatedProps}
                fill="none"
                stroke={INK}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </GestureDetector>
        {!hasInk ? (
          <Text variant="callout" tone="tertiary" style={styles.hint} pointerEvents="none">
            {t('signature.hint')}
          </Text>
        ) : null}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {!isBusiness ? (
          <TextField
            testID="signature-name"
            label={t('signature.name')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        ) : null}
        <Text variant="caption" tone="tertiary">
          {isBusiness
            ? t('signature.businessHint')
            : t('signature.consent', { date: f.date(clock.today()) })}
        </Text>
        <Button
          testID="signature-save"
          variant="primary"
          size="lg"
          fullWidth
          disabled={!hasInk || saving}
          label={
            isBusiness
              ? t('common.save')
              : doc?.type === 'DELIVERY_NOTE'
              ? t('signature.confirmReceived')
              : t('signature.accept')
          }
          onPress={save}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.app,
  },
  subtitle: {
    paddingHorizontal: theme.size.gutter,
    paddingBottom: theme.space[3],
  },
  pad: {
    flex: 1,
    marginHorizontal: theme.size.gutter,
    borderRadius: theme.radius.xl,
    backgroundColor: '#FFFFFF',
    borderWidth: theme.stroke.thin,
    borderColor: theme.colors.border.default,
    overflow: 'hidden',
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
  },
  footer: {
    gap: theme.space[3],
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[4],
  },
}));
