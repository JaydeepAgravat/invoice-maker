import type { DocType } from '@/domain/docTypes';
import type { PaymentField, PaymentKind } from '@/domain/payments';
import type { CountryCode } from '@/domain/presets';
import de from '@/i18n/locales/de';
import en from '@/i18n/locales/en';
import es from '@/i18n/locales/es';
import fr from '@/i18n/locales/fr';
import pt from '@/i18n/locales/pt';

/**
 * Words printed on documents. A document is printed in its own language
 * (the client's), which can differ from the app language, so these live
 * apart from the UI strings. Units and payment-method names are shared.
 */

export type PdfLanguage = 'en' | 'es' | 'pt' | 'fr' | 'de';
export type TitleKey = DocType | 'TAX_INVOICE' | 'QUOTE';

type Base = {
  title: Record<TitleKey, string>;
  number: string;
  issueDate: string;
  dueDate: string;
  validUntil: string;
  supplyDate: string;
  reference: string;
  period: string;
  billTo: string;
  shipTo: string;
  supplier: string;
  deliverTo: string;
  from: string;
  description: string;
  qty: string;
  unit: string;
  unitPrice: string;
  discount: string;
  tax: string;
  amount: string;
  subtotal: string;
  total: string;
  totalBeforeWithholding: string;
  paid: string;
  balanceDue: string;
  amountDue: string;
  amountReceived: string;
  includesTax: string;
  pricesIncludeTax: string;
  notes: string;
  terms: string;
  paymentDetails: string;
  scanToPay: string;
  scanPix: string;
  scanSepa: string;
  pixCopyPaste: string;
  page: string;
  of: string;
  signature: string;
  acceptedBy: string;
  receivedBy: string;
  approvedBy: string;
  name: string;
  date: string;
  signedOn: string;
  photos: string;
  taxId: string;
  creditFor: string;
  changeFor: string;
  invoiceFor: string;
  original: string;
  previousChanges: string;
  thisChange: string;
  revisedTotal: string;
  proformaNote: string;
  receiptNote: string;
  paidOn: string;
  stamp: { PAID: string; VOID: string; DRAFT: string };
  madeWith: string;
  statement: {
    openingBalance: string;
    closingBalance: string;
    date: string;
    document: string;
    charges: string;
    credits: string;
    balance: string;
    invoice: string;
    creditNote: string;
    payment: string;
    aging: string;
    current: string;
    days1to30: string;
    days31to60: string;
    days61to90: string;
    days90plus: string;
    totalDue: string;
  };
  field: Record<PaymentField, string>;
  kind: Record<PaymentKind, string>;
};

export type PdfLabels = Base & {
  units: Record<string, string>;
  paymentMethod: Record<string, string>;
};

