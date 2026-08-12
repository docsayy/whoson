import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { noteWrite, registerActiveListener } from "./dataCache";
import { initialDirectoryContacts } from "../data/initialDirectoryContacts";
import type {
  DirectoryContact,
  DirectoryContactInput,
} from "../types/directoryContact";

const directoryCollection = collection(db, "directoryContacts");

function toIso(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return typeof value === "string" ? value : "";
}

function mapContact(
  snapshot: QueryDocumentSnapshot<DocumentData>
): DirectoryContact {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    sourceKey: typeof data.sourceKey === "string" ? data.sourceKey : undefined,
    tab:
      data.tab === "pager" || data.tab === "nursing-home"
        ? data.tab
        : "contacts",
    category: typeof data.category === "string" ? data.category : "Other",
    name: typeof data.name === "string" ? data.name : "Unnamed",
    phoneNumbers: Array.isArray(data.phoneNumbers) ? data.phoneNumbers : [],
    extensions: Array.isArray(data.extensions) ? data.extensions : [],
    pagerNumbers: Array.isArray(data.pagerNumbers) ? data.pagerNumbers : [],
    faxNumbers: Array.isArray(data.faxNumbers) ? data.faxNumbers : [],
    notes: typeof data.notes === "string" ? data.notes : "",
    usualAdmittingAttendings:
      typeof data.usualAdmittingAttendings === "string"
        ? data.usualAdmittingAttendings
        : "",
    active: data.active !== false,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

type DirectorySubscriber = {
  onValue: (contacts: DirectoryContact[]) => void;
  onError?: (error: Error) => void;
};

const directorySubscribers = new Set<DirectorySubscriber>();
let directoryFirestoreUnsubscribe: Unsubscribe | null = null;
let directoryReleaseMetric: (() => void) | null = null;
let currentDirectoryContacts: DirectoryContact[] | null = null;

function startSharedDirectoryListener() {
  if (directoryFirestoreUnsubscribe) return;
  directoryReleaseMetric = registerActiveListener();
  directoryFirestoreUnsubscribe = onSnapshot(
    directoryCollection,
    (snapshot) => {
      currentDirectoryContacts = snapshot.docs
        .map(mapContact)
        .sort((a, b) => a.name.localeCompare(b.name));
      directorySubscribers.forEach((subscriber) =>
        subscriber.onValue(currentDirectoryContacts || [])
      );
    },
    (error) =>
      directorySubscribers.forEach((subscriber) => subscriber.onError?.(error))
  );
}

function stopSharedDirectoryListenerIfUnused() {
  if (directorySubscribers.size > 0 || !directoryFirestoreUnsubscribe) return;
  directoryFirestoreUnsubscribe();
  directoryFirestoreUnsubscribe = null;
  directoryReleaseMetric?.();
  directoryReleaseMetric = null;
  currentDirectoryContacts = null;
}

export function subscribeToDirectoryContacts(
  onValue: (contacts: DirectoryContact[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const subscriber = { onValue, onError };
  directorySubscribers.add(subscriber);
  if (currentDirectoryContacts) {
    queueMicrotask(() => onValue(currentDirectoryContacts || []));
  }
  startSharedDirectoryListener();

  return () => {
    directorySubscribers.delete(subscriber);
    stopSharedDirectoryListenerIfUnused();
  };
}

export async function createDirectoryContact(
  input: DirectoryContactInput
): Promise<string> {
  noteWrite();
  const ref = await addDoc(directoryCollection, {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateDirectoryContact(
  contact: DirectoryContact
): Promise<void> {
  const { id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = contact;

  noteWrite();
  await updateDoc(doc(db, "directoryContacts", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDirectoryContact(id: string): Promise<void> {
  noteWrite();
  await deleteDoc(doc(db, "directoryContacts", id));
}

export async function importInitialDirectoryContacts(): Promise<number> {
  let imported = 0;

  for (let start = 0; start < initialDirectoryContacts.length; start += 400) {
    const batch = writeBatch(db);
    const chunk = initialDirectoryContacts.slice(start, start + 400);

    for (const contact of chunk) {
      const stableId = contact.sourceKey || `provided-${start + imported + 1}`;
      const ref = doc(db, "directoryContacts", stableId);

      noteWrite();
      batch.set(
        ref,
        {
          ...contact,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      imported += 1;
    }

    await batch.commit();
  }

  return imported;
}
