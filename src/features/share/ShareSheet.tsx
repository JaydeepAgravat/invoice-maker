import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import {
  CheckCheck,
  Download,
  Mail,
  MessageCircle,
  MessageSquareText,
  Printer,
  Share2,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { clock, mutate } from '@/data/live';
import { getDatabase } from '@/data/database';
import { getClient } from '@/data/repositories/clients';
import {
  getDocument,
  issueDocument,
  recordShare,
  type DocumentRecord,
} from '@/data/repositories/documents';
import { generatePdf, printDocument, renderDocument } from '@/pdf/generate';
import { shareMessage } from '@/pdf/messages';
import NativeShare from '@/specs/NativeShare';
import { Button, Icon, Sheet, Text, Touchable, type SheetRef } from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

type Channel =
  | 'whatsapp'
  | 'whatsapp_business'
  | 'email'
  | 'sms'
  | 'print'
  | 'save'
  | 'any';

const WHATSAPP_GREEN = '#25D366';

/** Names that are clearly businesses, in the five supported markets. */
const COMPANY_SUFFIX =
  /\b(ltd|limited|llc|inc|corp|co|plc|pty|gmbh|ag|ug|kg|sl|sa|sas|sarl|srl|ltda|eireli|lda|s\.?a\.?|s\.?l\.?)\.?$/i;

const ICONS: Record<Channel, LucideIcon> = {
  whatsapp: MessageCircle,
  whatsapp_business: MessageCircle,
  email: Mail,
  sms: MessageSquareText,
  print: Printer,
  save: Download,
  any: Share2,
};

export type ShareSheetRef = { present: (id: string) => void };

type Context = {
  id: string;
  doc: DocumentRecord;
  emails: string[];
  phone: string;
  subject: string;
  body: string;
};

/**
 * Send a document. The message is written for the client in the document's
 * language and can be edited. Choosing any way to send issues a draft first,
 * so the PDF always carries its final number.
 */
export function ShareSheet({
  ref,
  onShared,
}: {
  ref?: Ref<ShareSheetRef>;
  onShared?: (doc: DocumentRecord, channel: string) => void;
}) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const sheet = useRef<SheetRef>(null);
  const [ctx, setCtx] = useState<Context | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState<Channel | 'mark' | null>(null);
  const [targets, setTargets] = useState<string[]>([]);

  useEffect(() => {
    NativeShare?.availableTargets().then(setTargets).catch(() => undefined);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      present: async (id: string) => {
        const db = await getDatabase();
        const [doc, rendered] = await Promise.all([
          getDocument(db, id),
          renderDocument(id),
        ]);
        if (!doc || !rendered) {
          return;
        }
        const client =
          (doc.clientSnapshot as {
            name?: string;
            company?: string | null;
            isBusiness?: boolean;
            emails?: string[];
            phone?: string;
          } | null) ?? (doc.clientId ? await getClient(db, doc.clientId) : null);
        // People are greeted by first name; businesses by their name.
        const greetName = !client?.name
          ? null
          : client.isBusiness ||
            client.company ||
            COMPANY_SUFFIX.test(client.name) ||
            client.name.split(' ').length > 3
          ? client.name
          : client.name.split(' ')[0]!;
        const m = rendered.model;
        const due = m.meta.find(
          r => r.label === m.labels.dueDate || r.label === m.labels.validUntil,
        );
        const message = shareMessage(doc.language, doc.type, {
          client: greetName,
          business: m.business.name,
          title: m.title,
          number: m.number ?? '',
          amount: m.highlight?.value ?? null,
          due: due?.value ?? null,
        });
        setCtx({
          id,
          doc,
          emails: client?.emails ?? [],
          phone: client?.phone ?? '',
          subject: message.subject,
          body: message.body,
        });
        setBody(message.body);
        NativeShare?.availableTargets().then(setTargets).catch(() => undefined);
        sheet.current?.present();
      },
    }),
    [],
  );

  const send = async (channel: Channel) => {
    if (!ctx || busy) {
      return;
    }
    setBusy(channel);
    try {
      const doc = await mutate(tx => recordShare(tx, clock, ctx.id, channel));
      if (channel === 'print') {
        await printDocument(ctx.id);
        if (!ctx.doc.number || ctx.doc.status === 'DRAFT') {
          toast.show({
            message: t('toast.markedSent', { number: doc.number }),
            tone: 'success',
          });
        }
      } else {
        const pdf = await generatePdf(ctx.id);
        if (!pdf) {
          throw new Error('No document');
        }
        if (channel === 'save') {
          const saved = await NativeShare!.saveToDownloads(
            pdf.path,
            pdf.fileName,
            'application/pdf',
          );
          toast.show({
            message: t('share.saved', { name: saved.name }),
            tone: 'success',
            haptic: 'success',
            action: {
              label: t('share.open'),
              onPress: () => NativeShare!.open(saved.uri, 'application/pdf'),
            },
          });
        } else {
          if (!ctx.doc.number || ctx.doc.status === 'DRAFT') {
            toast.show({
              message: t('toast.markedSent', { number: doc.number }),
              tone: 'success',
            });
          }
          await NativeShare!.share({
            path: pdf.path,
            mime: 'application/pdf',
            target: channel,
            subject: ctx.subject,
            text: body,
            emails: ctx.emails,
            phone: ctx.phone,
            chooserTitle: t('share.title'),
          });
        }
      }
      sheet.current?.dismiss();
      onShared?.(doc, channel);
    } catch (e) {
      const cancelled = (e as { code?: string })?.code === 'E_CANCELLED';
      if (!cancelled) {
        toast.show({
          message:
            (e as { code?: string })?.code === 'E_NO_APP'
              ? t('share.noApp')
              : t('share.failed'),
          tone: 'danger',
          haptic: 'error',
        });
      }
    } finally {
      setBusy(null);
    }
  };

  const markSent = async () => {
    if (!ctx) {
      return;
    }
    setBusy('mark');
    const doc = await mutate(tx =>
      issueDocument(tx, clock, ctx.id, { channel: 'manual' }),
    );
    setBusy(null);
    sheet.current?.dismiss();
    toast.show({
      message: t('toast.markedSent', { number: doc.number }),
      tone: 'success',
      haptic: 'success',
    });
    onShared?.(doc, 'manual');
  };

  const whatsapp: Channel | null = targets.includes('whatsapp')
    ? 'whatsapp'
    : targets.includes('whatsapp_business')
    ? 'whatsapp_business'
    : null;
  const channels: Channel[] = [
    ...(whatsapp ? [whatsapp] : []),
    ...(targets.includes('email') ? (['email'] as const) : []),
    ...(targets.includes('sms') ? (['sms'] as const) : []),
    'print',
    'save',
    'any',
  ];
  const isDraft = !!ctx && (!ctx.doc.number || ctx.doc.status === 'DRAFT');

  const tile = (c: Channel) => (
    <Touchable
      key={c}
      testID={`share-${c}`}
      feedback="scale"
      haptic="light"
      style={styles.tile}
      onPress={() => send(c)}
      disabled={!!busy}
      accessibilityRole="button"
      accessibilityLabel={t(`share.channel.${c}`)}
    >
      <View
        style={[
          styles.tileIcon,
          c.startsWith('whatsapp') && { backgroundColor: WHATSAPP_GREEN },
        ]}
      >
        {busy === c ? (
          <ActivityIndicator
            color={c.startsWith('whatsapp') ? '#fff' : theme.colors.text.primary}
          />
        ) : (
          <Icon
            icon={ICONS[c]}
            size={22}
            color={c.startsWith('whatsapp') ? '#FFFFFF' : undefined}
          />
        )}
      </View>
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {t(`share.channel.${c}`)}
      </Text>
    </Touchable>
  );

  return (
    <Sheet
      ref={sheet}
      title={
        ctx
          ? isDraft
            ? t('share.titleDraft')
            : t('share.titleNumber', { number: ctx.doc.number })
          : t('share.title')
      }
      onDismiss={() => setBusy(null)}
    >
      <View style={styles.grid}>{channels.map(tile)}</View>
      <View style={styles.messageWrap}>
        <Text variant="overline" tone="tertiary" style={styles.messageLabel}>
          {t('share.message')}
        </Text>
        <BottomSheetTextInput
          testID="share-message"
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
          style={styles.message}
          maxFontSizeMultiplier={1.6}
          accessibilityLabel={t('share.message')}
        />
        {isDraft ? (
          <Text variant="caption" tone="tertiary" style={styles.hint}>
            {t('share.draftHint')}
          </Text>
        ) : null}
      </View>
      {isDraft ? (
        <View style={styles.mark}>
          <Button
            testID="share-mark-sent"
            variant="ghost"
            size="sm"
            leadingIcon={CheckCheck}
            label={t('share.markOnly')}
            disabled={!!busy}
            onPress={markSent}
          />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create(theme => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.size.gutter - theme.space[1],
    rowGap: theme.space[4],
  },
  tile: {
    width: '25%',
    alignItems: 'center',
    gap: theme.space[2],
    paddingVertical: theme.space[1],
  },
  tileIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg.subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
  },
  messageWrap: {
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[6],
  },
  messageLabel: {
    paddingBottom: theme.space[2],
  },
  message: {
    ...theme.type.callout,
    lineHeight: undefined,
    color: theme.colors.text.primary,
    minHeight: 112,
    maxHeight: 180,
    padding: theme.space[3],
    borderRadius: theme.radius.md,
    borderWidth: theme.stroke.thin,
    borderColor: theme.colors.border.default,
    backgroundColor: theme.colors.bg.surface,
  },
  hint: {
    paddingTop: theme.space[2],
  },
  mark: {
    alignItems: 'center',
    paddingTop: theme.space[3],
  },
}));
