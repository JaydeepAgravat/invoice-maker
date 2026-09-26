import type { DocType } from '@/domain/docTypes';

import { toPdfLanguage, type PdfLanguage } from './labels';

/**
 * The message that goes with a shared document (email body, WhatsApp
 * caption, SMS text). Written in the document's language; the person can
 * edit it before sending.
 */

export type MessageValues = {
  client: string | null;
  business: string;
  title: string;
  number: string;
  amount: string | null;
  due: string | null;
};

type Kind = 'invoice' | 'estimate' | 'receipt' | 'other';

const kindOf = (type: DocType): Kind =>
  type === 'INVOICE' || type === 'PROFORMA'
    ? 'invoice'
    : type === 'ESTIMATE' || type === 'CHANGE_ORDER'
    ? 'estimate'
    : type === 'RECEIPT'
    ? 'receipt'
    : 'other';

type Templates = {
  greeting: (v: MessageValues) => string;
  body: Record<Kind, (v: MessageValues) => string>;
  due: (v: MessageValues) => string;
  valid: (v: MessageValues) => string;
  signoff: (v: MessageValues) => string;
  subject: (v: MessageValues) => string;
};

const T: Record<PdfLanguage, Templates> = {
  en: {
    greeting: v => (v.client ? `Hi ${v.client},` : 'Hello,'),
    body: {
      invoice: v => `Please find ${v.title.toLowerCase()} ${v.number}${v.amount ? ` for ${v.amount}` : ''} attached.`,
      estimate: v => `Here is ${v.title.toLowerCase()} ${v.number}${v.amount ? ` for ${v.amount}` : ''}. Let me know if you have any questions.`,
      receipt: v => `Thank you for your payment${v.amount ? ` of ${v.amount}` : ''}. Your receipt ${v.number} is attached.`,
      other: v => `Please find ${v.title.toLowerCase()} ${v.number} attached.`,
    },
    due: v => `It is due on ${v.due}.`,
    valid: v => `It is valid until ${v.due}.`,
    signoff: v => `Thank you,\n${v.business}`,
    subject: v => `${v.title} ${v.number} from ${v.business}`,
  },
  es: {
    greeting: v => (v.client ? `Hola, ${v.client}:` : 'Hola:'),
    body: {
      invoice: v => `Adjunto ${v.title.toLowerCase()} ${v.number}${v.amount ? ` por ${v.amount}` : ''}.`,
      estimate: v => `Te envío ${v.title.toLowerCase()} ${v.number}${v.amount ? ` por ${v.amount}` : ''}. Quedo a tu disposición para cualquier duda.`,
      receipt: v => `Gracias por tu pago${v.amount ? ` de ${v.amount}` : ''}. Adjunto el recibo ${v.number}.`,
      other: v => `Adjunto ${v.title.toLowerCase()} ${v.number}.`,
    },
    due: v => `Vence el ${v.due}.`,
    valid: v => `Es válido hasta el ${v.due}.`,
    signoff: v => `Gracias,\n${v.business}`,
    subject: v => `${v.title} ${v.number} de ${v.business}`,
  },
  pt: {
    greeting: v => (v.client ? `Olá, ${v.client},` : 'Olá,'),
    body: {
      invoice: v => `Segue em anexo ${v.title.toLowerCase()} ${v.number}${v.amount ? ` no valor de ${v.amount}` : ''}.`,
      estimate: v => `Segue ${v.title.toLowerCase()} ${v.number}${v.amount ? ` no valor de ${v.amount}` : ''}. Fico à disposição para dúvidas.`,
      receipt: v => `Obrigado pelo seu pagamento${v.amount ? ` de ${v.amount}` : ''}. Segue o recibo ${v.number}.`,
      other: v => `Segue em anexo ${v.title.toLowerCase()} ${v.number}.`,
    },
    due: v => `O vencimento é ${v.due}.`,
    valid: v => `É válido até ${v.due}.`,
    signoff: v => `Obrigado,\n${v.business}`,
    subject: v => `${v.title} ${v.number} de ${v.business}`,
  },
  fr: {
    greeting: v => (v.client ? `Bonjour ${v.client},` : 'Bonjour,'),
    body: {
      invoice: v => `Veuillez trouver ci-joint ${v.title.toLowerCase()} ${v.number}${v.amount ? ` d’un montant de ${v.amount}` : ''}.`,
      estimate: v => `Voici ${v.title.toLowerCase()} ${v.number}${v.amount ? ` d’un montant de ${v.amount}` : ''}. N’hésitez pas si vous avez des questions.`,
      receipt: v => `Merci pour votre règlement${v.amount ? ` de ${v.amount}` : ''}. Vous trouverez le reçu ${v.number} ci-joint.`,
      other: v => `Veuillez trouver ci-joint ${v.title.toLowerCase()} ${v.number}.`,
    },
    due: v => `Échéance : ${v.due}.`,
    valid: v => `Valable jusqu’au ${v.due}.`,
    signoff: v => `Cordialement,\n${v.business}`,
    subject: v => `${v.title} ${v.number} – ${v.business}`,
  },
  de: {
    greeting: v => (v.client ? `Hallo ${v.client},` : 'Guten Tag,'),
    body: {
      invoice: v => `anbei erhalten Sie ${v.title} ${v.number}${v.amount ? ` über ${v.amount}` : ''}.`,
      estimate: v => `anbei erhalten Sie ${v.title} ${v.number}${v.amount ? ` über ${v.amount}` : ''}. Bei Fragen melden Sie sich gerne.`,
      receipt: v => `vielen Dank für Ihre Zahlung${v.amount ? ` über ${v.amount}` : ''}. Anbei die Quittung ${v.number}.`,
      other: v => `anbei erhalten Sie ${v.title} ${v.number}.`,
    },
    due: v => `Fällig am ${v.due}.`,
    valid: v => `Gültig bis ${v.due}.`,
    signoff: v => `Viele Grüße\n${v.business}`,
    subject: v => `${v.title} ${v.number} von ${v.business}`,
  },
};

export function shareMessage(
  language: string,
  type: DocType,
  v: MessageValues,
): { subject: string; body: string } {
  const t = T[toPdfLanguage(language)];
  const kind = kindOf(type);
  const dueLine = v.due
    ? kind === 'invoice'
      ? t.due(v)
      : kind === 'estimate'
      ? t.valid(v)
      : ''
    : '';
  const main = [t.body[kind](v), dueLine].filter(Boolean).join(' ');
  return {
    subject: t.subject(v),
    body: [t.greeting(v), main, t.signoff(v)].join('\n\n'),
  };
}
