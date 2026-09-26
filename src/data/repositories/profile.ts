import { PRESETS, taxesFor, type CountryCode } from '@/domain/presets';
import { DOC_TYPES } from '@/domain/docTypes';
import { defaultPrefix, type NumberingStyle } from '@/domain/numbering';
import type { RoundingMode } from '@/domain/fraction';

import type { Clock } from '../clock';
import {
  bool,
  num,
  reqNum,
  reqStr,
  str,
  type Executor,
  type SqlValue,
} from '../db/types';
import { uuidv7 } from '../ids';

export type BusinessProfile = {
  name: string | null;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  country: CountryCode;
  region: string | null;
  taxIdLabel: string | null;
  taxId: string | null;
  secondaryTaxIdLabel: string | null;
  secondaryTaxId: string | null;
  isTaxRegistered: boolean;
  logoPath: string | null;
  signaturePath: string | null;
  currency: string;
  locale: string;
  language: string;
  paperSize: 'A4' | 'LETTER';
  measurement: 'METRIC' | 'IMPERIAL';
  pricesIncludeTax: boolean;
  rounding: 'PER_LINE' | 'PER_TOTAL';
  roundingMode: RoundingMode;
  numberingStyle: NumberingStyle;
  defaultTermsDays: number;
  defaultNotes: string | null;
  defaultTerms: string | null;
  defaultFooter: string | null;
  templateId: string;
  accentColor: string | null;
  font: string | null;
};

const COLUMNS: Record<keyof BusinessProfile, string> = {
  name: 'name',
  legalName: 'legal_name',
  email: 'email',
  phone: 'phone',
  website: 'website',
  address: 'address',
  country: 'country',
  region: 'region',
  taxIdLabel: 'tax_id_label',
  taxId: 'tax_id',
  secondaryTaxIdLabel: 'secondary_tax_id_label',
  secondaryTaxId: 'secondary_tax_id',
  isTaxRegistered: 'is_tax_registered',
  logoPath: 'logo_path',
  signaturePath: 'signature_path',
  currency: 'currency',
  locale: 'locale',
  language: 'language',
  paperSize: 'paper_size',
  measurement: 'measurement',
  pricesIncludeTax: 'prices_include_tax',
  rounding: 'rounding',
  roundingMode: 'rounding_mode',
  numberingStyle: 'numbering_style',
  defaultTermsDays: 'default_terms_days',
  defaultNotes: 'default_notes',
  defaultTerms: 'default_terms',
  defaultFooter: 'default_footer',
  templateId: 'template_id',
  accentColor: 'accent_color',
  font: 'font',
};

const BOOLEAN_KEYS = new Set<keyof BusinessProfile>([
  'isTaxRegistered',
  'pricesIncludeTax',
]);

export async function getProfile(db: Executor): Promise<BusinessProfile> {
  const { rows } = await db.execute(
    'SELECT * FROM business_profile WHERE id = 1',
  );
  const r = rows[0]!;
  return {
    name: str(r.name),
    legalName: str(r.legal_name),
    email: str(r.email),
    phone: str(r.phone),
    website: str(r.website),
    address: str(r.address),
    country: reqStr(r.country) as CountryCode,
    region: str(r.region),
    taxIdLabel: str(r.tax_id_label),
    taxId: str(r.tax_id),
    secondaryTaxIdLabel: str(r.secondary_tax_id_label),
    secondaryTaxId: str(r.secondary_tax_id),
    isTaxRegistered: bool(r.is_tax_registered),
    logoPath: str(r.logo_path),
    signaturePath: str(r.signature_path),
    currency: reqStr(r.currency),
    locale: reqStr(r.locale),
    language: reqStr(r.language),
    paperSize: reqStr(r.paper_size) as BusinessProfile['paperSize'],
    measurement: reqStr(r.measurement) as BusinessProfile['measurement'],
    pricesIncludeTax: bool(r.prices_include_tax),
    rounding: reqStr(r.rounding) as BusinessProfile['rounding'],
    roundingMode: reqStr(r.rounding_mode) as RoundingMode,
    numberingStyle: reqStr(r.numbering_style) as NumberingStyle,
    defaultTermsDays: reqNum(r.default_terms_days),
    defaultNotes: str(r.default_notes),
    defaultTerms: str(r.default_terms),
    defaultFooter: str(r.default_footer),
    templateId: reqStr(r.template_id),
    accentColor: str(r.accent_color),
    font: str(r.font),
  };
}

