"use client";

import { useEffect, useState } from "react";
import {
  type QueryConstraint,
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { fromFirestore } from "./firestore-helpers";

/**
 * Live-subscribes to a Firestore collection. This is the one primitive
 * every entity hook (useCompanies, useTasks, ...) is built on, so the
 * whole app updates in real time without any manual refetching.
 */
export function useCollection<T extends { id: string }>(
  path: string | null,
  constraints: QueryConstraint[] = [],
  // Callers own re-subscription: pass whatever values the constraints
  // above were built from (e.g. [companyId, statusFilter]).
  deps: unknown[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!path) return;
    // Reset to loading when re-subscribing (path/deps changed) - the
    // initial mount is already `true` from useState's default above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const q = query(collection(db, path), ...constraints);
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => fromFirestore<T>(d)));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err as Error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  if (!path) {
    return { data: [] as T[], loading: false, error: null };
  }
  return { data, loading, error };
}
