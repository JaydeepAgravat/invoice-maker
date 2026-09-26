import type { CountryCode } from './presets';

/**
 * Business mileage allowance per country: a starting rate the person can
 * change. Rates marked `verify` must be re-checked against the tax
 * authority before each release (they change yearly).
 */
export type MileagePreset = {
  unit: 'km' | 'mi';
  /** Minor units of the country's currency per unit of distance. */
  rate: number;
  currency: string;
  /** Short reference shown under the rate. */
  source: string | null;
};

export const MILEAGE_PRESETS: Record<CountryCode, MileagePreset> = {
  // verify: IRS standard mileage rate (70¢ in 2025).
  US: { unit: 'mi', rate: 70, currency: 'USD', source: 'IRS standard rate' },
  // HMRC: 45p for the first 10,000 miles, 25p after.
  GB: { unit: 'mi', rate: 45, currency: 'GBP', source: 'HMRC AMAP' },
  // verify: CRA 72¢/km for the first 5,000 km.
  CA: { unit: 'km', rate: 72, currency: 'CAD', source: 'CRA allowance' },
  // verify: ATO cents per km method (88¢ for 2025–26).
  AU: { unit: 'km', rate: 88, currency: 'AUD', source: 'ATO cents per km' },
  ES: { unit: 'km', rate: 26, currency: 'EUR', source: 'AEAT' },
  MX: { unit: 'km', rate: 0, currency: 'MXN', source: null },
  BR: { unit: 'km', rate: 0, currency: 'BRL', source: null },
  // verify: barème kilométrique, 5 CV, up to 5,000 km.
  FR: { unit: 'km', rate: 64, currency: 'EUR', source: 'Barème kilométrique' },
  DE: { unit: 'km', rate: 30, currency: 'EUR', source: 'Reisekosten' },
  PT: { unit: 'km', rate: 40, currency: 'EUR', source: 'Ajudas de custo' },
  OTHER: { unit: 'km', rate: 0, currency: 'USD', source: null },
};

/** Distance (thousandths) × rate (minor per unit), rounded half up to minor units. */
export const mileageAmount = (distanceMilli: number, rateMinor: number) =>
  Math.round((distanceMilli * rateMinor) / 1000);

const KM_PER_MILE = 1.609344;

/** Convert a distance in thousandths between km and miles. */
export const convertDistance = (
  milli: number,
  from: 'km' | 'mi',
  to: 'km' | 'mi',
) =>
  from === to
    ? milli
    : Math.round(from === 'mi' ? milli * KM_PER_MILE : milli / KM_PER_MILE);
