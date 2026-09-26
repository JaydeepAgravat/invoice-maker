import type { TaxKind } from './calc';
import type { DocType } from './docTypes';
import type { NumberingStyle } from './numbering';

/**
 * Country presets chosen at onboarding. They set sensible defaults only;
 * every value stays editable in Settings. Users remain responsible for their
 * own tax obligations (stated in the app and the store listing).
 *
 * Rates are parts per million. Entries marked `verify` must be re-checked
 * against the official source before each release.
 */

export type CountryCode =
  | 'US'
  | 'GB'
  | 'CA'
  | 'AU'
  | 'ES'
  | 'MX'
  | 'BR'
  | 'FR'
  | 'DE'
  | 'PT'
  | 'OTHER';

export type TaxPreset = {
  key: string;
  name: string;
  rate: number;
  kind: TaxKind;
  isDefault?: boolean;
};

export type RegionPreset = {
  code: string;
  name: string;
  taxes: TaxPreset[];
};

export type LegalNoteWhen = 'NOT_TAX_REGISTERED' | 'B2B';

export type LegalNote = {
  key: string;
  when: LegalNoteWhen;
  /** Always in the country's legal language, whatever the app language is. */
  text: string;
};

export type ComplianceNotice =
  /** Formal invoices must go through a government e-invoicing system. */
  | 'GOVERNMENT_EINVOICE_REQUIRED'
  /** Invoices must come from government-certified software. */
  | 'CERTIFIED_SOFTWARE_REQUIRED'
  /** B2B e-invoicing mandate phasing in. */
  | 'B2B_EINVOICE_PHASE_IN';

export type CountryPreset = {
  code: CountryCode;
  currency: string;
  locale: string;
  language: 'en' | 'es' | 'pt' | 'fr' | 'de';
  paper: 'A4' | 'LETTER';
  measurement: 'METRIC' | 'IMPERIAL';
  /** English wording: US/CA say "Estimate", UK/AU say "Quote". */
  estimateTerm: 'ESTIMATE' | 'QUOTE';
  taxLabel: string;
  taxIdLabel: string;
  numberingStyle: NumberingStyle;
  defaultTermsDays: number;
  pricesIncludeTax: boolean;
  /** Supply/delivery date is a mandatory invoice field (DE, UK VAT). */
  requiresSupplyDate: boolean;
  taxes: TaxPreset[];
  regions?: RegionPreset[];
  legalNotes: LegalNote[];
  compliance: ComplianceNotice[];
};

const t = (
  key: string,
  name: string,
  percent: number,
  kind: TaxKind = 'STANDARD',
  isDefault = false,
): TaxPreset => ({
  key,
  name,
  rate: Math.round(percent * 10_000),
  kind,
  isDefault,
});

const GST_CA = t('ca_gst', 'GST', 5, 'STANDARD', true);

