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
  Tab,
  Tabs,
  Typography,
} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";

import { getResidentCallServicesForDate } from "../config/scheduleServices";
import { useAuth } from "../context/AuthContext";
import { useAcademicBlocks } from "../hooks/useAcademicBlocks";
import { useBlockAssignments } from "../hooks/useBlockAssignments";
import { useMonthlySchedule } from "../hooks/useMonthlySchedule";
import { useResidents } from "../hooks/useResidents";
import {
  getDraftAssignmentsForYear,
  getLatestPublishedAssignmentsForYear,
} from "../services/blockAssignmentService";
import type { MonthlyScheduleCell } from "../types/monthSchedule";
import {
  getAutoNightFloatCell,
  parseLocalDate,
} from "../utils/nightFloatSchedule";
import { canBuildSchedule } from "../utils/permissions";

type ProfileTab = "calendar" | "blocks";

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthId(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(value: string, count: number) {
  const [year, month] = value.split("-").map(Number);
  return monthId(new Date(year, month - 1 + count, 1));
}

function monthName(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function calendarDays(value: string) {
  const [year, month] = value.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return toDateInputValue(date);
  });
}

function shortDate(date: string) {
  const parsed = parseLocalDate(date);
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

function rotationColor(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("vacation")) return { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
  if (lower.includes("nf") || lower.includes("night")) return { bg: "#eef2ff", color: "#4338ca", border: "#c7d2fe" };
  if (lower.includes("micu")) return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
  if (lower.includes("elective")) return { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" };
  if (lower.includes("jeopardy")) return { bg: "#fefce8", color: "#a16207", border: "#fde68a" };
  return { bg: "#ecfdf5", color: "#15803d", border: "#bbf7d0" };
}

function downloadCsv(filename: string, rows: Record<string, string>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map((header) => `"${header}"`).join(","),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] || "").replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ResidentScheduleProfilePage({
  residentId,
  onBack,
}: {
  residentId: string;
  onBack: () => void;
}) {
  const { profile } = useAuth();
  const allowBuild = canBuildSchedule(profile?.role);
  const [tab, setTab] = useState<ProfileTab>("calendar");
  const [selectedMonth, setSelectedMonth] = useState(monthId());

  const { residents, loading: residentsLoading, error: residentsError } = useResidents();
  const { blocks, loading: blocksLoading, error: blocksError } = useAcademicBlocks();
  const { assignments: allBlockAssignments, loading: assignmentLoading, error: assignmentError } = useBlockAssignments();
  const { schedule, loading: scheduleLoading, error: scheduleError } = useMonthlySchedule(selectedMonth);

  const resident = residents.find((item) => item.id === residentId);
  const days = useMemo(() => calendarDays(selectedMonth), [selectedMonth]);

  const relevantYears = useMemo(
    () => Array.from(new Set(blocks.map((block) => block.academicYear))),
    [blocks]
  );

  const blockAssignments = useMemo(
    () =>
      relevantYears.flatMap((year) =>
        allowBuild
          ? getDraftAssignmentsForYear(allBlockAssignments, year)
          : getLatestPublishedAssignmentsForYear(allBlockAssignments, year)
      ),
    [allBlockAssignments, allowBuild, relevantYears]
  );

  const residentCalls = useMemo(() => {
    if (!resident) return [];
    const manual = Object.values(schedule?.assignments || {}).filter(
      (cell) => cell.residentId === resident.id
    );
    const auto = days
      .flatMap((date) =>
        getResidentCallServicesForDate(date).map((service) =>
          getAutoNightFloatCell({
            date,
            service,
            blocks,
            blockAssignments,
            residents,
          })
        )
      )
      .filter(Boolean) as MonthlyScheduleCell[];

    const combined = [...manual];
    for (const cell of auto) {
      if (cell.residentId !== resident.id) continue;
      if (!combined.some((item) => item.date === cell.date && item.serviceId === cell.serviceId)) {
        combined.push(cell);
      }
    }
    return combined;
  }, [blockAssignments, blocks, days, resident, residents, schedule?.assignments]);

  const blockRows = useMemo(() => {
    if (!resident) return [];
    return blocks
      .slice()
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((block) => {
        const assignment = blockAssignments.find(
          (item) => item.blockId === block.id && item.residentId === resident.id
        );
        const activeChief = allowBuild
          ? block.activeChiefDraft || block.activeChiefPublished || null
          : block.activeChiefPublished || null;

        return {
          block: block.name,
          startDate: block.startDate,
          endDate: block.endDate,
          rotation: assignment?.rotationName || "Unassigned",
          notes: assignment?.notes || assignment?.overrideReason || "",
          activeChief:
            activeChief?.residentId === resident.id ? "Yes" : "",
        };
      });
  }, [blockAssignments, blocks, resident]);

  const blockSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of blockRows) {
      if (row.rotation === "Unassigned") continue;
      counts[row.rotation] = (counts[row.rotation] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [blockRows]);

  const loading = residentsLoading || blocksLoading || assignmentLoading || scheduleLoading;
  const error = residentsError || blocksError || assignmentError || scheduleError;

  if (loading) {
    return <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /><Typography color="text.secondary" sx={{ mt: 1 }}>Loading resident profile...</Typography></Stack>;
  }

  if (!resident) {
    return <Box><Button startIcon={<ArrowBackIcon />} onClick={onBack}>Back</Button><Alert severity="error" sx={{ mt: 1 }}>Resident not found.</Alert></Box>;
  }

  function rotationForDate(date: string) {
    const block = blocks.find((item) => date >= item.startDate && date <= item.endDate);
    if (!block) return "";
    return blockAssignments.find((item) => item.blockId === block.id && item.residentId === residentId)?.rotationName || "";
  }

  function callsForDate(date: string) {
    return residentCalls.filter((cell) => cell.date === date);
  }

  return (
    <Box sx={{ width: "100%", maxWidth: "none" }}>
      <Box className="no-print"><Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 1 }}>Back</Button>{error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}</Box>

      <Card sx={{ borderRadius: 3, mb: 1.5 }}>
        <CardContent sx={{ p: 1.5 }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
            <Box><Typography variant="h4" fontWeight={900} sx={{ fontSize: { xs: 24, md: 34 } }}>{resident.displayName}</Typography><Typography color="text.secondary" fontWeight={700}>{resident.pgy} Resident</Typography><Typography color="text.secondary" fontSize={13}>{allowBuild ? "Draft block view" : "Published block view"}</Typography></Box>
            <Stack direction="row" spacing={0.75} className="no-print"><Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>Print/PDF</Button><Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => tab === "blocks" ? downloadCsv(`${resident.displayName}-blocks.csv`, blockRows) : downloadCsv(`${resident.displayName}-${selectedMonth}.csv`, days.filter((date) => date.startsWith(selectedMonth)).map((date) => ({ Date: date, Rotation: rotationForDate(date), Calls: callsForDate(date).map((cell) => cell.serviceName).join("; ") })))}>CSV</Button></Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 1.5 }} className="no-print"><CardContent sx={{ p: 0.5 }}><Tabs value={tab} onChange={(_, value: ProfileTab) => setTab(value)}><Tab label="Monthly Calendar" value="calendar" /><Tab label="Academic Blocks" value="blocks" /></Tabs></CardContent></Card>

      {tab === "calendar" ? (
        <Card sx={{ borderRadius: 3 }}><CardContent sx={{ p: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }} className="no-print"><Button variant="outlined" onClick={() => setSelectedMonth(addMonths(selectedMonth, -1))}><ChevronLeftIcon /></Button><Box sx={{ flex: 1, height: 38, display: "grid", placeItems: "center", border: "1px solid", borderColor: "divider", borderRadius: 2, fontWeight: 900 }}>{monthName(selectedMonth)}</Box><Button variant="outlined" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}><ChevronRightIcon /></Button></Stack>
          <Box sx={{ overflowX: "auto" }} className="print-area"><Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(88px,1fr))", minWidth: 616, border: "1px solid", borderColor: "divider" }}>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <Box key={day} sx={{ p: 0.6, backgroundColor: "#e2e8f0", borderRight: "1px solid", borderBottom: "1px solid", borderColor: "divider", textAlign: "center", fontWeight: 900 }}>{day}</Box>)}{days.map((date) => { const rotation = rotationForDate(date); const calls = callsForDate(date); const dimmed = !date.startsWith(selectedMonth); const style = rotationColor(rotation || ""); return <Box key={date} sx={{ minHeight: 78, p: 0.5, borderRight: "1px solid", borderBottom: "1px solid", borderColor: "divider", opacity: dimmed ? 0.45 : 1, backgroundColor: dimmed ? "#f8fafc" : "white" }}><Typography fontWeight={900} fontSize={11}>{parseLocalDate(date).getDate()}</Typography>{rotation && <Box sx={{ mt: 0.3, px: 0.4, borderRadius: 0.75, backgroundColor: style.bg, color: style.color, border: `1px solid ${style.border}`, fontSize: 10, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rotation}</Box>}<Stack spacing={0.2} sx={{ mt: 0.25 }}>{calls.slice(0,2).map((call) => <Box key={`${call.date}-${call.serviceId}`} sx={{ px: 0.4, borderRadius: 0.75, backgroundColor: "#fff1f2", color: "#be123c", fontSize: 9.5, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{call.serviceName}</Box>)}</Stack></Box>; })}</Box></Box>
        </CardContent></Card>
      ) : (
        <Card sx={{ borderRadius: 3 }}><CardContent sx={{ p: 1 }}><Box className="print-area" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(3,1fr)", md: "repeat(5,1fr)" }, gap: 0.75 }}>{blockRows.map((row) => { const style = rotationColor(row.rotation); return <Box key={`${row.block}-${row.startDate}`} sx={{ minHeight: 90, p: 0.8, borderRadius: 2, backgroundColor: style.bg, border: `1px solid ${style.border}` }}><Typography fontWeight={950} sx={{ color: style.color }}>{row.block.replace("Block ", "B")}</Typography><Typography fontSize={10.5} color="text.secondary">{shortDate(row.startDate)} to {shortDate(row.endDate)}</Typography><Typography fontWeight={900} fontSize={12.5} sx={{ color: style.color, mt: 0.4 }}>{row.rotation}</Typography>{row.activeChief && <Chip label="Active Chief" size="small" sx={{ mt: 0.5, height: 20, fontSize: 9.5, fontWeight: 900, color: "#c2410c", backgroundColor: "#fff7ed", border: "1px solid #fed7aa" }} />}{row.notes && <Typography fontSize={10} color="text.secondary" noWrap>{row.notes}</Typography>}</Box>; })}</Box><Typography fontWeight={900} sx={{ mt: 2, mb: 1 }}>Block Summary</Typography><Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>{blockSummary.map(([rotation, count]) => { const style = rotationColor(rotation); return <Chip key={rotation} label={`${rotation}: ${count}`} size="small" sx={{ color: style.color, backgroundColor: style.bg, border: `1px solid ${style.border}` }} />; })}</Stack></CardContent></Card>
      )}
      <style>{`@media print {.no-print,.MuiAppBar-root,.MuiDrawer-root{display:none!important}.print-area{overflow:visible!important}main{padding:0!important}}`}</style>
    </Box>
  );
}
