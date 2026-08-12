import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";

import { db } from "../config/firebase";
import type { AttendingScheduleAssignment } from "../types/attendingSchedule";

const attendingScheduleCollection = collection(
  db,
  "attendingScheduleAssignments"
);

export async function getAttendingScheduleAssignments(): Promise<
  AttendingScheduleAssignment[]
> {
  const snapshot = await getDocs(attendingScheduleCollection);

  return snapshot.docs
    .map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<AttendingScheduleAssignment, "id">),
    }))
    .filter((assignment) => !assignment.archived)
    .sort((a, b) => {
      if (a.startDate !== b.startDate) {
        return a.startDate.localeCompare(b.startDate);
      }
      if (a.group !== b.group) return a.group.localeCompare(b.group);
      return a.serviceName.localeCompare(b.serviceName);
    });
}

export async function createAttendingScheduleAssignment(
  assignment: Omit<AttendingScheduleAssignment, "id">
): Promise<string> {
  const docRef = await addDoc(attendingScheduleCollection, assignment);
  return docRef.id;
}

export async function updateAttendingScheduleAssignment(
  assignment: AttendingScheduleAssignment
): Promise<void> {
  const ref = doc(db, "attendingScheduleAssignments", assignment.id);
  const { id, ...data } = assignment;
  await updateDoc(ref, data);
}

export async function deleteAttendingScheduleAssignmentById(
  id: string
): Promise<void> {
  await deleteDoc(doc(db, "attendingScheduleAssignments", id));
}
