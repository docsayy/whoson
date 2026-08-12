import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "../config/firebase";
import type { VacationBlock } from "../types/vacation";

const vacationCollection = collection(db, "vacationBlocks");

export async function getVacationBlocks(): Promise<VacationBlock[]> {
  const q = query(vacationCollection, orderBy("startDate", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<VacationBlock, "id">),
  }));
}

export async function createVacationBlock(
  vacation: Omit<VacationBlock, "id">
): Promise<string> {
  const docRef = await addDoc(vacationCollection, vacation);
  return docRef.id;
}

export async function deleteVacationBlockById(id: string): Promise<void> {
  const ref = doc(db, "vacationBlocks", id);
  await deleteDoc(ref);
}