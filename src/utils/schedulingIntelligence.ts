import type { AcademicBlock } from "../types/block";
import type { BlockAssignment } from "../types/blockAssignment";
import type { MonthlyScheduleCell } from "../types/monthSchedule";
import type { Resident } from "../types/resident";
import type { ScheduleService } from "../types/schedule";
import {
  getAutoNightFloatCell,
  isNightFloatService,
} from "./nightFloatSchedule";
import {
  getMissingCoverageIssues,
  validateCallAssignment,
  type RuleCode,
} from "./scheduleRules";

export type ScheduleIssueSeverity = "critical" | "warning" | "info";

export type ScheduleIssueCategory =
  | RuleCode
  | "manual-override"
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

function formatIssueDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function titleForCode(code: RuleCode) {
  const titles: Record<RuleCode, string> = {
    "service-unavailable": "Service unavailable",
    "wrong-pgy": "Wrong PGY level",
    "vacation-conflict": "Vacation conflict",
    "jeopardy-conflict": "Jeopardy conflict",
    "duplicate-assignment": "Resident assigned more than once",
    "night-float-day-conflict": "Night Float and day conflict",
    "night-float-short-duty-conflict": "Night Float and short duty conflict",
    "night-float-off-night": "Night Float off-night",
    "short-duty-floor-mismatch": "Short duty floor mismatch",
    "block-rotation-mismatch": "Block rotation mismatch",
    "missing-coverage": "Missing coverage",
  };
  return titles[code];
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
  includeMissingCoverage = false,
}: {
  date: string;
  services: ScheduleService[];
  monthlyAssignments: Record<string, MonthlyScheduleCell>;
  blocks: AcademicBlock[];
  blockAssignments: BlockAssignment[];
  residents: Resident[];
  includeMissingCoverage?: boolean;
}): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  const residentById = new Map(residents.map((resident) => [resident.id, resident]));
  const effectiveAssignments: Record<string, MonthlyScheduleCell> = {
    ...monthlyAssignments,
  };

  const effectiveRows = services.map((service) => {
    const result = getEffectiveMonthlyCell({
      date,
      service,
      monthlyAssignments,
      blocks,
      blockAssignments,
      residents,
    });

    if (result.cell) {
      effectiveAssignments[`${date}_${service.id}`] = result.cell;
    }

    return { service, ...result };
  });

  if (includeMissingCoverage) {
    for (const issue of getMissingCoverageIssues({
      date,
      services,
      assignments: effectiveAssignments,
    })) {
      const service = services.find((item) =>
        issue.message.startsWith(item.name)
      );
      issues.push({
        id: `missing-${date}-${service?.id || issue.message}`,
        severity: issue.severity,
        category: issue.code,
        date,
        serviceId: service?.id,
        serviceName: service?.name,
        title: titleForCode(issue.code),
        message: `${formatIssueDate(date)}: ${issue.message}`,
      });
    }
  }

  for (const item of effectiveRows) {
    if (!item.cell) continue;
    const resident = residentById.get(item.cell.residentId);
    if (!resident) continue;

    const result = validateCallAssignment({
      date,
      service: item.service,
      resident,
      existingAssignments: effectiveAssignments,
      blocks,
      blockAssignments,
      allowCoverageOverride: Boolean(item.manual?.notes),
    });

    for (const ruleIssue of result.issues) {
      issues.push({
        id: `${ruleIssue.code}-${date}-${item.service.id}-${resident.id}`,
        severity: ruleIssue.severity,
        category: ruleIssue.code,
        date,
        residentId: resident.id,
        residentName: resident.displayName,
        serviceId: item.service.id,
        serviceName: item.service.name,
        title: titleForCode(ruleIssue.code),
        message: `${formatIssueDate(date)}: ${ruleIssue.message}`,
      });
    }

    if (
      item.manual &&
      item.auto &&
      item.manual.residentId !== item.auto.residentId
    ) {
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
        message: `${formatIssueDate(date)}: ${item.service.name} was manually changed from ${item.auto.residentName} to ${item.manual.residentName}.`,
      });
    }
  }

  const unique = new Map<string, ScheduleIssue>();
  for (const issue of issues) {
    unique.set(issue.id, issue);
  }
  return Array.from(unique.values());
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
