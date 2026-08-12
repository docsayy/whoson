import {
  collection,
  doc,
  getDocs,
  writeBatch,
  type DocumentData,
  type WriteBatch,
} from "firebase/firestore";

import { findResidentCallService } from "../config/scheduleServices";
import { db } from "../config/firebase";
import type { Attending } from "../types/attending";
import type { AttendingScheduleAssignment } from "../types/attendingSchedule";
import type { BlockAssignment } from "../types/blockAssignment";
import type { RotationRequirement } from "../types/rotation";
import {
  canonicalAttendingServiceKey,
  normalizeAttendingText,
  resolveAttendingProfile,
} from "../utils/attendingScheduleCanonical";

export interface MaintenanceScanSummary {
  staleAttendingReferences: number;
  unresolvedAttendingReferences: number;
  exactDuplicateAttendingAssignments: number;
  overlappingAttendingAssignments: number;
  staleBlockRotationReferences: number;
  unresolvedBlockRotationReferences: number;
  duplicateDraftBlockAssignments: number;
  legacyCallCells: number;
  legacyMonthlyScheduleDocuments: number;
  legacyMonthlyScheduleDocumentsWithCurrentCopy: number;
  details: string[];
}

type FirestoreRecord<T> = T & { id: string };

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function newestTimestamp(value: {
  updatedAt?: string;
  createdAt?: string;
}) {
  return value.updatedAt || value.createdAt || "";
}

async function readCollection<T>(name: string): Promise<FirestoreRecord<T>[]> {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...(item.data() as T),
  }));
}

function rangesOverlap(
  first: Pick<AttendingScheduleAssignment, "startDate" | "endDate">,
  second: Pick<AttendingScheduleAssignment, "startDate" | "endDate">
) {
  return first.startDate <= second.endDate && second.startDate <= first.endDate;
}

function getAttendingDuplicateGroups(
  assignments: AttendingScheduleAssignment[],
  attendings: Attending[]
) {
  const groups = new Map<string, AttendingScheduleAssignment[]>();

  for (const assignment of assignments.filter((item) => !item.archived)) {
    const profile = resolveAttendingProfile(assignment, attendings);
    const attendingKey =
      profile?.id ||
      assignment.attendingId ||
      normalizeAttendingText(assignment.attendingName || "unassigned");
    const key = [
      assignment.group,
      canonicalAttendingServiceKey(assignment),
      assignment.startDate,
      assignment.endDate,
      attendingKey,
    ].join("|");

    const current = groups.get(key) || [];
    current.push(assignment);
    groups.set(key, current);
  }

  return Array.from(groups.values()).filter((items) => items.length > 1);
}

function getDuplicateDraftBlockGroups(assignments: BlockAssignment[]) {
  const groups = new Map<string, BlockAssignment[]>();

  for (const assignment of assignments) {
    if (assignment.status && assignment.status !== "draft") continue;
    const key = [
      assignment.academicYear,
      assignment.blockId,
      assignment.residentId,
    ].join("|");
    const current = groups.get(key) || [];
    current.push(assignment);
    groups.set(key, current);
  }

  return Array.from(groups.values()).filter((items) => items.length > 1);
}

