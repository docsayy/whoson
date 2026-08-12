import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
  deleteField,
  writeBatch,
  type DocumentReference,
  type WriteBatch,
} from "firebase/firestore";

import { db } from "../config/firebase";
import type { BlockAssignment } from "../types/blockAssignment";
import { CACHE_TTL, getCachedValue, invalidateCachedValue, noteWrite, readThroughCache, setCachedValue, valuesEqual } from "./dataCache";

const blockAssignmentsCollection = collection(db, "blockAssignments");
const CACHE_KEY = "block-assignments:all";

function removeUndefinedValues<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;
}

export type BlockAssignmentUpsert = {
  existingId?: string;
  assignment: Omit<BlockAssignment, "id">;
};

export function isDraftBlockAssignment(assignment: BlockAssignment) {
  return !assignment.status || assignment.status === "draft";
}

export function getDraftAssignmentsForYear(
  assignments: BlockAssignment[],
  academicYear: string
) {
  return assignments.filter(
    (assignment) =>
      assignment.academicYear === academicYear && isDraftBlockAssignment(assignment)
  );
}

export function getLatestPublishedAssignmentsForYear(
  assignments: BlockAssignment[],
  academicYear: string
) {
  const published = assignments.filter(
    (assignment) =>
      assignment.academicYear === academicYear && assignment.status === "published"
  );

  if (published.length > 0) {
    const latestVersion = Math.max(
      ...published.map((assignment) => assignment.version || 1)
    );
    return published.filter(
      (assignment) => (assignment.version || 1) === latestVersion
    );
  }

  // Backward compatibility: before first publish, legacy records remain visible.
  return assignments.filter(
    (assignment) =>
      assignment.academicYear === academicYear && !assignment.status
  );
}

export function getBlockScheduleVersions(
  assignments: BlockAssignment[],
  academicYear: string
) {
  const versions = new Map<
    number,
    { version: number; status: "published" | "archived"; updatedAt: string; count: number }
  >();

  for (const assignment of assignments) {
    if (assignment.academicYear !== academicYear) continue;
    if (assignment.status !== "published" && assignment.status !== "archived") continue;

    const version = assignment.version || 1;
    const current = versions.get(version);
    const updatedAt = assignment.updatedAt || assignment.createdAt;

    if (!current) {
      versions.set(version, {
        version,
        status: assignment.status,
        updatedAt,
        count: 1,
      });
    } else {
      current.count += 1;
      if (assignment.status === "published") current.status = "published";
      if (updatedAt > current.updatedAt) current.updatedAt = updatedAt;
    }
  }

  return Array.from(versions.values()).sort((a, b) => b.version - a.version);
}

function sortAssignments(items: BlockAssignment[]) {
  return items.slice().sort((a, b) => {
    if (a.academicYear !== b.academicYear) {
      return a.academicYear.localeCompare(b.academicYear);
    }
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return a.residentName.localeCompare(b.residentName);
  });
}

export function peekBlockAssignments(): BlockAssignment[] | undefined {
  return getCachedValue<BlockAssignment[]>(CACHE_KEY);
}

export async function getBlockAssignments(force = false): Promise<BlockAssignment[]> {
  return readThroughCache(
    CACHE_KEY,
    async () => {
      const snapshot = await getDocs(blockAssignmentsCollection);
      return sortAssignments(snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<BlockAssignment, "id">),
      })));
    },
    CACHE_TTL.schedule,
    force
  );
}

export async function createBlockAssignment(
  assignment: Omit<BlockAssignment, "id">
): Promise<string> {
  const payload = removeUndefinedValues({
    ...assignment,
    status: assignment.status || "draft",
    source: assignment.source || "manual",
  });

  noteWrite();
  const docRef = await addDoc(blockAssignmentsCollection, payload);
  const current = getCachedValue<BlockAssignment[]>(CACHE_KEY) || [];
  setCachedValue(CACHE_KEY, sortAssignments([...current, { id: docRef.id, ...(payload as Omit<BlockAssignment, "id">) }]), CACHE_TTL.schedule);
  return docRef.id;
}

