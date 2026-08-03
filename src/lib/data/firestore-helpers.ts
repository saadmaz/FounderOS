import {
  type DocumentData,
  type QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";

/** Converts Firestore Timestamp fields back to epoch millis on read. */
export function fromFirestore<T>(snap: QueryDocumentSnapshot<DocumentData>): T {
  const data = snap.data();
  const converted: Record<string, unknown> = { id: snap.id };
  for (const [key, value] of Object.entries(data)) {
    converted[key] = value instanceof Timestamp ? value.toMillis() : value;
  }
  return converted as T;
}

export function now(): number {
  return Date.now();
}
