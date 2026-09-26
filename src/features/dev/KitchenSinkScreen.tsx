import { ArrowLeft, Download, Plus, Send, Share2, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { EmptyDocuments } from '@/ui/illustrations';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Avatar,
  Badge,
  Button,
  Chip,
  Divider,
  EmptyState,
  IconButton,
  ListRow,
  SectionHeader,
  SegmentedControl,
  Sheet,
  Skeleton,
  Surface,
  Switch,
  Text,
  TextField,
  type SheetRef,
} from '@/ui/primitives';
import type { TypographyVariant } from '@/ui/tokens';
import { toast } from '@/ui/toast/store';

const TYPE_SAMPLES: ReadonlyArray<[TypographyVariant, string]> = [
  ['display', '$4,280.00'],
  ['title1', 'Invoice INV-0042'],
  ['title2', 'Acme Construction'],
  ['headline', 'Line items'],
  ['body', 'Kitchen tap replacement, parts and labour.'],
  ['bodyMedium', 'Due in 14 days'],
  ['callout', 'Payment terms: Net 14'],
  ['label', 'Unit price'],
  ['caption', 'Last edited 2 min ago'],
  ['overline', 'Payment details'],
];

/** Dev-only gallery of every primitive, used to review light and dark themes. */
export function KitchenSinkScreen({ navigation }: RootScreenProps<'KitchenSink'>) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const sheet = useRef<SheetRef>(null);
  const [segment, setSegment] = useState<'items' | 'hours' | 'fixed'>('items');
  const [on, setOn] = useState(true);
  const [chip, setChip] = useState('unpaid');

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Component gallery"
        left={<IconButton icon={ArrowLeft} label="Back" onPress={navigation.goBack} />}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
        <SectionHeader title="Typography" />
        <View style={styles.pad}>
          {TYPE_SAMPLES.map(([variant, sample]) => (
            <View key={variant} style={styles.typeRow}>
              <Text variant="caption" tone="tertiary" style={styles.typeName}>
                {variant}
              </Text>
              <Text variant={variant} tabular={variant === 'display'} style={styles.flex} numberOfLines={1}>
                {sample}
              </Text>
            </View>
          ))}
        </View>

        <SectionHeader title="Surfaces & text" />
        <View style={[styles.pad, styles.swatches]}>
          {(
            [
              ['app', theme.colors.bg.app],
              ['surface', theme.colors.bg.surface],
              ['subtle', theme.colors.bg.subtle],
              ['hover', theme.colors.bg.hover],
              ['accent', theme.colors.accent.solid],
              ['accent.subtle', theme.colors.accent.subtle],
            ] as const
          ).map(([name, color]) => (
            <View key={name} style={styles.swatch}>
              <View style={[styles.swatchChip, { backgroundColor: color }]} />
              <Text variant="caption" tone="secondary">
                {name}
              </Text>
            </View>
          ))}
        </View>
        <View style={[styles.pad, styles.stack]}>
          <Text tone="primary">Primary text</Text>
          <Text tone="secondary">Secondary text</Text>
          <Text tone="tertiary">Tertiary text</Text>
          <Text tone="accent">Accent text</Text>
          <Text tone="danger">Danger text</Text>
        </View>

        <SectionHeader title="Buttons" />
        <View style={[styles.pad, styles.wrap]}>
          <Button variant="primary" label="Send invoice" leadingIcon={Send} />
          <Button variant="secondary" label="Preview" />
          <Button variant="ghost" label="Share" leadingIcon={Share2} />
          <Button variant="danger" label="Delete" leadingIcon={Trash2} haptic="warning" />
          <Button variant="primary" size="sm" label="Small" />
          <Button variant="secondary" size="sm" label="Download" leadingIcon={Download} />
          <Button variant="primary" label="Saving" loading />
          <Button variant="secondary" label="Disabled" disabled />
        </View>
        <View style={styles.pad}>
          <Button variant="primary" size="lg" label="Record payment" fullWidth haptic="success" />
        </View>
        <View style={[styles.pad, styles.wrap]}>
          <IconButton icon={Plus} label="Add" />
          <IconButton icon={Plus} label="Add" variant="outline" />
          <IconButton icon={Plus} label="Add" variant="filled" />
          <IconButton icon={Share2} label="Share" size="sm" variant="outline" />
        </View>

        <SectionHeader title="Status" />
        <View style={[styles.pad, styles.wrap]}>
          <Badge label="Draft" tone="neutral" />
          <Badge label="Sent" tone="info" />
          <Badge label="Partially paid" tone="warning" />
          <Badge label="Paid" tone="success" />
          <Badge label="Overdue" tone="danger" />
          <Badge label="Pro" tone="accent" dot={false} />
        </View>

        <SectionHeader title="Selection" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.padH, styles.row]}>
          {['all', 'drafts', 'unpaid', 'overdue', 'paid'].map(c => (
            <Chip key={c} label={c[0]!.toUpperCase() + c.slice(1)} selected={chip === c} onPress={() => setChip(c)} />
          ))}
        </ScrollView>
        <View style={[styles.pad, styles.stack]}>
          <SegmentedControl
            value={segment}
            onChange={setSegment}
            segments={[
              { value: 'items', label: 'Items' },
              { value: 'hours', label: 'Hours' },
              { value: 'fixed', label: 'Fixed fee' },
            ]}
          />
          <View style={styles.rowBetween}>
            <Text>Prices include tax</Text>
            <Switch value={on} onValueChange={setOn} accessibilityLabel="Prices include tax" />
          </View>
        </View>

        <SectionHeader title="Fields" />
        <View style={[styles.pad, styles.stack]}>
          <TextField label="Client name" placeholder="Acme Construction" />
          <TextField
            label="Unit price"
            placeholder="0.00"
            keyboardType="decimal-pad"
            tabular
            prefix={<Text tone="tertiary">$</Text>}
            hint="Excluding tax"
          />
          <TextField label="Email" defaultValue="accounts@acme" error="Enter a valid email address" />
        </View>

        <SectionHeader title="Document rows" />
        <Surface style={styles.card}>
          <ListRow
            leading={<Avatar name="Acme Construction" />}
            title="Acme Construction"
            subtitle="INV-0042 · Due in 3 days"
            value="$1,200.00"
            meta={<Badge label="Sent" tone="info" />}
            onPress={() => undefined}
          />
          <Divider inset={60} />
          <ListRow
            leading={<Avatar name="Jordan Smith" />}
            title="Jordan Smith"
            subtitle="INV-0041 · 5 days overdue"
            value="$640.00"
            meta={<Badge label="Overdue" tone="danger" />}
            onPress={() => undefined}
          />
          <Divider inset={60} />
          <ListRow
            leading={<Avatar name="Bloom Florists" />}
            title="Bloom Florists"
            subtitle="INV-0040 · Paid 12 Sep"
            value="$2,440.00"
            meta={<Badge label="Paid" tone="success" />}
            onPress={() => undefined}
          />
        </Surface>

        <SectionHeader title="Loading" />
        <View style={[styles.pad, styles.stack]}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={10} />
          <Skeleton height={44} radius={8} />
        </View>

        <SectionHeader title="Feedback" />
        <View style={[styles.pad, styles.wrap]}>
          <Button label="Toast" onPress={() => toast.show({ message: 'Draft saved' })} />
          <Button
            label="Undo toast"
            onPress={() =>
              toast.show({
                message: 'Invoice deleted',
                action: { label: 'Undo', onPress: () => toast.show({ message: 'Restored' }) },
                haptic: 'warning',
              })
            }
          />
          <Button
            label="Success"
            onPress={() => toast.show({ message: 'Payment recorded', tone: 'success', haptic: 'success' })}
          />
          <Button label="Sheet" onPress={() => sheet.current?.present()} />
        </View>

        <SectionHeader title="Empty state" />
        <Surface style={styles.card}>
          <EmptyState
            illustration={<EmptyDocuments />}
            title="No documents yet"
            body="Create your first invoice. It takes less than a minute."
            action={{ label: 'New invoice', leadingIcon: Plus }}
          />
        </Surface>
      </ScrollView>

      <Sheet ref={sheet} title="Record payment">
        <View style={[styles.pad, styles.stack]}>
          <TextField label="Amount" keyboardType="decimal-pad" tabular prefix={<Text tone="tertiary">$</Text>} />
          <Button variant="primary" size="lg" label="Save payment" fullWidth onPress={() => sheet.current?.dismiss()} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.app,
  },
  flex: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: theme.size.gutter,
    paddingVertical: theme.space[2],
  },
  padH: {
    paddingHorizontal: theme.size.gutter,
  },
  card: {
    marginHorizontal: theme.size.gutter,
  },
  stack: {
    gap: theme.space[3],
  },
  row: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    paddingVertical: theme.space[1],
  },
  typeName: {
    width: 76,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
  },
  swatch: {
    alignItems: 'center',
    gap: theme.space[1],
  },
  swatchChip: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    borderWidth: theme.stroke.thin,
    borderColor: theme.colors.border.subtle,
  },
}));
