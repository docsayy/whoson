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

export function subscribeToDirectoryContacts(
  onValue: (contacts: DirectoryContact[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    directoryCollection,
    (snapshot) => {
      const contacts = snapshot.docs
        .map(mapContact)
        .sort((a, b) => a.name.localeCompare(b.name));

      onValue(contacts);
    },
    (error) => onError?.(error)
  );
}

export async function createDirectoryContact(
  input: DirectoryContactInput
): Promise<string> {
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

  await updateDoc(doc(db, "directoryContacts", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDirectoryContact(id: string): Promise<void> {
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
