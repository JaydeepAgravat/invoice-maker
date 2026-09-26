import { useProfile } from '@/data/ProfileProvider';
import { MILEAGE_PRESETS } from '@/domain/mileage';

/** The rate new trips use: the person's own, else the country preset. */
export function useMileageRate() {
  const { profile } = useProfile();
  const preset = MILEAGE_PRESETS[profile.country];
  return {
    unit: profile.mileageUnit ?? preset.unit,
    rate: profile.mileageRate ?? preset.rate,
    currency: profile.currency,
    source: profile.mileageRate === null ? preset.source : null,
  };
}
