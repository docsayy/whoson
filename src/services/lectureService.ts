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
import type { LectureEvent } from "../types/lecture";
import {
  CACHE_TTL,
  getCachedValue,
  noteWrite,
  readThroughCache,
  setCachedValue,
  valuesEqual,
} from "./dataCache";

const lectureCollection = collection(db, "lectureEvents");
const CACHE_KEY = "lectures:all";

function sortLectures(items: LectureEvent[]) {
  return items.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });
}

export function peekLectureEvents(): LectureEvent[] | undefined {
  return getCachedValue<LectureEvent[]>(CACHE_KEY);
}

export async function getLectureEvents(force = false): Promise<LectureEvent[]> {
  return readThroughCache(
    CACHE_KEY,
    async () => {
      const snapshot = await getDocs(query(lectureCollection, orderBy("date", "asc")));
      return sortLectures(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<LectureEvent, "id">),
        }))
      );
    },
    CACHE_TTL.lectures,
    force
  );
}

export async function createLectureEvent(
  event: Omit<LectureEvent, "id">
): Promise<string> {
  noteWrite();
  const ref = await addDoc(lectureCollection, event);
  const current = getCachedValue<LectureEvent[]>(CACHE_KEY) || [];
  setCachedValue(
    CACHE_KEY,
    sortLectures([...current, { id: ref.id, ...event }]),
    CACHE_TTL.lectures
  );
  return ref.id;
}

export async function updateLectureEvent(event: LectureEvent): Promise<void> {
  const current = getCachedValue<LectureEvent[]>(CACHE_KEY);
  const existing = current?.find((item) => item.id === event.id);
  if (existing && valuesEqual(existing, event)) {
    noteWrite(true);
    return;
  }

  noteWrite();
  const { id, ...data } = event;
  await updateDoc(doc(db, "lectureEvents", id), data);
  if (current) {
    setCachedValue(
      CACHE_KEY,
      sortLectures(current.map((item) => (item.id === event.id ? event : item))),
      CACHE_TTL.lectures
    );
  }
}

export async function deleteLectureEvent(id: string): Promise<void> {
  noteWrite();
  await deleteDoc(doc(db, "lectureEvents", id));
  const current = getCachedValue<LectureEvent[]>(CACHE_KEY);
  if (current) {
    setCachedValue(
      CACHE_KEY,
      current.filter((item) => item.id !== id),
      CACHE_TTL.lectures
    );
  }
}
