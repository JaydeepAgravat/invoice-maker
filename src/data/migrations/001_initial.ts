/**
 * Schema v1.
 *
 * Conventions:
 *   *_minor   integer money in the currency's minor unit
 *   *_ppm     integer tax/discount rate, parts per million (1_000_000 = 100%)
 *   *_milli   integer quantity/distance in thousandths
 *   *_at      integer epoch milliseconds
 *   *_date    ISO calendar date TEXT (YYYY-MM-DD)
 *   ids       TEXT UUID v7 (time-ordered)
 *   deleted_at  soft delete; purged after 30 days
 */
export const migration001 = [
  `CREATE TABLE app_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,

  `CREATE TABLE business_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT, legal_name TEXT, email TEXT, phone TEXT, website TEXT,
    address TEXT,
    country TEXT NOT NULL DEFAULT 'OTHER',
    region TEXT,
    tax_id_label TEXT, tax_id TEXT,
    secondary_tax_id_label TEXT, secondary_tax_id TEXT,
    is_tax_registered INTEGER NOT NULL DEFAULT 1,
    logo_path TEXT, signature_path TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    locale TEXT NOT NULL DEFAULT 'en-US',
    language TEXT NOT NULL DEFAULT 'en',
    paper_size TEXT NOT NULL DEFAULT 'LETTER' CHECK (paper_size IN ('A4','LETTER')),
    measurement TEXT NOT NULL DEFAULT 'IMPERIAL' CHECK (measurement IN ('METRIC','IMPERIAL')),
    prices_include_tax INTEGER NOT NULL DEFAULT 0,
    rounding TEXT NOT NULL DEFAULT 'PER_LINE' CHECK (rounding IN ('PER_LINE','PER_TOTAL')),
    rounding_mode TEXT NOT NULL DEFAULT 'HALF_UP' CHECK (rounding_mode IN ('HALF_UP','HALF_EVEN')),
    numbering_style TEXT NOT NULL DEFAULT 'SEQUENTIAL' CHECK (numbering_style IN ('SEQUENTIAL','YEARLY')),
    default_terms_days INTEGER NOT NULL DEFAULT 30,
    default_notes TEXT, default_terms TEXT, default_footer TEXT,
    template_id TEXT NOT NULL DEFAULT 'classic',
    accent_color TEXT,
    font TEXT,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`,
  `INSERT INTO business_profile (id) VALUES (1)`,

  `CREATE TABLE payment_methods (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    label TEXT,
    fields_json TEXT NOT NULL DEFAULT '{}',
    show_qr INTEGER NOT NULL DEFAULT 0,
    is_default INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
  )`,

  `CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'CLIENT' CHECK (kind IN ('CLIENT','SUPPLIER')),
    name TEXT NOT NULL,
    company TEXT,
    is_business INTEGER NOT NULL DEFAULT 0,
    phone TEXT, tax_id TEXT, notes TEXT,
    billing_address TEXT, shipping_address TEXT,
    language TEXT, currency TEXT,
    default_terms_days INTEGER,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
  )`,
  `CREATE INDEX idx_clients_name ON clients(kind, name COLLATE NOCASE) WHERE deleted_at IS NULL`,

  `CREATE TABLE client_emails (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX idx_client_emails_client ON client_emails(client_id)`,

  `CREATE TABLE tax_rates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rate_ppm INTEGER NOT NULL CHECK (rate_ppm >= 0 AND rate_ppm < 1000000),
    kind TEXT NOT NULL DEFAULT 'STANDARD' CHECK (kind IN ('STANDARD','COMPOUND','WITHHOLDING')),
    is_default INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    preset_key TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`,

  `CREATE TABLE items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT,
    unit_price_minor INTEGER NOT NULL DEFAULT 0,
    sku TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
  )`,
  `CREATE INDEX idx_items_name ON items(name COLLATE NOCASE) WHERE deleted_at IS NULL`,

  `CREATE TABLE item_taxes (
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tax_rate_id TEXT NOT NULL REFERENCES tax_rates(id),
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (item_id, tax_rate_id)
  )`,

  `CREATE TABLE number_sequences (
    key TEXT PRIMARY KEY,
    doc_type TEXT NOT NULL,
    prefix TEXT NOT NULL,
    pad INTEGER NOT NULL DEFAULT 4,
    style TEXT NOT NULL CHECK (style IN ('SEQUENTIAL','YEARLY')),
    next_value INTEGER NOT NULL DEFAULT 1 CHECK (next_value >= 1)
  )`,

  `CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('INVOICE','ESTIMATE','RECEIPT','CREDIT_NOTE','PROFORMA',
      'DELIVERY_NOTE','CHANGE_ORDER','PURCHASE_ORDER','STATEMENT')),
    number TEXT,
    sequence_key TEXT,
    sequence_value INTEGER,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENT','VOID','ACCEPTED','DECLINED',
      'CONVERTED','DELIVERED','RECEIVED')),
    client_id TEXT REFERENCES clients(id),
    client_snapshot_json TEXT,
    business_snapshot_json TEXT,
    title TEXT,
    reference TEXT,
    issue_date TEXT NOT NULL,
    due_date TEXT,
    supply_date TEXT,
    valid_until TEXT,
    terms_days INTEGER,
    statement_from TEXT, statement_to TEXT,
    currency TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    prices_include_tax INTEGER NOT NULL DEFAULT 0,
    rounding TEXT NOT NULL DEFAULT 'PER_LINE',
    rounding_mode TEXT NOT NULL DEFAULT 'HALF_UP',
    discount_type TEXT CHECK (discount_type IN ('PERCENT','AMOUNT')),
    discount_value INTEGER,
    subtotal_minor INTEGER NOT NULL DEFAULT 0,
    discount_minor INTEGER NOT NULL DEFAULT 0,
    tax_total_minor INTEGER NOT NULL DEFAULT 0,
    withholding_minor INTEGER NOT NULL DEFAULT 0,
    total_minor INTEGER NOT NULL DEFAULT 0,
    paid_minor INTEGER NOT NULL DEFAULT 0,
    notes TEXT, terms TEXT, footer TEXT,
    template_id TEXT, accent_color TEXT, paper_size TEXT,
    payment_method_ids_json TEXT,
    source_document_id TEXT REFERENCES documents(id),
    signature_path TEXT,
    client_signature_path TEXT, client_signed_at INTEGER, client_signed_name TEXT,
    revision INTEGER NOT NULL DEFAULT 0,
    sent_at INTEGER,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
  )`,
  `CREATE UNIQUE INDEX idx_documents_number ON documents(doc_type, number) WHERE number IS NOT NULL`,
  `CREATE INDEX idx_documents_list ON documents(deleted_at, issue_date DESC, created_at DESC)`,
  `CREATE INDEX idx_documents_status ON documents(doc_type, status, due_date)`,
  `CREATE INDEX idx_documents_client ON documents(client_id)`,
  `CREATE INDEX idx_documents_source ON documents(source_document_id)`,

  `CREATE TABLE document_lines (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'ITEM' CHECK (kind IN ('ITEM','CHARGE')),
    item_id TEXT REFERENCES items(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT,
    quantity_milli INTEGER NOT NULL,
    unit_price_minor INTEGER NOT NULL,
    discount_type TEXT CHECK (discount_type IN ('PERCENT','AMOUNT')),
    discount_value INTEGER,
    gross_minor INTEGER NOT NULL DEFAULT 0,
    net_minor INTEGER NOT NULL DEFAULT 0,
    base_minor INTEGER NOT NULL DEFAULT 0,
    total_minor INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX idx_lines_document ON document_lines(document_id, position)`,

  `CREATE TABLE document_line_taxes (
    line_id TEXT NOT NULL REFERENCES document_lines(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    tax_rate_id TEXT,
    name TEXT NOT NULL,
    rate_ppm INTEGER NOT NULL,
    kind TEXT NOT NULL,
    amount_minor INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (line_id, position)
  )`,

  `CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    amount_minor INTEGER NOT NULL,
    paid_on TEXT NOT NULL,
    method TEXT,
    reference TEXT,
    note TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX idx_payments_document ON payments(document_id)`,
  `CREATE INDEX idx_payments_date ON payments(paid_on)`,

  `CREATE TABLE attachments (
    id TEXT PRIMARY KEY,
    document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('PHOTO','CLIENT_SIGNATURE')),
    path TEXT NOT NULL,
    width INTEGER, height INTEGER,
    caption TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX idx_attachments_document ON attachments(document_id, position)`,

  `CREATE TABLE activity_log (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    payload_json TEXT,
    at INTEGER NOT NULL
  )`,
  `CREATE INDEX idx_activity_document ON activity_log(document_id, at)`,

  `CREATE TABLE document_revisions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    snapshot_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,

  `CREATE TABLE share_log (
    id TEXT PRIMARY KEY,
    document_id TEXT,
    channel TEXT,
    month TEXT NOT NULL,
    shared_at INTEGER NOT NULL
  )`,
  `CREATE INDEX idx_share_month ON share_log(month, document_id)`,

  `CREATE TABLE expenses (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    vendor TEXT,
    category TEXT,
    amount_minor INTEGER NOT NULL,
    tax_minor INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL,
    client_id TEXT REFERENCES clients(id),
    document_id TEXT REFERENCES documents(id),
    note TEXT,
    receipt_path TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
  )`,
  `CREATE INDEX idx_expenses_date ON expenses(date)`,

  `CREATE TABLE mileage (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    from_place TEXT, to_place TEXT,
    distance_milli INTEGER NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('km','mi')),
    rate_minor INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL,
    purpose TEXT,
    client_id TEXT REFERENCES clients(id),
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
  )`,
  `CREATE INDEX idx_mileage_date ON mileage(date)`,

  `CREATE TABLE recurring_schedules (
    id TEXT PRIMARY KEY,
    template_document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL CHECK (frequency IN ('WEEKLY','MONTHLY','QUARTERLY','YEARLY')),
    interval INTEGER NOT NULL DEFAULT 1,
    next_date TEXT NOT NULL,
    end_date TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`,

  // Full-text search over documents. Maintained by the documents repository.
  `CREATE VIRTUAL TABLE documents_fts USING fts5(
    document_id UNINDEXED,
    number, client, body,
    tokenize = 'unicode61 remove_diacritics 2'
  )`,
];
