/** Schema v2: mileage settings on the business profile. */
export const migration002 = [
  'ALTER TABLE business_profile ADD COLUMN mileage_rate_minor INTEGER',
  "ALTER TABLE business_profile ADD COLUMN mileage_unit TEXT CHECK (mileage_unit IN ('km','mi'))",
];
