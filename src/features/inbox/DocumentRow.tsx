import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { DocumentSummary } from '@/data/repositories/inbox';
import {
  docTypeKey,
  statusKey,
  STATUS_TONE,
} from '@/features/documents/statusMeta';
import { useFormat } from '@/lib/format';
import { Avatar, Badge, Text, Touchable } from '@/ui/primitives';

type Props = {
  doc: DocumentSummary;
  today: string;
  onPress: (id: string) => void;
  /** Highlighted when open in the side pane (tablets). */
  selected?: boolean;
};

/**
 * One line of the inbox. Left: who. Middle: what and when. Right: how much
 * and where it stands. The subtitle always answers "what do I do next?".
 */
export const DocumentRow = memo(function DocumentRowView({
  doc,
  today,
  onPress,
  selected = false,
}: Props) {
  const { t } = useTranslation();
  const f = useFormat();

  const who = doc.clientName ?? t('document.noClient');
  const kind = doc.type === 'INVOICE' ? null : t(docTypeKey(doc.type));
  const reference = doc.number ?? t('status.draft');

  let when: string;
  if (doc.status === 'DRAFT') {
    when = f.date(doc.issueDate, 'short');
  } else if (
    (doc.status === 'SENT' ||
      doc.status === 'PARTIAL' ||
      doc.status === 'OVERDUE') &&
    doc.dueDate
  ) {
    when = f.due(doc.dueDate, today);
  } else {
    when = f.date(doc.issueDate, 'short');
  }
  const subtitle = [kind, reference, when].filter(Boolean).join(' · ');
  const amount =
    doc.status === 'PARTIAL' || doc.status === 'OVERDUE'
      ? doc.balance
      : doc.total;
  const status = t(statusKey(doc.status));

  return (
    <Touchable
      testID={`doc-${doc.number ?? doc.id}`}
      onPress={() => onPress(doc.id)}
      feedback="highlight"
      accessibilityRole="button"
      accessibilityLabel={`${who}, ${subtitle}, ${f.money(
        amount,
        doc.currency,
      )}, ${status}`}
      style={[styles.row, selected && styles.selected]}
    >
      <Avatar name={who} size={36} />
      <View style={styles.main}>
        <Text
          variant="bodyMedium"
          numberOfLines={1}
          tone={doc.clientName ? 'primary' : 'secondary'}
        >
          {who}
        </Text>
        <Text
          variant="caption"
          tone={doc.status === 'OVERDUE' ? 'danger' : 'secondary'}
          numberOfLines={1}
          tabular
        >
          {subtitle}
        </Text>
      </View>
      <View style={styles.side}>
        <Text
          variant="bodyMedium"
          tabular
          numberOfLines={1}
          tone={doc.status === 'VOID' ? 'tertiary' : 'primary'}
        >
          {f.money(amount, doc.currency)}
        </Text>
        <Badge label={status} tone={STATUS_TONE[doc.status]} />
      </View>
    </Touchable>
  );
});

const styles = StyleSheet.create(theme => ({
  selected: {
    backgroundColor: theme.colors.bg.selected,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    minHeight: theme.size.rowTall,
    paddingHorizontal: theme.size.gutter,
    paddingVertical: 10,
    backgroundColor: theme.colors.bg.app,
  },
  main: {
    flex: 1,
    gap: 3,
  },
  side: {
    alignItems: 'flex-end',
    gap: 4,
  },
}));
