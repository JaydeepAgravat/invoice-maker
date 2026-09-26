import type { Clock } from '../clock';
import { num, reqNum, reqStr, str, type Executor } from '../db/types';
import { uuidv7 } from '../ids';

export type Photo = {
  id: string;
  documentId: string;
  path: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  position: number;
};

export async function listPhotos(
  db: Executor,
  documentId: string,
): Promise<Photo[]> {
  const { rows } = await db.execute(
    "SELECT * FROM attachments WHERE document_id = ? AND kind = 'PHOTO' ORDER BY position, created_at",
    [documentId],
  );
  return rows.map(r => ({
    id: reqStr(r.id),
    documentId: reqStr(r.document_id),
    path: reqStr(r.path),
    width: num(r.width),
    height: num(r.height),
    caption: str(r.caption),
    position: reqNum(r.position),
  }));
}

export async function addPhoto(
  db: Executor,
  clock: Clock,
  documentId: string,
  photo: { path: string; width?: number | null; height?: number | null },
): Promise<string> {
  const now = clock.now();
  const id = uuidv7(now);
  const { rows } = await db.execute(
    "SELECT COALESCE(MAX(position), -1) + 1 AS p FROM attachments WHERE document_id = ? AND kind = 'PHOTO'",
    [documentId],
  );
  await db.execute(
    `INSERT INTO attachments (id, document_id, kind, path, width, height, position, created_at)
     VALUES (?, ?, 'PHOTO', ?, ?, ?, ?, ?)`,
    [id, documentId, photo.path, photo.width ?? null, photo.height ?? null, reqNum(rows[0]!.p), now],
  );
  return id;
}

export const setPhotoCaption = (db: Executor, id: string, caption: string | null) =>
  db.execute('UPDATE attachments SET caption = ? WHERE id = ?', [caption?.trim() || null, id]);

/**
 * Remove a photo from a document. Returns the file path when no other
 * document (e.g. the invoice converted from this estimate) still uses it, so
 * the caller can delete the file.
 */
export async function removePhoto(db: Executor, id: string): Promise<string | null> {
  const { rows } = await db.execute('SELECT path FROM attachments WHERE id = ?', [id]);
  const path = str(rows[0]?.path);
  await db.execute('DELETE FROM attachments WHERE id = ?', [id]);
  if (!path) {
    return null;
  }
  const others = await db.execute('SELECT 1 FROM attachments WHERE path = ? LIMIT 1', [path]);
  return others.rows.length ? null : path;
}

export type ClientSignature = {
  path: string;
  name: string | null;
  signedAt: number;
};

export async function getClientSignature(
  db: Executor,
  documentId: string,
): Promise<ClientSignature | null> {
  const { rows } = await db.execute(
    'SELECT client_signature_path, client_signed_name, client_signed_at FROM documents WHERE id = ?',
    [documentId],
  );
  const r = rows[0];
  const path = str(r?.client_signature_path);
  return path
    ? { path, name: str(r!.client_signed_name), signedAt: reqNum(r!.client_signed_at) }
    : null;
}

/** Save the client's on-device signature; logged in the document's history. */
export async function setClientSignature(
  db: Executor,
  clock: Clock,
  documentId: string,
  signature: { path: string; name: string | null } | null,
): Promise<void> {
  const now = clock.now();
  await db.execute(
    `UPDATE documents SET client_signature_path = ?, client_signed_name = ?, client_signed_at = ?, updated_at = ?
     WHERE id = ?`,
    [signature?.path ?? null, signature?.name?.trim() || null, signature ? now : null, now, documentId],
  );
  await db.execute(
    'INSERT INTO activity_log (id, document_id, kind, payload_json, at) VALUES (?, ?, ?, ?, ?)',
    [
      uuidv7(now),
      documentId,
      signature ? 'SIGNED' : 'SIGNATURE_REMOVED',
      signature?.name ? JSON.stringify({ name: signature.name.trim() }) : null,
      now,
    ],
  );
}
