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

const residentsCollection = collection(db, "residents");

export async function getResidents(): Promise<Resident[]> {
  const q = query(residentsCollection, orderBy("displayName", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<Resident, "id">),
  }));
}

export async function createResident(
  resident: Omit<Resident, "id">
): Promise<string> {
  const docRef = await addDoc(residentsCollection, resident);
  return docRef.id;
}

export async function updateResident(resident: Resident): Promise<void> {
  const residentRef = doc(db, "residents", resident.id);
  const { id, ...data } = resident;
  await updateDoc(residentRef, data);
}

export async function deleteResidentById(id: string): Promise<void> {
  const residentRef = doc(db, "residents", id);
  await deleteDoc(residentRef);
}