export async function updateProfile(
  db: Executor,
  clock: Clock,
  patch: Partial<BusinessProfile>,
): Promise<void> {
  const keys = (Object.keys(patch) as (keyof BusinessProfile)[]).filter(
    k => k in COLUMNS,
  );
  if (keys.length === 0) {
    return;
  }
  const values: SqlValue[] = keys.map(k => {
    const v = patch[k];
    if (BOOLEAN_KEYS.has(k)) {
      return v ? 1 : 0;
    }
    return (v ?? null) as SqlValue;
  });
  const sets = keys.map(k => `${COLUMNS[k]} = ?`).join(', ');
  await db.execute(
    `UPDATE business_profile SET ${sets}, updated_at = ? WHERE id = 1`,
    [...values, clock.now()],
  );
}

/**
 * Onboarding: apply a country preset. Sets locale, currency, paper, tax labels,
 * numbering style, seeds tax rates and one numbering sequence per document type.
 * Safe to run again: tax rates from presets are matched by preset key.
 */
export async function applyCountryPreset(
  db: Executor,
  clock: Clock,
  opts: {
    country: CountryCode;
    region?: string | null;
    language: string;
    locale?: string;
  },
): Promise<void> {
  const p = PRESETS[opts.country];
  await updateProfile(db, clock, {
    country: p.code,
    region: opts.region ?? null,
    currency: p.currency,
    locale: opts.locale ?? p.locale,
    language: opts.language,
    paperSize: p.paper,
    measurement: p.measurement,
    taxIdLabel: p.taxIdLabel,
    pricesIncludeTax: p.pricesIncludeTax,
    numberingStyle: p.numberingStyle,
    defaultTermsDays: p.defaultTermsDays,
  });

  const now = clock.now();
  const presetTaxes = taxesFor(p.code, opts.region);
  for (const [i, t] of presetTaxes.entries()) {
    const existing = await db.execute(
      'SELECT id FROM tax_rates WHERE preset_key = ?',
      [t.key],
    );
    if (existing.rows.length > 0) {
      await db.execute(
        'UPDATE tax_rates SET archived = 0, is_default = ?, updated_at = ? WHERE preset_key = ?',
        [t.isDefault ? 1 : 0, now, t.key],
      );
      continue;
    }
    await db.execute(
      `INSERT INTO tax_rates (id, name, rate_ppm, kind, is_default, position, preset_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv7(now),
        t.name,
        t.rate,
        t.kind,
        t.isDefault ? 1 : 0,
        i,
        t.key,
        now,
        now,
      ],
    );
  }

  for (const type of DOC_TYPES) {
    await db.execute(
      `INSERT INTO number_sequences (key, doc_type, prefix, pad, style, next_value) VALUES (?, ?, ?, 4, ?, 1)
       ON CONFLICT(key) DO UPDATE SET style = excluded.style`,
      [type, type, defaultPrefix(opts.language, type), p.numberingStyle],
    );
  }
}

export const profileExists = async (db: Executor): Promise<boolean> => {
  const { rows } = await db.execute(
    "SELECT value FROM app_meta WHERE key = 'onboarded'",
  );
  return num(rows[0]?.value) === 1;
};

export const markOnboarded = (db: Executor) =>
  db.execute(
    "INSERT INTO app_meta (key, value) VALUES ('onboarded', '1') ON CONFLICT(key) DO UPDATE SET value = '1'",
  );
