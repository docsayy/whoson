import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";

import { useAuth } from "../context/AuthContext";
import { useAcademicBlocks } from "../hooks/useAcademicBlocks";
import { useAttendingSchedule } from "../hooks/useAttendingSchedule";
import { useAttendings } from "../hooks/useAttendings";
import { useBlockAssignments } from "../hooks/useBlockAssignments";
import { useMonthlySchedule } from "../hooks/useMonthlySchedule";
import { useResidents } from "../hooks/useResidents";
import type { AttendingScheduleAssignment } from "../types/attendingSchedule";
import type { MonthlyScheduleCell } from "../types/monthSchedule";
import type { ScheduleService } from "../types/schedule";
import { canBuildSchedule } from "../utils/permissions";
import {
  EXACT_NF_SERVICE_IDS,
  getAutoNightFloatCell,
  isNightFloatService,
} from "../utils/nightFloatSchedule";
import {
  detectDailyScheduleIssues,
  issueSeverityStyle,
  type ScheduleIssue,
} from "../utils/schedulingIntelligence";

type WhosOnMode = "call" | "all" | "admitting" | "consulting";


const residentCallRows = [
  { ids: ["tele-pgy1", "tele-intern"], names: ["Tele PGY1", "Tele Intern"], name: "Tele PGY1", time: "7a-7p", level: "PGY-1", order: 1 },
  { ids: ["2n-ccu-pgy1", "2n-ccu-intern"], names: ["2N-CCU PGY1", "2N CCU PGY1", "2N-CCU Intern", "2N CCU Intern"], name: "2N-CCU PGY1", time: "7a-7p", level: "PGY-1", order: 2 },
  { ids: ["2n-ccu-pgy2"], names: ["2N-CCU PGY2", "2N CCU PGY2"], name: "2N-CCU PGY2", time: "7a-7p", level: "PGY-2", order: 3 },
  { ids: ["3w-pgy1", "3w-intern"], names: ["3W PGY1", "3W Intern"], name: "3W PGY1", time: "7a-7p", level: "PGY-1", order: 4 },
  { ids: ["4n-pgy1", "4n-intern"], names: ["4N PGY1", "4N Intern"], name: "4N PGY1", time: "7a-7p", level: "PGY-1", order: 5 },
  { ids: ["4n-3w-pgy2"], names: ["4N-3W PGY2"], name: "4N-3W PGY2", time: "7a-7p", level: "PGY-2", order: 6 },
  { ids: ["micu-pgy1", "micu-intern"], names: ["MICU PGY1", "MICU Intern"], name: "MICU PGY1", time: "7a-7a", level: "PGY-1", order: 7 },
  { ids: ["micu-senior"], names: ["MICU Senior"], name: "MICU Senior", time: "8a-8a", level: "PGY-2, PGY-3", order: 8 },
  { ids: ["chief-on-call"], names: ["Chief On Call"], name: "Chief On Call", time: "7a-7p", level: "PGY-3", order: 9 },
  { ids: [EXACT_NF_SERVICE_IDS.pgy1FourNorthThreeWest, "weekend-nf-intern-1"], names: ["4N-3W PGY1 NF", "Weekend NF Intern 1"], name: "4N-3W PGY1 NF", time: "7p-7a", level: "PGY-1", order: 10 },
  { ids: [EXACT_NF_SERVICE_IDS.pgy2FourNorthThreeWest, "weekend-nf-senior-1"], names: ["4N-3W PGY2 NF", "Weekend NF Senior 1"], name: "4N-3W PGY2 NF", time: "7p-7a", level: "PGY-2", order: 11 },
  { ids: [EXACT_NF_SERVICE_IDS.pgy1TwoNorthCcu, "weekend-nf-intern-2"], names: ["2N-CCU PGY1 NF", "2N CCU PGY1 NF", "Weekend NF Intern 2"], name: "2N-CCU PGY1 NF", time: "7p-7a", level: "PGY-1", order: 12 },
  { ids: [EXACT_NF_SERVICE_IDS.pgy2TwoNorthCcu, "weekend-nf-senior-2"], names: ["2N-CCU PGY2 NF", "2N CCU PGY2 NF", "Weekend NF Senior 2"], name: "2N-CCU PGY2 NF", time: "7p-7a", level: "PGY-2", order: 13 },
  { ids: [EXACT_NF_SERVICE_IDS.pgy3, "weekend-pgy3-nf"], names: ["PGY3 NF", "Weekend PGY3 NF"], name: "PGY3 NF", time: "7p-7a", level: "PGY-3", order: 14 },
];

type ResidentConsultKey =
  | "cardio-ccu"
  | "id-pgy1"
  | "id-senior"
  | "gi"
  | "endo-rheum-nephro"
  | "pulm"
  | "hem-onc"
  | "neuro";

const residentConsultRows: {
  key: ResidentConsultKey;
  name: string;
  time: string;
  level: string;
  order: number;
}[] = [
  { key: "cardio-ccu", name: "Cardio/CCU", time: "7a-4p", level: "PGY-2, PGY-3", order: 15 },
  { key: "id-pgy1", name: "ID PGY1", time: "7a-4p", level: "PGY-1", order: 16 },
  { key: "id-senior", name: "ID Senior", time: "7a-4p", level: "PGY-2, PGY-3", order: 17 },
  { key: "gi", name: "GI", time: "7a-4p", level: "PGY-2, PGY-3", order: 18 },
  { key: "endo-rheum-nephro", name: "Endo/Rheum/Nephro", time: "7a-4p", level: "PGY-2, PGY-3", order: 19 },
  { key: "pulm", name: "Pulm", time: "7a-4p", level: "PGY-2, PGY-3", order: 20 },
  { key: "hem-onc", name: "Hem-Onc", time: "7a-4p", level: "PGY-2, PGY-3", order: 21 },
  { key: "neuro", name: "Neuro", time: "7a-4p", level: "PGY-2, PGY-3", order: 22 },
];


