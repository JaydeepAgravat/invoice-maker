/**
 * Column mapping for imports. Headers are matched against aliases in the
 * five app languages and the export formats of common invoicing apps
 * (Invoice Simple, Zoho Invoice, Bookipi, QuickBooks, Wave), so most files
 * map themselves; the person only confirms.
 */

export type ClientField =
  | 'name'
  | 'company'
  | 'email'
  | 'phone'
  | 'address'
  | 'address2'
  | 'city'
  | 'region'
  | 'postcode'
  | 'country'
  | 'taxId'
  | 'notes';

export type ItemField = 'name' | 'description' | 'price' | 'unit' | 'sku';

export type ImportTarget = 'clients' | 'items';

export const CLIENT_FIELDS: readonly ClientField[] = [
  'name',
  'company',
  'email',
  'phone',
  'address',
  'address2',
  'city',
  'region',
  'postcode',
  'country',
  'taxId',
  'notes',
];

export const ITEM_FIELDS: readonly ItemField[] = [
  'name',
  'description',
  'price',
  'unit',
  'sku',
];

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const CLIENT_ALIASES: Record<ClientField, string[]> = {
  name: [
    'name', 'client', 'client name', 'customer', 'customer name', 'display name', 'contact name',
    'full name', 'nombre', 'cliente', 'nome', 'nom', 'kunde', 'kundenname', 'name des kunden',
  ],
  company: [
    'company', 'company name', 'business', 'business name', 'organization', 'organisation',
    'empresa', 'razon social', 'razao social', 'entreprise', 'societe', 'firma', 'unternehmen',
  ],
  email: [
    'email', 'e mail', 'email address', 'emailid', 'email id', 'correo', 'correo electronico',
    'courriel', 'e mail adresse', 'mail',
  ],
  phone: [
    'phone', 'phone number', 'telephone', 'mobile', 'mobile phone', 'work phone', 'cell',
    'telefono', 'movil', 'celular', 'telefone', 'telephone portable', 'portable', 'telefon', 'handy',
  ],
  address: [
    'address', 'address 1', 'address line 1', 'billing address', 'billing street', 'street',
    'street address', 'direccion', 'endereco', 'adresse', 'strasse', 'rechnungsadresse',
  ],
  address2: ['address 2', 'address line 2', 'billing street2', 'billing address 2'],
  city: ['city', 'town', 'billing city', 'ciudad', 'cidade', 'ville', 'stadt', 'ort'],
  region: [
    'state', 'province', 'region', 'county', 'billing state', 'estado', 'provincia', 'departement',
    'bundesland',
  ],
  postcode: [
    'zip', 'zip code', 'postcode', 'postal code', 'billing code', 'billing zip', 'codigo postal',
    'cep', 'code postal', 'plz', 'postleitzahl',
  ],
  country: ['country', 'billing country', 'pais', 'pays', 'land'],
  taxId: [
    'tax id', 'tax number', 'vat', 'vat number', 'vat no', 'gst number', 'abn', 'ein', 'tin',
    'gst treatment number', 'nif', 'cif', 'rfc', 'cpf', 'cnpj', 'cpf cnpj', 'n tva', 'siret',
    'ust id', 'ust idnr', 'steuernummer',
  ],
  notes: ['notes', 'note', 'comments', 'remarks', 'notas', 'observaciones', 'observacoes', 'notizen'],
};

const ITEM_ALIASES: Record<ItemField, string[]> = {
  name: [
    'name', 'item', 'item name', 'product', 'product name', 'service', 'title', 'nombre',
    'producto', 'articulo', 'produto', 'nome', 'article', 'produit', 'artikel', 'bezeichnung',
  ],
  description: ['description', 'details', 'descripcion', 'descricao', 'beschreibung', 'designation'],
  price: [
    'price', 'rate', 'unit price', 'amount', 'cost', 'selling price', 'precio', 'preco', 'prix',
    'prix unitaire', 'preis', 'einzelpreis',
  ],
  unit: ['unit', 'units', 'usage unit', 'uom', 'unidad', 'unidade', 'unite', 'einheit'],
  sku: ['sku', 'code', 'item code', 'product code', 'ref', 'reference', 'codigo', 'artikelnummer'],
};

export type Mapping<F extends string> = Array<F | null>;