export const PRESETS: Record<CountryCode, CountryPreset> = {
  US: {
    code: 'US',
    currency: 'USD',
    locale: 'en-US',
    language: 'en',
    paper: 'LETTER',
    measurement: 'IMPERIAL',
    estimateTerm: 'ESTIMATE',
    taxLabel: 'Sales tax',
    taxIdLabel: 'EIN',
    numberingStyle: 'SEQUENTIAL',
    defaultTermsDays: 30,
    pricesIncludeTax: false,
    requiresSupplyDate: false,
    // Sales tax varies by state, county and city: the user adds their own rate.
    taxes: [],
    legalNotes: [],
    compliance: [],
  },
  GB: {
    code: 'GB',
    currency: 'GBP',
    locale: 'en-GB',
    language: 'en',
    paper: 'A4',
    measurement: 'METRIC',
    estimateTerm: 'QUOTE',
    taxLabel: 'VAT',
    taxIdLabel: 'VAT No.',
    numberingStyle: 'SEQUENTIAL',
    defaultTermsDays: 30,
    pricesIncludeTax: false,
    requiresSupplyDate: true,
    taxes: [
      t('gb_std', 'VAT', 20, 'STANDARD', true),
      t('gb_red', 'VAT', 5),
      t('gb_zero', 'VAT', 0),
    ],
    legalNotes: [],
    compliance: [],
  },
  CA: {
    code: 'CA',
    currency: 'CAD',
    locale: 'en-CA',
    language: 'en',
    paper: 'LETTER',
    measurement: 'METRIC',
    estimateTerm: 'ESTIMATE',
    taxLabel: 'Tax',
    taxIdLabel: 'GST/HST No.',
    numberingStyle: 'SEQUENTIAL',
    defaultTermsDays: 30,
    pricesIncludeTax: false,
    requiresSupplyDate: false,
    taxes: [GST_CA],
    // verify: provincial rates each release (NS HST moved to 14% on 2025-04-01).
    regions: [
      { code: 'AB', name: 'Alberta', taxes: [GST_CA] },
      {
        code: 'BC',
        name: 'British Columbia',
        taxes: [GST_CA, t('ca_bc_pst', 'PST', 7, 'STANDARD', true)],
      },
      {
        code: 'MB',
        name: 'Manitoba',
        taxes: [GST_CA, t('ca_mb_rst', 'RST', 7, 'STANDARD', true)],
      },
      {
        code: 'NB',
        name: 'New Brunswick',
        taxes: [t('ca_hst15', 'HST', 15, 'STANDARD', true)],
      },
      {
        code: 'NL',
        name: 'Newfoundland and Labrador',
        taxes: [t('ca_hst15', 'HST', 15, 'STANDARD', true)],
      },
      {
        code: 'NS',
        name: 'Nova Scotia',
        taxes: [t('ca_hst14', 'HST', 14, 'STANDARD', true)],
      },
      { code: 'NT', name: 'Northwest Territories', taxes: [GST_CA] },
      { code: 'NU', name: 'Nunavut', taxes: [GST_CA] },
      {
        code: 'ON',
        name: 'Ontario',
        taxes: [t('ca_hst13', 'HST', 13, 'STANDARD', true)],
      },
      {
        code: 'PE',
        name: 'Prince Edward Island',
        taxes: [t('ca_hst15', 'HST', 15, 'STANDARD', true)],
      },
      {
        code: 'QC',
        name: 'Québec',
        taxes: [GST_CA, t('ca_qc_qst', 'QST', 9.975, 'STANDARD', true)],
      },
      {
        code: 'SK',
        name: 'Saskatchewan',
        taxes: [GST_CA, t('ca_sk_pst', 'PST', 6, 'STANDARD', true)],
      },
      { code: 'YT', name: 'Yukon', taxes: [GST_CA] },
    ],
    legalNotes: [],
    compliance: [],
  },
  AU: {
    code: 'AU',
    currency: 'AUD',
    locale: 'en-AU',
    language: 'en',
    paper: 'A4',
    measurement: 'METRIC',
    estimateTerm: 'QUOTE',
    taxLabel: 'GST',
    taxIdLabel: 'ABN',
    numberingStyle: 'SEQUENTIAL',
    defaultTermsDays: 14,
    // Australian trades usually quote GST-inclusive prices.
    pricesIncludeTax: true,
    requiresSupplyDate: false,
    taxes: [
      t('au_gst', 'GST', 10, 'STANDARD', true),
      t('au_free', 'GST-free', 0),
    ],
    legalNotes: [],
    compliance: [],
  },
  ES: {
    code: 'ES',
    currency: 'EUR',
    locale: 'es-ES',
    language: 'es',
    paper: 'A4',
    measurement: 'METRIC',
    estimateTerm: 'ESTIMATE',
    taxLabel: 'IVA',
    taxIdLabel: 'NIF',
    numberingStyle: 'YEARLY',
    defaultTermsDays: 30,
    pricesIncludeTax: false,
    requiresSupplyDate: false,
    taxes: [
      t('es_iva21', 'IVA', 21, 'STANDARD', true),
      t('es_iva10', 'IVA', 10),
      t('es_iva4', 'IVA', 4),
      t('es_iva0', 'IVA', 0),
      t('es_irpf15', 'IRPF', 15, 'WITHHOLDING'),
      t('es_irpf7', 'IRPF', 7, 'WITHHOLDING'),
    ],
    regions: [
      {
        code: 'CN',
        name: 'Canarias',
        taxes: [
          t('es_igic7', 'IGIC', 7, 'STANDARD', true),
          t('es_irpf15', 'IRPF', 15, 'WITHHOLDING'),
        ],
      },
    ],
    legalNotes: [],
    // verify: VERI*FACTU certified billing software deadlines (postponed to 2027).
    compliance: ['CERTIFIED_SOFTWARE_REQUIRED'],
  },
  MX: {
    code: 'MX',
    currency: 'MXN',
    locale: 'es-MX',
    language: 'es',
    paper: 'LETTER',
    measurement: 'METRIC',
    estimateTerm: 'ESTIMATE',
    taxLabel: 'IVA',
    taxIdLabel: 'RFC',
    numberingStyle: 'SEQUENTIAL',
    defaultTermsDays: 30,
    pricesIncludeTax: false,
    requiresSupplyDate: false,
    taxes: [
      t('mx_iva16', 'IVA', 16, 'STANDARD', true),
      t('mx_iva8', 'IVA frontera', 8),
      t('mx_iva0', 'IVA', 0),
      t('mx_ret_isr', 'Retención ISR', 10, 'WITHHOLDING'),
      t('mx_ret_iva', 'Retención IVA', 10.6667, 'WITHHOLDING'),
    ],
    legalNotes: [],
    // Formal invoices must be CFDI stamped through the SAT.
    compliance: ['GOVERNMENT_EINVOICE_REQUIRED'],
  },
  BR: {
    code: 'BR',
    currency: 'BRL',
    locale: 'pt-BR',
    language: 'pt',
    paper: 'A4',
    measurement: 'METRIC',
    estimateTerm: 'ESTIMATE',
    taxLabel: 'Imposto',
    taxIdLabel: 'CNPJ/CPF',
    numberingStyle: 'SEQUENTIAL',
    defaultTermsDays: 30,
    pricesIncludeTax: false,
    requiresSupplyDate: false,
    // ISS varies 2–5% by municipality; offered but not applied by default.
    taxes: [t('br_iss5', 'ISS', 5), t('br_iss2', 'ISS', 2)],
    legalNotes: [],
    // Registered businesses must issue NF-e / NFS-e.
    compliance: ['GOVERNMENT_EINVOICE_REQUIRED'],
  },
  FR: {
    code: 'FR',
    currency: 'EUR',
    locale: 'fr-FR',
    language: 'fr',
    paper: 'A4',
    measurement: 'METRIC',
    estimateTerm: 'ESTIMATE',
    taxLabel: 'TVA',
    taxIdLabel: 'SIRET',
    numberingStyle: 'YEARLY',
    defaultTermsDays: 30,
    pricesIncludeTax: false,
    requiresSupplyDate: false,
    taxes: [
      t('fr_tva20', 'TVA', 20, 'STANDARD', true),
      t('fr_tva10', 'TVA', 10),
      t('fr_tva55', 'TVA', 5.5),
      t('fr_tva21', 'TVA', 2.1),
    ],
    legalNotes: [
      {
        key: 'fr_293b',
        when: 'NOT_TAX_REGISTERED',
        text: 'TVA non applicable, art. 293 B du CGI',
      },
      {
        key: 'fr_late_b2b',
        when: 'B2B',
        text:
          'En cas de retard de paiement, une pénalité égale à trois fois le taux d’intérêt légal sera exigible, ' +
          'ainsi qu’une indemnité forfaitaire pour frais de recouvrement de 40 €.',
      },
    ],
    // verify: B2B e-invoicing (receive from 2026-09, issue for SMEs from 2027-09).
    compliance: ['B2B_EINVOICE_PHASE_IN'],
  },
  DE: {
    code: 'DE',
    currency: 'EUR',
    locale: 'de-DE',
    language: 'de',
    paper: 'A4',
    measurement: 'METRIC',
    estimateTerm: 'ESTIMATE',
    taxLabel: 'USt.',
    taxIdLabel: 'USt-IdNr.',
    numberingStyle: 'YEARLY',
    defaultTermsDays: 14,
    pricesIncludeTax: false,
    requiresSupplyDate: true,
    taxes: [
      t('de_ust19', 'USt.', 19, 'STANDARD', true),
      t('de_ust7', 'USt.', 7),
      t('de_ust0', 'USt.', 0),
    ],
    legalNotes: [
      {
        key: 'de_19ustg',
        when: 'NOT_TAX_REGISTERED',
        text: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
      },
    ],
    // verify: B2B e-invoice issuing obligation phases in 2027/2028.
    compliance: ['B2B_EINVOICE_PHASE_IN'],
  },
  PT: {
    code: 'PT',
    currency: 'EUR',
    locale: 'pt-PT',
    language: 'pt',
    paper: 'A4',
    measurement: 'METRIC',
    estimateTerm: 'ESTIMATE',
    taxLabel: 'IVA',
    taxIdLabel: 'NIF',
    numberingStyle: 'YEARLY',
    defaultTermsDays: 30,
    pricesIncludeTax: false,
    requiresSupplyDate: false,
    taxes: [
      t('pt_iva23', 'IVA', 23, 'STANDARD', true),
      t('pt_iva13', 'IVA', 13),
      t('pt_iva6', 'IVA', 6),
      t('pt_iva0', 'IVA', 0),
      // verify: category B withholding rate (25% historically; reduced in recent budgets).
      t('pt_irs', 'Retenção IRS', 25, 'WITHHOLDING'),
    ],
    legalNotes: [
      {
        key: 'pt_53civa',
        when: 'NOT_TAX_REGISTERED',
        text: 'IVA - regime de isenção [art. 53.º do CIVA]',
      },
    ],
    // Invoices (faturas) must be issued by AT-certified software or the e-Fatura portal.
    compliance: ['CERTIFIED_SOFTWARE_REQUIRED'],
  },
  OTHER: {
    code: 'OTHER',
    currency: 'USD',
    locale: 'en-US',
    language: 'en',
    paper: 'A4',
    measurement: 'METRIC',
    estimateTerm: 'ESTIMATE',
    taxLabel: 'Tax',
    taxIdLabel: 'Tax ID',
    numberingStyle: 'SEQUENTIAL',
    defaultTermsDays: 30,
    pricesIncludeTax: false,
    requiresSupplyDate: false,
    taxes: [],
    legalNotes: [],
    compliance: [],
  },
};

