import { Landmark } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { PRESETS, type CountryCode } from '@/domain/presets';
import { Icon, Text } from '@/ui/primitives';

/** Official e-invoicing systems, named so the notice is concrete. */
const SYSTEMS: Partial<Record<CountryCode, string>> = {
  MX: 'CFDI (SAT)',
  BR: 'NF-e / NFS-e',
  PT: 'software certificado pela AT',
  ES: 'VERI*FACTU',
};

/**
 * Honest, calm note for countries where official tax invoices must go through
 * a government system. Shown during onboarding and in Settings; never blocks.
 */
export function ComplianceNotice({ country }: { country: CountryCode }) {
  const { t } = useTranslation();
  const system = SYSTEMS[country];
  if (!system || PRESETS[country].compliance.length === 0) {
    return null;
  }
  const upcoming = country === 'ES';
  return (
    <View style={styles.card} accessibilityRole="summary">
      <Icon icon={Landmark} size={18} tone="warning" />
      <View style={styles.body}>
        <Text variant="calloutMedium">
          {t(upcoming ? 'compliance.titleUpcoming' : 'compliance.title')}
        </Text>
        <Text variant="caption" tone="secondary">
          {t(upcoming ? 'compliance.bodyUpcoming' : 'compliance.body', {
            system,
          })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  card: {
    flexDirection: 'row',
    gap: theme.space[3],
    marginTop: theme.space[4],
    padding: theme.space[4],
    borderRadius: theme.radius.lg,
    borderWidth: theme.stroke.thin,
    borderColor: theme.colors.status.warning.border,
    backgroundColor: theme.colors.status.warning.bg,
  },
  body: {
    flex: 1,
    gap: theme.space[1],
  },
}));
