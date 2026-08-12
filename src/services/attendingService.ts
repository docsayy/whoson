import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

import { db } from "../config/firebase";
import type { Attending } from "../types/attending";
import {
  CACHE_TTL,
  getCachedValue,
  noteWrite,
  readThroughCache,
  setCachedValue,
  valuesEqual,
} from "./dataCache";

const attendingsCollection = collection(db, "attendings");
const CACHE_KEY = "attendings:all";

function sortAttendings(items: Attending[]) {
  return items.slice().sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function getAttendings(force = false): Promise<Attending[]> {
  return readThroughCache(
    CACHE_KEY,
    async () => {
      const q = query(attendingsCollection, orderBy("displayName", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Attending, "id">),
      }));
    },
    CACHE_TTL.reference,
    force
  );
}

export async function createAttending(
  attending: Omit<Attending, "id">
): Promise<string> {
  noteWrite();
  const docRef = await addDoc(attendingsCollection, attending);
  const current = getCachedValue<Attending[]>(CACHE_KEY) || [];
  setCachedValue(
    CACHE_KEY,
    sortAttendings([...current, { id: docRef.id, ...attending }]),
    CACHE_TTL.reference
  );
  return docRef.id;
}

export async function updateAttending(attending: Attending): Promise<void> {
  const current = getCachedValue<Attending[]>(CACHE_KEY);
  const existing = current?.find((item) => item.id === attending.id);
  if (existing && valuesEqual(existing, attending)) {
    noteWrite(true);
    return;
  }

  noteWrite();
  const ref = doc(db, "attendings", attending.id);
  const { id, ...data } = attending;
  await updateDoc(ref, data);
  if (current) {
    setCachedValue(
      CACHE_KEY,
      sortAttendings(current.map((item) => (item.id === attending.id ? attending : item))),
      CACHE_TTL.reference
    );
  }
}

export async function deleteAttendingById(id: string): Promise<void> {
  noteWrite();
  await deleteDoc(doc(db, "attendings", id));
  const current = getCachedValue<Attending[]>(CACHE_KEY);
  if (current) {
    setCachedValue(
      CACHE_KEY,
      current.filter((item) => item.id !== id),
      CACHE_TTL.reference
    );
  }
}
