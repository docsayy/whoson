import * as XLSX from "xlsx";

import {
  findResidentCallService,
  getServiceTimingForDate,
  isServiceAvailableOnDate,
  isShortDutyService,
  type ResidentCallServiceDefinition,
} from "../config/scheduleServices";
import type { AcademicBlock } from "../types/block";
import type { BlockAssignment } from "../types/blockAssignment";
import type { MonthlyScheduleCell } from "../types/monthSchedule";
import type { Resident } from "../types/resident";
import { residentTraining } from "./nightFloatSchedule";

export type CallImportAction = "new" | "replace" | "same" | "review";

export type CallImportPreviewRow = {
  sourceService: string;
  sourceDate: string;
  sourceResident: string;
  action: CallImportAction;
  message: string;
  cell?: MonthlyScheduleCell;
  existingCell?: MonthlyScheduleCell;
};

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function toDateString(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const text = String(value || "").trim();
  if (!text) return "";

  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 20000) {
    const parsed = XLSX.SSF.parse_date_code(numeric);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildResidentMap(residents: Resident[]) {
  const map = new Map<string, Resident[]>();

  function add(key: string, resident: Resident) {
    if (!key) return;
    const list = map.get(key) || [];
    if (!list.some((item) => item.id === resident.id)) list.push(resident);
    map.set(key, list);
  }

  for (const resident of residents.filter((item) => item.active)) {
    add(normalize(resident.displayName), resident);
    add(normalize(`${resident.firstName} ${resident.lastName}`), resident);
    add(normalize(resident.firstName), resident);
    add(normalize(resident.lastName), resident);
  }

  return map;
}

function findResident(source: string, map: Map<string, Resident[]>) {
  const matches = map.get(normalize(source)) || [];
  return matches.length === 1 ? matches[0] : undefined;
}

function findService(source: string) {
  const direct = findResidentCallService(source);
  if (direct) return direct;

  const normalized = normalize(source);
  if (normalized === "micu") return findResidentCallService("MICU Senior");
  if (normalized === "nightfloat") return findResidentCallService("PGY3 NF");
  if (normalized === "chiefoncall") return findResidentCallService("Chief On Call");
  return undefined;
}

export async function parseCallScheduleWorkbook({
  file,
  residents,
  existingAssignments,
  blocks = [],
  blockAssignments = [],
}: {
  file: File;
  residents: Resident[];
  existingAssignments: Record<string, MonthlyScheduleCell>;
  blocks?: AcademicBlock[];
  blockAssignments?: BlockAssignment[];
}): Promise<CallImportPreviewRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("The workbook has no worksheets.");

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(
    workbook.Sheets[firstSheetName],
    { header: 1, defval: "", raw: true }
  );

  const dateRowIndex = matrix.findIndex(
    (row) => row.slice(1).filter((value) => Boolean(toDateString(value))).length >= 3
  );

  if (dateRowIndex < 0) {
    throw new Error("Could not find a row of schedule dates.");
  }

  const dateRow = matrix[dateRowIndex];
  const residentMap = buildResidentMap(residents);
  const previews: CallImportPreviewRow[] = [];

  for (let rowIndex = dateRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] || [];
    const sourceService = String(row[0] || "").trim();
    if (!sourceService) continue;

    const service = findService(sourceService);

    for (let columnIndex = 1; columnIndex < row.length; columnIndex += 1) {
      const sourceResident = String(row[columnIndex] || "").trim();
      if (!sourceResident) continue;

      const date = toDateString(dateRow[columnIndex]);
      const sourceDate = String(dateRow[columnIndex] || "").trim();

      if (!date) {
        previews.push({
          sourceService,
          sourceDate,
          sourceResident,
          action: "review",
          message: "Date could not be interpreted.",
        });
        continue;
      }

      if (!service) {
        previews.push({
          sourceService,
          sourceDate: date,
          sourceResident,
          action: "review",
          message: "Call-service row could not be mapped.",
        });
        continue;
      }

      if (!isServiceAvailableOnDate(service, date)) {
        previews.push({
          sourceService,
          sourceDate: date,
          sourceResident,
          action: "review",
          message: `${service.name} is available only on Saturday and Sunday.`,
        });
        continue;
      }

      const resident = findResident(sourceResident, residentMap);
      if (!resident) {
        previews.push({
          sourceService,
          sourceDate: date,
          sourceResident,
          action: "review",
          message: "Resident name did not match exactly or was ambiguous.",
        });
        continue;
      }

      if (
        service.requiredTraining?.length &&
        !service.requiredTraining.includes(residentTraining(resident))
      ) {
        previews.push({
          sourceService,
          sourceDate: date,
          sourceResident,
          action: "review",
          message: `${resident.displayName} is ${resident.pgy}, which is not eligible for ${service.name}.`,
        });
        continue;
      }

      if (isShortDutyService(service)) {
        const definition = service as ResidentCallServiceDefinition;
        const currentBlock = blocks.find(
          (block) => date >= block.startDate && date <= block.endDate
        );
        const floorAssignment = currentBlock
          ? blockAssignments.find(
              (assignment) =>
                assignment.blockId === currentBlock.id &&
                assignment.residentId === resident.id &&
                assignment.rotationId === definition.floorRotationId
            )
          : undefined;

        if (!floorAssignment) {
          previews.push({
            sourceService,
            sourceDate: date,
            sourceResident,
            action: "review",
            message: `${resident.displayName} is not assigned to ${definition.floorRotationId?.toUpperCase()} in the applicable block. Use a manual coverage override if needed.`,
          });
          continue;
        }
      }

      const timing = getServiceTimingForDate(service, date);

      const cell: MonthlyScheduleCell = {
        date,
        serviceId: service.id,
        serviceName: service.name,
        residentId: resident.id,
        residentName: resident.displayName,
        training: residentTraining(resident),
        pager: resident.pager,
        shiftType: service.defaultShiftType || "Day",
        startTime: timing.startTime,
        endTime: timing.endTime,
        notes: `Imported from ${file.name}`,
      };

      const key = `${date}_${service.id}`;
      const existingCell = existingAssignments[key];
      const same = existingCell?.residentId === resident.id;

      previews.push({
        sourceService,
        sourceDate: date,
        sourceResident,
        cell,
        existingCell,
        action: same ? "same" : existingCell ? "replace" : "new",
        message: same
          ? "Already matches the schedule."
          : existingCell
            ? `Will replace ${existingCell.residentName}.`
            : "New call assignment.",
      });
    }
  }

  return previews;
}
