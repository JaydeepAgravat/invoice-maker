import type { Executor } from '@/data/db/types';
import { str, num, reqStr } from '@/data/db/types';
import type { Client } from '@/data/repositories/clients';
import { getClient } from '@/data/repositories/clients';
import {
  getDocument,
  listDerived,
  statusOf,
} from '@/data/repositories/documents';
import { clientStatement } from '@/data/repositories/inbox';
import { listPaymentMethods } from '@/data/repositories/paymentMethods';
import { getProfile, type BusinessProfile } from '@/data/repositories/profile';
import { previewNumber } from '@/data/repositories/sequences';
import type { ISODate } from '@/domain/dates';

import type { PdfImage, PdfInput, PdfParty } from './model';

export type LoadOptions = {
  today: ISODate;
  isPro: boolean;
  appName: string;
};

/**
 * Everything needed to print one document. Issued documents use the
 * business and client details frozen when they were issued, so reprinting
 * an old invoice never picks up a later address change.
 */
export async function loadPdfInput(
  db: Executor,
  id: string,
  opts: LoadOptions,
): Promise<PdfInput | null> {
  const doc = await getDocument(db, id);
  if (!doc) {
    return null;
  }
  const current = await getProfile(db);
  const business: BusinessProfile = doc.businessSnapshot
    ? { ...current, ...(doc.businessSnapshot as Partial<BusinessProfile>) }
    : current;
  const live = doc.clientId ? await getClient(db, doc.clientId) : null;
  const client: PdfParty | null =
    (doc.clientSnapshot as Client | null) ?? live;

  const sourceDoc = doc.sourceDocumentId
    ? await getDocument(db, doc.sourceDocumentId)
    : null;

  let contract: PdfInput['contract'] = null;
  if (doc.type === 'CHANGE_ORDER' && sourceDoc) {
    const siblings = await listDerived(db, sourceDoc.id, 'CHANGE_ORDER');
    const previousChanges = siblings
      .filter(
        s =>
          s.id !== doc.id &&
          s.status === 'ACCEPTED' &&
          s.createdAt < doc.createdAt,
      )
      .reduce((sum, s) => sum + s.totals.total, 0);
    contract = {
      original: sourceDoc.totals.total,
      previousChanges,
      revised: sourceDoc.totals.total + previousChanges + doc.totals.total,
    };
  }

  const statement =
    doc.type === 'STATEMENT' &&
    doc.clientId &&
    doc.statementFrom &&
    doc.statementTo
      ? await clientStatement(db, {
          clientId: doc.clientId,
          currency: doc.currency,
          from: doc.statementFrom,
          to: doc.statementTo,
        })
      : null;

  const extra = (
    await db.execute(
      'SELECT client_signature_path, client_signed_at, client_signed_name, signature_path FROM documents WHERE id = ?',
      [id],
    )
  ).rows[0];
  const photos: PdfImage[] = (
    await db.execute(
      "SELECT path, width, height, caption FROM attachments WHERE document_id = ? AND kind = 'PHOTO' ORDER BY position",
      [id],
    )
  ).rows.map(r => ({
    uri: reqStr(r.path),
    width: num(r.width),
    height: num(r.height),
    caption: str(r.caption),
  }));

  const clientSignaturePath = str(extra?.client_signature_path);
  const signedAt = num(extra?.client_signed_at);
  const signaturePath = str(extra?.signature_path) ?? business.signaturePath;

  return {
    doc,
    status: statusOf(doc, opts.today),
    business,
    client,
    paymentMethods: await listPaymentMethods(db),
    source: sourceDoc ? { type: sourceDoc.type, number: sourceDoc.number } : null,
    contract,
    statement,
    numberPreview: doc.number
      ? null
      : await previewNumber(db, doc.type, doc.issueDate),
    logo: business.logoPath ? { uri: business.logoPath } : null,
    signature: signaturePath ? { uri: signaturePath } : null,
    clientSignature: clientSignaturePath
      ? {
          uri: clientSignaturePath,
          name: str(extra?.client_signed_name),
          signedAt: signedAt
            ? new Date(signedAt).toISOString().slice(0, 10)
            : null,
        }
      : null,
    photos,
    template: doc.templateId ?? business.templateId,
    accentColor: doc.accentColor ?? business.accentColor,
    paperSize: doc.paperSize ?? business.paperSize,
    isPro: opts.isPro,
    appName: opts.appName,
  };
}
