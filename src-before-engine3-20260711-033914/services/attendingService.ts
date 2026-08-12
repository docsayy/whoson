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

const attendingsCollection = collection(db, "attendings");

export async function getAttendings(): Promise<Attending[]> {
  const q = query(attendingsCollection, orderBy("displayName", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<Attending, "id">),
  }));
}

export async function createAttending(
  attending: Omit<Attending, "id">
): Promise<string> {
  const docRef = await addDoc(attendingsCollection, attending);
  return docRef.id;
}

export async function updateAttending(attending: Attending): Promise<void> {
  const ref = doc(db, "attendings", attending.id);
  const { id, ...data } = attending;
  await updateDoc(ref, data);
}

export async function deleteAttendingById(id: string): Promise<void> {
  const ref = doc(db, "attendings", id);
  await deleteDoc(ref);
}