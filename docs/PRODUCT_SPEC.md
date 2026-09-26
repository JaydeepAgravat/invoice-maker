# App 1: Offline Invoice & Estimate Maker (Android, React Native)

**Build-ready report for Claude Code.** Research date: 26 Sep 2026. 

> **How to use this file with Claude Code**
> 1. Put this file in the repo root as `docs/PRODUCT_SPEC.md` (or paste the "Build plan" section into `CLAUDE.md`).
> 2. Ask Claude Code to work milestone by milestone (section 11). Each milestone has acceptance criteria you can turn into tests.
> 3. Sections 1–3 explain *why* each feature exists. Sections 4–12 are the *what* and *how*.
> 4. Anything marked **(verify)** was not fully confirmed during research. Check it before relying on it.
> 5. **Project rule: bare React Native (React Native Community CLI). Do not use Expo, Expo modules, expo-* packages, EAS or config plugins.** Native code goes in `android/` as Kotlin Turbo Modules / Fabric components.

---

## 0. TL;DR

| Item | Decision |
|---|---|
| Product | Offline invoice, estimate/quote and receipt maker for freelancers and small tradespeople |
| Markets | US, UK, Canada, Australia (English). **Not** India GST billing (Vyapar/myBillBook price war) |
| Positioning | **Unlimited invoices. No account. Works offline. Pay once.** |
| Price | Free tier (see section 3.1) + **$24.99 lifetime unlock** (launch price $19.99). Use Play per-country pricing |
| Backend | None. Local SQLite, on-device PDF, share sheet, backup to the user's own Google Drive |
| Stack | **Bare React Native (CLI, no Expo)**, New Architecture, op-sqlite, custom Kotlin HTML→PDF Turbo Module, react-native-iap |
| v1 build time | ~4–6 weeks solo |
| Biggest risks | "Lost my invoices when I changed phones" (solve with backup), no payment links or "client viewed" tracking (be upfront), Play fee ~15% |