function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toMonthId(date: Date) {
  return toDateInputValue(date).slice(0, 7);
}

function fromDateInputValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDisplayDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isWeekday(date: string) {
  const day = fromDateInputValue(date).getDay();
  return day >= 1 && day <= 5;
}

function matchesAny(value: string, aliases: string[]) {
  const normalized = normalizeText(value);
  return aliases.some((alias) => normalized.includes(normalizeText(alias)));
}

function getResidentConsultKey(
  rotationId: string,
  rotationName: string,
  residentPgy?: string
): ResidentConsultKey | null {
  const source = `${rotationId} ${rotationName}`;
  const normalizedId = normalizeText(rotationId);
  const normalizedName = normalizeText(rotationName);

  if (
    normalizedId === "id" ||
    normalizedName === "id" ||
    matchesAny(source, [
      "infectious disease",
      "infectious",
      "id consult",
      "id rotation",
    ])
  ) {
    return residentPgy === "PGY-1" ? "id-pgy1" : "id-senior";
  }

  if (
    (normalizedId === "cardio" ||
      normalizedId === "cardiology" ||
      normalizedId === "ccu" ||
      normalizedId === "cardioccu" ||
      normalizedName === "cardio" ||
      normalizedName === "cardiology" ||
      normalizedName === "ccu" ||
      normalizedName === "cardioccu" ||
      matchesAny(source, [
        "cardiology",
        "cardio",
        "ccu consult",
        "cardio ccu",
      ])) &&
    !matchesAny(source, ["night float", "pgy1 nf", "pgy2 nf"])
  ) {
    return "cardio-ccu";
  }

  if (
    normalizedId === "gi" ||
    normalizedName === "gi" ||
    matchesAny(source, ["gastroenterology", "gastro", "gi consult"])
  ) {
    return "gi";
  }

  if (
    normalizedId === "end" ||
    normalizedId === "endo" ||
    normalizedId === "rheum" ||
    normalizedId === "nephro" ||
    normalizedId === "endorheumnephro" ||
    normalizedName === "endo" ||
    normalizedName === "rheum" ||
    normalizedName === "nephro" ||
    normalizedName === "endorheumnephro" ||
    matchesAny(source, [
      "endo rheum neph",
      "endocrinology rheumatology nephrology",
      "endocrinology",
      "rheumatology",
      "nephrology",
      "nephro",
    ])
  ) {
    return "endo-rheum-nephro";
  }

  if (
    (normalizedId === "pulm" ||
      normalizedName === "pulm" ||
      matchesAny(source, [
        "pulmonology",
        "pulmonary",
        "pulm consult",
        "pulm",
      ])) &&
    !matchesAny(source, ["micu"])
  ) {
    return "pulm";
  }

  if (
    normalizedId === "hemonc" ||
    normalizedId === "hemoncology" ||
    normalizedName === "hemonc" ||
    normalizedName === "hemoncology" ||
    matchesAny(source, [
      "hematology oncology",
      "hematology/oncology",
      "heme onc",
      "hem onc",
      "hemonc",
    ])
  ) {
    return "hem-onc";
  }

  if (
    normalizedId === "neuro" ||
    normalizedName === "neuro" ||
    matchesAny(source, ["neurology", "neuro consult", "neuro"])
  ) {
    return "neuro";
  }

  return null;
}

function shortenSpecialtyName(value: string) {
  const withoutOnCall = value
    .replace(/\s*[-–—]?\s*on\s*call\s*$/i, "")
    .replace(/\s*on-call\s*$/i, "")
    .trim();

  const normalized = normalizeText(withoutOnCall);

  if (normalized.includes("gastroenterology") || normalized === "gastro") return "GI";
  if (normalized.includes("infectiousdisease") || normalized === "infectious") return "ID";
  if (
    normalized.includes("hematologyoncology") ||
    normalized.includes("hemeonc") ||
    normalized.includes("hemonc")
  ) {
    return "Hem-Onc";
  }
  if (normalized.includes("endocrinology") && normalized.includes("rheumatology") && normalized.includes("nephrology")) {
    return "Endo/Rheum/Nephro";
  }
  if (normalized.includes("nephrology")) return "Nephro";
  if (normalized.includes("pulmonology") || normalized.includes("pulmonary")) return "Pulm";
  if (normalized.includes("cardiology")) return "Cardio";
  if (normalized.includes("neurology")) return "Neuro";
  if (normalized.includes("rheumatology")) return "Rheum";
  if (normalized.includes("endocrinology")) return "Endo";
  if (normalized.includes("criticalcare") || normalized === "medicalicu") return "MICU";

  return withoutOnCall;
}

function findMonthlyCell(
  date: string,
  row: (typeof residentCallRows)[number],
  assignments: Record<string, MonthlyScheduleCell>
) {
  for (const id of row.ids) {
    const direct = assignments[`${date}_${id}`];
    if (direct) return direct;
  }

  const rowNames = row.names.map(normalizeText);

  return Object.values(assignments).find((cell) => {
    if (cell.date !== date) return false;
    return rowNames.includes(normalizeText(cell.serviceName || ""));
  });
}

function makeScheduleServiceFromRow(row: (typeof residentCallRows)[number]): ScheduleService {
  const isNight = row.time.includes("7p");
  const firstId = row.ids[0];

  return {
    id: firstId,
    name: row.name,
    shortName: row.name,
    category: isNight ? "Night" : "Day",
    coverageGroup: "Resident",
    attendingScheduleType: "None",
    requiredTraining: [],
    defaultStartTime: isNight ? "19:00" : "07:00",
    defaultEndTime: row.time.includes("8a") ? "08:00" : isNight ? "07:00" : "19:00",
    displayOrderCall: row.order,
    displayOrderAll: row.order,
    visibleOnCall: true,
    visibleOnAllServices: true,
    active: true,
  };
}

