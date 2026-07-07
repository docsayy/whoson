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
import type { ScheduleAssignment } from "../types/schedule";

const scheduleCollection = collection(db, "scheduleAssignments");

export async function getScheduleAssignments(): Promise<ScheduleAssignment[]> {
  const q = query(scheduleCollection, orderBy("date", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<ScheduleAssignment, "id">),
  }));
}

export async function createScheduleAssignment(
  assignment: Omit<ScheduleAssignment, "id">
): Promise<string> {
  const docRef = await addDoc(scheduleCollection, assignment);
  return docRef.id;
}

export async function updateScheduleAssignment(
  assignment: ScheduleAssignment
): Promise<void> {
  const ref = doc(db, "scheduleAssignments", assignment.id);
  const { id, ...data } = assignment;
  await updateDoc(ref, data);
}

export async function deleteScheduleAssignmentById(id: string): Promise<void> {
  const ref = doc(db, "scheduleAssignments", id);
  await deleteDoc(ref);
}