**Why this wins:** about 65% of critical reviews across the top invoice apps are about pricing: price hikes, surprise paywalls after N invoices, free tiers removed, double charges, and one-time purchases converted to subscriptions. No sizeable Play app clearly sells "unlimited, offline, no account, one-time". The closest (BillGo's Simple Invoice) has a lifetime tier, but buyers complain it isn't recognized.

---

## 1. Market analysis

### 1.1 Competitor table

Prices are USD from vendor pricing pages and App Store in-app purchase lists. Play prices can differ, so treat them as "as listed, Sep 2026".

| App (package) | Installs · Rating | Unlimited plan | Free tier | Account | Offline | Lifetime |
|---|---|---|---|---|---|---|
| **Invoice Simple** (`com.aadhk.woinvoice`) | 5M+ (7.6M total, ~23k/mo) · 4.7–4.8★ (160–170k) | Premium $21.99/mo or $219.99/yr. Essentials $6.99/mo = 3 invoices/mo; Plus $14.99/mo = 10/mo | 14-day trial only | Yes | No | No |
| **Invoice2go** (`com.invoice2go.invoice2goplus`, owned by BILL) | 1M+ (3.5M total) · 4.3–4.5★ (31k) | Premium $39.99/mo or $399.99/yr. Starter $5.99/mo = 30 invoices/**year** | 30-day trial, **card required** | Yes | No | No |
| **Invoice Fly** (`io.labhouse.invoicesapp`) | 1M+ (~180k downloads/mo, fastest growing) · 4.5–4.7★ (125–131k) | $5.99–9.99/**week**, $17.99/mo, $98.99/yr | Effectively none (3-day trial, email + card) | Yes | No | No |
| **Bookipi** (`bookipi.invoice.maker.estimate.billing`) | 1M+ (1.7M) · 4.2–4.6★ (66k) | $12.99/mo or $129.99/yr | 3 docs/mo **with watermark** (since Mar 2025) | Yes | No | No |
| **Joist** (`com.joistapp.android.joist`) | 1M+ (2.1M) · 4.0–4.6★ (13.4k) | Pro $16.99/mo or $169.99/yr. Basics $9.99/mo = 5 docs/mo | **Free plan discontinued**; 14-day trial | Yes | No | No |
| **Square Invoices** (`com.squareup.invoicesapp`) | 1M+ · 4.6–4.7★ (19.8k) | Free; earns on card fees (3.3% + 30¢ online) | Unlimited | Yes (KYC) | No | n/a |
| **Zoho Invoice** (`com.zoho.invoice`) | 1M+ (3.1M) · 4.8–4.9★ (~31k) | Free | 500 invoices/yr, "Powered by Zoho" | Yes | No | n/a |
| **Simple Invoice** by BillGo (`invoice.invoicemaker.simple`) | 500k+ · 4.6–4.7★ (5.5k) | Yearly sub + **lifetime** (prices not found) | A few invoices, then paywall | No | **Yes** | Yes |
| **Freebie Invoice Maker** (`app.invoice_maker`) | 500k+ · 4.8★ (19.1k) | ~$200/yr unlimited (per reviews); ~$49.99/yr = 3/mo | 5 documents | **No login** | **Yes** | No |
| **Easy Invoice** (`com.invoice.maker`) | 500k+ · 3.7–3.9★ | Ads + IAP (prices not found) | Free with ads | ? | ? | ? |
| **Simple Invoice Manager** (`com.invoiceapp`, IN) | 5M+ · 4.7★ (36.9k) | **$24.99/yr** (cheapest found) | 1-month trial | Yes | Offline + Dropbox backup | No |
| **SpeedInvoice** (`au.com.speedinvoice.android`) | 1M+ · 4.9★ (36.2k) | ~$97.80/yr | ? | Cloud backup | Offline creation | No |
| **InvoiceBase** (Gulooloo) | 1M+ · 4.9★ (60k) | ? | ~5 items | Google login | ? | ? |
| **Invoice Home** | 1M+ · 4.4★ | Unlimited plan (price not found) | Free up to $1,000 invoiced/month | Yes | ? | No |
| **MobileBiz Pro** / **Invoice Pro** | 10k+ / 100k+ | Subscription (**both were one-time before**) | Limited | Optional | Yes | **Removed** → angry 1–2★ reviews |

**Pricing anchor:** most unlimited plans cost $98–$220/year. A $19.99–$29.99 lifetime unlock costs less than 2–3 months of most competitors.

### 1.2 Competitor profiles (pros / cons)

**Invoice Simple** (category leader by brand)
- Pros: easiest UX, strong ratings, clients love "invoice viewed" notifications, saved clients and items.
- Cons: metered caps (3 or 10 invoices/month) on lower tiers; repeated price hikes (legacy SKUs visible); reports of double charges and AI-only support; a reviewer says there is no data export.
- Backend: heavy (accounts, sync, payments, read receipts).

**Invoice2go**
- Pros: mature and full-featured (projects, expenses, accounting integrations, web app).
- Cons: the harshest price-hike complaints; card-required trial; accounts deleted after cancelling; chatbot-first support.

**Invoice Fly**
- Pros: very polished onboarding, strong ASO, simple "all unlimited" plan, AI price estimator, photos, signatures.
- Cons: **weekly pricing** dark pattern; practically no free use; surprise charges; inaccurate AI estimator; Stripe payout holds.

**Bookipi**
- Pros: rich document types (credit notes, delivery notes, purchase orders); used to be "the best free app".
- Cons: removed free tier in Mar 2025 (many angry reviews); the Aug 2025 redesign broke workflows; watermark on free docs.

**Joist** (contractors)
- Pros: trade-specific estimates, material/labor lists, change orders, contracts.
- Cons: removed free plan; repeated price rises; slow support; can't store multiple emails per client; historically no UK bank transfer (BACS) option.

**Square / Zoho** (free, but tied to accounts)
- Pros: free and unlimited (Square) or 500/yr (Zoho).
- Cons: need a KYC account (Square) or cloud login (Zoho); branding on invoices; processing fees. They set the "free" expectation, but serve a different user.

**BillGo Simple Invoice / Freebie** (closest to your positioning)
- Pros: offline, no login, fast.
- Cons: surprise paywall after a few invoices ("shady"); **no backup → lost invoices on phone change**; lifetime buyers can't get purchase confirmed; bugs (discount carrying over to new invoices).

### 1.3 Review analysis: complaints

About 110 critical reviews were read across Play (US/GB/AU/CA), the App Store, Trustpilot, JustUseApp and Capterra. Counts are rough; themes overlap. Reddit was not accessible.

| # | Theme | ~Count | What it means for you |
|---|---|---|---|
| 1 | Price hikes on existing subscribers | 22 | One price, forever. Say so on the store page |
| 2 | "Free" app with hidden paywall after N invoices | 16 | State the free limit **before** users enter data. Never lock invoices they already made |
| 3 | Free tier removed / features newly paywalled | 12 | Publicly promise never to remove what someone paid for |
| 4 | Poor or AI-only support | 20 | Human email support; in-app "Contact developer" with logs |
| 5 | Updates break workflows | 20 | Stable UI, staged rollouts, no forced redesigns |
| 6 | Billing errors (double charges, charges after cancel, refunds refused) | 12 | One-time IAP avoids this by design |
| 7 | Data loss / account deleted / no export | 14 | Full export (PDF, CSV, backup file) from day 1 |
| 8 | Payment holds (Stripe/Square/Joist Pay) | 15 | You don't process payments; put the user's own payment details or links on invoices |
| 9 | One-time purchase converted to subscription | 5 | **Never do this.** Grandfather lifetime buyers in writing |
| 10 | PDF layout issues (page breaks, logo, spacing) | 6 | Test multi-page invoices; handle page breaks in CSS |
| 11 | Offline apps lose data when changing phones | 3 | Backup must be prominent (onboarding + reminders) |
| 12 | Nag screens, forced tutorials, review prompts | 4 | No nags after unlock; tutorial skippable forever |
| 13 | Lifetime purchase not recognized | 2 | "Restore purchase" button + automatic restore on reinstall |
| 14 | Auto-saved one-off line items clutter the item list | 4 | Toggle "Save item to catalog" per line |
| 15 | Too many permissions / forced login | 4 | Request only what's needed, at the moment it's needed |

### 1.4 Review analysis: praise (what to copy)

| Theme | ~Count | Implication |
|---|---|---|
| Easy, no learning curve | 55 | First invoice in under 60 seconds |
| Professional-looking documents | 35 | Invest in 4–6 beautiful templates |
| Fast enough to invoice on site | 18 | Big buttons, one-handed, quick duplicate |
| Saved clients and items autofill | 15 | Client and item catalogs with search |
| Free / good value | 12 | Generous free tier |
| Human support | 10 | Respond to every review |
| Long-term reliability | 8 | Stable data format, migrations tested |
| Photo attachments | 4 | Job photos on invoices/estimates |

### 1.5 Feature requests seen in reviews

- Toggle to stop auto-saving line items; bulk delete saved items
- Multiple emails per client
- Estimate revisions; change orders
- Pro-forma invoices; "delivered" stamps
- Payment date next to "Paid"; partial payments with type (cash, card, transfer)
- **Decimal quantities** (1.5 hours)
- Bulk export and reports by customer
- **Bank transfer details** on invoices (ACH, BACS, BSB, Interac e-Transfer)
- Terms & conditions acceptance; adjustable font size
- Custom fonts; template search; industry templates
- Thermal printer receipts (58/80 mm)
- Ink-saving / minimal template
- Photos from estimate carried over to invoice
- Edit after sending
- Hourly and daily rate items; tips
- Recurring invoices with reminders
- CSV import of clients and products
- Duplicate invoice
- Expense and mileage tracking with receipt photos

---

## 2. Positioning & target users

**One-line pitch:** *"Make professional invoices, estimates and receipts in seconds. Unlimited. No account. Works offline. Pay once."*

**Primary users**
1. Solo tradespeople: plumbers, electricians, cleaners, handymen, landscapers (US/UK/AU/CA). They invoice on site from a phone.
2. Freelancers: designers, tutors, photographers, consultants.
3. Micro-businesses: 1–3 people, no accountant software yet.

**Jobs to be done**
- Send a quote before starting a job, then convert it to an invoice.
- Get paid (show payment details and a payment link).
- Know who owes what; track paid, unpaid, overdue.
- Hand records to an accountant at tax time (CSV / PDF export).

**Non-goals (v1)**
- Payment processing, hosted payment pages, "client viewed" tracking (needs a server).
- Multi-device live sync, web app, team accounts.
- Full accounting (ledger, bank feeds).
- India GST, e-invoicing / e-way bills.

**Honesty about limits:** say clearly in the listing and FAQ that the app doesn't process payments and has no web version, and that invoices can include the user's own PayPal.me, Stripe Payment Link, Venmo, Square link or bank details.

---

## 3. Pricing & monetization rules

### 3.1 Model
- **Free tier:** unlimited clients, items and drafts. **Up to 5 sent (exported/shared) documents per calendar month**, with a small footer "Made with <AppName>". All data export is always free.
  - Alternative to A/B test later: unlimited but watermark on free. Pick one for v1: **5/month + footer** (clear, generous, easy to explain).
- **Lifetime Pro (non-consumable IAP `pro_lifetime`):** unlimited documents, no footer, all templates, photos, signatures, reports, recurring reminders, Drive backup automation.
- Launch price $19.99 → list $24.99. Suggested regional: UK £19.99, EU €21.99, AU A$34.99, CA C$29.99, IN ₹499 (India isn't the target market, but a low price costs nothing).

### 3.2 Rules (from review analysis)
1. Show the free limit on the store page, on the first onboarding screen and as a counter ("3 of 5 free this month").
2. Never block **viewing, editing, exporting data or backup** of existing documents. The limit applies only to generating new PDFs/shares beyond 5 per month.
3. No paywall on first launch. The paywall appears only on the 6th share in a month, or when the user taps a Pro feature.
4. No weekly or monthly plans. No trials that auto-convert.
5. Written promise on the store page: *"Lifetime means lifetime. We will never turn your purchase into a subscription."*
6. "Restore purchase" in Settings, plus automatic restore on launch.

### 3.3 Google Play fees (verify in Play Console)
- From 30 Jun 2026 (US/UK/EEA) and 30 Sep 2026 (AU): first $1M/year = 10% service fee + ~5% billing fee ≈ **15%**, the same for one-time purchases and subscriptions. Canada probably follows the rest-of-world date (2027) **(verify)**.
- New apps and updates must use **Play Billing Library 8+** since 31 Aug 2026.
- **Acknowledge purchases within 3 days** or Google auto-refunds them.

---

## 4. Invoice compliance requirements (build these into the data model)

| Market | Must support |
|---|---|
| **US** | No federal format. Unique invoice numbers. Sales tax per line or total, multiple rates. Optional tax ID/permit field. Letter paper (8.5×11) default |
| **UK** | Unique number, supply date + issue date, seller and customer name/address, description, amounts. **VAT-registered:** sequential number, VAT number, per-line qty / unit price / VAT rate (20/5/0/exempt), total excl. VAT, **total VAT in GBP**. Simplified VAT invoice allowed at £250 or less. Use "Quote" wording. A4 default |
| **Canada** | Under $100: seller name, date, total. $100–499.99: + **GST/HST number** (BN + RT0001), tax charged, taxable vs exempt items. $500+: + buyer name, description, payment terms. GST 5%, HST 13–15% by province, PST/QST separate **(verify current rates)** |
| **Australia** | Document titled **"Tax invoice"** if GST-registered, seller **ABN** (11 digits, checksum validation), date, description, qty, price, GST amount or "includes GST". $1,000+: buyer identity or ABN. Not registered → title "Invoice" and no GST. GST 10%. A4 default |

**Derived requirements**
- Configurable prefix + sequential numbering per document type (INV-0001, QUO-0001, REC-0001). Numbers are never reused. Deleting a sent invoice becomes **void** (keeps the number) or a credit note.
- Tax engine: none / single / multiple per line / compound; tax-inclusive or tax-exclusive prices.
- Business tax ID label configurable: EIN / VAT No. / GST/HST No. / ABN.
- Dates: issue date, supply date (optional, UK), due date, payment terms (Net 7/14/30, due on receipt, custom).
- Payment details block: bank (ACH routing/account, UK sort code/account, AU BSB/account, CA transit/institution), Interac e-Transfer email, PayPal.me, custom payment link, **QR code** for the link.
- Region presets at onboarding pick defaults: currency, date format, paper size, tax names, terminology (Estimate vs Quote).

---

## 5. Feature spec

Priority: **P0** = v1 launch, **P1** = within 1–2 updates, **P2** = later.

### 5.1 Onboarding (P0)
- Pick country (US/UK/CA/AU/Other) → sets currency, tax preset, paper size, terminology.
- Business profile: name, logo (optional), address, email, phone, tax ID (label by country), payment details. Everything is skippable; "Create first invoice" is the primary button.
- Backup prompt: "Protect your invoices: turn on Google Drive backup" (skippable; reminded later).
- **Acceptance:** a new user can export their first invoice PDF in under 60 seconds without filling in the profile.

### 5.2 Documents (P0)
- Types: **Invoice**, **Estimate/Quote**, **Receipt**. P1: Credit note, Pro-forma invoice. P2: Purchase order, Delivery note.
- Fields: number (auto), issue date, due date/terms, supply date (toggle), client, line items, discount (line % / $ and document % / $), tax (per line and/or document), shipping/other charges (P1), notes, terms, signature(s), photos (Pro), payment details, footer.
- Line item: name, description (multi-line), quantity (**decimal**), unit (hr, day, item, m², custom), unit price, discount, tax rate(s), "save to catalog" toggle.
- Actions: Save draft, Preview, Share PDF, Print, Duplicate, **Convert estimate → invoice** (keeps photos and lines), Mark as sent, Record payment, Void.
- Status: Draft, Sent, Partially paid, Paid, Overdue (computed from due date), Void. Estimates: Draft, Sent, Accepted, Declined, Converted.
- Payments: multiple partial payments with date, amount, method (cash, card, bank transfer, cheque, other), note. Show "Paid on <date>" on the PDF.
- **Acceptance:**
  - Totals match a reference calculation for inclusive and exclusive tax, compound tax, and per-line + document discounts (unit tests with fixtures per country).
  - Rounding uses integer minor units (cents); round per line vs per total is configurable, default per line.
  - A 40-line invoice renders across multiple pages with repeated table headers and no split rows.

### 5.3 Clients & items (P0)
- Client: name, company, multiple emails (P1 for multiple), phone, billing address, shipping address (P1), tax ID, notes, default terms.
- Item catalog: name, description, unit, price, default tax, SKU (P1). Search as you type in the line editor.
- Import contacts from the phone (P1, runtime permission only when tapped). CSV import clients and items (P1).
- Client detail: all documents, total billed, outstanding balance.

### 5.4 PDF templates (P0: 4 templates; P1: 8+)
- Templates: Classic, Modern, Minimal (ink-saving), Bold (colored header). All support logo, accent color, font choice (3–4 bundled fonts), Letter/A4, a signature block and a photo appendix page.
- Pro-only templates can be previewed by free users (watermarked preview).
- Tax invoice title logic (AU/UK/CA) comes from the business profile.
- Payment QR code rendered from the payment link (on-device QR generation).
- **Acceptance:** PDF text is selectable (HTML → print, not an image); logo and signature embedded as base64 data URIs; file size under 1 MB without photos.

### 5.5 Sharing (P0)
- Share sheet: PDF attachment with prefilled subject/body (templates with variables: `{client_name}`, `{invoice_number}`, `{amount_due}`, `{due_date}`).
- Direct: Email, WhatsApp, SMS (text + PDF), Print (Android print framework), Save to Files.
- Each share counts toward the free monthly limit (drafts and previews don't).

### 5.6 Dashboard & reports (P0 basic, P1 full)
- Home: outstanding total, overdue total, paid this month; list of recent documents with status chips; filters (status, client, date).
- Reports (P1): income by month, by client, tax collected per period, unpaid aging (0–30, 31–60, 61–90, 90+). Export CSV.

### 5.7 Backup & export (P0, non-negotiable)
Three layers:
1. **Android Auto Backup** configured (`dataExtractionRules`) as a silent safety net. Test with SQLite WAL (checkpoint before backup, or exclude the WAL file).
2. **Manual backup file:** "Export backup" writes `AppName-backup-YYYYMMDD.zip` (DB dump as JSON + images) through the Storage Access Framework. "Restore backup" imports it with a preview ("1,203 documents, 87 clients") and a merge-or-replace choice.
3. **Google Drive backup (P0 manual, P1 automatic weekly):** sign in only when the user taps it; `drive.appdata` scope (non-sensitive, basic OAuth verification); keep the last 5 backups.
- CSV export: documents, line items, clients, items, payments. Always free.
- Reminder banner if the last backup is older than 14 days and there are more than 10 documents.
- **Acceptance:** uninstall → reinstall → restore from Drive or file brings back all documents, images, numbering counters and settings. Tested on 2 devices.

### 5.8 Settings (P0)
Business profile, numbering (prefix, next number, per type), defaults (terms, notes, tax, currency, paper size, rounding), templates and accent color, email templates, backup, restore purchase, contact support (email with app version + device info, no personal data), privacy policy, licenses.

### 5.9 P1 / P2 backlog
- P1: recurring invoice **reminders** (local notification: "Monthly invoice for Acme is due to send" → one tap duplicates it; no auto-send without a server), overdue reminders (local notification to the user), payment reminder message template, expense log with receipt photo, mileage log, change orders on estimates, estimate revisions, client signature capture on device (sign on the phone at the job), multi-currency per client, dark mode.
- P2: thermal printer receipts (ESC/POS over Bluetooth), home-screen widget (outstanding total), time tracking → invoice, localization (ES, FR-CA), Wear OS tile.

---

## 6. Screens & navigation

```
Tabs: [Documents] [Clients] [Items] [Reports] [Settings]
FAB on Documents: New Invoice / New Estimate / New Receipt

Documents list → Document editor → Line item sheet (bottom sheet)
                                 → Client picker (search + create inline)
                                 → Preview (WebView of the HTML) → Share / Print / Save
                → Document detail (status, payments, activity log: created/sent/paid)
Clients list → Client detail (documents, balance) → Edit client
Items list → Edit item
Reports → Income / Clients / Tax / Aging (P1)
Settings → Business profile, Numbering, Defaults, Templates, Backup & restore, Pro, Support
Paywall (modal) → only on a Pro feature tap or the 6th share of the month
```

UX rules: one-handed reach (primary actions at the bottom), numeric keypad for money fields, currency formatting while typing, autosave drafts every change, undo snackbar on delete, empty states that teach (one sentence + one button).

---

## 7. Data model (SQLite)

Money is stored as **INTEGER minor units** (cents). Rates are stored as **INTEGER basis points** (e.g. 1000 = 10.00%).

```sql
CREATE TABLE business_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT, email TEXT, phone TEXT, website TEXT,
  address_line1 TEXT, address_line2 TEXT, city TEXT, region TEXT, postcode TEXT, country TEXT,
  tax_id_label TEXT, tax_id TEXT,              -- 'ABN', 'VAT No.', 'GST/HST No.', 'EIN'
  is_tax_registered INTEGER DEFAULT 0,
  logo_path TEXT, signature_path TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  paper_size TEXT NOT NULL DEFAULT 'LETTER',   -- 'A4' | 'LETTER'
  locale TEXT NOT NULL DEFAULT 'en-US',
  payment_details_md TEXT,                     -- free text shown on invoices
  payment_link TEXT                            -- rendered as QR
);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,                         -- uuid v7
  name TEXT NOT NULL, company TEXT,
  phone TEXT, tax_id TEXT, notes TEXT,
  billing_address TEXT, shipping_address TEXT,
  default_terms_days INTEGER, currency TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE TABLE client_emails (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id),
  email TEXT NOT NULL, is_primary INTEGER DEFAULT 0);

CREATE TABLE tax_rates (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,     -- 'GST', 'HST ON', 'VAT 20%'
  rate_bp INTEGER NOT NULL, is_compound INTEGER DEFAULT 0, is_default INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0
);

CREATE TABLE items (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, unit TEXT,
  unit_price_minor INTEGER NOT NULL DEFAULT 0, default_tax_id TEXT REFERENCES tax_rates(id),
  sku TEXT, created_at INTEGER, updated_at INTEGER, deleted_at INTEGER
);

CREATE TABLE number_sequences (doc_type TEXT PRIMARY KEY, prefix TEXT NOT NULL, next_value INTEGER NOT NULL, pad INTEGER DEFAULT 4);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  doc_type TEXT NOT NULL,                      -- 'INVOICE','ESTIMATE','RECEIPT','CREDIT_NOTE','PROFORMA'
  number TEXT,                                 -- assigned on first save; never reused
  status TEXT NOT NULL,                        -- DRAFT, SENT, PARTIAL, PAID, VOID, ACCEPTED, DECLINED, CONVERTED
  client_id TEXT REFERENCES clients(id),
  client_snapshot_json TEXT,                   -- frozen client details when sent
  issue_date TEXT NOT NULL, due_date TEXT, supply_date TEXT, terms_days INTEGER,
  currency TEXT NOT NULL,
  prices_include_tax INTEGER DEFAULT 0,
  discount_type TEXT, discount_value INTEGER,  -- 'PERCENT' (bp) | 'AMOUNT' (minor)
  shipping_minor INTEGER DEFAULT 0,
  subtotal_minor INTEGER, tax_total_minor INTEGER, total_minor INTEGER, paid_minor INTEGER DEFAULT 0,
  notes TEXT, terms TEXT, footer TEXT,
  template_id TEXT, accent_color TEXT,
  source_document_id TEXT REFERENCES documents(id), -- estimate → invoice link
  sent_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE INDEX idx_documents_status ON documents(doc_type, status, due_date);
CREATE INDEX idx_documents_client ON documents(client_id);

CREATE TABLE document_lines (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, item_id TEXT REFERENCES items(id),
  name TEXT NOT NULL, description TEXT, unit TEXT,
  quantity_milli INTEGER NOT NULL,             -- 1500 = 1.5
  unit_price_minor INTEGER NOT NULL,
  discount_type TEXT, discount_value INTEGER,
  line_subtotal_minor INTEGER, line_tax_minor INTEGER, line_total_minor INTEGER
);
CREATE TABLE document_line_taxes (line_id TEXT REFERENCES document_lines(id) ON DELETE CASCADE,
  tax_rate_id TEXT REFERENCES tax_rates(id), name TEXT, rate_bp INTEGER, is_compound INTEGER, amount_minor INTEGER);

CREATE TABLE payments (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id),
  amount_minor INTEGER NOT NULL, paid_on TEXT NOT NULL, method TEXT, note TEXT, created_at INTEGER
);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY, document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
  kind TEXT,                                   -- 'PHOTO','CLIENT_SIGNATURE'
  path TEXT NOT NULL, width INTEGER, height INTEGER, position INTEGER
);

CREATE TABLE share_log (id TEXT PRIMARY KEY, document_id TEXT, shared_at INTEGER NOT NULL, channel TEXT); -- free-tier counting
CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER);
```

Rules:
- The calculation engine is a **pure TypeScript module** (`src/domain/calc.ts`) with no React imports and 100% unit-test coverage.
- Freeze client and business details into snapshots when a document is sent, so later edits don't change old invoices.
- Soft-delete (`deleted_at`) everywhere; purge after 30 days.
- Migrations are versioned, forward-only and tested with fixture databases.

---

## 8. Tech stack

Versions as checked on npm, 26 Sep 2026. Re-check at project start.

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Bare React Native (React Native Community CLI, latest stable 0.8x), New Architecture + Hermes, TypeScript strict. No Expo, no Expo modules** | RN 0.79+ is needed for Nitro-based IAP. Create with `npx @react-native-community/cli init` |
| Navigation | **React Navigation 7** (native stack + bottom tabs) | Tabs + stack |
| DB | **@op-engineering/op-sqlite** (18.x, JSI, fast) | Avoid WatermelonDB (no release since Apr 2025) and react-native-quick-sqlite (superseded) |
| Queries | Drizzle ORM (op-sqlite driver) or hand-written SQL + zod | Keep the domain layer pure |
| Settings / entitlement cache | **react-native-mmkv 4.x** | Not for business data |
| State | Zustand + TanStack Query (local queries) or just hooks around the repo | |
| Forms | react-hook-form + zod | Money inputs with a custom masked component |
| PDF | **Small custom Kotlin Turbo Module `HtmlToPdf`** (~150 lines): load the HTML into an off-screen `WebView`, then `createPrintDocumentAdapter()` → write to a file with `PrintAttributes` (A4/Letter, margins). Also expose `print(html)` via `PrintManager` | This is the same approach expo-print uses internally. Quick-start alternative: react-native-html-to-pdf (1.3.0, Sep 2025; slow release cadence, check it builds on the New Architecture **(verify)**). Use CSS `@page { size: A4; margin: 12mm }`; **embed images as base64 data URIs** (file URLs often don't load in the print WebView) |
| PDF preview | react-native-webview rendering the same HTML | What you see = what prints |
| Signature | **react-native-signature-canvas 5.x** | Outputs base64 PNG. Avoid react-native-signature-capture (dead since 2021) |
| Images | **react-native-image-picker** (camera/gallery) + **@bam.tech/react-native-image-resizer** (resize to ≤1600 px, JPEG 0.8) **(verify maintenance)** | Keep PDFs small |
| QR | react-native-qrcode-svg or generate SVG string in HTML | For payment links |
| Files / share | **@dr.pogodin/react-native-fs** (maintained fork) or react-native-blob-util; **react-native-share**; **@react-native-documents/picker**; zip via **react-native-zip-archive** **(verify)** | Avoid the original react-native-fs (abandoned) |
| Drive backup | @react-native-google-signin/google-signin + Drive REST (`spaces=appDataFolder`) via fetch | Check the package docs for the current recommended Android auth path (Credential Manager / AuthorizationClient) **(verify)** |
| IAP | **react-native-iap 16.x** (requires react-native-nitro-modules) | Repo archived Aug 2026, development moved to `hyodotdev/openiap`; npm still publishes. Alternative: RevenueCat (free under $2.5k/month revenue) |
| Notifications | **@notifee/react-native** (local notifications + scheduled triggers) | Overdue and recurring reminders |
| Build & release | Gradle (`./gradlew bundleRelease`), Fastlane `supply` or GitHub Actions to upload AABs to Play | No EAS |
| Crash reporting | Optional: Sentry (free tier). Or none, keeping the Data Safety form "no data collected" | Decide early; it affects the listing |
| Testing | Jest (domain), React Native Testing Library, Maestro (E2E flows) | |

**Architecture**
```
android/app/src/main/java/<pkg>/
  htmltopdf/     HtmlToPdfModule.kt (Turbo Module: toPdf(html, paper, margins) → path; print(html))
src/
  specs/         NativeHtmlToPdf.ts (codegen spec for the Turbo Module)
  domain/        calc.ts, numbering.ts, tax-presets.ts, money.ts (pure TS, fully unit tested)
  data/          db.ts, migrations/, repositories/ (documents, clients, items, payments)
  pdf/           templates/*.ts (HTML string builders), render.ts (calls NativeHtmlToPdf), assets.ts (base64)
  backup/        zip-export.ts, zip-import.ts, drive.ts, auto-backup rules
  billing/       iap.ts (init, purchase, restore, acknowledge), entitlement.ts (MMKV cache)
  features/      documents/, clients/, items/, reports/, settings/, onboarding/, paywall/
  ui/            design system: tokens, Button, MoneyInput, Sheet, EmptyState...
```

---

## 9. Implementation notes & pitfalls

1. **Money math:** never floats. Integer minor units, banker's rounding or half-up per locale (default half-up), round per line. Snapshot tests per country preset.
2. **Numbering:** assign the number inside a transaction on first save; `next_value` increments atomically. Users can edit the next number (for migrating from another app) but not below an existing number.
3. **PDF pagination:** use `thead { display: table-header-group }` to repeat headers; `tr { page-break-inside: avoid }`. Photo appendix on a new page. Test long descriptions and 40+ lines.
4. **Fonts in PDF:** embed WOFF2 fonts as base64 `@font-face` in the HTML; verify they render in the print WebView.
5. **Large logos:** resize on import (max 600 px wide) to keep PDFs small.
6. **IAP flow:**
   - `initConnection` at start → `getAvailablePurchases` → if `pro_lifetime` is found and `purchaseState` is purchased → cache entitlement in MMKV → **acknowledge if not acknowledged**.
   - Purchase flow listener must acknowledge within 3 days; handle pending purchases (cash payments in some countries).
   - Re-verify on each launch when online; if a purchase is revoked or refunded, remove Pro gracefully (keep all data).
7. **Free-limit counting:** count successful shares/prints/saves of new PDFs per calendar month from `share_log`. Re-sharing the same document in the same month doesn't count again.
8. **Auto Backup + SQLite:** run `PRAGMA wal_checkpoint(FULL)` on app background, or use journal mode DELETE; include the DB and images directory in `dataExtractionRules`; the 25 MB limit means photos may not fit, so rely on the zip/Drive backup for photos.
9. **Permissions:** no storage permission needed with SAF. Camera and contacts only when tapped. POST_NOTIFICATIONS only when enabling reminders.
10. **Play requirements:** target API 36 (required for new apps/updates since 31 Aug 2026); 16 KB page-size aligned native libraries (required from 1 Feb 2027); Play Billing Library 8+.
11. **Data Safety form:** if there's no analytics/crash SDK, declare "No data collected" and "No data shared". Google Drive backup is user-initiated to the user's own account; declare it per Google's guidance **(verify wording)**.

---

## 10. Play Store listing (ASO draft)

Titles lead with "Invoice Maker" across the category; offline/no-subscription keywords are largely unused.

- **Title (≤30 chars):** `Invoice Maker: Offline & Easy` (or `<Brand> Invoice Maker`)
- **Short description (≤80):** `Invoices, estimates & receipts in seconds. No account. Works offline.`
- **Long description, first lines:**
  - Create professional invoices, quotes and receipts right from your phone, even with no signal on the job site.
  - Unlimited invoices with a one-time Pro upgrade. No subscription. No account. Your data stays on your phone and your own Google Drive.
- **Keywords to weave in:** invoice maker, invoice generator, estimate maker, quote maker (UK/AU), receipt maker, bill maker, invoice app, invoice template, PDF invoice, contractor invoice, freelancer invoice, small business, tax invoice (AU), VAT invoice (UK), GST/HST (CA), offline invoice, no subscription, one-time purchase.
- **Localized listings:** en-US (estimate, sales tax), en-GB (quote, VAT), en-AU (tax invoice, GST, ABN), en-CA (GST/HST).
- **Screenshots (8):** 1) "Invoice in 30 seconds" 2) Templates 3) Estimate → invoice 4) Paid / overdue dashboard 5) Payment QR + bank details 6) "No account. Works offline." 7) Backup to your Drive 8) "Pay once. Yours forever." + price.
- Don't put pricing claims ("free", "#1") in the title; Play metadata policy restricts them. Put them in descriptions **(verify current policy)**.
- Reply to every review within 48 h (support quality is a major review theme).

---

## 11. Build plan for Claude Code (milestones)

Each milestone ends with a working build and passing tests.

**M0: Project setup (1–2 days)**
- Bare React Native app via `npx @react-native-community/cli init` (TypeScript strict, New Architecture, Hermes), ESLint/Prettier, Jest, Maestro; folder structure from section 8; design tokens; release signing config; CI (lint + tests + `./gradlew assembleRelease`).
- Accept: app launches on a physical Android device; CI green.

**M1: Domain & data (4–5 days)**
- `money.ts`, `calc.ts` (lines, discounts, inclusive/exclusive, compound taxes, rounding), `numbering.ts`, `tax-presets.ts` (US/UK/CA/AU).
- SQLite schema + migrations + repositories; seed script with 200 documents.
- Accept: ≥95% unit coverage on `domain/`; totals match fixtures for every preset.

**M2: Core flows (6–8 days)**
- Onboarding (country preset, optional profile). Clients and items CRUD. Document editor (invoice, estimate, receipt) with line item sheet, discounts, taxes, notes, terms. Document list with status/filter/search. Record payment; mark sent; void; duplicate; convert estimate → invoice.
- Accept: Maestro flow "create client → invoice with 3 lines → record partial payment → status Partially paid" passes.

**M3: PDF & sharing (4–5 days)**
- `HtmlToPdf` Kotlin Turbo Module (WebView print adapter → PDF file, plus print), 4 templates (HTML builders), preview WebView, share/print/save; logo and signature embedding; QR payment link; multi-page handling; Letter/A4.
- Accept: golden-file PDF text checks; 40-line invoice paginates correctly; logo + signature render; PDF < 1 MB without photos.

**M4: Backup, export, restore (3–4 days)**
- Zip export/import with preview and merge/replace; CSV export; Android Auto Backup rules; Google Drive appDataFolder backup/restore; backup reminder banner.
- Accept: uninstall/reinstall restore test passes on two devices; restore of a 1,000-document backup completes in under 10 s.

**M5: Monetization (2–3 days)**
- `pro_lifetime` IAP, paywall screen, free-limit counter, entitlement cache, restore purchase, acknowledge flow, revoked-purchase handling. Test with Play license testers.
- Accept: purchase → Pro unlocked offline after restart; reinstall → auto-restored; refund → Pro removed without data loss.

**M6: Polish & launch (4–5 days)**
- Reports (basic), dashboard totals, empty states, accessibility (TalkBack labels, 48 dp targets, contrast), dark mode (optional), performance pass (list virtualization), privacy policy page, store listing assets, internal → closed testing (Play requires closed testing for new personal developer accounts: 12 testers for 14 days **(verify current rule)**) → production.
- Accept: cold start < 1.5 s on a mid-range device; no crash in 14-day closed test.

**Post-launch P1 order:** recurring reminders → client on-device signature → expense log with receipt photo → reports export → CSV import → change orders/revisions.

---

## 12. Test plan

- **Unit:** calc engine (tax inclusive/exclusive, compound, per-line vs document discounts, rounding, zero/negative lines, credit notes), numbering (concurrency, custom next number), free-limit counter (month boundary, timezone).
- **Integration:** migrations from every past schema version; backup → restore round-trip equality (hash of all rows).
- **PDF:** snapshot HTML per template × paper size × country; manual visual check on 3 devices.
- **E2E (Maestro):** onboarding skip path; estimate → invoice; partial payments; paywall on 6th share; restore purchase; zip backup/restore.
- **Devices:** a Samsung mid-range (A-series), a Pixel, a Xiaomi/Redmi (aggressive battery and storage quirks), Android 10 through 16.

---

## 13. Risks & open questions

| Risk | Mitigation |
|---|---|
| Users lose data on phone change | Prominent backup onboarding, reminders, Auto Backup, Drive backup |
| Can't offer payment processing or "viewed" tracking | Payment details + QR link; be explicit in the listing; revisit a tiny optional backend later only if demanded |
| Competitors cut prices or add a lifetime tier | Speed and trust: human support, no nags, stability |
| Piracy of a client-side unlock | Accept at this price point; optionally RevenueCat later |
| Compliance mistakes (tax invoice rules) | Presets from GOV.UK / CRA / ATO; disclaimer that users are responsible for their own tax obligations |
| Play policy (closed testing, target API, 16 KB, PBL 8) | Checklist in M6 |

Open questions:
1. Free-tier limit: 5 sends/month + footer vs unlimited with watermark. Start with 5/month; revisit after 30 days of data.
2. Include crash reporting (better quality) vs a "no data collected" Data Safety label (better marketing)?
3. Brand name (check Play search and trademarks before committing).

---

## 14. Key sources

- Play listings (fetched with `&gl=US/GB/AU/CA`): Invoice Simple, Invoice2go, Invoice Fly, Bookipi, Joist, Square Invoices, Zoho Invoice, BillGo Simple Invoice, Freebie Invoice Maker, Easy Invoice, Simple Invoice Manager, SpeedInvoice, InvoiceBase, Invoice Home, MobileBiz Pro, Invoice Pro.
- Pricing: invoicesimple.com/pricing, invoice.2go.com/pricing, invoicefly.com/pricing, bookipi.com/pricing, joist.com/pricing, squareup.com/us/en/invoices/pricing, zoho.com/us/invoice/pricing, simpleinvoicemanager.com/pricing.html.
- Reviews: AppBrain, JustUseApp (Invoice Simple, Invoice Fly, Joist), Trustpilot (invoicesimple.com, invoice.2go.com, invoicefly.com, bookipi.com, joist.com), Capterra.
- Play Billing & fees: support.google.com/googleplay/android-developer/answer/16954621 and /112622; developer.android.com/google/play/billing/deprecation-faq.
- Invoice rules: gov.uk/invoicing-and-taking-payment-from-customers/invoices-what-they-must-include; gov.uk VAT Notice 700/21; canada.ca GST/HST input tax credit requirements; ato.gov.au tax invoices.
- Tech: npm registry (versions above), developer.android.com (WebView `createPrintDocumentAdapter`, PrintManager), reactnative.dev (Turbo Modules / codegen), developers.google.com/workspace/drive/api/guides/appdata, github.com/hyochan/react-native-iap, revenuecat.com/pricing.
- Full raw research with every URL: `research_invoice.md` (available on request).