function findRotationMatch(
  assignment: BlockAssignment,
  rotations: RotationRequirement[]
) {
  const byId = rotations.find((rotation) => rotation.id === assignment.rotationId);
  if (byId) return byId;

  const normalizedName = normalize(assignment.rotationName || "");
  const matches = rotations.filter(
    (rotation) => normalize(rotation.name) === normalizedName
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function countOverlappingAttendingAssignments(
  assignments: AttendingScheduleAssignment[],
  attendings: Attending[]
) {
  const active = assignments.filter((item) => !item.archived);
  let count = 0;

  for (let firstIndex = 0; firstIndex < active.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < active.length;
      secondIndex += 1
    ) {
      const first = active[firstIndex];
      const second = active[secondIndex];
      if (first.group !== second.group) continue;
      if (
        canonicalAttendingServiceKey(first) !==
        canonicalAttendingServiceKey(second)
      ) {
        continue;
      }
      if (!rangesOverlap(first, second)) continue;

      const firstProfile = resolveAttendingProfile(first, attendings);
      const secondProfile = resolveAttendingProfile(second, attendings);
      const firstAttending =
        firstProfile?.id || first.attendingId || normalize(first.attendingName);
      const secondAttending =
        secondProfile?.id || second.attendingId || normalize(second.attendingName);

      if (firstAttending !== secondAttending) count += 1;
    }
  }

  return count;
}

export async function scanLegacySchedulingData(): Promise<MaintenanceScanSummary> {
  const [attendings, attendingAssignments, rotations, blockAssignments] =
    await Promise.all([
      readCollection<Attending>("attendings"),
      readCollection<AttendingScheduleAssignment>(
        "attendingScheduleAssignments"
      ),
      readCollection<RotationRequirement>("rotations"),
      readCollection<BlockAssignment>("blockAssignments"),
    ]);

  let staleAttendingReferences = 0;
  let unresolvedAttendingReferences = 0;

  for (const assignment of attendingAssignments.filter(
    (item) => !item.archived
  )) {
    const profile = resolveAttendingProfile(assignment, attendings);
    if (!profile) {
      unresolvedAttendingReferences += 1;
      continue;
    }

    if (
      assignment.attendingId !== profile.id ||
      assignment.attendingName !== profile.displayName ||
      assignment.phone !== (profile.phone || "") ||
      assignment.pager !== (profile.pager || "")
    ) {
      staleAttendingReferences += 1;
    }
  }

  let staleBlockRotationReferences = 0;
  let unresolvedBlockRotationReferences = 0;

  for (const assignment of blockAssignments) {
    if (assignment.status === "archived") continue;
    const rotation = findRotationMatch(assignment, rotations);
    if (!rotation) {
      unresolvedBlockRotationReferences += 1;
      continue;
    }
    if (
      assignment.rotationId !== rotation.id ||
      assignment.rotationName !== rotation.name
    ) {
      staleBlockRotationReferences += 1;
    }
  }

  const scheduleMonths = await readCollection<{
    assignments?: Record<string, DocumentData>;
  }>("scheduleMonths");
  let legacyCallCells = 0;

  for (const month of scheduleMonths) {
    for (const [key, rawCell] of Object.entries(month.assignments || {})) {
      const cell = rawCell as {
        date?: string;
        serviceId?: string;
        serviceName?: string;
      };
      const service = findResidentCallService(
        cell.serviceId || cell.serviceName || ""
      );
      if (!service) continue;
      const expectedKey = `${cell.date || key.slice(0, 10)}_${service.id}`;
      if (
        key !== expectedKey ||
        cell.serviceId !== service.id ||
        cell.serviceName !== service.name
      ) {
        legacyCallCells += 1;
      }
    }
  }

  const legacyMonthlySchedules = await readCollection<DocumentData>(
    "monthlySchedules"
  );
  const currentMonthIds = new Set(scheduleMonths.map((item) => item.id));
  const legacyWithCurrentCopy = legacyMonthlySchedules.filter((item) =>
    currentMonthIds.has(item.id)
  ).length;

  const duplicateAttendingGroups = getAttendingDuplicateGroups(
    attendingAssignments,
    attendings
  );
  const duplicateBlockGroups = getDuplicateDraftBlockGroups(blockAssignments);
  const overlappingAttendingAssignments =
    countOverlappingAttendingAssignments(attendingAssignments, attendings);

  const details: string[] = [];
  if (staleAttendingReferences) {
    details.push(
      `${staleAttendingReferences} attending schedule record(s) use an old name, phone, pager, or ID.`
    );
  }
  if (unresolvedAttendingReferences) {
    details.push(
      `${unresolvedAttendingReferences} attending schedule record(s) could not be linked to a current attending profile.`
    );
  }
  if (overlappingAttendingAssignments) {
    details.push(
      `${overlappingAttendingAssignments} overlapping attending service assignment pair(s) need review.`
    );
  }
  if (staleBlockRotationReferences) {
    details.push(
      `${staleBlockRotationReferences} block assignment(s) use an old rotation ID or name.`
    );
  }
  if (unresolvedBlockRotationReferences) {
    details.push(
      `${unresolvedBlockRotationReferences} block assignment(s) point to an unknown rotation.`
    );
  }
  if (legacyCallCells) {
    details.push(
      `${legacyCallCells} daily call cell(s) use an older service ID or name.`
    );
  }
  if (legacyMonthlySchedules.length) {
    details.push(
      `${legacyMonthlySchedules.length} document(s) remain in the old monthlySchedules collection.`
    );
  }

  return {
    staleAttendingReferences,
    unresolvedAttendingReferences,
    exactDuplicateAttendingAssignments: duplicateAttendingGroups.reduce(
      (total, group) => total + group.length - 1,
      0
    ),
    overlappingAttendingAssignments,
    staleBlockRotationReferences,
    unresolvedBlockRotationReferences,
    duplicateDraftBlockAssignments: duplicateBlockGroups.reduce(
      (total, group) => total + group.length - 1,
      0
    ),
    legacyCallCells,
    legacyMonthlyScheduleDocuments: legacyMonthlySchedules.length,
    legacyMonthlyScheduleDocumentsWithCurrentCopy: legacyWithCurrentCopy,
    details,
  };
}

async function commitOperations(
  operations: Array<(batch: WriteBatch) => void>,
  chunkSize = 350
) {
  for (let index = 0; index < operations.length; index += chunkSize) {
    const batch = writeBatch(db);
    operations
      .slice(index, index + chunkSize)
      .forEach((operation) => operation(batch));
    await batch.commit();
  }
}

export async function repairLegacySchedulingReferences() {
  const [attendings, attendingAssignments, rotations, blockAssignments] =
    await Promise.all([
      readCollection<Attending>("attendings"),
      readCollection<AttendingScheduleAssignment>(
        "attendingScheduleAssignments"
      ),
      readCollection<RotationRequirement>("rotations"),
      readCollection<BlockAssignment>("blockAssignments"),
    ]);

  const operations: Array<(batch: WriteBatch) => void> = [];
  const now = new Date().toISOString();
  let repairedAttendingAssignments = 0;
  let repairedBlockAssignments = 0;
  let repairedCallCells = 0;

  for (const assignment of attendingAssignments.filter(
    (item) => !item.archived
  )) {
    const profile = resolveAttendingProfile(assignment, attendings);
    if (!profile) continue;
    if (
      assignment.attendingId === profile.id &&
      assignment.attendingName === profile.displayName &&
      assignment.phone === (profile.phone || "") &&
      assignment.pager === (profile.pager || "")
    ) {
      continue;
    }

    operations.push((batch) =>
      batch.set(
        doc(db, "attendingScheduleAssignments", assignment.id),
        {
          attendingId: profile.id,
          attendingName: profile.displayName,
          phone: profile.phone || "",
          pager: profile.pager || "",
          updatedAt: now,
        },
        { merge: true }
      )
    );
    repairedAttendingAssignments += 1;
  }

  for (const assignment of blockAssignments) {
    if (assignment.status === "archived") continue;
    const rotation = findRotationMatch(assignment, rotations);
    if (!rotation) continue;
    if (
      assignment.rotationId === rotation.id &&
      assignment.rotationName === rotation.name
    ) {
      continue;
    }

    operations.push((batch) =>
      batch.set(
        doc(db, "blockAssignments", assignment.id),
        {
          rotationId: rotation.id,
          rotationName: rotation.name,
          updatedAt: now,
          source: assignment.source || "migration",
        },
        { merge: true }
      )
    );
    repairedBlockAssignments += 1;
  }

  const scheduleMonths = await readCollection<{
    assignments?: Record<string, DocumentData>;
  }>("scheduleMonths");

  for (const month of scheduleMonths) {
    const original = month.assignments || {};
    const next: Record<string, DocumentData> = {};
    let changed = false;

    for (const [key, rawCell] of Object.entries(original)) {
      const cell = rawCell as {
        date?: string;
        serviceId?: string;
        serviceName?: string;
      };
      const service = findResidentCallService(
        cell.serviceId || cell.serviceName || ""
      );

      if (!service) {
        next[key] = rawCell;
        continue;
      }

      const date = cell.date || key.slice(0, 10);
      const canonicalKey = `${date}_${service.id}`;
      const canonicalCell = {
        ...rawCell,
        date,
        serviceId: service.id,
        serviceName: service.name,
      };

      if (
        canonicalKey !== key ||
        cell.serviceId !== service.id ||
        cell.serviceName !== service.name
      ) {
        changed = true;
        repairedCallCells += 1;
      }

      // Prefer a cell already stored under the canonical key.
      if (!next[canonicalKey] || key === canonicalKey) {
        next[canonicalKey] = canonicalCell;
      }
    }

    if (changed) {
      operations.push((batch) =>
        batch.set(
          doc(db, "scheduleMonths", month.id),
          { assignments: next, updatedAt: now },
          { merge: true }
        )
      );
    }
  }

  await commitOperations(operations);

  return {
    repairedAttendingAssignments,
    repairedBlockAssignments,
    repairedCallCells,
  };
}

function recordsToArchive<
  T extends { id: string; updatedAt?: string; createdAt?: string }
>(groups: T[][]) {
  return groups.flatMap((group) =>
    group
      .slice()
      .sort((a, b) => newestTimestamp(b).localeCompare(newestTimestamp(a)))
      .slice(1)
  );
}

export async function archiveExactDuplicateSchedulingData() {
  const [attendings, attendingAssignments, blockAssignments] =
    await Promise.all([
      readCollection<Attending>("attendings"),
      readCollection<AttendingScheduleAssignment>(
        "attendingScheduleAssignments"
      ),
      readCollection<BlockAssignment>("blockAssignments"),
    ]);

  const duplicateAttendingRecords = recordsToArchive(
    getAttendingDuplicateGroups(attendingAssignments, attendings)
  );
  const duplicateBlockRecords = recordsToArchive(
    getDuplicateDraftBlockGroups(blockAssignments)
  );

  const operations: Array<(batch: WriteBatch) => void> = [];
  const archivedAt = new Date().toISOString();

  for (const item of duplicateAttendingRecords) {
    operations.push((batch) => {
      batch.set(doc(db, "maintenanceArchive", `attending_${item.id}`), {
        originalCollection: "attendingScheduleAssignments",
        originalId: item.id,
        archivedAt,
        reason: "Exact duplicate attending assignment",
        data: item,
      });
      batch.delete(doc(db, "attendingScheduleAssignments", item.id));
    });
  }

  for (const item of duplicateBlockRecords) {
    operations.push((batch) => {
      batch.set(doc(db, "maintenanceArchive", `block_${item.id}`), {
        originalCollection: "blockAssignments",
        originalId: item.id,
        archivedAt,
        reason: "Exact duplicate draft block assignment",
        data: item,
      });
      batch.delete(doc(db, "blockAssignments", item.id));
    });
  }

  const [legacyMonths, currentMonths] = await Promise.all([
    readCollection<DocumentData>("monthlySchedules"),
    readCollection<DocumentData>("scheduleMonths"),
  ]);
  const currentMonthIds = new Set(currentMonths.map((item) => item.id));
  const legacyCopies = legacyMonths.filter((item) => currentMonthIds.has(item.id));

  for (const item of legacyCopies) {
    operations.push((batch) => {
      batch.set(doc(db, "maintenanceArchive", `monthly_${item.id}`), {
        originalCollection: "monthlySchedules",
        originalId: item.id,
        archivedAt,
        reason: "Legacy call month already exists in scheduleMonths",
        data: item,
      });
      batch.delete(doc(db, "monthlySchedules", item.id));
    });
  }

  await commitOperations(operations, 150);

  return {
    archivedAttendingAssignments: duplicateAttendingRecords.length,
    archivedBlockAssignments: duplicateBlockRecords.length,
    archivedLegacyMonthlySchedules: legacyCopies.length,
  };
}
