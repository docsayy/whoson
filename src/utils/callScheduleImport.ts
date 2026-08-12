import * as XLSX from "xlsx";

import {
  findResidentCallService,
  getServiceTimingForDate,
  isServiceAvailableOnDate,
} from "../config/scheduleServices";
import type { AcademicBlock } from "../types/block";
import type { BlockAssignment } from "../types/blockAssignment";
import type { MonthlyScheduleCell } from "../types/monthSchedule";
import type { Resident } from "../types/resident";
import {
  matchMethodLabel,
  matchResidentName,
  type PersonMatchMethod,
} from "./personMatching";
import { residentTraining } from "./nightFloatSchedule";
import { ruleIssueSummary, validateCallAssignment } from "./scheduleRules";

export type CallImportAction =
  | "safe-new"
  | "same"
  | "replacement"
  | "conflict"
  | "invalid"
  | "unmatched";

export type CallImportPreviewRow = {
  sourceService: string;
  sourceDate: string;
  sourceResident: string;
  sheetName?: string;
  rowNumber?: number;
  action: CallImportAction;
  message: string;
  cell?: MonthlyScheduleCell;
  existingCell?: MonthlyScheduleCell;
  matchConfidence?: number;
  matchMethod?: PersonMatchMethod;
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

function findService(source: string) {
  const direct = findResidentCallService(source);
  if (direct) return direct;

  const normalized = normalize(source);
  if (normalized === "micu") return findResidentCallService("MICU Senior");
  if (["nightfloat", "pgy3nightfloat"].includes(normalized)) {
    return findResidentCallService("PGY3 NF");
  }
  if (["chief", "chiefoncall"].includes(normalized)) {
    return findResidentCallService("Chief On Call");
  }
  if (["shortduty2n", "shortcall2n"].includes(normalized)) {
    return findResidentCallService("Short Duty 2N PGY1");
  }
  if (["shortdutytele", "shortcalltele"].includes(normalized)) {
    return findResidentCallService("Short Duty Tele PGY1");
  }
  if (["shortduty4n", "shortcall4n"].includes(normalized)) {
    return findResidentCallService("Short Duty 4N PGY1");
  }
  return undefined;
}

function findDateRow(matrix: unknown[][]) {
  return matrix.findIndex(
    (row) => row.slice(1).filter((value) => Boolean(toDateString(value))).length >= 2
  );
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

  const previews: CallImportPreviewRow[] = [];
  let recognizedSheet = false;

  for (const sheetName of workbook.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: true,
    });

    const dateRowIndex = findDateRow(matrix);
    if (dateRowIndex < 0) continue;
    recognizedSheet = true;
    const dateRow = matrix[dateRowIndex];

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
            sheetName,
            rowNumber: rowIndex + 1,
            action: "invalid",
            message: "Date could not be interpreted.",
          });
          continue;
        }

        if (!service) {
          previews.push({
            sourceService,
            sourceDate: date,
            sourceResident,
            sheetName,
            rowNumber: rowIndex + 1,
            action: "invalid",
            message: "Call-service row could not be mapped.",
          });
          continue;
        }

        if (!isServiceAvailableOnDate(service, date)) {
          previews.push({
            sourceService,
            sourceDate: date,
            sourceResident,
            sheetName,
            rowNumber: rowIndex + 1,
            action: "invalid",
            message: `${service.name} is available only on weekends and hospital-observed holidays.`,
          });
          continue;
        }

        const match = matchResidentName(sourceResident, residents);
        const resident = match.resident;
        if (!resident) {
          previews.push({
            sourceService,
            sourceDate: date,
            sourceResident,
            sheetName,
            rowNumber: rowIndex + 1,
            action: "unmatched",
            matchConfidence: match.confidence,
            matchMethod: match.method,
            message:
              match.method === "ambiguous"
                ? `Multiple residents could match “${sourceResident}”: ${match.candidates
                    .map((item) => item.displayName)
                    .join(", ")}.`
                : `Resident was not matched. ${matchMethodLabel(match.method)}.`,
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
            sheetName,
            rowNumber: rowIndex + 1,
            action: "invalid",
            matchConfidence: match.confidence,
            matchMethod: match.method,
            message: `${resident.displayName} matched at ${match.confidence}%, but ${resident.pgy} is not eligible for ${service.name}.`,
          });
          continue;
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
        const matchText = `${matchMethodLabel(match.method)} (${match.confidence}%).`;
        const validation = validateCallAssignment({
          date,
          service,
          resident,
          existingAssignments,
          blocks,
          blockAssignments,
          allowCoverageOverride: false,
        });
        const blockingIssues = validation.issues.filter(
          (issue) => issue.severity === "critical"
        );
        const reviewIssues = validation.issues.filter(
          (issue) => issue.severity !== "info"
        );

        let action: CallImportAction;
        let message: string;

        if (same) {
          action = "same";
          message = `${matchText} Already matches the schedule.`;
        } else if (blockingIssues.length > 0) {
          action = blockingIssues.some((issue) =>
            ["wrong-pgy", "vacation-conflict", "service-unavailable"].includes(
              issue.code
            )
          )
            ? "invalid"
            : "conflict";
          message = `${matchText} ${ruleIssueSummary(validation)}`;
        } else if (reviewIssues.length > 0) {
          action = "conflict";
          message = `${matchText} ${ruleIssueSummary(validation)}`;
        } else if (existingCell) {
          action = "replacement";
          message = `${matchText} Will replace ${existingCell.residentName}.`;
        } else {
          action = "safe-new";
          message = `${matchText} Safe new assignment.`;
        }

        previews.push({
          sourceService,
          sourceDate: date,
          sourceResident,
          sheetName,
          rowNumber: rowIndex + 1,
          cell,
          existingCell,
          matchConfidence: match.confidence,
          matchMethod: match.method,
          action,
          message,
        });
      }
    }
  }

  if (!recognizedSheet) {
    throw new Error("Could not find a worksheet with a row of schedule dates.");
  }

  return previews;
}