const EN: Base = {
  title: {
    INVOICE: 'Invoice',
    TAX_INVOICE: 'Tax invoice',
    ESTIMATE: 'Estimate',
    QUOTE: 'Quote',
    RECEIPT: 'Receipt',
    CREDIT_NOTE: 'Credit note',
    PROFORMA: 'Pro-forma invoice',
    DELIVERY_NOTE: 'Delivery note',
    CHANGE_ORDER: 'Change order',
    PURCHASE_ORDER: 'Purchase order',
    STATEMENT: 'Statement of account',
  },
  number: 'Number',
  issueDate: 'Date',
  dueDate: 'Due date',
  validUntil: 'Valid until',
  supplyDate: 'Supply date',
  reference: 'Reference',
  period: 'Period',
  billTo: 'Bill to',
  shipTo: 'Ship to',
  supplier: 'Supplier',
  deliverTo: 'Deliver to',
  from: 'From',
  description: 'Description',
  qty: 'Qty',
  unit: 'Unit',
  unitPrice: 'Price',
  discount: 'Discount',
  tax: 'Tax',
  amount: 'Amount',
  subtotal: 'Subtotal',
  total: 'Total',
  totalBeforeWithholding: 'Total before withholding',
  paid: 'Paid',
  balanceDue: 'Balance due',
  amountDue: 'Amount due',
  amountReceived: 'Amount received',
  includesTax: 'Includes {tax}',
  pricesIncludeTax: 'Prices include tax',
  notes: 'Notes',
  terms: 'Terms',
  paymentDetails: 'How to pay',
  scanToPay: 'Scan to pay',
  scanPix: 'Pay with Pix',
  scanSepa: 'Scan with your banking app',
  pixCopyPaste: 'Pix copy and paste',
  page: 'Page',
  of: 'of',
  signature: 'Authorised signature',
  acceptedBy: 'Accepted by',
  receivedBy: 'Received by',
  approvedBy: 'Approved by',
  name: 'Name',
  date: 'Date',
  signedOn: 'Signed on {date}',
  photos: 'Photos',
  taxId: 'Tax ID',
  creditFor: 'Credit for invoice {number}',
  changeFor: 'Change to estimate {number}',
  invoiceFor: 'For estimate {number}',
  original: 'Original estimate',
  previousChanges: 'Previous approved changes',
  thisChange: 'This change',
  revisedTotal: 'Revised contract total',
  proformaNote: 'This pro-forma invoice is not a tax invoice.',
  receiptNote: 'Thank you for your payment.',
  paidOn: 'Paid on {date}',
  stamp: { PAID: 'Paid', VOID: 'Void', DRAFT: 'Draft' },
  madeWith: 'Made with {app}',
  statement: {
    openingBalance: 'Opening balance',
    closingBalance: 'Closing balance',
    date: 'Date',
    document: 'Document',
    charges: 'Charges',
    credits: 'Payments & credits',
    balance: 'Balance',
    invoice: 'Invoice {number}',
    creditNote: 'Credit note {number}',
    payment: 'Payment',
    aging: 'Amount due by age',
    current: 'Current',
    days1to30: '1–30 days',
    days31to60: '31–60 days',
    days61to90: '61–90 days',
    days90plus: 'Over 90 days',
    totalDue: 'Total due',
  },
  field: {
    accountName: 'Account name',
    bankName: 'Bank',
    iban: 'IBAN',
    bic: 'BIC / SWIFT',
    accountNumber: 'Account number',
    routingNumber: 'Routing number',
    sortCode: 'Sort code',
    bsb: 'BSB',
    institution: 'Institution number',
    transit: 'Transit number',
    clabe: 'CLABE',
    agency: 'Branch',
    pixKey: 'Pix key',
    merchantCity: 'City',
    url: 'Payment link',
    email: 'PayPal email',
    instructions: 'Instructions',
  },
  kind: {
    BANK: 'Bank transfer',
    PIX: 'Pix',
    PAYPAL: 'PayPal',
    LINK: 'Pay online',
    OTHER: 'Other',
  },
};

