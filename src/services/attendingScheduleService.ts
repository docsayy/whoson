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
import {
  CACHE_TTL,
  getCachedValue,
  noteWrite,
  readThroughCache,
  setCachedValue,
  valuesEqual,
} from "./dataCache";

const attendingScheduleCollection = collection(
  db,
  "attendingScheduleAssignments"
);
const CACHE_KEY = "attending-schedule:all";

function normalize(items: AttendingScheduleAssignment[]) {
  return items
    .filter((assignment) => !assignment.archived)
    .sort((a, b) => {
      if (a.startDate !== b.startDate) {
        return a.startDate.localeCompare(b.startDate);
      }
      if (a.group !== b.group) return a.group.localeCompare(b.group);
      return a.serviceName.localeCompare(b.serviceName);
    });
}

export async function getAttendingScheduleAssignments(
  force = false
): Promise<AttendingScheduleAssignment[]> {
  return readThroughCache(
    CACHE_KEY,
    async () => {
      const snapshot = await getDocs(attendingScheduleCollection);
      return normalize(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<AttendingScheduleAssignment, "id">),
        }))
      );
    },
    CACHE_TTL.schedule,
    force
  );
}

export async function createAttendingScheduleAssignment(
  assignment: Omit<AttendingScheduleAssignment, "id">
): Promise<string> {
  noteWrite();
  const docRef = await addDoc(attendingScheduleCollection, assignment);
  const current = getCachedValue<AttendingScheduleAssignment[]>(CACHE_KEY) || [];
  setCachedValue(
    CACHE_KEY,
    normalize([...current, { id: docRef.id, ...assignment }]),
    CACHE_TTL.schedule
  );
  return docRef.id;
}

export async function updateAttendingScheduleAssignment(
  assignment: AttendingScheduleAssignment
): Promise<void> {
  const current = getCachedValue<AttendingScheduleAssignment[]>(CACHE_KEY);
  const existing = current?.find((item) => item.id === assignment.id);
  if (existing && valuesEqual(existing, assignment)) {
    noteWrite(true);
    return;
  }

  noteWrite();
  const ref = doc(db, "attendingScheduleAssignments", assignment.id);
  const { id, ...data } = assignment;
  await updateDoc(ref, data);
  if (current) {
    setCachedValue(
      CACHE_KEY,
      normalize(current.map((item) => (item.id === assignment.id ? assignment : item))),
      CACHE_TTL.schedule
    );
  }
}

export async function deleteAttendingScheduleAssignmentById(
  id: string
): Promise<void> {
  noteWrite();
  await deleteDoc(doc(db, "attendingScheduleAssignments", id));
  const current = getCachedValue<AttendingScheduleAssignment[]>(CACHE_KEY);
  if (current) {
    setCachedValue(
      CACHE_KEY,
      current.filter((item) => item.id !== id),
      CACHE_TTL.schedule
    );
  }
}
