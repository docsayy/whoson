import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { auth } from "../config/firebase";

export type SourceRecord = Record<string, unknown>;

export type SourceSyncStatus = {
  ok: boolean;
  source: string;
  start?: string;
  end?: string;
  completedAt?: string;
  failedAt?: string;
  error?: string;
  documentCount?: number;
};

const SOURCE_SYNC_URL =
  "https://whoson-source-scheduler-sync.msayan92.workers.dev";

export async function runSourceSyncNow() {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in again before updating the schedule.");
  const response = await fetch(SOURCE_SYNC_URL, {
    method: "POST",
    headers: { authorization: `Firebase ${await user.getIdToken()}` },
  });
  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string }
    | null;
  if (!response.ok || !body?.ok)
    throw new Error(body?.error || "Schedule update failed.");
  return body;
}

export async function getSourceSyncStatus() {
  const snapshot = await getDoc(doc(db, "sourceSyncStatus", "current"));
  return snapshot.exists() ? (snapshot.data() as SourceSyncStatus) : null;
}

export async function getSourceBlockSchedule() {
  const snapshot = await getDoc(
    doc(db, "sourceScheduleCache", "blockSchedule"),
  );
  return snapshot.exists() ? (snapshot.data() as SourceRecord) : null;
}

export async function getSourceCallDays(start: string, end: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "sourceCallDays"),
      where("date", ">=", start),
      where("date", "<=", end),
      orderBy("date", "asc"),
    ),
  );
  return snapshot.docs.map(
    (item) => ({ id: item.id, ...item.data() }) as SourceRecord,
  );
}

export async function getSourceCallDay(date: string) {
  const snapshot = await getDoc(doc(db, "sourceCallDays", date));
  return snapshot.exists() ? (snapshot.data() as SourceRecord) : null;
}

export async function getSourceServiceDay(
  date: string,
  kind: "inpatient" | "clinic",
) {
  const snapshot = await getDoc(
    doc(db, "sourceServiceDays", `${kind}_${date}`),
  );
  return snapshot.exists() ? (snapshot.data() as SourceRecord) : null;
}

export async function getSourceServiceDays(start: string, end: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "sourceServiceDays"),
      where("date", ">=", start),
      where("date", "<=", end),
      orderBy("date", "asc"),
    ),
  );
  return snapshot.docs.map(
    (item) => ({ id: item.id, ...item.data() }) as SourceRecord,
  );
}

export async function getSourceAttendingCoverage(start: string, end: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "sourceAttendingDays"),
      where("date", ">=", start),
      where("date", "<=", end),
      orderBy("date", "asc"),
    ),
  );
  return snapshot.docs.flatMap(
    (item) => (item.data().items as SourceRecord[] | undefined) || [],
  );
}

export async function getSourceLectures(start: string, end: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "sourceLectureDays"),
      where("date", ">=", start),
      where("date", "<=", end),
      orderBy("date", "asc"),
    ),
  );
  return snapshot.docs.flatMap(
    (item) => (item.data().items as SourceRecord[] | undefined) || [],
  );
}