const ES: Base = {
  title: {
    INVOICE: 'Factura',
    TAX_INVOICE: 'Factura',
    ESTIMATE: 'Presupuesto',
    QUOTE: 'Presupuesto',
    RECEIPT: 'Recibo',
    CREDIT_NOTE: 'Nota de crédito',
    PROFORMA: 'Factura proforma',
    DELIVERY_NOTE: 'Nota de entrega',
    CHANGE_ORDER: 'Orden de cambio',
    PURCHASE_ORDER: 'Orden de compra',
    STATEMENT: 'Estado de cuenta',
  },
  number: 'Número',
  issueDate: 'Fecha',
  dueDate: 'Vencimiento',
  validUntil: 'Válido hasta',
  supplyDate: 'Fecha de operación',
  reference: 'Referencia',
  period: 'Periodo',
  billTo: 'Cliente',
  shipTo: 'Enviar a',
  supplier: 'Proveedor',
  deliverTo: 'Entregar en',
  from: 'De',
  description: 'Concepto',
  qty: 'Cant.',
  unit: 'Unidad',
  unitPrice: 'Precio',
  discount: 'Descuento',
  tax: 'Impuesto',
  amount: 'Importe',
  subtotal: 'Base imponible',
  total: 'Total',
  totalBeforeWithholding: 'Total antes de retención',
  paid: 'Pagado',
  balanceDue: 'Pendiente de pago',
  amountDue: 'Importe a pagar',
  amountReceived: 'Importe recibido',
  includesTax: 'Incluye {tax}',
  pricesIncludeTax: 'Precios con impuestos incluidos',
  notes: 'Notas',
  terms: 'Condiciones',
  paymentDetails: 'Forma de pago',
  scanToPay: 'Escanea para pagar',
  scanPix: 'Paga con Pix',
  scanSepa: 'Escanea con la app de tu banco',
  pixCopyPaste: 'Pix copia y pega',
  page: 'Página',
  of: 'de',
  signature: 'Firma autorizada',
  acceptedBy: 'Aceptado por',
  receivedBy: 'Recibido por',
  approvedBy: 'Aprobado por',
  name: 'Nombre',
  date: 'Fecha',
  signedOn: 'Firmado el {date}',
  photos: 'Fotos',
  taxId: 'NIF',
  creditFor: 'Rectifica la factura {number}',
  changeFor: 'Modifica el presupuesto {number}',
  invoiceFor: 'Según presupuesto {number}',
  original: 'Presupuesto original',
  previousChanges: 'Cambios aprobados anteriores',
  thisChange: 'Este cambio',
  revisedTotal: 'Nuevo total del contrato',
  proformaNote: 'Esta factura proforma no es una factura fiscal.',
  receiptNote: 'Gracias por su pago.',
  paidOn: 'Pagado el {date}',
  stamp: { PAID: 'Pagada', VOID: 'Anulada', DRAFT: 'Borrador' },
  madeWith: 'Creado con {app}',
  statement: {
    openingBalance: 'Saldo inicial',
    closingBalance: 'Saldo final',
    date: 'Fecha',
    document: 'Documento',
    charges: 'Cargos',
    credits: 'Pagos y abonos',
    balance: 'Saldo',
    invoice: 'Factura {number}',
    creditNote: 'Nota de crédito {number}',
    payment: 'Pago',
    aging: 'Pendiente por antigüedad',
    current: 'Al día',
    days1to30: '1–30 días',
    days31to60: '31–60 días',
    days61to90: '61–90 días',
    days90plus: 'Más de 90 días',
    totalDue: 'Total pendiente',
  },
  field: {
    accountName: 'Titular',
    bankName: 'Banco',
    iban: 'IBAN',
    bic: 'BIC / SWIFT',
    accountNumber: 'Número de cuenta',
    routingNumber: 'Número de ruta',
    sortCode: 'Sort code',
    bsb: 'BSB',
    institution: 'Institución',
    transit: 'Tránsito',
    clabe: 'CLABE',
    agency: 'Sucursal',
    pixKey: 'Clave Pix',
    merchantCity: 'Ciudad',
    url: 'Enlace de pago',
    email: 'Email de PayPal',
    instructions: 'Instrucciones',
  },
  kind: {
    BANK: 'Transferencia bancaria',
    PIX: 'Pix',
    PAYPAL: 'PayPal',
    LINK: 'Pago en línea',
    OTHER: 'Otro',
  },
};

const PT: Base = {
  title: {
    INVOICE: 'Fatura',
    TAX_INVOICE: 'Fatura',
    ESTIMATE: 'Orçamento',
    QUOTE: 'Orçamento',
    RECEIPT: 'Recibo',
    CREDIT_NOTE: 'Nota de crédito',
    PROFORMA: 'Fatura pró-forma',
    DELIVERY_NOTE: 'Guia de remessa',
    CHANGE_ORDER: 'Aditivo',
    PURCHASE_ORDER: 'Pedido de compra',
    STATEMENT: 'Extrato de conta',
  },
  number: 'Número',
  issueDate: 'Data',
  dueDate: 'Vencimento',
  validUntil: 'Válido até',
  supplyDate: 'Data de fornecimento',
  reference: 'Referência',
  period: 'Período',
  billTo: 'Cliente',
  shipTo: 'Entregar em',
  supplier: 'Fornecedor',
  deliverTo: 'Local de entrega',
  from: 'De',
  description: 'Descrição',
  qty: 'Qtd.',
  unit: 'Unid.',
  unitPrice: 'Preço',
  discount: 'Desconto',
  tax: 'Imposto',
  amount: 'Valor',
  subtotal: 'Subtotal',
  total: 'Total',
  totalBeforeWithholding: 'Total antes de retenção',
  paid: 'Pago',
  balanceDue: 'Saldo a pagar',
  amountDue: 'Valor a pagar',
  amountReceived: 'Valor recebido',
  includesTax: 'Inclui {tax}',
  pricesIncludeTax: 'Preços com impostos incluídos',
  notes: 'Observações',
  terms: 'Condições',
  paymentDetails: 'Como pagar',
  scanToPay: 'Leia para pagar',
  scanPix: 'Pague com Pix',
  scanSepa: 'Leia com a app do seu banco',
  pixCopyPaste: 'Pix copia e cola',
  page: 'Página',
  of: 'de',
  signature: 'Assinatura autorizada',
  acceptedBy: 'Aceite por',
  receivedBy: 'Recebido por',
  approvedBy: 'Aprovado por',
  name: 'Nome',
  date: 'Data',
  signedOn: 'Assinado em {date}',
  photos: 'Fotos',
  taxId: 'NIF / CNPJ',
  creditFor: 'Referente à fatura {number}',
  changeFor: 'Altera o orçamento {number}',
  invoiceFor: 'Conforme orçamento {number}',
  original: 'Orçamento original',
  previousChanges: 'Alterações aprovadas anteriores',
  thisChange: 'Esta alteração',
  revisedTotal: 'Novo total do contrato',
  proformaNote: 'Esta fatura pró-forma não é uma fatura fiscal.',
  receiptNote: 'Obrigado pelo seu pagamento.',
  paidOn: 'Pago em {date}',
  stamp: { PAID: 'Paga', VOID: 'Anulada', DRAFT: 'Rascunho' },
  madeWith: 'Criado com {app}',
  statement: {
    openingBalance: 'Saldo inicial',
    closingBalance: 'Saldo final',
    date: 'Data',
    document: 'Documento',
    charges: 'Débitos',
    credits: 'Pagamentos e créditos',
    balance: 'Saldo',
    invoice: 'Fatura {number}',
    creditNote: 'Nota de crédito {number}',
    payment: 'Pagamento',
    aging: 'Em aberto por antiguidade',
    current: 'Em dia',
    days1to30: '1–30 dias',
    days31to60: '31–60 dias',
    days61to90: '61–90 dias',
    days90plus: 'Mais de 90 dias',
    totalDue: 'Total em aberto',
  },
  field: {
    accountName: 'Titular',
    bankName: 'Banco',
    iban: 'IBAN',
    bic: 'BIC / SWIFT',
    accountNumber: 'Conta',
    routingNumber: 'Routing number',
    sortCode: 'Sort code',
    bsb: 'BSB',
    institution: 'Instituição',
    transit: 'Trânsito',
    clabe: 'CLABE',
    agency: 'Agência',
    pixKey: 'Chave Pix',
    merchantCity: 'Cidade',
    url: 'Link de pagamento',
    email: 'Email do PayPal',
    instructions: 'Instruções',
  },
  kind: {
    BANK: 'Transferência bancária',
    PIX: 'Pix',
    PAYPAL: 'PayPal',
    LINK: 'Pagamento online',
    OTHER: 'Outro',
  },
};

