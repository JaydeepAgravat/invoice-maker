import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { AppState } from 'react-native';

import { clock, getDatabase } from './database';
import type { Database, Executor } from './db/types';

/**
 * Tiny reactive layer. Every write goes through `mutate`, which runs in a
 * transaction and then bumps a global data version; every `useLiveQuery`
 * re-runs when the version changes. Queries take milliseconds, so coarse
 * invalidation is simpler and safer than tracking tables.
 */

let version = 0;
const listeners = new Set<() => void>();

const bump = () => {
  version++;
  listeners.forEach(l => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// Coming back to the app may cross midnight: re-derive "Overdue" and friends.
// Going to the background, fold the write-ahead log into the database file so
// Android's own backup always copies a complete database.
AppState.addEventListener('change', state => {
  if (state === 'active') {
    bump();
  } else if (state === 'background') {
    getDatabase()
      .then(db => db.execute('PRAGMA wal_checkpoint(TRUNCATE)'))
      .catch(() => undefined);
  }
});

/** Tell every live query to refresh (after a restore or bulk import). */
export const notifyDataChanged = () => bump();

/** Subscribe to data changes outside React (reminder scheduling). */
export const onDataChanged = subscribe;

export const useDataVersion = () =>
  useSyncExternalStore(subscribe, () => version);

export async function mutate<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
  const db = await getDatabase();
  const result = await db.transaction(fn);
  bump();
  return result;
}

export type LiveQuery<T> = {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  refetch: () => void;
};

/**
 * Run a read against the database and keep it fresh. Previous data is kept
 * while refetching, so lists never flash empty.
 */
export function useLiveQuery<T>(
  query: (db: Database) => Promise<T>,
  deps: readonly unknown[],
): LiveQuery<T> {
  const v = useDataVersion();
  const [state, setState] = useState<{
    data: T | undefined;
    error: unknown;
    loading: boolean;
  }>({
    data: undefined,
    error: null,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(query, deps);

  useEffect(() => {
    const ticket = ++latest.current;
    let cancelled = false;
    getDatabase()
      .then(db => run(db))
      .then(
        data =>
          !cancelled &&
          ticket === latest.current &&
          setState({ data, error: null, loading: false }),
        error =>
          !cancelled &&
          ticket === latest.current &&
          setState(s => ({ ...s, error, loading: false })),
      );
    return () => {
      cancelled = true;
    };
  }, [run, v, nonce]);

  return { ...state, refetch: () => setNonce(n => n + 1) };
}

export { clock };
