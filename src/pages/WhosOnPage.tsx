import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";

import { useAcademicBlocks } from "../hooks/useAcademicBlocks";
import { useAttendingSchedule } from "../hooks/useAttendingSchedule";
import { useBlockAssignments } from "../hooks/useBlockAssignments";
import { useMonthlySchedule } from "../hooks/useMonthlySchedule";
import { useResidents } from "../hooks/useResidents";
import type { AttendingScheduleAssignment } from "../types/attendingSchedule";
import type { MonthlyScheduleCell } from "../types/monthSchedule";
import type { ScheduleService } from "../types/schedule";
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

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function makeScheduleServiceFromRow(
  row: (typeof residentCallRows)[number]
): ScheduleService {
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

export default function WhosOnPage() {
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

  const residentsById = useMemo(() => {
    const map: Record<string, (typeof residents)[number]> = {};
    for (const resident of residents) map[resident.id] = resident;
    return map;
  }, [residents]);

  const currentBlock = useMemo(() => {
    return blocks.find(
      (block) => selectedDateKey >= block.startDate && selectedDateKey <= block.endDate
    );
  }, [blocks, selectedDateKey]);

  const monthlyAssignments = schedule?.assignments || {};

  const residentCallServices = useMemo(
    () => residentCallRows.map(makeScheduleServiceFromRow),
    []
  );

  const todayIssues = useMemo(() => {
    return detectDailyScheduleIssues({
      date: selectedDateKey,
      services: residentCallServices,
      monthlyAssignments,
      blocks,
      blockAssignments,
      residents,
    });
  }, [
    blockAssignments,
    blocks,
    monthlyAssignments,
    residentCallServices,
    residents,
    selectedDateKey,
  ]);

  const callRows = useMemo(() => {
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

        const rowIssues = todayIssues.filter((issue) => issue.serviceId === service.id);

        return {
          service: row.name,
          time: row.time,
          name: cell?.residentName || "",
          level: cell?.training || row.level,
          pager: cell?.pager || resident?.pager || "",
          issues: rowIssues,
        };
      });
  }, [
    blockAssignments,
    blocks,
    monthlyAssignments,
    residents,
    residentsById,
    selectedDateKey,
    todayIssues,
  ]);

  const assignedCallCount = callRows.filter((row) => row.name).length;

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
        specialty: assignment.serviceName,
        consultant: assignment.attendingName,
        coverage: assignment.coverageNote || `${assignment.coverageStartTime}-${assignment.coverageEndTime}`,
        phone: assignment.phone || "—",
      }));
  }, [attendingAssignments, selectedDateKey]);

  const consultingRows = useMemo(() => {
    return attendingAssignments
      .filter((assignment) => assignment.group === "Specialty")
      .filter((assignment) => isActiveOnDate(assignment, selectedDateKey))
      .sort((a, b) => a.serviceName.localeCompare(b.serviceName))
      .map((assignment) => ({
        specialty: assignment.serviceName,
        consultant: assignment.attendingName,
        coverage: assignment.coverageNote || `${assignment.coverageStartTime}-${assignment.coverageEndTime}`,
        phone: assignment.phone || "—",
      }));
  }, [attendingAssignments, selectedDateKey]);

  const loading =
    monthlyLoading || blocksLoading || blockAssignmentsLoading || attendingLoading;

  const error = monthlyError || blocksError || blockAssignmentsError || attendingError;

  const timeText = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", lg: "center" }}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={850} sx={{ lineHeight: 1 }}>
            Who&apos;s On
          </Typography>
          <Typography color="text.secondary" fontSize={14}>
            See who is on service for the selected date.
          </Typography>
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={0.5}
          sx={{
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
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" onClick={() => setSelectedDate((d) => addDays(d, -1))}>
            <ChevronLeftIcon />
          </Button>

          <TextField
            size="small"
            type="date"
            value={selectedDateKey}
            onChange={(e) => setSelectedDate(fromDateInputValue(e.target.value))}
            sx={{ width: 180 }}
          />

          <Button variant="outlined" onClick={() => setSelectedDate((d) => addDays(d, 1))}>
            <ChevronRightIcon />
          </Button>

          <Button variant="outlined" startIcon={<TodayIcon />} onClick={() => setSelectedDate(new Date())} sx={{ textTransform: "none" }}>
            Today
          </Button>
        </Stack>

        <Chip
          label={`as of ${timeText}`}
          sx={{
            height: 38,
            borderRadius: 2,
            fontWeight: 700,
            backgroundColor: "#f8fafc",
            border: "1px solid",
            borderColor: "divider",
          }}
        />
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && <TodayIssuesPanel issues={todayIssues} />}

      {mode === "call" && !loading && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          Reading monthly schedule <b>{monthId}</b>. Assigned resident call rows found for this date: <b>{assignedCallCount}</b>.
        </Alert>
      )}

      {mode === "all" && currentBlock && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          Showing assignments for <b>{currentBlock.name}</b> on <b>{formatDisplayDate(selectedDate)}</b>.
        </Alert>
      )}

      {mode === "admitting" && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          Showing admitting attending coverage for <b>{formatDisplayDate(selectedDate)}</b>.
        </Alert>
      )}

      {mode === "consulting" && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          Showing consulting service coverage for <b>{formatDisplayDate(selectedDate)}</b>.
        </Alert>
      )}

      <Card sx={{ borderRadius: 3, boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)" }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          {loading ? (
            <Stack alignItems="center" sx={{ py: 5 }}>
              <CircularProgress />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                Loading Who&apos;s On...
              </Typography>
            </Stack>
          ) : mode === "call" ? (
            <ResidentCallsTable rows={callRows} />
          ) : mode === "all" ? (
            <AllServicesTable rows={allServiceRows} />
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

function TodayIssuesPanel({ issues }: { issues: ScheduleIssue[] }) {
  const critical = issues.filter((issue) => issue.severity === "critical");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const info = issues.filter((issue) => issue.severity === "info");

  if (issues.length === 0) {
    return (
      <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
        No resident call conflicts detected for this date.
      </Alert>
    );
  }

  return (
    <Card sx={{ mb: 2, borderRadius: 3 }}>
      <CardContent sx={{ p: 1.5 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          justifyContent="space-between"
          sx={{ mb: 1 }}
        >
          <Box>
            <Typography fontWeight={900}>Today&apos;s Issues</Typography>
            <Typography color="text.secondary" fontSize={12.5}>
              These are warnings only. They do not block the schedule.
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <IssueCountChip label="Critical" count={critical.length} severity="critical" />
            <IssueCountChip label="Warning" count={warnings.length} severity="warning" />
            <IssueCountChip label="Info" count={info.length} severity="info" />
          </Stack>
        </Stack>

        <Stack spacing={0.6}>
          {issues.slice(0, 5).map((issue) => {
            const style = issueSeverityStyle(issue.severity);

            return (
              <Box
                key={issue.id}
                sx={{
                  p: 0.75,
                  borderRadius: 2,
                  backgroundColor: style.bg,
                  border: "1px solid",
                  borderColor: style.border,
                }}
              >
                <Typography fontSize={12.5} fontWeight={900} sx={{ color: style.color }}>
                  {issue.title}
                </Typography>
                <Typography fontSize={12} color="text.secondary">
                  {issue.message}
                </Typography>
              </Box>
            );
          })}

          {issues.length > 5 && (
            <Typography fontSize={12} color="text.secondary">
              + {issues.length - 5} more issue{issues.length - 5 === 1 ? "" : "s"}.
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function IssueCountChip({
  label,
  count,
  severity,
}: {
  label: string;
  count: number;
  severity: "critical" | "warning" | "info";
}) {
  const style = issueSeverityStyle(severity);

  return (
    <Chip
      label={`${label}: ${count}`}
      size="small"
      sx={{
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
}: {
  rows: {
    service: string;
    time: string;
    name: string;
    level: string;
    pager: string;
    issues: ScheduleIssue[];
  }[];
}) {
  return (
    <TableShell columns="minmax(170px, 1.1fr) 110px minmax(180px, 1.4fr) 110px 110px">
      <HeaderRow columns="minmax(170px, 1.1fr) 110px minmax(180px, 1.4fr) 110px 110px">
        <HeaderCell>Service</HeaderCell>
        <HeaderCell>Time</HeaderCell>
        <HeaderCell>Resident</HeaderCell>
        <HeaderCell>Level</HeaderCell>
        <HeaderCell>Pager</HeaderCell>
      </HeaderRow>

      {rows.map((row, index) => (
        <DataRow key={`${row.service}-${index}`} columns="minmax(170px, 1.1fr) 110px minmax(180px, 1.4fr) 110px 110px" index={index}>
          <ServiceCell label={row.service} />
          <TimeBadge time={row.time} />
          <NameCell name={row.name} issues={row.issues} />
          <LevelBadge level={row.level} />
          <PagerCell pager={row.pager} />
        </DataRow>
      ))}
    </TableShell>
  );
}

function AllServicesTable({
  rows,
}: {
  rows: { service: string; name: string; level: string }[];
}) {
  return (
    <TableShell columns="minmax(190px, 1fr) minmax(220px, 1.3fr) 110px">
      <HeaderRow columns="minmax(190px, 1fr) minmax(220px, 1.3fr) 110px">
        <HeaderCell>Service</HeaderCell>
        <HeaderCell>Resident</HeaderCell>
        <HeaderCell>Level</HeaderCell>
      </HeaderRow>

      {rows.map((row, index) => (
        <DataRow key={`${row.service}-${row.name}-${index}`} columns="minmax(190px, 1fr) minmax(220px, 1.3fr) 110px" index={index}>
          <ServiceCell label={row.service} />
          <NameCell name={row.name} issues={[]} />
          <LevelBadge level={row.level} />
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
    <TableShell columns="minmax(220px, 1.3fr) minmax(180px, 1.1fr) 130px minmax(160px, 1fr)">
      <HeaderRow columns="minmax(220px, 1.3fr) minmax(180px, 1.1fr) 130px minmax(160px, 1fr)">
        <HeaderCell>Specialty / Service</HeaderCell>
        <HeaderCell>Consultant</HeaderCell>
        <HeaderCell>Coverage</HeaderCell>
        <HeaderCell>Phone Number</HeaderCell>
      </HeaderRow>

      {rows.map((row, index) => (
        <DataRow key={`${row.specialty}-${index}`} columns="minmax(220px, 1.3fr) minmax(180px, 1.1fr) 130px minmax(160px, 1fr)" index={index}>
          <ServiceCell label={row.specialty} />
          <NameCell name={row.consultant} issues={[]} />
          <Chip label={row.coverage} size="small" sx={{ width: "fit-content", fontWeight: 800, ...coverageBadgeColor(row.coverage) }} />
          <Typography fontSize={13} fontWeight={700} sx={{ color: row.phone === "—" ? "text.secondary" : "#2563eb" }}>
            ☎ {row.phone}
          </Typography>
        </DataRow>
      ))}

      {rows.length === 0 && <Typography color="text.secondary" sx={{ p: 2 }}>{emptyMessage}</Typography>}
    </TableShell>
  );
}

function TableShell({ children, columns }: { children: React.ReactNode; columns: string }) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ minWidth: 720, "& > .table-row": { display: "grid", gridTemplateColumns: columns, alignItems: "center" } }}>
        {children}
      </Box>
    </Box>
  );
}

function HeaderRow({ children, columns }: { children: React.ReactNode; columns: string }) {
  return (
    <Box className="table-row" sx={{ display: "grid", gridTemplateColumns: columns, borderBottom: "1px solid", borderColor: "divider", pb: 1 }}>
      {children}
    </Box>
  );
}

function DataRow({ children, columns, index }: { children: React.ReactNode; columns: string; index: number }) {
  return (
    <Box
      className="table-row"
      sx={{
        display: "grid",
        gridTemplateColumns: columns,
        alignItems: "center",
        px: 1,
        py: 0.75,
        minHeight: 42,
        borderBottom: "1px solid",
        borderColor: "#eef2f7",
        backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8fafc",
      }}
    >
      {children}
    </Box>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return <Typography fontSize={12} fontWeight={800} color="text.secondary" sx={{ px: 1 }}>{children}</Typography>;
}

function ServiceCell({ label }: { label: string }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 1 }}>
      <Box sx={{ width: 26, height: 26, borderRadius: 1.25, display: "grid", placeItems: "center", backgroundColor: "#f8fafc", border: "1px solid", borderColor: "#dbeafe", fontSize: 15 }}>
        {serviceIcon(label)}
      </Box>
      <Typography fontSize={13.5} fontWeight={650}>{label}</Typography>
    </Stack>
  );
}

function NameCell({ name, issues }: { name: string; issues: ScheduleIssue[] }) {
  const hasCritical = issues.some((issue) => issue.severity === "critical");
  const hasWarning = issues.some((issue) => issue.severity === "warning");

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ px: 1 }}>
      <Typography fontSize={13.5} fontWeight={name && name !== "—" ? 650 : 500} fontStyle={name && name !== "—" ? "normal" : "italic"} color={name && name !== "—" ? "text.primary" : "text.secondary"}>
        {name || "Unassigned"}
      </Typography>

      {hasCritical && (
        <Chip
          label="Issue"
          size="small"
          sx={{
            height: 18,
            fontSize: 10,
            fontWeight: 900,
            color: "#be123c",
            backgroundColor: "#ffe4e6",
          }}
        />
      )}

      {!hasCritical && hasWarning && (
        <Chip
          label="Warning"
          size="small"
          sx={{
            height: 18,
            fontSize: 10,
            fontWeight: 900,
            color: "#b45309",
            backgroundColor: "#fef3c7",
          }}
        />
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
        fontWeight: 800,
        fontSize: 12,
        color: night ? "#2563eb" : "#b45309",
        borderColor: night ? "#bfdbfe" : "#fde68a",
        backgroundColor: night ? "#eff6ff" : "#fffbeb",
      }}
      variant="outlined"
    />
  );
}

function LevelBadge({ level }: { level: string }) {
  const style = getLevelStyle(level);
  return <Chip label={level} size="small" sx={{ width: "fit-content", fontWeight: 900, fontSize: 11, color: style.color, backgroundColor: style.bg, border: "1px solid", borderColor: style.border }} />;
}

function PagerCell({ pager }: { pager: string }) {
  return (
    <Typography component={pager ? "a" : "span"} href={pager ? `tel:${pager}` : undefined} fontSize={13.5} fontWeight={800} sx={{ px: 1, color: pager ? "#2563eb" : "text.secondary", textDecoration: "none" }}>
      {pager ? `📟 ${pager}` : "—"}
    </Typography>
  );
}