const FR: Base = {
  title: {
    INVOICE: 'Facture',
    TAX_INVOICE: 'Facture',
    ESTIMATE: 'Devis',
    QUOTE: 'Devis',
    RECEIPT: 'Reçu',
    CREDIT_NOTE: 'Avoir',
    PROFORMA: 'Facture pro forma',
    DELIVERY_NOTE: 'Bon de livraison',
    CHANGE_ORDER: 'Avenant',
    PURCHASE_ORDER: 'Bon de commande',
    STATEMENT: 'Relevé de compte',
  },
  number: 'Numéro',
  issueDate: 'Date',
  dueDate: 'Échéance',
  validUntil: 'Valable jusqu’au',
  supplyDate: 'Date de livraison',
  reference: 'Référence',
  period: 'Période',
  billTo: 'Facturé à',
  shipTo: 'Livré à',
  supplier: 'Fournisseur',
  deliverTo: 'Adresse de livraison',
  from: 'De',
  description: 'Désignation',
  qty: 'Qté',
  unit: 'Unité',
  unitPrice: 'Prix unitaire',
  discount: 'Remise',
  tax: 'TVA',
  amount: 'Montant',
  subtotal: 'Total HT',
  total: 'Total TTC',
  totalBeforeWithholding: 'Total avant retenue',
  paid: 'Payé',
  balanceDue: 'Reste à payer',
  amountDue: 'Net à payer',
  amountReceived: 'Montant reçu',
  includesTax: 'Dont {tax}',
  pricesIncludeTax: 'Prix TTC',
  notes: 'Notes',
  terms: 'Conditions',
  paymentDetails: 'Règlement',
  scanToPay: 'Scannez pour payer',
  scanPix: 'Payer avec Pix',
  scanSepa: 'Scannez avec votre appli bancaire',
  pixCopyPaste: 'Pix copier-coller',
  page: 'Page',
  of: 'sur',
  signature: 'Signature autorisée',
  acceptedBy: 'Bon pour accord',
  receivedBy: 'Reçu par',
  approvedBy: 'Approuvé par',
  name: 'Nom',
  date: 'Date',
  signedOn: 'Signé le {date}',
  photos: 'Photos',
  taxId: 'N° TVA',
  creditFor: 'Avoir sur la facture {number}',
  changeFor: 'Avenant au devis {number}',
  invoiceFor: 'Selon devis {number}',
  original: 'Devis initial',
  previousChanges: 'Avenants acceptés',
  thisChange: 'Cet avenant',
  revisedTotal: 'Nouveau total du marché',
  proformaNote: 'Cette facture pro forma n’est pas une facture.',
  receiptNote: 'Merci pour votre règlement.',
  paidOn: 'Payé le {date}',
  stamp: { PAID: 'Payée', VOID: 'Annulée', DRAFT: 'Brouillon' },
  madeWith: 'Créé avec {app}',
  statement: {
    openingBalance: 'Solde d’ouverture',
    closingBalance: 'Solde de clôture',
    date: 'Date',
    document: 'Document',
    charges: 'Débit',
    credits: 'Crédit',
    balance: 'Solde',
    invoice: 'Facture {number}',
    creditNote: 'Avoir {number}',
    payment: 'Règlement',
    aging: 'Échéancier des impayés',
    current: 'Non échu',
    days1to30: '1–30 jours',
    days31to60: '31–60 jours',
    days61to90: '61–90 jours',
    days90plus: 'Plus de 90 jours',
    totalDue: 'Total dû',
  },
  field: {
    accountName: 'Titulaire',
    bankName: 'Banque',
    iban: 'IBAN',
    bic: 'BIC',
    accountNumber: 'Numéro de compte',
    routingNumber: 'Routing number',
    sortCode: 'Sort code',
    bsb: 'BSB',
    institution: 'Numéro d’institution',
    transit: 'Numéro de transit',
    clabe: 'CLABE',
    agency: 'Agence',
    pixKey: 'Clé Pix',
    merchantCity: 'Ville',
    url: 'Lien de paiement',
    email: 'E-mail PayPal',
    instructions: 'Instructions',
  },
  kind: {
    BANK: 'Virement bancaire',
    PIX: 'Pix',
    PAYPAL: 'PayPal',
    LINK: 'Paiement en ligne',
    OTHER: 'Autre',
  },
};