export const COUNTRY_CODES = Object.keys(PRESETS) as CountryCode[];

/** Best preset for a device locale such as "pt-BR" or "en-AU". */
export const presetForLocale = (locale: string): CountryPreset => {
  const region = locale.split(/[-_]/)[1]?.toUpperCase();
  if (region === 'UK') {
    return PRESETS.GB;
  }
  const match = COUNTRY_CODES.find(c => c === region);
  return match ? PRESETS[match] : PRESETS.OTHER;
};

/** Taxes for a country, narrowed to a region (CA provinces, Canarias) when given. */
export const taxesFor = (
  country: CountryCode,
  regionCode?: string | null,
): TaxPreset[] => {
  const preset = PRESETS[country];
  const region = regionCode
    ? preset.regions?.find(r => r.code === regionCode)
    : undefined;
  return region ? region.taxes : preset.taxes;
};

/** Legal notes that must be printed for this business and client. */
export const legalNotesFor = (
  country: CountryCode,
  opts: { taxRegistered: boolean; clientIsBusiness: boolean },
): LegalNote[] =>
  PRESETS[country].legalNotes.filter(n =>
    n.when === 'NOT_TAX_REGISTERED'
      ? !opts.taxRegistered
      : opts.clientIsBusiness,
  );

/**
 * Title printed on the document. Australia requires "Tax invoice" when the
 * seller is GST-registered; elsewhere the plain document name is used.
 * Returns a translation key suffix; the PDF layer localizes it.
 */
export const documentTitleKey = (
  country: CountryCode,
  type: DocType,
  opts: { taxRegistered: boolean },
): string => {
  if (type === 'INVOICE' && country === 'AU' && opts.taxRegistered) {
    return 'TAX_INVOICE';
  }
  if (type === 'ESTIMATE' && PRESETS[country].estimateTerm === 'QUOTE') {
    return 'QUOTE';
  }
  return type;
};

/** Australian Business Number checksum (ATO algorithm). */
export const isValidABN = (input: string): boolean => {
  const digits = input.replace(/\s/g, '');
  if (!/^\d{11}$/.test(digits)) {
    return false;
  }
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const nums = digits.split('').map(Number);
  nums[0] = nums[0]! - 1;
  const sum = nums.reduce((acc, d, i) => acc + d * weights[i]!, 0);
  return sum % 89 === 0;
};
