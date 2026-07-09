import type { AcademicBlock } from "../types/block";
import type { BlockAssignment } from "../types/blockAssignment";
import type { MonthlyScheduleCell } from "../types/monthSchedule";
import type { Resident } from "../types/resident";
import type { ScheduleService } from "../types/schedule";
import {
  getAutoNightFloatCell,
  isNightFloatService,
} from "./nightFloatSchedule";

export type ScheduleIssueSeverity = "critical" | "warning" | "info";

export type ScheduleIssueCategory =
  | "double-assignment"
  | "wrong-pgy"
  | "vacation-conflict"
  | "night-float-conflict"
  | "manual-override"
  | "jeopardy-conflict"
  | "block-conflict";

export interface ScheduleIssue {
  id: string;
  severity: ScheduleIssueSeverity;
  category: ScheduleIssueCategory;
  date?: string;
  residentId?: string;
  residentName?: string;
  serviceId?: string;
  serviceName?: string;
  title: string;
  message: string;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getResidentById(residents: Resident[], id: string) {
  return residents.find((resident) => resident.id === id);
}

function getCurrentBlock(date: string, blocks: AcademicBlock[]) {
  return blocks.find((block) => date >= block.startDate && date <= block.endDate);
}

function isVacationLike(rotationName: string) {
  const text = normalize(rotationName);
  return text.includes("vacation") || text.includes("pto") || text.includes("leave");
}

function isJeopardyLike(rotationName: string) {
  return normalize(rotationName).includes("jeopardy");
}

function isDayService(service: ScheduleService) {
  if (isNightFloatService(service.id)) return false;
  const text = normalize(`${service.name} ${service.category}`);
  return !text.includes("night") && !text.includes("nf");
}

function getRequiredTrainingText(service: ScheduleService) {
  return service.requiredTraining?.join(", ") || "Any";
}

function residentMeetsServiceRequirement(
  resident: Resident,
  service: ScheduleService
) {
  const required = service.requiredTraining || [];
  if (required.length === 0) return true;
  return required.includes(resident.pgy);
}

export function getEffectiveMonthlyCell({
  date,
  service,
  monthlyAssignments,
  blocks,
  blockAssignments,
  residents,
}: {
  date: string;
  service: ScheduleService;
  monthlyAssignments: Record<string, MonthlyScheduleCell>;
  blocks: AcademicBlock[];
  blockAssignments: BlockAssignment[];
  residents: Resident[];
}) {
  const manual = monthlyAssignments[`${date}_${service.id}`];

  const auto = isNightFloatService(service.id)
    ? getAutoNightFloatCell({
        date,
        service,
        blocks,
        blockAssignments,
        residents,
      })
    : undefined;

  return {
    cell: manual || auto,
    manual,
    auto,
  };
}

export function detectDailyScheduleIssues({
  date,
  services,
  monthlyAssignments,
  blocks,
  blockAssignments,
  residents,
}: {
  date: string;
  services: ScheduleService[];
  monthlyAssignments: Record<string, MonthlyScheduleCell>;
  blocks: AcademicBlock[];
  blockAssignments: BlockAssignment[];
  residents: Resident[];
}): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  const currentBlock = getCurrentBlock(date, blocks);

  const effectiveCells = services
    .map((service) => {
      const result = getEffectiveMonthlyCell({
        date,
        service,
        monthlyAssignments,
        blocks,
        blockAssignments,
        residents,
      });

      return {
        service,
        ...result,
      };
    })
    .filter((item) => item.cell);

  const cellsByResident = new Map<string, typeof effectiveCells>();