const DE: Base = {
  title: {
    INVOICE: 'Rechnung',
    TAX_INVOICE: 'Rechnung',
    ESTIMATE: 'Angebot',
    QUOTE: 'Angebot',
    RECEIPT: 'Quittung',
    CREDIT_NOTE: 'Gutschrift',
    PROFORMA: 'Proformarechnung',
    DELIVERY_NOTE: 'Lieferschein',
    CHANGE_ORDER: 'Nachtrag',
    PURCHASE_ORDER: 'Bestellung',
    STATEMENT: 'Kontoauszug',
  },
  number: 'Nummer',
  issueDate: 'Datum',
  dueDate: 'Fällig am',
  validUntil: 'Gültig bis',
  supplyDate: 'Leistungsdatum',
  reference: 'Referenz',
  period: 'Zeitraum',
  billTo: 'Rechnung an',
  shipTo: 'Lieferung an',
  supplier: 'Lieferant',
  deliverTo: 'Lieferadresse',
  from: 'Von',
  description: 'Beschreibung',
  qty: 'Menge',
  unit: 'Einheit',
  unitPrice: 'Einzelpreis',
  discount: 'Rabatt',
  tax: 'USt.',
  amount: 'Betrag',
  subtotal: 'Nettobetrag',
  total: 'Gesamtbetrag',
  totalBeforeWithholding: 'Summe vor Einbehalt',
  paid: 'Bezahlt',
  balanceDue: 'Offener Betrag',
  amountDue: 'Zu zahlen',
  amountReceived: 'Erhaltener Betrag',
  includesTax: 'Enthaltene {tax}',
  pricesIncludeTax: 'Preise inkl. Steuern',
  notes: 'Hinweise',
  terms: 'Bedingungen',
  paymentDetails: 'Zahlung',
  scanToPay: 'Zum Bezahlen scannen',
  scanPix: 'Mit Pix bezahlen',
  scanSepa: 'Mit Ihrer Banking-App scannen',
  pixCopyPaste: 'Pix Copia e Cola',
  page: 'Seite',
  of: 'von',
  signature: 'Unterschrift',
  acceptedBy: 'Angenommen von',
  receivedBy: 'Erhalten von',
  approvedBy: 'Genehmigt von',
  name: 'Name',
  date: 'Datum',
  signedOn: 'Unterschrieben am {date}',
  photos: 'Fotos',
  taxId: 'USt-IdNr.',
  creditFor: 'Gutschrift zur Rechnung {number}',
  changeFor: 'Nachtrag zum Angebot {number}',
  invoiceFor: 'Gemäß Angebot {number}',
  original: 'Ursprüngliches Angebot',
  previousChanges: 'Bisher genehmigte Nachträge',
  thisChange: 'Dieser Nachtrag',
  revisedTotal: 'Neue Auftragssumme',
  proformaNote: 'Diese Proformarechnung ist keine Rechnung im Sinne des UStG.',
  receiptNote: 'Vielen Dank für Ihre Zahlung.',
  paidOn: 'Bezahlt am {date}',
  stamp: { PAID: 'Bezahlt', VOID: 'Storniert', DRAFT: 'Entwurf' },
  madeWith: 'Erstellt mit {app}',
  statement: {
    openingBalance: 'Anfangssaldo',
    closingBalance: 'Endsaldo',
    date: 'Datum',
    document: 'Beleg',
    charges: 'Soll',
    credits: 'Haben',
    balance: 'Saldo',
    invoice: 'Rechnung {number}',
    creditNote: 'Gutschrift {number}',
    payment: 'Zahlung',
    aging: 'Offene Posten nach Alter',
    current: 'Nicht fällig',
    days1to30: '1–30 Tage',
    days31to60: '31–60 Tage',
    days61to90: '61–90 Tage',
    days90plus: 'Über 90 Tage',
    totalDue: 'Gesamt offen',
  },
  field: {
    accountName: 'Kontoinhaber',
    bankName: 'Bank',
    iban: 'IBAN',
    bic: 'BIC',
    accountNumber: 'Kontonummer',
    routingNumber: 'Routing number',
    sortCode: 'Sort code',
    bsb: 'BSB',
    institution: 'Institutsnummer',
    transit: 'Transitnummer',
    clabe: 'CLABE',
    agency: 'Filiale',
    pixKey: 'Pix-Schlüssel',
    merchantCity: 'Stadt',
    url: 'Zahlungslink',
    email: 'PayPal-E-Mail',
    instructions: 'Hinweise',
  },
  kind: {
    BANK: 'Überweisung',
    PIX: 'Pix',
    PAYPAL: 'PayPal',
    LINK: 'Online bezahlen',
    OTHER: 'Sonstiges',
  },
};