export async function updateBlockAssignment(
  assignment: BlockAssignment
): Promise<void> {
  const current = getCachedValue<BlockAssignment[]>(CACHE_KEY);
  const existing = current?.find((item) => item.id === assignment.id);
  if (existing && valuesEqual(existing, assignment)) { noteWrite(true); return; }
  noteWrite();
  const ref = doc(db, "blockAssignments", assignment.id);
  const { id, ...data } = assignment;
  const payload: Record<string, unknown> = removeUndefinedValues({
    ...data,
    status: data.status || "draft",
    source: data.source || "manual",
  });

  // When changing from a staffed rotation to an unlimited rotation such as
  // Jeopardy, remove the old slot key instead of leaving stale data behind.
  if (data.slotKey === undefined) {
    payload.slotKey = deleteField();
  }

  await updateDoc(ref, payload);
  if (current) setCachedValue(CACHE_KEY, sortAssignments(current.map((item) => item.id === assignment.id ? assignment : item)), CACHE_TTL.schedule);
}

export async function deleteBlockAssignmentById(id: string): Promise<void> {
  noteWrite();
  const ref = doc(db, "blockAssignments", id);
  await deleteDoc(ref);
  const current = getCachedValue<BlockAssignment[]>(CACHE_KEY);
  if (current) setCachedValue(CACHE_KEY, current.filter((item) => item.id !== id), CACHE_TTL.schedule);
}

async function commitOperations(
  operations: Array<(batch: WriteBatch) => void>,
  chunkSize = 400
) {
  for (let index = 0; index < operations.length; index += chunkSize) {
    const batch = writeBatch(db);
    operations.slice(index, index + chunkSize).forEach((operation) => operation(batch));
    await batch.commit();
  }
}

export async function upsertBlockAssignments(items: BlockAssignmentUpsert[]) {
  const operations: Array<(batch: WriteBatch) => void> = [];

  for (const item of items) {
    const ref: DocumentReference = item.existingId
      ? doc(db, "blockAssignments", item.existingId)
      : doc(blockAssignmentsCollection);

    operations.push((batch) =>
      batch.set(
        ref,
        removeUndefinedValues({
          ...item.assignment,
          status: item.assignment.status || "draft",
          source: item.assignment.source || "excel-import",
        }),
        { merge: true }
      )
    );
  }

  operations.forEach(() => noteWrite());
  await commitOperations(operations);
  invalidateCachedValue(CACHE_KEY);
}

export async function publishBlockSchedule(
  academicYear: string,
  draftAssignments: BlockAssignment[]
) {
  const allAssignments = await getBlockAssignments();
  const existingVersioned = allAssignments.filter(
    (assignment) =>
      assignment.academicYear === academicYear &&
      (assignment.status === "published" || assignment.status === "archived")
  );

  const nextVersion =
    existingVersioned.length === 0
      ? 1
      : Math.max(...existingVersioned.map((assignment) => assignment.version || 1)) + 1;

  const now = new Date().toISOString();
  const operations: Array<(batch: WriteBatch) => void> = [];

  for (const currentPublished of allAssignments.filter(
    (assignment) =>
      assignment.academicYear === academicYear &&
      assignment.status === "published"
  )) {
    const ref = doc(db, "blockAssignments", currentPublished.id);
    operations.push((batch) =>
      batch.update(ref, {
        status: "archived",
        updatedAt: now,
      })
    );
  }

  for (const assignment of draftAssignments) {
    const safeResident = assignment.residentId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeBlock = assignment.blockId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const publishedId = `published_${academicYear}_v${nextVersion}_${safeResident}_${safeBlock}`;
    const ref = doc(db, "blockAssignments", publishedId);
    const { id: _id, ...data } = assignment;

    operations.push((batch) =>
      batch.set(
        ref,
        removeUndefinedValues({
          ...data,
          status: "published",
          version: nextVersion,
          source: "publish",
          createdAt: now,
          updatedAt: now,
        })
      )
    );
  }

  operations.forEach(() => noteWrite());
  await commitOperations(operations);
  invalidateCachedValue(CACHE_KEY);
  return nextVersion;
}

export async function restoreBlockScheduleVersion(
  academicYear: string,
  version: number
) {
  const allAssignments = await getBlockAssignments();
  const sourceAssignments = allAssignments.filter(
    (assignment) =>
      assignment.academicYear === academicYear &&
      (assignment.status === "published" || assignment.status === "archived") &&
      (assignment.version || 1) === version
  );

  if (sourceAssignments.length === 0) {
    throw new Error(`No block schedule assignments were found for version ${version}.`);
  }

  return publishBlockSchedule(academicYear, sourceAssignments);
}