  for (const item of effectiveCells) {
    const cell = item.cell;
    if (!cell) continue;

    const existing = cellsByResident.get(cell.residentId) || [];
    existing.push(item);
    cellsByResident.set(cell.residentId, existing);

    const resident = getResidentById(residents, cell.residentId);

    if (resident && !residentMeetsServiceRequirement(resident, item.service)) {
      issues.push({
        id: `wrong-pgy-${date}-${item.service.id}-${resident.id}`,
        severity: "critical",
        category: "wrong-pgy",
        date,
        residentId: resident.id,
        residentName: resident.displayName,
        serviceId: item.service.id,
        serviceName: item.service.name,
        title: "Wrong PGY level",
        message: `${resident.displayName} is ${resident.pgy}, but ${item.service.name} requires ${getRequiredTrainingText(item.service)}.`,
      });
    }

    if (item.manual && item.auto && item.manual.residentId !== item.auto.residentId) {
      issues.push({
        id: `manual-override-${date}-${item.service.id}`,
        severity: "info",
        category: "manual-override",
        date,
        residentId: item.manual.residentId,
        residentName: item.manual.residentName,
        serviceId: item.service.id,
        serviceName: item.service.name,
        title: "Manual override",
        message: `${item.service.name} was manually changed from ${item.auto.residentName} to ${item.manual.residentName}.`,
      });
    }
  }

  for (const [residentId, residentCells] of cellsByResident.entries()) {
    const resident = getResidentById(residents, residentId);
    if (!resident) continue;

    if (residentCells.length > 1) {
      issues.push({
        id: `double-${date}-${residentId}`,
        severity: "critical",
        category: "double-assignment",
        date,
        residentId,
        residentName: resident.displayName,
        title: "Resident assigned more than once",
        message: `${resident.displayName} is assigned to ${residentCells
          .map((item) => item.service.name)
          .join(", ")} on the same day.`,
      });
    }

    const hasNightFloat = residentCells.some((item) =>
      isNightFloatService(item.service.id)
    );

    const hasDayService = residentCells.some((item) => isDayService(item.service));

    if (hasNightFloat && hasDayService) {
      issues.push({
        id: `nf-day-${date}-${residentId}`,
        severity: "critical",
        category: "night-float-conflict",
        date,
        residentId,
        residentName: resident.displayName,
        title: "Night float and day service conflict",
        message: `${resident.displayName} is assigned to night float and a daytime call/service on the same date.`,
      });
    }
  }

  if (currentBlock) {
    const blockAssignmentsForDate = blockAssignments.filter(
      (assignment) => assignment.blockId === currentBlock.id
    );

    for (const item of effectiveCells) {
      const cell = item.cell;
      if (!cell) continue;

      const residentBlockAssignments = blockAssignmentsForDate.filter(
        (assignment) => assignment.residentId === cell.residentId
      );

      const vacationAssignment = residentBlockAssignments.find((assignment) =>
        isVacationLike(assignment.rotationName)
      );

      if (vacationAssignment) {
        issues.push({
          id: `vacation-${date}-${cell.residentId}-${item.service.id}`,
          severity: "critical",
          category: "vacation-conflict",
          date,
          residentId: cell.residentId,
          residentName: cell.residentName,
          serviceId: item.service.id,
          serviceName: item.service.name,
          title: "Vacation conflict",
          message: `${cell.residentName} is on ${vacationAssignment.rotationName} but assigned to ${item.service.name}.`,
        });
      }

      const jeopardyAssignment = residentBlockAssignments.find((assignment) =>
        isJeopardyLike(assignment.rotationName)
      );

      if (jeopardyAssignment && !normalize(item.service.name).includes("jeopardy")) {
        issues.push({
          id: `jeopardy-${date}-${cell.residentId}-${item.service.id}`,
          severity: "warning",
          category: "jeopardy-conflict",
          date,
          residentId: cell.residentId,
          residentName: cell.residentName,
          serviceId: item.service.id,
          serviceName: item.service.name,
          title: "Jeopardy conflict",
          message: `${cell.residentName} is assigned to Jeopardy in the block schedule but also assigned to ${item.service.name}.`,
        });
      }
    }
  }

  return issues;
}

export function issueSeverityStyle(severity: ScheduleIssueSeverity) {
  if (severity === "critical") {
    return {
      label: "Critical",
      color: "#be123c",
      bg: "#fff1f2",
      border: "#fecdd3",
    };
  }

  if (severity === "warning") {
    return {
      label: "Warning",
      color: "#b45309",
      bg: "#fffbeb",
      border: "#fde68a",
    };
  }

  return {
    label: "Info",
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
  };
}