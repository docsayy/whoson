import {
  isServiceAvailableOnDate,
  isShortDutyService,
  type ResidentCallServiceDefinition,
} from "../config/scheduleServices";
import type { AcademicBlock } from "../types/block";
import type { BlockAssignment } from "../types/blockAssignment";
import type { MonthlyScheduleCell } from "../types/monthSchedule";
import type { Resident } from "../types/resident";
import type { ScheduleService } from "../types/schedule";
import {
  dayOfWeek,
  EXACT_NF_SERVICE_IDS,
  isAutoNightFloatDate,
  isNightFloatService,
} from "./nightFloatSchedule";

export type RuleSeverity = "critical" | "warning" | "info";

export type RuleCode =
  | "service-unavailable"
  | "wrong-pgy"
  | "vacation-conflict"
  | "jeopardy-conflict"
  | "duplicate-assignment"
  | "night-float-day-conflict"
  | "night-float-short-duty-conflict"
  | "night-float-off-night"
  | "short-duty-floor-mismatch"
  | "block-rotation-mismatch"
  | "missing-coverage";

export interface ScheduleRuleIssue {
  code: RuleCode;
  severity: RuleSeverity;
  message: string;
  requiresOverride?: boolean;
}

export interface CallAssignmentRuleResult {
  allowed: boolean;
  requiresOverride: boolean;
  issues: ScheduleRuleIssue[];
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getCurrentBlock(date: string, blocks: AcademicBlock[]) {
  return blocks.find((block) => date >= block.startDate && date <= block.endDate);
}

function isVacationLike(rotationName: string) {
  const text = normalize(rotationName);
  return text.includes("vacation") || text.includes("leave") || text.includes("pto");
}

function isJeopardyLike(rotationName: string) {
  return normalize(rotationName).includes("jeopardy");
}


export function isAllowedConcurrentAssignment(
  date: string,
  firstServiceId: string,
  secondServiceId: string
) {
  const dow = dayOfWeek(date);
  if (dow !== 5 && dow !== 6) return false;

  const pair = new Set([firstServiceId, secondServiceId]);
  const allowedPairs = [
    new Set(["2n-ccu-pgy2", EXACT_NF_SERVICE_IDS.pgy2TwoNorthCcu]),
    new Set(["4n-3w-pgy2", EXACT_NF_SERVICE_IDS.pgy2FourNorthThreeWest]),
    new Set(["chief-on-call", EXACT_NF_SERVICE_IDS.pgy3]),
  ];

  return allowedPairs.some(
    (allowed) =>
      allowed.size === pair.size &&
      Array.from(allowed).every((serviceId) => pair.has(serviceId))
  );
}

const COMPATIBLE_ROTATIONS_BY_SERVICE: Record<string, string[]> = {
  "2n-ccu-pgy1": ["2n", "ambulatory", "admission", "jeopardy"],
  "short-duty-2n-pgy1": ["2n"],
  "tele-pgy1": ["tele", "ambulatory", "admission", "jeopardy"],
  "short-duty-tele-pgy1": ["tele"],
  "2n-ccu-pgy2": ["2n", "ambulatory", "admission", "jeopardy"],
  "4n-pgy1": ["4n", "ambulatory", "admission", "jeopardy"],
  "short-duty-4n-pgy1": ["4n"],
  "3w-pgy1": ["3w", "ambulatory", "admission", "jeopardy"],
  "4n-3w-pgy2": ["4n", "3w", "ambulatory", "admission", "jeopardy"],
  "micu-pgy1": ["micu"],
  "micu-senior": ["micu", "pulm"],
  "chief-on-call": [],
  [EXACT_NF_SERVICE_IDS.pgy1TwoNorthCcu]: [EXACT_NF_SERVICE_IDS.pgy1TwoNorthCcu],
  [EXACT_NF_SERVICE_IDS.pgy2TwoNorthCcu]: [EXACT_NF_SERVICE_IDS.pgy2TwoNorthCcu],
  [EXACT_NF_SERVICE_IDS.pgy1FourNorthThreeWest]: [
    EXACT_NF_SERVICE_IDS.pgy1FourNorthThreeWest,
  ],
  [EXACT_NF_SERVICE_IDS.pgy2FourNorthThreeWest]: [
    EXACT_NF_SERVICE_IDS.pgy2FourNorthThreeWest,
  ],
  [EXACT_NF_SERVICE_IDS.pgy3]: [EXACT_NF_SERVICE_IDS.pgy3, "pgy3-nf-amb"],
};

function getResidentBlockAssignments({
  date,
  residentId,
  blocks,
  blockAssignments,
}: {
  date: string;
  residentId: string;
  blocks: AcademicBlock[];
  blockAssignments: BlockAssignment[];
}) {
  const block = getCurrentBlock(date, blocks);
  if (!block) return [];
  return blockAssignments.filter(
    (assignment) =>
      assignment.blockId === block.id && assignment.residentId === residentId
  );
}

function hasDuplicateConflict({
  date,
  service,
  resident,
  existingAssignments,
}: {
  date: string;
  service: ScheduleService;
  resident: Resident;
  existingAssignments: Record<string, MonthlyScheduleCell>;
}) {
  const sameDay = Object.values(existingAssignments).filter(
    (cell) =>
      cell.date === date &&
      cell.residentId === resident.id &&
      cell.serviceId !== service.id
  );

  return sameDay.find(
    (cell) => !isAllowedConcurrentAssignment(date, service.id, cell.serviceId)
  );
}

export function validateCallAssignment({
  date,
  service,
  resident,
  existingAssignments,
  blocks,
  blockAssignments,
  allowCoverageOverride = false,
}: {
  date: string;
  service: ScheduleService;
  resident: Resident;
  existingAssignments: Record<string, MonthlyScheduleCell>;
  blocks: AcademicBlock[];
  blockAssignments: BlockAssignment[];
  allowCoverageOverride?: boolean;
}): CallAssignmentRuleResult {
  const issues: ScheduleRuleIssue[] = [];

  if (!isServiceAvailableOnDate(service, date)) {
    issues.push({
      code: "service-unavailable",
      severity: "critical",
      message: `${service.name} is not available on ${date}.`,
    });
  }

  if (
    service.requiredTraining?.length &&
    !service.requiredTraining.includes(resident.pgy)
  ) {
    issues.push({
      code: "wrong-pgy",
      severity: "critical",
      message: `${resident.displayName} is ${resident.pgy}, but ${service.name} requires ${service.requiredTraining.join(
        ", "
      )}.`,
    });
  }

  const residentBlockAssignments = getResidentBlockAssignments({
    date,
    residentId: resident.id,
    blocks,
    blockAssignments,
  });

  const vacation = residentBlockAssignments.find((assignment) =>
    isVacationLike(assignment.rotationName)
  );
  if (vacation) {
    issues.push({
      code: "vacation-conflict",
      severity: "critical",
      message: `${resident.displayName} is assigned to ${vacation.rotationName} during this block.`,
    });
  }

  const jeopardy = residentBlockAssignments.find((assignment) =>
    isJeopardyLike(assignment.rotationName)
  );
  if (jeopardy && service.id !== "chief-on-call") {
    issues.push({
      code: "jeopardy-conflict",
      severity: "warning",
      requiresOverride: true,
      message: `${resident.displayName} is assigned to Jeopardy in the block schedule.`,
    });
  }

  const duplicate = hasDuplicateConflict({
    date,
    service,
    resident,
    existingAssignments,
  });
  if (duplicate) {
    issues.push({
      code: "duplicate-assignment",
      severity: "critical",
      message: `${resident.displayName} is already assigned to ${duplicate.serviceName} on ${date}.`,
    });

    const duplicateIsNight = isNightFloatService(duplicate.serviceId);
    const serviceIsNight = isNightFloatService(service.id);
    if (serviceIsNight !== duplicateIsNight) {
      issues.push({
        code:
          isShortDutyService(service) || duplicate.serviceName.toLowerCase().includes("short duty")
            ? "night-float-short-duty-conflict"
            : "night-float-day-conflict",
        severity: "critical",
        message: `${resident.displayName} cannot cover overlapping day and night assignments on ${date}.`,
      });
    }
  }

  if (isShortDutyService(service)) {
    const definition = service as ResidentCallServiceDefinition;
    const correctFloor = residentBlockAssignments.some(
      (assignment) => assignment.rotationId === definition.floorRotationId
    );

    if (!correctFloor) {
      issues.push({
        code: "short-duty-floor-mismatch",
        severity: allowCoverageOverride ? "warning" : "critical",
        requiresOverride: true,
        message: `${resident.displayName} is not assigned to ${definition.floorRotationId?.toUpperCase()} in the applicable block.`,
      });
    }
  }

  if (isNightFloatService(service.id) && !isAutoNightFloatDate(service.id, date)) {
    const isSameNightFloatRotation = residentBlockAssignments.some(
      (assignment) => assignment.rotationId === service.id
    );
    if (isSameNightFloatRotation) {
      issues.push({
        code: "night-float-off-night",
        severity: "warning",
        requiresOverride: true,
        message: `${resident.displayName} is scheduled on an off-night for this Night Float rotation.`,
      });
    }
  }

  const compatibleRotations = COMPATIBLE_ROTATIONS_BY_SERVICE[service.id];
  if (
    compatibleRotations &&
    compatibleRotations.length > 0 &&
    residentBlockAssignments.length > 0 &&
    !residentBlockAssignments.some((assignment) =>
      compatibleRotations.includes(assignment.rotationId)
    )
  ) {
    issues.push({
      code: "block-rotation-mismatch",
      severity: "warning",
      requiresOverride: true,
      message: `${resident.displayName}'s block rotation does not normally match ${service.name}.`,
    });
  }

  const hasCritical = issues.some((issue) => issue.severity === "critical");
  const requiresOverride = issues.some((issue) => issue.requiresOverride);

  return {
    allowed: !hasCritical,
    requiresOverride,
    issues,
  };
}

export function getMissingCoverageIssues({
  date,
  services,
  assignments,
}: {
  date: string;
  services: ScheduleService[];
  assignments: Record<string, MonthlyScheduleCell>;
}): ScheduleRuleIssue[] {
  return services
    .filter((service) => !assignments[`${date}_${service.id}`])
    .map((service) => ({
      code: "missing-coverage" as const,
      severity: "warning" as const,
      message: `${service.name} is unassigned on ${date}.`,
    }));
}

export function ruleIssueSummary(result: CallAssignmentRuleResult) {
  return result.issues.map((issue) => issue.message).join(" ");
}
