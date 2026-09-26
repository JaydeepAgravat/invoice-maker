import { APP_NAME } from '@/config';
import { clock, getDatabase } from '@/data/database';
import { notifyDataChanged } from '@/data/live';
import { PrefKeys, prefs } from '@/lib/storage';
import NativeBackup from '@/specs/NativeBackup';
import NativeDrive, { type DriveFile } from '@/specs/NativeDrive';

import {
  createSnapshot,
  readSnapshot,
  restoreSnapshot,
  summarize,
  type Snapshot,
  type SnapshotSummary,
} from './snapshot';

const WEEK = 7 * 24 * 60 * 60 * 1000;
const KEEP_ON_DRIVE = 5;

const native = () => {
  if (!NativeBackup) {
    throw new Error('NativeBackup unavailable');
  }
  return NativeBackup;
};

const issuedCount = async () => {
  const db = await getDatabase();
  const { rows } = await db.execute(
    "SELECT COUNT(*) AS n FROM documents WHERE status <> 'DRAFT' AND deleted_at IS NULL",
  );
  return Number(rows[0]?.n ?? 0);
};

const stamp = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

/** Build a backup zip in the app cache. */
export async function createBackupZip(): Promise<{ path: string; bytes: number; name: string }> {
  const db = await getDatabase();
  await db.execute('PRAGMA wal_checkpoint(TRUNCATE)');
  const snap = await createSnapshot(db, {
    filesDir: native().getFilesDir(),
    app: APP_NAME,
    now: clock.now(),
  });
  const name = `${APP_NAME} backup ${stamp(new Date())}.zip`;
  const zip = await native().writeZip(JSON.stringify(snap), snap.files, name);
  return { ...zip, name };
}

export async function markBackedUp(kind: 'file' | 'drive') {
  prefs.set(PrefKeys.lastBackupAt, Date.now());
  prefs.set(PrefKeys.lastBackupKind, kind);
  prefs.set(PrefKeys.lastBackupDocs, await issuedCount());
  if (kind === 'drive') {
    prefs.remove(PrefKeys.driveError);
  }
}

export const lastBackup = () => {
  const at = prefs.getNumber(PrefKeys.lastBackupAt);
  return at
    ? { at, kind: (prefs.getString(PrefKeys.lastBackupKind) ?? 'file') as 'file' | 'drive' }
    : null;
};

export type OpenedBackup = { snapshot: Snapshot; summary: SnapshotSummary };

/** Unpack and check a backup file without changing anything yet. */
export async function openBackup(uri: string): Promise<OpenedBackup> {
  const { json } = await native().openZip(uri);
  const snapshot = readSnapshot(json);
  return { snapshot, summary: summarize(snapshot) };
}

/** Apply an opened backup: data first (one transaction), then its files. */
export async function applyBackup(
  opened: OpenedBackup,
  mode: 'replace' | 'merge',
): Promise<void> {
  const db = await getDatabase();
  await restoreSnapshot(db, opened.snapshot, {
    mode,
    filesDir: native().getFilesDir(),
  });
  await native().commitStaged();
  notifyDataChanged();
}

/* ─────────────────────────────── Drive ────────────────────────────── */

const drive = () => {
  if (!NativeDrive) {
    throw new Error('NativeDrive unavailable');
  }
  return NativeDrive;
};

/** Back up to the app's hidden Drive folder and keep the latest five. */
export async function backupToDrive(interactive: boolean): Promise<boolean> {
  const token = await drive().authorize(interactive);
  if (!token) {
    return false;
  }
  const zip = await createBackupZip();
  await drive().upload(token, zip.path, zip.name);
  const files = await drive().list(token);
  for (const old of files.slice(KEEP_ON_DRIVE)) {
    await drive().remove(token, old.id).catch(() => undefined);
  }
  await markBackedUp('drive');
  return true;
}

export async function listDriveBackups(): Promise<DriveFile[] | null> {
  const token = await drive().authorize(true);
  return token ? drive().list(token) : null;
}

export async function openDriveBackup(id: string): Promise<OpenedBackup> {
  const token = await drive().authorize(true);
  if (!token) {
    throw new Error('Not authorized');
  }
  return openBackup(await drive().download(token, id));
}

/**
 * Weekly automatic Drive backup, run when the app is in use (no background
 * JavaScript needed). Silent: never shows consent; failures are recorded
 * and surfaced on the Backup screen.
 */
export async function maybeAutoBackup(): Promise<void> {
  if (!prefs.getBoolean(PrefKeys.autoDriveBackup)) {
    return;
  }
  const last = lastBackup();
  if (last && last.kind === 'drive' && Date.now() - last.at < WEEK) {
    return;
  }
  try {
    const done = await backupToDrive(false);
    if (!done) {
      prefs.set(PrefKeys.driveError, 'AUTH');
    }
  } catch {
    prefs.set(PrefKeys.driveError, 'FAILED');
  }
}

/**
 * Contextual nudge: shown once there is something worth protecting and it
 * isn't protected — first backup after 5 issued documents, then again when
 * a month passed with new work since the last backup.
 */
export async function shouldNudge(): Promise<boolean> {
  if (prefs.getBoolean(PrefKeys.autoDriveBackup) && !prefs.getString(PrefKeys.driveError)) {
    return false;
  }
  const dismissed = prefs.getNumber(PrefKeys.nudgeDismissedAt);
  if (dismissed && Date.now() - dismissed < 2 * WEEK) {
    return false;
  }
  const issued = await issuedCount();
  const last = lastBackup();
  if (!last) {
    return issued >= 5;
  }
  const sinceDocs = issued - (prefs.getNumber(PrefKeys.lastBackupDocs) ?? 0);
  return Date.now() - last.at > 30 * 24 * 60 * 60 * 1000 && sinceDocs > 0;
}

export const dismissNudge = () => prefs.set(PrefKeys.nudgeDismissedAt, Date.now());