/** Best field for each column; each field is used at most once. */
export function guessMapping<F extends string>(
  headers: readonly string[],
  aliases: Record<F, string[]>,
): Mapping<F> {
  const used = new Set<F>();
  const fields = Object.keys(aliases) as F[];
  const exact = headers.map(h => {
    const n = norm(h);
    return fields.find(f => aliases[f].includes(n)) ?? null;
  });
  return exact.map((field, i) => {
    if (field && !used.has(field)) {
      used.add(field);
      return field;
    }
    // Fallback: a header that contains an alias ("Client email" → email).
    const n = norm(headers[i]!);
    const loose = fields.find(
      f =>
        !used.has(f) &&
        !exact.includes(f) &&
        aliases[f].some(a => a.length > 2 && ` ${n} `.includes(` ${a} `)),
    );
    if (loose) {
      used.add(loose);
      return loose;
    }
    return null;
  });
}

export const guessClientMapping = (headers: readonly string[]) =>
  guessMapping<ClientField>(headers, CLIENT_ALIASES);
export const guessItemMapping = (headers: readonly string[]) =>
  guessMapping<ItemField>(headers, ITEM_ALIASES);

export type ImportedClient = {
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  taxId: string | null;
  notes: string | null;
  isBusiness: boolean;
};

const pick = <F extends string>(row: readonly string[], mapping: Mapping<F>, field: F) => {
  const i = mapping.indexOf(field);
  const v = i >= 0 ? row[i]?.trim() : '';
  return v ? v : null;
};

/** Rows → clients. Rows without a name or company are skipped. */
export function toClients(
  rows: readonly string[][],
  mapping: Mapping<ClientField>,
): { clients: ImportedClient[]; skipped: number } {
  const clients: ImportedClient[] = [];
  let skipped = 0;
  for (const row of rows) {
    const company = pick(row, mapping, 'company');
    const name = pick(row, mapping, 'name') ?? company;
    if (!name) {
      skipped++;
      continue;
    }
    const cityLine = [
      pick(row, mapping, 'postcode'),
      pick(row, mapping, 'city'),
      pick(row, mapping, 'region'),
    ]
      .filter(Boolean)
      .join(' ');
    const address = [
      pick(row, mapping, 'address'),
      pick(row, mapping, 'address2'),
      cityLine || null,
      pick(row, mapping, 'country'),
    ]
      .filter(Boolean)
      .join('\n');
    const email = pick(row, mapping, 'email');
    clients.push({
      name,
      company: company && company !== name ? company : null,
      email: email && /\S+@\S+\.\S+/.test(email) ? email.toLowerCase() : null,
      phone: pick(row, mapping, 'phone'),
      billingAddress: address || null,
      taxId: pick(row, mapping, 'taxId'),
      notes: pick(row, mapping, 'notes'),
      isBusiness: !!company || !!pick(row, mapping, 'taxId'),
    });
  }
  return { clients, skipped };
}

export type ImportedItem = {
  name: string;
  description: string | null;
  priceText: string | null;
  unit: string | null;
  sku: string | null;
};

export function toItems(
  rows: readonly string[][],
  mapping: Mapping<ItemField>,
): { items: ImportedItem[]; skipped: number } {
  const items: ImportedItem[] = [];
  let skipped = 0;
  for (const row of rows) {
    const name = pick(row, mapping, 'name');
    if (!name) {
      skipped++;
      continue;
    }
    items.push({
      name,
      description: pick(row, mapping, 'description'),
      priceText: pick(row, mapping, 'price')?.replace(/[^\d.,-]/g, '') || null,
      unit: pick(row, mapping, 'unit'),
      sku: pick(row, mapping, 'sku'),
    });
  }
  return { items, skipped };
}

/** Which app a file probably came from, from its headers (shown as a hint). */
export function detectSource(headers: readonly string[]): string | null {
  const h = new Set(headers.map(norm));
  if (h.has('display name') && (h.has('emailid') || h.has('contact id'))) {
    return 'Zoho Invoice';
  }
  if (h.has('client name') && h.has('client email')) {
    return 'Invoice Simple';
  }
  if (h.has('business name') && h.has('contact name') && h.has('abn')) {
    return 'Bookipi';
  }
  if (h.has('customer') && h.has('billing street')) {
    return 'QuickBooks';
  }
  return null;
}
