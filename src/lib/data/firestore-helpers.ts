import {
  deleteField,
  type DocumentData,
  type FieldValue,
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

/**
 * Firestore's addDoc/updateDoc throw on any field whose value is `undefined`
 * (top-level or nested) - strip them so optional-field patterns like
 * `foo: values.foo || undefined` can be spread into a write payload safely.
 */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}

/**
 * For an updateDoc() patch specifically - unlike omitUndefined (which drops
 * the key entirely, leaving whatever value is already stored untouched),
 * this turns each `undefined` into Firestore's deleteField() sentinel.
 * The detail-sheet autosave pattern (`commit({ title: draft.title ||
 * undefined })`) relies on `undefined` meaning "clear this field" - since
 * every commit() patch is just that one edited field, omitting the key
 * would silently no-op instead of clearing it, and updateDoc rejects a
 * bare `undefined` value outright.
 */
export function withFieldDeletes<T extends Record<string, unknown>>(
  patch: T
): Record<string, FieldValue | T[keyof T]> {
  const result: Record<string, FieldValue | T[keyof T]> = {};
  for (const [key, value] of Object.entries(patch)) {
    result[key] = value === undefined ? deleteField() : (value as T[keyof T]);
  }
  return result;
}