function getLevelStyle(level: string) {
  if (level.includes("PGY-1")) return { color: "#dc2626", bg: "#fff1f2", border: "#fecdd3" };
  if (level.includes("PGY-2")) return { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" };
  if (level.includes("PGY-3")) return { color: "#15803d", bg: "#ecfdf5", border: "#bbf7d0" };
  return { color: "#475569", bg: "#f8fafc", border: "#e2e8f0" };
}

function serviceIcon(service: string) {
  const lower = service.toLowerCase();
  if (lower.includes("chief") || lower.includes("pgy3 nf")) return "👑";
  if (lower.includes("nf")) return "🌙";
  if (lower.includes("micu") || lower.includes("pulm")) return "🫁";
  if (lower.includes("ccu") || lower.includes("card")) return "🫀";
  if (lower.includes("tele")) return "🖥️";
  if (lower.includes("4n")) return "🏥";
  if (lower.includes("3w")) return "🛏️";
  if (lower.includes("jeopardy")) return "🧰";
  if (lower.includes("vac")) return "🌴";
  if (lower.includes("neuro")) return "🧠";
  if (lower.includes("gi") || lower.includes("gastro")) return "🍽️";
  if (lower.includes("neph")) return "🫘";
  if (lower.includes("heme") || lower.includes("onc")) return "🩸";
  if (lower.includes("id") || lower.includes("infect")) return "🦠";
  if (lower.includes("rheum")) return "🦴";
  if (lower.includes("observ")) return "👀";
  if (lower.includes("faculty")) return "⭐";
  return "🏥";
}

function coverageBadgeColor(coverage: string) {
  if (coverage.includes("24")) {
    return { color: "#6d28d9", borderColor: "#ddd6fe", backgroundColor: "#f5f3ff" };
  }
  return { color: "#b45309", borderColor: "#fde68a", backgroundColor: "#fffbeb" };
}

function isActiveOnDate(assignment: AttendingScheduleAssignment, date: string) {
  return assignment.startDate <= date && assignment.endDate >= date;
}

export default function WhosOnPage({
  onOpenResidentProfile,
}: {
  onOpenResidentProfile?: (residentId: string) => void;
}) {
  const { profile } = useAuth();
  const allowBuild = canBuildSchedule(profile?.role);

  const [mode, setMode] = useState<WhosOnMode>("call");
  const [selectedDate, setSelectedDate] = useState(new Date());

  const selectedDateKey = toDateInputValue(selectedDate);
  const monthId = toMonthId(selectedDate);

  const { residents } = useResidents();
  const { schedule, loading: monthlyLoading, error: monthlyError } = useMonthlySchedule(monthId);
  const { blocks, loading: blocksLoading, error: blocksError } = useAcademicBlocks();
  const {
    assignments: blockAssignments,
    loading: blockAssignmentsLoading,
    error: blockAssignmentsError,
  } = useBlockAssignments();

  const {
    assignments: attendingAssignments,
    loading: attendingLoading,
    error: attendingError,
  } = useAttendingSchedule();

  const {
    attendings,
    loading: attendingsLoading,
    error: attendingsError,
  } = useAttendings();

  const monthlyAssignments = schedule?.assignments || {};
  const isResidentCallPublished = schedule?.status === "published";
  const canViewResidentCall = allowBuild || isResidentCallPublished;

  const residentsById = useMemo(() => {
    const map: Record<string, (typeof residents)[number]> = {};
    for (const resident of residents) map[resident.id] = resident;
    return map;
  }, [residents]);

  const residentIdByName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const resident of residents) {
      map[normalizeText(resident.displayName)] = resident.id;
    }
    return map;
  }, [residents]);

  const attendingsById = useMemo(() => {
    const map: Record<string, (typeof attendings)[number]> = {};
    for (const attending of attendings) {
      map[attending.id] = attending;
    }
    return map;
  }, [attendings]);

  const attendingByName = useMemo(() => {
    const map: Record<string, (typeof attendings)[number]> = {};
    for (const attending of attendings) {
      map[normalizeText(attending.displayName)] = attending;
    }
    return map;
  }, [attendings]);

  function getAttendingPhone(assignment: AttendingScheduleAssignment) {
    const profileById = assignment.attendingId
      ? attendingsById[assignment.attendingId]
      : undefined;

    const profileByName = assignment.attendingName
      ? attendingByName[normalizeText(assignment.attendingName)]
      : undefined;

    return assignment.phone || profileById?.phone || profileByName?.phone || "—";
  }

  const currentBlock = useMemo(() => {
    return blocks.find(
      (block) => selectedDateKey >= block.startDate && selectedDateKey <= block.endDate
    );
  }, [blocks, selectedDateKey]);

  const residentCallServices = useMemo(
    () => residentCallRows.map(makeScheduleServiceFromRow),
    []
  );

  const todayIssues = useMemo(() => {
    if (!allowBuild) return [];

    return detectDailyScheduleIssues({
      date: selectedDateKey,
      services: residentCallServices,
      monthlyAssignments,
      blocks,
      blockAssignments,
      residents,
    });
  }, [
    allowBuild,
    blockAssignments,
    blocks,
    monthlyAssignments,
    residentCallServices,
    residents,
    selectedDateKey,
  ]);

  const callRows = useMemo(() => {
    if (!canViewResidentCall) return [];

    return residentCallRows
      .sort((a, b) => a.order - b.order)
      .map((row) => {
        const manualCell = findMonthlyCell(selectedDateKey, row, monthlyAssignments);
        const service = makeScheduleServiceFromRow(row);

        const autoCell =
          !manualCell && isNightFloatService(service.id)
            ? getAutoNightFloatCell({
                date: selectedDateKey,
                service,
                blocks,
                blockAssignments,
                residents,
              })
            : undefined;

        const cell = manualCell || autoCell;
        const resident = cell?.residentId ? residentsById[cell.residentId] : undefined;

        return {
          service: row.name,
          time: row.time,
          name: cell?.residentName || "",
          residentId: cell?.residentId || "",
          level: cell?.training || row.level,
          pager: cell?.pager || resident?.pager || "",
          issues: todayIssues.filter((issue) => issue.serviceId === service.id),
        };
      });
  }, [
    blockAssignments,
    blocks,
    canViewResidentCall,
    monthlyAssignments,
    residents,
    residentsById,
    selectedDateKey,
    todayIssues,
  ]);


  const residentConsultCoverageRows = useMemo(() => {
    if (!currentBlock || !isWeekday(selectedDateKey)) return [];

    const todayMicuSenior = findMonthlyCell(
      selectedDateKey,
      residentCallRows.find((row) => row.ids.includes("micu-senior"))!,
      monthlyAssignments
    )?.residentId;

    const previousDateKey = toDateInputValue(addDays(selectedDate, -1));
    const previousMicuSenior = findMonthlyCell(
      previousDateKey,
      residentCallRows.find((row) => row.ids.includes("micu-senior"))!,
      monthlyAssignments
    )?.residentId;

    const assignmentsByKey = new Map<
      ResidentConsultKey,
      (typeof blockAssignments)[number]
    >();

    for (const assignment of blockAssignments) {
      if (assignment.blockId !== currentBlock.id) continue;

      const resident = residentsById[assignment.residentId];
      if (!resident?.active) continue;

      const key = getResidentConsultKey(
        assignment.rotationId,
        assignment.rotationName,
        resident.pgy
      );

      if (!key) continue;

      if (
        key === "pulm" &&
        (assignment.residentId === todayMicuSenior ||
          assignment.residentId === previousMicuSenior)
      ) {
        continue;
      }

      if (!assignmentsByKey.has(key)) {
        assignmentsByKey.set(key, assignment);
      }
    }

    return residentConsultRows.map((row) => {
      const assignment = assignmentsByKey.get(row.key);
      const resident = assignment
        ? residentsById[assignment.residentId]
        : undefined;

      return {
        service: row.name,
        time: row.time,
        name: assignment?.residentName || "",
        residentId: assignment?.residentId || "",
        level: resident?.pgy || row.level,
        pager: resident?.pager || "",
        issues: [] as ScheduleIssue[],
      };
    });
  }, [
    blockAssignments,
    currentBlock,
    monthlyAssignments,
    residentsById,
    selectedDate,
    selectedDateKey,
  ]);

  const displayedCallRows = useMemo(
    () => [...callRows, ...residentConsultCoverageRows],
    [callRows, residentConsultCoverageRows]
  );

  const assignedCallCount = displayedCallRows.filter((row) => row.name).length;

  const allServiceRows = useMemo(() => {
    if (!currentBlock) return [];

    const byResident = new Map<string, (typeof blockAssignments)[number]>();

    for (const assignment of blockAssignments) {
      if (assignment.blockId !== currentBlock.id) continue;

      const existing = byResident.get(assignment.residentId);
      if (!existing) {
        byResident.set(assignment.residentId, assignment);
        continue;
      }

      const existingIsJeopardy = existing.rotationName.toLowerCase().includes("jeopardy");
      const newIsJeopardy = assignment.rotationName.toLowerCase().includes("jeopardy");

      if (existingIsJeopardy && !newIsJeopardy) {
        byResident.set(assignment.residentId, assignment);
      }
    }

    return Array.from(byResident.values())
      .sort((a, b) => {
        const residentA = residentsById[a.residentId];
        const residentB = residentsById[b.residentId];

        const pgySort = (residentA?.pgy || "").localeCompare(residentB?.pgy || "");
        if (pgySort !== 0) return pgySort;

        return a.residentName.localeCompare(b.residentName);
      })
      .map((item) => {
        const resident = residentsById[item.residentId];
        return {
          service: item.rotationName,
          name: item.residentName,
          residentId: item.residentId,
          level: resident?.pgy || "Resident",
        };
      });
  }, [blockAssignments, currentBlock, residentsById]);

  const admittingRows = useMemo(() => {
    return attendingAssignments
      .filter((assignment) => assignment.group === "Core")
      .filter((assignment) => isActiveOnDate(assignment, selectedDateKey))
      .sort((a, b) => a.serviceName.localeCompare(b.serviceName))
      .map((assignment) => ({
        specialty: shortenSpecialtyName(assignment.serviceName),
        consultant: assignment.attendingName,
        coverage: assignment.coverageNote || `${assignment.coverageStartTime}-${assignment.coverageEndTime}`,
        phone: getAttendingPhone(assignment),
      }));
  }, [
    attendingAssignments,
    attendingByName,
    attendingsById,
    selectedDateKey,
  ]);

  const consultingRows = useMemo(() => {
    return attendingAssignments
      .filter((assignment) => assignment.group === "Specialty")
      .filter((assignment) => isActiveOnDate(assignment, selectedDateKey))
      .sort((a, b) => a.serviceName.localeCompare(b.serviceName))
      .map((assignment) => ({
        specialty: shortenSpecialtyName(assignment.serviceName),
        consultant: assignment.attendingName,
        coverage: assignment.coverageNote || `${assignment.coverageStartTime}-${assignment.coverageEndTime}`,
        phone: getAttendingPhone(assignment),
      }));
  }, [
    attendingAssignments,
    attendingByName,
    attendingsById,
    selectedDateKey,
  ]);

  const loading =
    monthlyLoading ||
    blocksLoading ||
    blockAssignmentsLoading ||
    attendingLoading ||
    attendingsLoading;

  const error =
    monthlyError ||
    blocksError ||
    blockAssignmentsError ||
    attendingError ||
    attendingsError;

  const timeText = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  function openResidentByName(name: string, residentId?: string) {
    const id = residentId || residentIdByName[normalizeText(name)];
    if (id) onOpenResidentProfile?.(id);
  }

  return (
    <Box sx={{ width: "100%", maxWidth: "none", minWidth: 0 }}>
      <Stack
        direction={{ xs: "row", md: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "center", md: "center" }}
        sx={{ mb: { xs: 1, md: 2 }, minWidth: 0 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h4"
            fontWeight={850}
            sx={{
              lineHeight: 1,
              fontSize: { xs: 26, md: 34 },
              whiteSpace: "nowrap",
            }}
          >
            Who&apos;s On
          </Typography>
          <Typography
            color="text.secondary"
            fontSize={14}
            sx={{ display: { xs: "none", md: "block" } }}
          >
            See who is on service for the selected date.
          </Typography>
        </Box>

        <TextField
          select
          size="small"
          value={mode}
          onChange={(e) => setMode(e.target.value as WhosOnMode)}
          sx={{
            display: { xs: "block", md: "none" },
            width: 170,
            flexShrink: 0,
            "& .MuiInputBase-input": {
              fontWeight: 850,
              fontSize: 13,
              py: 1,
            },
          }}
        >
          <MenuItem value="call">Resident Calls</MenuItem>
          <MenuItem value="all">All Services</MenuItem>
          <MenuItem value="admitting">Admitting</MenuItem>
          <MenuItem value="consulting">Consulting</MenuItem>
        </TextField>

        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            display: { xs: "none", md: "flex" },
            p: 0.5,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            backgroundColor: "#f8fafc",
          }}
        >
          <Button variant={mode === "call" ? "contained" : "text"} onClick={() => setMode("call")} sx={{ textTransform: "none", fontWeight: 800 }}>
            📞 Resident Calls
          </Button>
          <Button variant={mode === "all" ? "contained" : "text"} onClick={() => setMode("all")} sx={{ textTransform: "none", fontWeight: 800 }}>
            ▦ All Services
          </Button>
          <Button variant={mode === "admitting" ? "contained" : "text"} onClick={() => setMode("admitting")} sx={{ textTransform: "none", fontWeight: 800 }}>
            🏥 Admitting Attendings
          </Button>
          <Button variant={mode === "consulting" ? "contained" : "text"} onClick={() => setMode("consulting")} sx={{ textTransform: "none", fontWeight: 800 }}>
            🩺 Consulting Services
          </Button>
        </Stack>
      </Stack>

      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{ mb: { xs: 1, md: 2 }, width: "100%", minWidth: 0 }}
      >
        <Button
          variant="outlined"
          onClick={() => setSelectedDate((d) => addDays(d, -1))}
          sx={{ minWidth: { xs: 42, sm: 48 }, px: { xs: 0.75, sm: 1.5 } }}
        >
          <ChevronLeftIcon />
        </Button>

        <TextField
          size="small"
          type="date"
          value={selectedDateKey}
          onChange={(e) => setSelectedDate(fromDateInputValue(e.target.value))}
          sx={{
            flex: 1,
            minWidth: 0,
            maxWidth: { xs: "none", sm: 190 },
            "& input": {
              fontSize: { xs: 14, sm: 15 },
              fontWeight: 750,
              px: { xs: 1, sm: 1.5 },
            },
          }}
        />

        <Button
          variant="outlined"
          onClick={() => setSelectedDate((d) => addDays(d, 1))}
          sx={{ minWidth: { xs: 42, sm: 48 }, px: { xs: 0.75, sm: 1.5 } }}
        >
          <ChevronRightIcon />
        </Button>

        <Button
          variant="outlined"
          startIcon={<TodayIcon />}
          onClick={() => setSelectedDate(new Date())}
          sx={{
            textTransform: "none",
            fontWeight: 850,
            minWidth: { xs: 42, sm: 92 },
            px: { xs: 1, sm: 1.5 },
            "& .MuiButton-startIcon": {
              mr: { xs: 0, sm: 0.75 },
            },
          }}
        >
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
            Today
          </Box>
        </Button>

        <Chip
          label={`as of ${timeText}`}
          sx={{
            display: { xs: "none", md: "inline-flex" },
            height: 38,
            borderRadius: 2,
            fontWeight: 700,
            backgroundColor: "#f8fafc",
            border: "1px solid",
            borderColor: "divider",
          }}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 1, py: { xs: 0.25, md: 0.75 } }}>
          {error}
        </Alert>
      )}

      {allowBuild && !loading && <TodayIssuesPanel issues={todayIssues} />}

      {mode === "call" && !loading && !canViewResidentCall && (
        <Alert severity="warning" sx={compactAlertSx}>
          Resident call schedule is still in draft.
        </Alert>
      )}

      {mode === "call" && !loading && canViewResidentCall && (
        <Alert severity="info" sx={compactAlertSx}>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
            Reading monthly schedule <b>{monthId}</b>.{" "}
          </Box>
          <b>{assignedCallCount}</b> assigned resident call row{assignedCallCount === 1 ? "" : "s"}.
        </Alert>
      )}

      {mode === "all" && currentBlock && (
        <Alert severity="info" sx={compactAlertSx}>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
            Showing assignments for{" "}
          </Box>
          <b>{currentBlock.name}</b>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
            {" "}on <b>{formatDisplayDate(selectedDate)}</b>.
          </Box>
        </Alert>
      )}

      {mode === "admitting" && (
        <Alert severity="info" sx={compactAlertSx}>
          Admitting attending coverage.
        </Alert>
      )}

      {mode === "consulting" && (
        <Alert severity="info" sx={compactAlertSx}>
          Consulting service coverage.
        </Alert>
      )}

      <Card
        sx={{
          borderRadius: { xs: 2, md: 3 },
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
          width: "100%",
          overflow: "hidden",
        }}
      >
        <CardContent sx={{ p: { xs: 0.75, sm: 1.25, md: 2 } }}>
          {loading ? (
            <Stack alignItems="center" sx={{ py: 5 }}>
              <CircularProgress />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                Loading Who&apos;s On...
              </Typography>
            </Stack>
          ) : mode === "call" && !canViewResidentCall ? (
            <Typography color="text.secondary" sx={{ p: 2 }}>
              Resident call schedule is not published yet.
            </Typography>
          ) : mode === "call" ? (
            <ResidentCallsTable rows={displayedCallRows} onOpenResident={openResidentByName} />
          ) : mode === "all" ? (
            <AllServicesTable rows={allServiceRows} onOpenResident={openResidentByName} />
          ) : mode === "admitting" ? (
            <AttendingServicesTable rows={admittingRows} emptyMessage="No admitting attending coverage found for this date." />
          ) : (
            <AttendingServicesTable rows={consultingRows} emptyMessage="No consulting coverage found for this date." />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

const compactAlertSx = {
  mb: { xs: 1, md: 2 },
  borderRadius: { xs: 2, md: 2 },
  py: { xs: 0.25, md: 0.75 },
  px: { xs: 1, md: 2 },
  "& .MuiAlert-icon": {
    fontSize: { xs: 20, md: 24 },
    mr: { xs: 1, md: 1.5 },
  },
  "& .MuiAlert-message": {
    fontSize: { xs: 13, md: 14 },
    py: { xs: 0.35, md: 0.5 },
  },
};

function TodayIssuesPanel({ issues }: { issues: ScheduleIssue[] }) {
  const critical = issues.filter((issue) => issue.severity === "critical");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const info = issues.filter((issue) => issue.severity === "info");

  if (issues.length === 0) {
    return (
      <Alert severity="success" sx={compactAlertSx}>
        No resident call conflicts detected.
      </Alert>
    );
  }

  return (
    <Card sx={{ mb: { xs: 1, md: 2 }, borderRadius: 2 }}>
      <CardContent sx={{ p: { xs: 1, md: 1.5 } }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" sx={{ mb: 1 }}>
          <Box>
            <Typography fontWeight={900} fontSize={{ xs: 13, md: 15 }}>
              Today&apos;s Issues
            </Typography>
            <Typography color="text.secondary" fontSize={12}>
              Visible to schedule builders only.
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            <IssueCountChip label="Critical" count={critical.length} severity="critical" />
            <IssueCountChip label="Warning" count={warnings.length} severity="warning" />
            <IssueCountChip label="Info" count={info.length} severity="info" />
          </Stack>
        </Stack>

        <Stack spacing={0.5}>
          {issues.slice(0, 3).map((issue) => {
            const style = issueSeverityStyle(issue.severity);

            return (
              <Box key={issue.id} sx={{ p: 0.65, borderRadius: 1.5, backgroundColor: style.bg, border: "1px solid", borderColor: style.border }}>
                <Typography fontSize={12} fontWeight={900} sx={{ color: style.color }}>
                  {issue.title}
                </Typography>
                <Typography fontSize={11.5} color="text.secondary">
                  {issue.message}
                </Typography>
              </Box>
            );
          })}

          {issues.length > 3 && (
            <Typography fontSize={11.5} color="text.secondary">
              + {issues.length - 3} more issue{issues.length - 3 === 1 ? "" : "s"}.
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function IssueCountChip({ label, count, severity }: { label: string; count: number; severity: "critical" | "warning" | "info" }) {
  const style = issueSeverityStyle(severity);

  return (
    <Chip
      label={`${label}: ${count}`}
      size="small"
      sx={{
        height: 21,
        fontSize: 10.5,
        fontWeight: 900,
        color: style.color,
        backgroundColor: style.bg,
        border: "1px solid",
        borderColor: style.border,
      }}
    />
  );
}

function ResidentCallsTable({
  rows,
  onOpenResident,
}: {
  rows: {
    service: string;
    time: string;
    name: string;
    residentId: string;
    level: string;
    pager: string;
    issues: ScheduleIssue[];
  }[];
  onOpenResident: (name: string, residentId?: string) => void;
}) {
  return (
    <TableShell
      desktopColumns="minmax(165px, 1.15fr) 95px minmax(155px, 1.45fr) 86px 90px"
      mobileColumns="minmax(104px, 1fr) 68px minmax(105px, 1.1fr) minmax(82px, 0.8fr)"
    >
      <HeaderRow
        desktopColumns="minmax(165px, 1.15fr) 95px minmax(155px, 1.45fr) 86px 90px"
        mobileColumns="minmax(104px, 1fr) 68px minmax(105px, 1.1fr) minmax(82px, 0.8fr)"
      >
        <HeaderCell>Service</HeaderCell>
        <HeaderCell>Time</HeaderCell>
        <HeaderCell>Resident</HeaderCell>
        <HeaderCell sx={{ display: { xs: "none", md: "block" } }}>Level</HeaderCell>
        <HeaderCell>Pager</HeaderCell>
      </HeaderRow>

      {rows.map((row, index) => (
        <DataRow
          key={`${row.service}-${index}`}
          desktopColumns="minmax(165px, 1.15fr) 95px minmax(155px, 1.45fr) 86px 90px"
          mobileColumns="minmax(104px, 1fr) 68px minmax(105px, 1.1fr) minmax(82px, 0.8fr)"
          index={index}
        >
          <ServiceCell label={row.service} />
          <TimeBadge time={row.time} />
          <NameCell name={row.name} residentId={row.residentId} issues={row.issues} onOpenResident={onOpenResident} />
          <Box sx={{ display: { xs: "none", md: "block" } }}>
            <LevelBadge level={row.level} />
          </Box>
          <Box>
            <PagerCell pager={row.pager} />
          </Box>
        </DataRow>
      ))}
    </TableShell>
  );
}

function AllServicesTable({
  rows,
  onOpenResident,
}: {
  rows: { service: string; name: string; residentId: string; level: string }[];
  onOpenResident: (name: string, residentId?: string) => void;
}) {
  return (
    <TableShell
      desktopColumns="minmax(220px, 1.35fr) minmax(180px, 1.45fr) 95px"
      mobileColumns="minmax(155px, 1.1fr) minmax(145px, 1fr)"
    >
      <HeaderRow
        desktopColumns="minmax(220px, 1.35fr) minmax(180px, 1.45fr) 95px"
        mobileColumns="minmax(155px, 1.1fr) minmax(145px, 1fr)"
      >
        <HeaderCell>Service</HeaderCell>
        <HeaderCell>Resident</HeaderCell>
        <HeaderCell sx={{ display: { xs: "none", md: "block" } }}>Level</HeaderCell>
      </HeaderRow>

      {rows.map((row, index) => (
        <DataRow
          key={`${row.service}-${row.name}-${index}`}
          desktopColumns="minmax(220px, 1.35fr) minmax(180px, 1.45fr) 95px"
          mobileColumns="minmax(155px, 1.1fr) minmax(145px, 1fr)"
          index={index}
        >
          <ServiceCell label={row.service} />
          <NameCell name={row.name} residentId={row.residentId} issues={[]} onOpenResident={onOpenResident} />
          <Box sx={{ display: { xs: "none", md: "block" } }}>
            <LevelBadge level={row.level} />
          </Box>
        </DataRow>
      ))}

      {rows.length === 0 && <Typography color="text.secondary" sx={{ p: 2 }}>No block assignments found for this date.</Typography>}
    </TableShell>
  );
}

function AttendingServicesTable({
  rows,
  emptyMessage,
}: {
  rows: { specialty: string; consultant: string; coverage: string; phone: string }[];
  emptyMessage: string;
}) {
  return (
    <TableShell
      desktopColumns="minmax(220px, 1.4fr) minmax(165px, 1.1fr) 105px minmax(130px, 0.9fr)"
      mobileColumns="minmax(92px, 0.8fr) minmax(105px, 1fr) minmax(104px, 0.95fr)"
    >
      <HeaderRow
        desktopColumns="minmax(220px, 1.4fr) minmax(165px, 1.1fr) 105px minmax(130px, 0.9fr)"
        mobileColumns="minmax(92px, 0.8fr) minmax(105px, 1fr) minmax(104px, 0.95fr)"
      >
        <HeaderCell>Service</HeaderCell>
        <HeaderCell>Consultant</HeaderCell>
        <HeaderCell sx={{ display: { xs: "none", md: "block" } }}>Coverage</HeaderCell>
        <HeaderCell>Phone</HeaderCell>
      </HeaderRow>

      {rows.map((row, index) => (
        <DataRow
          key={`${row.specialty}-${index}`}
          desktopColumns="minmax(220px, 1.4fr) minmax(165px, 1.1fr) 105px minmax(130px, 0.9fr)"
          mobileColumns="minmax(92px, 0.8fr) minmax(105px, 1fr) minmax(104px, 0.95fr)"
          index={index}
        >
          <ServiceCell label={row.specialty} />
          <Typography fontSize={{ xs: 12.5, md: 13.5 }} fontWeight={700} sx={{ px: { xs: 0.5, md: 1 } }} noWrap>
            {row.consultant || "Unassigned"}
          </Typography>
          <Box sx={{ display: { xs: "none", md: "block" } }}>
            <Chip label={row.coverage} size="small" sx={{ width: "fit-content", maxWidth: "100%", fontWeight: 800, fontSize: 12, height: 24, ...coverageBadgeColor(row.coverage) }} />
          </Box>
          <Typography
            component={row.phone !== "—" ? "a" : "span"}
            href={row.phone !== "—" ? `tel:${row.phone}` : undefined}
            fontSize={{ xs: 11.5, md: 13 }}
            fontWeight={800}
            noWrap
            sx={{
              px: { xs: 0.35, md: 0 },
              color: row.phone === "—" ? "text.secondary" : "#2563eb",
              textDecoration: "none",
            }}
          >
            ☎ {row.phone}
          </Typography>
        </DataRow>
      ))}

      {rows.length === 0 && <Typography color="text.secondary" sx={{ p: 2 }}>{emptyMessage}</Typography>}
    </TableShell>
  );
}

function TableShell({
  children,
  desktopColumns,
  mobileColumns,
}: {
  children: React.ReactNode;
  desktopColumns: string;
  mobileColumns: string;
}) {
  return (
    <Box sx={{ overflowX: "auto", width: "100%" }}>
      <Box
        sx={{
          minWidth: { xs: "max-content", md: 760 },
          width: { xs: "max-content", md: "100%" },
          "& > .table-row": {
            display: "grid",
            gridTemplateColumns: { xs: mobileColumns, md: desktopColumns },
            alignItems: "center",
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function HeaderRow({
  children,
  desktopColumns,
  mobileColumns,
}: {
  children: React.ReactNode;
  desktopColumns: string;
  mobileColumns: string;
}) {
  return (
    <Box
      className="table-row"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: mobileColumns, md: desktopColumns },
        borderBottom: "1px solid",
        borderColor: "divider",
        py: { xs: 0.7, md: 1 },
      }}
    >
      {children}
    </Box>
  );
}

function DataRow({
  children,
  desktopColumns,
  mobileColumns,
  index,
}: {
  children: React.ReactNode;
  desktopColumns: string;
  mobileColumns: string;
  index: number;
}) {
  return (
    <Box
      className="table-row"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: mobileColumns, md: desktopColumns },
        alignItems: "center",
        px: { xs: 0.35, md: 1 },
        py: { xs: 0.45, md: 0.75 },
        minHeight: { xs: 38, md: 42 },
        borderBottom: "1px solid",
        borderColor: "#eef2f7",
        backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8fafc",
      }}
    >
      {children}
    </Box>
  );
}

function HeaderCell({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: object;
}) {
  return (
    <Typography
      fontSize={{ xs: 11.5, md: 12 }}
      fontWeight={850}
      color="text.secondary"
      sx={{ px: { xs: 0.5, md: 1 }, ...sx }}
      noWrap
    >
      {children}
    </Typography>
  );
}

function ServiceCell({ label }: { label: string }) {
  return (
    <Stack direction="row" spacing={{ xs: 0.55, md: 1 }} alignItems="center" sx={{ px: { xs: 0.45, md: 1 }, minWidth: 0 }}>
      <Box
        sx={{
          width: { xs: 22, md: 26 },
          height: { xs: 22, md: 26 },
          borderRadius: 1.25,
          display: "grid",
          placeItems: "center",
          backgroundColor: "#f8fafc",
          border: "1px solid",
          borderColor: "#dbeafe",
          fontSize: { xs: 13, md: 15 },
          flexShrink: 0,
        }}
      >
        {serviceIcon(label)}
      </Box>
      <Typography fontSize={{ xs: 12.5, md: 13.5 }} fontWeight={800} noWrap>
        {label}
      </Typography>
    </Stack>
  );
}

function NameCell({
  name,
  residentId,
  issues,
  onOpenResident,
}: {
  name: string;
  residentId?: string;
  issues: ScheduleIssue[];
  onOpenResident: (name: string, residentId?: string) => void;
}) {
  const hasCritical = issues.some((issue) => issue.severity === "critical");
  const hasWarning = issues.some((issue) => issue.severity === "warning");
  const clickable = Boolean(name && name !== "—" && residentId);

  return (
    <Stack direction="row" spacing={0.35} alignItems="center" sx={{ px: { xs: 0.45, md: 1 }, minWidth: 0 }}>
      <Button
        variant="text"
        disabled={!clickable}
        onClick={() => onOpenResident(name, residentId)}
        sx={{
          p: 0,
          minWidth: 0,
          maxWidth: "100%",
          textTransform: "none",
          fontSize: { xs: 12.5, md: 13.5 },
          fontWeight: name && name !== "—" ? 800 : 500,
          fontStyle: name && name !== "—" ? "normal" : "italic",
          color: name && name !== "—" ? "#0f172a" : "text.secondary",
          justifyContent: "flex-start",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          "&.Mui-disabled": {
            color: name && name !== "—" ? "#0f172a" : "text.secondary",
          },
          "&:hover": {
            backgroundColor: "transparent",
            textDecoration: clickable ? "underline" : "none",
          },
        }}
      >
        {name || "Unassigned"}
      </Button>

      {hasCritical && (
        <Chip label="Issue" size="small" sx={{ height: 17, fontSize: 9.5, fontWeight: 900, color: "#be123c", backgroundColor: "#ffe4e6" }} />
      )}

      {!hasCritical && hasWarning && (
        <Chip label="Warn" size="small" sx={{ height: 17, fontSize: 9.5, fontWeight: 900, color: "#b45309", backgroundColor: "#fef3c7" }} />
      )}
    </Stack>
  );
}

function TimeBadge({ time }: { time: string }) {
  const night = time.includes("7p") || time.includes("8a");
  return (
    <Chip
      label={`${night ? "🌙" : "☀️"} ${time}`}
      size="small"
      sx={{
        width: "fit-content",
        maxWidth: "100%",
        fontWeight: 850,
        fontSize: { xs: 11, md: 12 },
        height: { xs: 22, md: 24 },
        color: night ? "#2563eb" : "#b45309",
        borderColor: night ? "#bfdbfe" : "#fde68a",
        backgroundColor: night ? "#eff6ff" : "#fffbeb",
        "& .MuiChip-label": {
          px: { xs: 0.7, md: 1 },
        },
      }}
      variant="outlined"
    />
  );
}

function LevelBadge({ level }: { level: string }) {
  const style = getLevelStyle(level);
  return (
    <Chip
      label={level}
      size="small"
      sx={{
        width: "fit-content",
        fontWeight: 900,
        fontSize: 11,
        height: 22,
        color: style.color,
        backgroundColor: style.bg,
        border: "1px solid",
        borderColor: style.border,
      }}
    />
  );
}

function PagerCell({ pager }: { pager: string }) {
  return (
    <Typography
      component={pager ? "a" : "span"}
      href={pager ? `tel:${pager}` : undefined}
      fontSize={{ xs: 11.5, md: 13 }}
      fontWeight={800}
      sx={{
        px: { xs: 0.35, md: 1 },
        color: pager ? "#2563eb" : "text.secondary",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      {pager ? `📟 ${pager}` : "—"}
    </Typography>
  );
}