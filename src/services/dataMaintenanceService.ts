import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  type DocumentData,
  type WriteBatch,
} from "firebase/firestore";

import { findResidentCallService } from "../config/scheduleServices";
import { db } from "../config/firebase";
import type { AcademicBlock } from "../types/block";
import type { Attending } from "../types/attending";
import type { AttendingScheduleAssignment } from "../types/attendingSchedule";
import type { BlockAssignment } from "../types/blockAssignment";
import type { Resident } from "../types/resident";
import type { RotationRequirement } from "../types/rotation";
import {
  canonicalAttendingServiceKey,
  normalizeAttendingText,
  resolveAttendingProfile,
} from "../utils/attendingScheduleCanonical";

export type MaintenanceRecordSummary = {
  id: string;
  displayName: string;
  storedName?: string;
  startDate?: string;
  endDate?: string;
  coverage?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AttendingOverlapDetail = {
  id: string;
  serviceKey: string;
  serviceName: string;
  overlapStart: string;
  overlapEnd: string;
  first: MaintenanceRecordSummary;
  second: MaintenanceRecordSummary;
};

export type DuplicateBlockDetail = {
  id: string;
  residentId: string;
  residentName: string;
  pgy: string;
  academicYear: string;
  blockId: string;
  blockNumber: number;
  blockName: string;
  blockStart: string;
  blockEnd: string;
  records: Array<{
    id: string;
    rotationId: string;
    rotationName: string;
    notes: string;
    source: string;
    importedFileName: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type StaleAttendingDetail = {
  id: string;
  serviceName: string;
  storedName: string;
  currentName: string;
  startDate: string;
  endDate: string;
};

export type UnresolvedAttendingDetail = {
  id: string;
  serviceName: string;
  storedName: string;
  startDate: string;
  endDate: string;
};

export type RotationReferenceDetail = {
  id: string;
  residentName: string;
  blockNumber: number;
  storedRotationId: string;
  storedRotationName: string;
  resolvedRotationId?: string;
  resolvedRotationName?: string;
};

export type LegacyCallCellDetail = {
  monthId: string;
  originalKey: string;
  date: string;
  storedServiceId: string;
  storedServiceName: string;
  canonicalServiceId: string;
  canonicalServiceName: string;
  residentName: string;
};

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
  attendingOverlaps: AttendingOverlapDetail[];
  duplicateDraftBlocks: DuplicateBlockDetail[];
  staleAttendingDetails: StaleAttendingDetail[];
  unresolvedAttendingDetails: UnresolvedAttendingDetail[];
  staleRotationDetails: RotationReferenceDetail[];
  unknownRotationDetails: RotationReferenceDetail[];
  legacyCallCellDetails: LegacyCallCellDetail[];
}

type FirestoreRecord<T> = T & { id: string };

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function newestTimestamp(value: { updatedAt?: string; createdAt?: string }) {
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

function overlapRange(
  first: Pick<AttendingScheduleAssignment, "startDate" | "endDate">,
  second: Pick<AttendingScheduleAssignment, "startDate" | "endDate">
) {
  return {
    start: first.startDate > second.startDate ? first.startDate : second.startDate,
    end: first.endDate < second.endDate ? first.endDate : second.endDate,
  };
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

function getAttendingOverlaps(
  assignments: AttendingScheduleAssignment[],
  attendings: Attending[]
): AttendingOverlapDetail[] {
  const active = assignments.filter((item) => !item.archived);
  const details: AttendingOverlapDetail[] = [];

  for (let firstIndex = 0; firstIndex < active.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < active.length;
      secondIndex += 1
    ) {
      const first = active[firstIndex];
      const second = active[secondIndex];
      const firstKey = canonicalAttendingServiceKey(first);
      const secondKey = canonicalAttendingServiceKey(second);
      if (first.group !== second.group || firstKey !== secondKey) continue;
      if (!rangesOverlap(first, second)) continue;

      const firstProfile = resolveAttendingProfile(first, attendings);
      const secondProfile = resolveAttendingProfile(second, attendings);
      const firstAttending =
        firstProfile?.id || first.attendingId || normalize(first.attendingName);
      const secondAttending =
        secondProfile?.id || second.attendingId || normalize(second.attendingName);
      if (firstAttending === secondAttending) continue;

      const overlap = overlapRange(first, second);
      details.push({
        id: `${first.id}_${second.id}`,
        serviceKey: firstKey,
        serviceName: first.serviceName || second.serviceName,
        overlapStart: overlap.start,
        overlapEnd: overlap.end,
        first: {
          id: first.id,
          displayName: firstProfile?.displayName || first.attendingName || "Unassigned",
          storedName: first.attendingName,
          startDate: first.startDate,
          endDate: first.endDate,
          coverage:
            first.coverageNote ||
            `${first.coverageStartTime || ""}-${first.coverageEndTime || ""}`,
          createdAt: first.createdAt,
          updatedAt: first.updatedAt,
        },
        second: {
          id: second.id,
          displayName: secondProfile?.displayName || second.attendingName || "Unassigned",
          storedName: second.attendingName,
          startDate: second.startDate,
          endDate: second.endDate,
          coverage:
            second.coverageNote ||
            `${second.coverageStartTime || ""}-${second.coverageEndTime || ""}`,
          createdAt: second.createdAt,
          updatedAt: second.updatedAt,
        },
      });
    }
  }

  return details.sort(
    (a, b) =>
      a.overlapStart.localeCompare(b.overlapStart) ||
      a.serviceName.localeCompare(b.serviceName)
  );
}

function buildDuplicateBlockDetails(
  groups: BlockAssignment[][],
  residents: Resident[],
  blocks: AcademicBlock[]
): DuplicateBlockDetail[] {
  const residentById = new Map(residents.map((resident) => [resident.id, resident]));
  const blockById = new Map(blocks.map((block) => [block.id, block]));

  return groups.map((group) => {
    const first = group[0];
    const resident = residentById.get(first.residentId);
    const block = blockById.get(first.blockId);
    return {
      id: `${first.academicYear}_${first.blockId}_${first.residentId}`,
      residentId: first.residentId,
      residentName: resident?.displayName || first.residentName,
      pgy: resident?.pgy || "Unknown PGY",
      academicYear: first.academicYear,
      blockId: first.blockId,
      blockNumber: first.blockNumber,
      blockName: block?.name || `Block ${first.blockNumber}`,
      blockStart: block?.startDate || "",
      blockEnd: block?.endDate || "",
      records: group
        .slice()
        .sort((a, b) => newestTimestamp(b).localeCompare(newestTimestamp(a)))
        .map((item) => ({
          id: item.id,
          rotationId: item.rotationId,
          rotationName: item.rotationName,
          notes: item.notes || "",
          source: item.source || "legacy/manual",
          importedFileName: item.importedFileName || "",
          createdAt: item.createdAt || "",
          updatedAt: item.updatedAt || "",
        })),
    };
  });
}

export async function scanLegacySchedulingData(): Promise<MaintenanceScanSummary> {
  const [
    attendings,
    attendingAssignments,
    rotations,
    blockAssignments,
    residents,
    academicBlocks,
  ] = await Promise.all([
    readCollection<Attending>("attendings"),
    readCollection<AttendingScheduleAssignment>("attendingScheduleAssignments"),
    readCollection<RotationRequirement>("rotations"),
    readCollection<BlockAssignment>("blockAssignments"),
    readCollection<Resident>("residents"),
    readCollection<AcademicBlock>("academicBlocks"),
  ]);

  const staleAttendingDetails: StaleAttendingDetail[] = [];
  const unresolvedAttendingDetails: UnresolvedAttendingDetail[] = [];

  for (const assignment of attendingAssignments.filter((item) => !item.archived)) {
    const profile = resolveAttendingProfile(assignment, attendings);
    if (!profile) {
      unresolvedAttendingDetails.push({
        id: assignment.id,
        serviceName: assignment.serviceName,
        storedName: assignment.attendingName || "Unassigned",
        startDate: assignment.startDate,
        endDate: assignment.endDate,
      });
      continue;
    }

    if (
      assignment.attendingId !== profile.id ||
      assignment.attendingName !== profile.displayName ||
      assignment.phone !== (profile.phone || "") ||
      assignment.pager !== (profile.pager || "")
    ) {
      staleAttendingDetails.push({
        id: assignment.id,
        serviceName: assignment.serviceName,
        storedName: assignment.attendingName || "Unassigned",
        currentName: profile.displayName,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
      });
    }
  }

  const staleRotationDetails: RotationReferenceDetail[] = [];
  const unknownRotationDetails: RotationReferenceDetail[] = [];

  for (const assignment of blockAssignments) {
    if (assignment.status === "archived") continue;
    const rotation = findRotationMatch(assignment, rotations);
    const detail: RotationReferenceDetail = {
      id: assignment.id,
      residentName: assignment.residentName,
      blockNumber: assignment.blockNumber,
      storedRotationId: assignment.rotationId,
      storedRotationName: assignment.rotationName,
      resolvedRotationId: rotation?.id,
      resolvedRotationName: rotation?.name,
    };
    if (!rotation) unknownRotationDetails.push(detail);
    else if (
      assignment.rotationId !== rotation.id ||
      assignment.rotationName !== rotation.name
    ) {
      staleRotationDetails.push(detail);
    }
  }

  const scheduleMonths = await readCollection<{
    assignments?: Record<string, DocumentData>;
  }>("scheduleMonths");
  const legacyCallCellDetails: LegacyCallCellDetail[] = [];

  for (const month of scheduleMonths) {
    for (const [key, rawCell] of Object.entries(month.assignments || {})) {
      const cell = rawCell as {
        date?: string;
        serviceId?: string;
        serviceName?: string;
        residentName?: string;
      };
      const service = findResidentCallService(
        cell.serviceId || cell.serviceName || ""
      );
      if (!service) continue;
      const date = cell.date || key.slice(0, 10);
      const expectedKey = `${date}_${service.id}`;
      if (
        key !== expectedKey ||
        cell.serviceId !== service.id ||
        cell.serviceName !== service.name
      ) {
        legacyCallCellDetails.push({
          monthId: month.id,
          originalKey: key,
          date,
          storedServiceId: cell.serviceId || "",
          storedServiceName: cell.serviceName || "",
          canonicalServiceId: service.id,
          canonicalServiceName: service.name,
          residentName: cell.residentName || "Unassigned",
        });
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
  const attendingOverlaps = getAttendingOverlaps(
    attendingAssignments,
    attendings
  );
  const duplicateDraftBlocks = buildDuplicateBlockDetails(
    duplicateBlockGroups,
    residents,
    academicBlocks
  );

  const details: string[] = [];
  if (staleAttendingDetails.length) {
    details.push(
      `${staleAttendingDetails.length} attending schedule record(s) use an old name, phone, pager, or ID.`
    );
  }
  if (unresolvedAttendingDetails.length) {
    details.push(
      `${unresolvedAttendingDetails.length} attending schedule record(s) could not be linked to a current attending profile.`
    );
  }
  if (attendingOverlaps.length) {
    details.push(
      `${attendingOverlaps.length} overlapping attending service assignment pair(s) need review.`
    );
  }
  if (staleRotationDetails.length) {
    details.push(
      `${staleRotationDetails.length} block assignment(s) use an old rotation ID or name.`
    );
  }
  if (unknownRotationDetails.length) {
    details.push(
      `${unknownRotationDetails.length} block assignment(s) point to an unknown rotation.`
    );
  }
  if (legacyCallCellDetails.length) {
    details.push(
      `${legacyCallCellDetails.length} daily call cell(s) use an older service ID or name.`
    );
  }
  if (legacyMonthlySchedules.length) {
    details.push(
      `${legacyMonthlySchedules.length} document(s) remain in the old monthlySchedules collection.`
    );
  }

  return {
    staleAttendingReferences: staleAttendingDetails.length,
    unresolvedAttendingReferences: unresolvedAttendingDetails.length,
    exactDuplicateAttendingAssignments: duplicateAttendingGroups.reduce(
      (total, group) => total + group.length - 1,
      0
    ),
    overlappingAttendingAssignments: attendingOverlaps.length,
    staleBlockRotationReferences: staleRotationDetails.length,
    unresolvedBlockRotationReferences: unknownRotationDetails.length,
    duplicateDraftBlockAssignments: duplicateBlockGroups.reduce(
      (total, group) => total + group.length - 1,
      0
    ),
    legacyCallCells: legacyCallCellDetails.length,
    legacyMonthlyScheduleDocuments: legacyMonthlySchedules.length,
    legacyMonthlyScheduleDocumentsWithCurrentCopy: legacyWithCurrentCopy,
    details,
    attendingOverlaps,
    duplicateDraftBlocks,
    staleAttendingDetails,
    unresolvedAttendingDetails,
    staleRotationDetails,
    unknownRotationDetails,
    legacyCallCellDetails,
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

  for (const assignment of attendingAssignments.filter((item) => !item.archived)) {
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

export async function archiveMaintenanceRecord(params: {
  collectionName: "attendingScheduleAssignments" | "blockAssignments";
  id: string;
  reason: string;
  note?: string;
}) {
  const ref = doc(db, params.collectionName, params.id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("The selected document no longer exists.");

  const archivedAt = new Date().toISOString();
  const archiveId = `${params.collectionName}_${params.id}_${Date.now()}`;
  await setDoc(doc(db, "maintenanceArchive", archiveId), {
    originalCollection: params.collectionName,
    originalId: params.id,
    archivedAt,
    reason: params.reason,
    note: params.note || "",
    data: snapshot.data(),
  });
  await deleteDoc(ref);
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
