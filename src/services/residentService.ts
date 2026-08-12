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
import type { Resident } from "../types/resident";
import {
  CACHE_TTL,
  getCachedValue,
  noteWrite,
  readThroughCache,
  setCachedValue,
  valuesEqual,
} from "./dataCache";

const residentsCollection = collection(db, "residents");
const CACHE_KEY = "residents:all";

function sortResidents(items: Resident[]) {
  return items.slice().sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function getResidents(force = false): Promise<Resident[]> {
  return readThroughCache(
    CACHE_KEY,
    async () => {
      const q = query(residentsCollection, orderBy("displayName", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Resident, "id">),
      }));
    },
    CACHE_TTL.reference,
    force
  );
}

export async function createResident(
  resident: Omit<Resident, "id">
): Promise<string> {
  noteWrite();
  const docRef = await addDoc(residentsCollection, resident);
  const current = getCachedValue<Resident[]>(CACHE_KEY) || [];
  setCachedValue(
    CACHE_KEY,
    sortResidents([...current, { id: docRef.id, ...resident }]),
    CACHE_TTL.reference
  );
  return docRef.id;
}

export async function updateResident(resident: Resident): Promise<void> {
  const current = getCachedValue<Resident[]>(CACHE_KEY);
  const existing = current?.find((item) => item.id === resident.id);
  if (existing && valuesEqual(existing, resident)) {
    noteWrite(true);
    return;
  }

  noteWrite();
  const residentRef = doc(db, "residents", resident.id);
  const { id, ...data } = resident;
  await updateDoc(residentRef, data);
  if (current) {
    setCachedValue(
      CACHE_KEY,
      sortResidents(current.map((item) => (item.id === resident.id ? resident : item))),
      CACHE_TTL.reference
    );
  }
}

export async function deleteResidentById(id: string): Promise<void> {
  noteWrite();
  await deleteDoc(doc(db, "residents", id));
  const current = getCachedValue<Resident[]>(CACHE_KEY);
  if (current) {
    setCachedValue(
      CACHE_KEY,
      current.filter((item) => item.id !== id),
      CACHE_TTL.reference
    );
  }
}