/** Local names where a language's countries disagree. */
const TITLE_OVERRIDES: Partial<
  Record<PdfLanguage, Partial<Record<CountryCode, Partial<Record<TitleKey, string>>>>>
> = {
  es: {
    ES: { CREDIT_NOTE: 'Factura rectificativa', DELIVERY_NOTE: 'Albarán' },
    MX: { ESTIMATE: 'Cotización', DELIVERY_NOTE: 'Nota de remisión' },
  },
  pt: {
    BR: { CREDIT_NOTE: 'Nota de crédito', DELIVERY_NOTE: 'Romaneio' },
    PT: {
      PURCHASE_ORDER: 'Nota de encomenda',
      CHANGE_ORDER: 'Adenda ao orçamento',
    },
  },
};

/** Tax-ID label by country for the client line (the business uses its own). */
const CLIENT_TAX_ID: Partial<Record<CountryCode, string>> = {
  US: 'EIN',
  GB: 'VAT No.',
  CA: 'BN',
  AU: 'ABN',
  ES: 'NIF',
  MX: 'RFC',
  BR: 'CPF / CNPJ',
  FR: 'N° TVA',
  DE: 'USt-IdNr.',
  PT: 'NIF',
};

const BASES: Record<PdfLanguage, Base> = {
  en: EN,
  es: ES,
  pt: PT,
  fr: FR,
  de: DE,
};
const UI = { en, es, pt, fr, de };

export const PDF_LANGUAGES = Object.keys(BASES) as PdfLanguage[];

export const toPdfLanguage = (lang: string): PdfLanguage =>
  (PDF_LANGUAGES as string[]).includes(lang) ? (lang as PdfLanguage) : 'en';

export function pdfLabels(language: string, country: CountryCode): PdfLabels {
  const lang = toPdfLanguage(language);
  const base = BASES[lang];
  return {
    ...base,
    title: { ...base.title, ...TITLE_OVERRIDES[lang]?.[country] },
    taxId: CLIENT_TAX_ID[country] ?? base.taxId,
    units: UI[lang].units,
    paymentMethod: UI[lang].paymentMethod,
  };
}

/** "{number}" style interpolation for the label strings above. */
export const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
