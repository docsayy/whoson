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
import PhoneIcon from "@mui/icons-material/Phone";

import {
  getResidentCallServicesForDate,
  getServiceTimingForDate,
  normalizeScheduleText,
} from "../config/scheduleServices";
import { useAuth } from "../context/AuthContext";
import { useAcademicBlocks } from "../hooks/useAcademicBlocks";
import { useAttendingSchedule } from "../hooks/useAttendingSchedule";
import { useAttendings } from "../hooks/useAttendings";
import { useBlockAssignments } from "../hooks/useBlockAssignments";
import { useMonthlySchedule } from "../hooks/useMonthlySchedule";
import { useResidents } from "../hooks/useResidents";
import {
  getDraftAssignmentsForYear,
  getLatestPublishedAssignmentsForYear,
} from "../services/blockAssignmentService";
import type { ScheduleService } from "../types/schedule";
import { getHospitalHoliday, isHospitalHoliday } from "../utils/holidayRules";
import {
  getAutoNightFloatCell,
  isNightFloatService,
} from "../utils/nightFloatSchedule";
import { canBuildSchedule } from "../utils/permissions";
import { birthdayName, isBirthdayOnDate } from "../utils/birthday";
import {
  detectDailyScheduleIssues,
  issueSeverityStyle,
  type ScheduleIssue,
} from "../utils/schedulingIntelligence";
import {
  attendingDisplayValues,
  canonicalAttendingServiceLabel,
  getEffectiveAttendingAssignments,
} from "../utils/attendingScheduleCanonical";
import {
  getConsultServiceProfileId,
  type ConsultServiceProfileId,
} from "../utils/consultServiceProfiles";

type WhosOnMode = "call" | "all" | "admitting" | "consulting";
type ResidentConsultKey =
  | "cardio-ccu"
  | "id-pgy1"
  | "id-senior"
  | "gi"
  | "endo-rheum-nephro"
  | "pulm"
  | "hem-onc"
  | "neuro";

const residentConsultRows: Array<{
  key: ResidentConsultKey;
  name: string;
  time: string;
  level: string;
}> = [
  { key: "cardio-ccu", name: "Cardio/CCU", time: "7a-4p", level: "PGY-2; PGY-3 override" },
  { key: "id-pgy1", name: "ID PGY1", time: "7a-4p", level: "PGY-1" },
  { key: "id-senior", name: "ID Senior", time: "7a-4p", level: "PGY-2, PGY-3" },
  { key: "gi", name: "GI", time: "7a-4p", level: "PGY-2" },
  { key: "endo-rheum-nephro", name: "Endo/Rheum/Nephro", time: "7a-4p", level: "PGY-3" },
  { key: "pulm", name: "Pulm", time: "7a-4p", level: "PGY-2, PGY-3" },
  { key: "hem-onc", name: "Heme-Onc", time: "7a-4p", level: "PGY-3" },
  { key: "neuro", name: "Neuro", time: "7a-4p", level: "PGY-2" },
];

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

function isWeekday(date: string) {
  const day = fromDateInputValue(date).getDay();
  return day >= 1 && day <= 5;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getConsultKey(rotationId: string, residentPgy: string): ResidentConsultKey | null {
  const id = normalize(rotationId);
  if (id === "id") return residentPgy === "PGY-1" ? "id-pgy1" : "id-senior";
  if (id === "ccucardio" || id === "cardio" || id === "cardiology") return "cardio-ccu";
  if (id === "gi") return "gi";
  if (id === "nephrorheumendo" || id === "endorheumnephro") return "endo-rheum-nephro";
  if (id === "pulm") return "pulm";
  if (id === "hemeonc") return "hem-onc";
  if (id === "neuro") return "neuro";
  return null;
}

function serviceIcon(service: string) {
  const lower = service.toLowerCase();
  if (lower.includes("short duty")) return "⏱️";
  if (lower.includes("chief") || lower.includes("pgy3 nf")) return "👑";
  if (lower.includes("nf")) return "🌙";
  if (lower.includes("micu") || lower.includes("pulm")) return "🫁";
  if (lower.includes("ccu") || lower.includes("card")) return "🫀";
  if (lower.includes("tele")) return "🖥️";
  if (lower.includes("neuro")) return "🧠";
  if (lower.includes("gi")) return "🍽️";
  if (lower.includes("heme")) return "🩸";
  if (lower.includes("id")) return "🦠";
  return "🏥";
}

export default function WhosOnPage({
  onOpenResidentProfile,
  onOpenAttendingProfile,
  onOpenConsultServiceProfile,
}: {
  onOpenResidentProfile?: (residentId: string) => void;
  onOpenAttendingProfile?: (attendingId: string) => void;
  onOpenConsultServiceProfile?: (serviceId: ConsultServiceProfileId) => void;
}) {
  const { profile } = useAuth();
  const allowBuild = canBuildSchedule(profile?.role);
  const [mode, setMode] = useState<WhosOnMode>("call");
  const [selectedDate, setSelectedDate] = useState(new Date());

  const dateKey = toDateInputValue(selectedDate);
  const monthId = dateKey.slice(0, 7);
  const holiday = getHospitalHoliday(dateKey);

  const { residents } = useResidents();
  const { blocks, loading: blocksLoading, error: blocksError } = useAcademicBlocks();
  const { assignments: allBlockAssignments, loading: assignmentLoading, error: assignmentError } = useBlockAssignments();
  const { schedule, loading: monthlyLoading, error: monthlyError } = useMonthlySchedule(monthId);
  const { assignments: attendingAssignments, loading: attendingLoading, error: attendingError } = useAttendingSchedule();
  const { attendings, loading: attendingsLoading, error: attendingsError } = useAttendings();

  const currentBlock = useMemo(
    () => blocks.find((block) => dateKey >= block.startDate && dateKey <= block.endDate),
    [blocks, dateKey]
  );

  const activeChief = useMemo(() => {
    if (!currentBlock) return null;
    return allowBuild
      ? currentBlock.activeChiefDraft || currentBlock.activeChiefPublished || null
      : currentBlock.activeChiefPublished || null;
  }, [allowBuild, currentBlock]);

  const blockAssignments = useMemo(() => {
    if (!currentBlock) return [];
    return allowBuild
      ? getDraftAssignmentsForYear(allBlockAssignments, currentBlock.academicYear)
      : getLatestPublishedAssignmentsForYear(allBlockAssignments, currentBlock.academicYear);
  }, [allBlockAssignments, allowBuild, currentBlock]);

  const residentById = useMemo(
    () => new Map(residents.map((resident) => [resident.id, resident])),
    [residents]
  );
  const activeChiefDisplay = useMemo(() => {
    if (!activeChief) return null;
    const currentResident = residentById.get(activeChief.residentId);
    return {
      residentId: currentResident?.id || activeChief.residentId,
      residentName: currentResident?.displayName || activeChief.residentName,
      birthday: isBirthdayOnDate(currentResident, dateKey),
    };
  }, [activeChief, residentById]);

  const monthlyAssignments = schedule?.assignments || {};
  const callPublished = schedule?.status === "published";
  const canViewCalls = allowBuild || callPublished;

  const issues = useMemo(
    () =>
      allowBuild
        ? detectDailyScheduleIssues({
            date: dateKey,
            services: getResidentCallServicesForDate(dateKey),
            monthlyAssignments,
            blocks,
            blockAssignments,
            residents,
          })
        : [],
    [allowBuild, blockAssignments, blocks, dateKey, monthlyAssignments, residents]
  );

  function manualCell(date: string, service: ScheduleService) {
    const direct = monthlyAssignments[`${date}_${service.id}`];
    if (direct) return direct;
    const candidates = [service.id, service.name, ...((service as any).aliases || [])].map(normalizeScheduleText);
    return Object.values(monthlyAssignments).find(
      (cell) => cell.date === date && candidates.includes(normalizeScheduleText(cell.serviceName))
    );
  }

  const callRows = useMemo(() => {
    if (!canViewCalls) return [];

    return getResidentCallServicesForDate(dateKey).map((service) => {
      const manual = manualCell(dateKey, service);
      const auto =
        !manual && isNightFloatService(service.id)
          ? getAutoNightFloatCell({
              date: dateKey,
              service,
              blocks,
              blockAssignments,
              residents,
            })
          : undefined;
      const cell = manual || auto;
      const timing = getServiceTimingForDate(service, dateKey);

      return {
        service: service.name,
        time: timing.displayTime,
        residentId: cell?.residentId || "",
        name: cell?.residentName || "",
        level: cell?.training || service.requiredTraining?.join(", ") || "",
        pager: cell?.pager || "",
        birthday: cell?.residentId ? isBirthdayOnDate(residentById.get(cell.residentId), dateKey) : false,
        issues: issues.filter((issue) => issue.serviceId === service.id),
      };
    });
  }, [blockAssignments, blocks, canViewCalls, dateKey, issues, monthlyAssignments, residents]);

  const consultRows = useMemo(() => {
    if (!currentBlock || !isWeekday(dateKey) || isHospitalHoliday(dateKey)) return [];
    const byKey = new Map<ResidentConsultKey, (typeof blockAssignments)[number]>();

    for (const assignment of blockAssignments) {
      if (assignment.blockId !== currentBlock.id) continue;
      const resident = residentById.get(assignment.residentId);
      if (!resident?.active) continue;
      const key = getConsultKey(assignment.rotationId, resident.pgy);
      if (key && !byKey.has(key)) byKey.set(key, assignment);
    }

    return residentConsultRows.map((row) => {
      const assignment = byKey.get(row.key);
      const resident = assignment ? residentById.get(assignment.residentId) : undefined;
      return {
        service: row.name,
        time: row.time,
        residentId: assignment?.residentId || "",
        name: assignment?.residentName || "",
        level: resident?.pgy || row.level,
        pager: resident?.pager || "",
        birthday: isBirthdayOnDate(resident, dateKey),
        issues: [] as ScheduleIssue[],
      };
    });
  }, [blockAssignments, currentBlock, dateKey, residentById]);

  const allServices = useMemo(() => {
    if (!currentBlock) return [];
    const byResident = new Map<string, (typeof blockAssignments)[number]>();
    for (const assignment of blockAssignments) {
      if (assignment.blockId !== currentBlock.id) continue;
      const current = byResident.get(assignment.residentId);
      if (!current || current.rotationName.toLowerCase().includes("jeopardy")) {
        byResident.set(assignment.residentId, assignment);
      }
    }
    return Array.from(byResident.values())
      .sort((a, b) => a.residentName.localeCompare(b.residentName))
      .map((assignment) => ({
        service: assignment.rotationName,
        residentId: assignment.residentId,
        name: assignment.residentName,
        level: residentById.get(assignment.residentId)?.pgy || "Resident",
        activeChief: activeChief?.residentId === assignment.residentId,
        birthday: isBirthdayOnDate(residentById.get(assignment.residentId), dateKey),
      }));
  }, [activeChief, blockAssignments, currentBlock, residentById]);

  const admittingRows = useMemo(
    () =>
      getEffectiveAttendingAssignments({
        assignments: attendingAssignments,
        date: dateKey,
        group: "Core",
      }).map(({ key, assignment }) => {
        const display = attendingDisplayValues(assignment, attendings);
        return {
          service: canonicalAttendingServiceLabel(key, assignment.serviceName),
          consultant: display.consultant,
          attendingId: display.attendingId,
          coverage:
            assignment.coverageNote ||
            `${assignment.coverageStartTime}-${assignment.coverageEndTime}`,
          phone: display.phone,
          birthday: isBirthdayOnDate(attendings.find((item) => item.id === display.attendingId), dateKey),
        };
      }),
    [attendingAssignments, attendings, dateKey]
  );

  const consultingRows = useMemo(
    () =>
      getEffectiveAttendingAssignments({
        assignments: attendingAssignments,
        date: dateKey,
        group: "Specialty",
      }).map(({ key, assignment }) => {
        const display = attendingDisplayValues(assignment, attendings);
        return {
          service: canonicalAttendingServiceLabel(key, assignment.serviceName),
          serviceProfileId: getConsultServiceProfileId(assignment),
          consultant: display.consultant,
          attendingId: display.attendingId,
          coverage:
            assignment.coverageNote ||
            `${assignment.coverageStartTime}-${assignment.coverageEndTime}`,
          phone: display.phone,
          birthday: isBirthdayOnDate(attendings.find((item) => item.id === display.attendingId), dateKey),
        };
      }),
    [attendingAssignments, attendings, dateKey]
  );

  const loading = blocksLoading || assignmentLoading || monthlyLoading || attendingLoading || attendingsLoading;
  const error = blocksError || assignmentError || monthlyError || attendingError || attendingsError;


  return (
    <Box sx={{ width: "100%", maxWidth: "none", minWidth: 0 }}>
      <Stack direction={{ xs: "row", md: "row" }} justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} sx={{ fontSize: { xs: 21, md: 25 }, lineHeight: 1.05 }}>Who&apos;s On</Typography>
          <Typography color="text.secondary" fontSize={14} sx={{ display: { xs: "none", md: "block" } }}>Live call, block, admitting, and consultation coverage.</Typography>
        </Box>
        <TextField select size="small" value={mode} onChange={(event) => setMode(event.target.value as WhosOnMode)} sx={{ width: { xs: 175, md: 220 } }}>
          <MenuItem value="call">Resident Calls</MenuItem>
          <MenuItem value="all">All Services</MenuItem>
          <MenuItem value="admitting">Admitting Attendings</MenuItem>
          <MenuItem value="consulting">Consulting Services</MenuItem>
        </TextField>
      </Stack>

      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5 }}>
        <Button variant="outlined" onClick={() => setSelectedDate((date) => addDays(date, -1))} sx={{ minWidth: 42 }}><ChevronLeftIcon /></Button>
        <TextField type="date" size="small" value={dateKey} onChange={(event) => setSelectedDate(fromDateInputValue(event.target.value))} sx={{ flex: 1, maxWidth: 200 }} />
        <Button variant="outlined" onClick={() => setSelectedDate((date) => addDays(date, 1))} sx={{ minWidth: 42 }}><ChevronRightIcon /></Button>
        <Button variant="outlined" startIcon={<TodayIcon />} onClick={() => setSelectedDate(new Date())} sx={{ textTransform: "none" }}>Today</Button>
      </Stack>

      {error && <Alert severity="error" sx={compactAlertSx}>{error}</Alert>}
      {holiday && <Alert severity="warning" sx={compactAlertSx}><b>{holiday.name}</b>: weekend-style hospital coverage. Resident consult services are off.</Alert>}
      {allowBuild && <IssuesPanel issues={issues} />}
      {mode === "call" && !loading && !canViewCalls && <Alert severity="warning" sx={compactAlertSx}>Resident call schedule is still in draft.</Alert>}
      {mode === "all" && currentBlock && <Alert severity="info" sx={compactAlertSx}>Showing {allowBuild ? "draft" : "published"} assignments for <b>{currentBlock.name}</b>.</Alert>}



      <Card sx={{ borderRadius: 3, overflow: "hidden" }}>
        <CardContent sx={{ p: { xs: 0.75, md: 1.5 } }}>
          {loading ? (
            <Stack alignItems="center" sx={{ py: 5 }}><CircularProgress /><Typography color="text.secondary" sx={{ mt: 1 }}>Loading Who&apos;s On...</Typography></Stack>
          ) : mode === "call" && !canViewCalls ? (
            <Typography color="text.secondary" sx={{ p: 2 }}>Call schedule is not published.</Typography>
          ) : mode === "call" ? (
            <Stack spacing={1.5}>
              <Box>
                <Typography fontWeight={900} fontSize={14} sx={{ mb: 0.75 }}>
                  Resident Calls
                </Typography>
                <ResidentTable rows={callRows} showWarnings={allowBuild} onOpenResident={(id) => onOpenResidentProfile?.(id)} />
              </Box>

              {consultRows.length > 0 && (
                <Box>
                  <Typography fontWeight={900} fontSize={14} sx={{ mb: 0.75 }}>
                    Resident Consult Coverage
                  </Typography>
                  <ResidentTable rows={consultRows} showWarnings={allowBuild} onOpenResident={(id) => onOpenResidentProfile?.(id)} />
                </Box>
              )}
            </Stack>
          ) : mode === "all" ? (
            <AllServicesTable rows={allServices} onOpenResident={(id) => onOpenResidentProfile?.(id)} />
          ) : mode === "admitting" ? (
            <AttendingTable rows={admittingRows} onOpenAttending={(id) => onOpenAttendingProfile?.(id)} />
          ) : (
            <AttendingTable rows={consultingRows} onOpenAttending={(id) => onOpenAttendingProfile?.(id)} onOpenService={(id) => id && onOpenConsultServiceProfile?.(id)} />
          )}
        </CardContent>
      </Card>

      {currentBlock && (
        <Card
          sx={{
            mt: 1,
            borderRadius: 2,
            boxShadow: "none",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <CardContent
            sx={{
              py: 0.75,
              px: 1.25,
              "&:last-child": { pb: 0.75 },
            }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "220px 1fr" },
                alignItems: "center",
                gap: { xs: 0.25, sm: 1 },
              }}
            >
              <Typography
                fontSize={12}
                fontWeight={900}
                color="text.secondary"
              >
                Active Chief · {currentBlock.name}
              </Typography>
              <Button
                variant="text"
                disabled={!activeChiefDisplay?.residentId}
                onClick={() =>
                  activeChiefDisplay?.residentId &&
                  onOpenResidentProfile?.(activeChiefDisplay.residentId)
                }
                sx={{
                  p: 0,
                  minWidth: 0,
                  justifyContent: { xs: "flex-start", sm: "flex-start" },
                  textTransform: "none",
                  color: activeChiefDisplay ? "#0f172a" : "text.secondary",
                  fontWeight: 850,
                  fontSize: 13,
                }}
              >
                {activeChiefDisplay?.residentName || "Not assigned"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

function ResidentTable({ rows, onOpenResident, showWarnings }: {
  rows: Array<{ service: string; time: string; residentId: string; name: string; level: string; pager: string; birthday?: boolean; issues: ScheduleIssue[] }>;
  onOpenResident: (residentId: string) => void;
  showWarnings: boolean;
}) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ minWidth: 680 }}>
        <Row header columns="1.25fr .7fr 1.25fr .85fr .75fr"><Cell>Service</Cell><Cell>Time</Cell><Cell>Resident</Cell><Cell>Level</Cell><Cell>Pager</Cell></Row>
        {rows.map((row, index) => {
          const critical = showWarnings && row.issues.some((issue) => issue.severity === "critical");
          const warning = showWarnings && row.issues.some((issue) => issue.severity === "warning");
          return (
            <Row key={`${row.service}-${index}`} columns="1.25fr .7fr 1.25fr .85fr .75fr" index={index}>
              <Cell><Stack direction="row" spacing={0.6} alignItems="center"><Typography>{serviceIcon(row.service)}</Typography><Typography fontSize={13} fontWeight={850}>{row.service}</Typography></Stack></Cell>
              <Cell><Chip label={row.time} size="small" sx={{ height: 22, fontSize: 11 }} /></Cell>
              <Cell><Button disabled={!row.residentId} onClick={() => onOpenResident(row.residentId)} sx={{ p: 0, minWidth: 0, textTransform: "none", color: row.name ? "#0f172a" : "text.secondary", fontWeight: 800 }}>{birthdayName(row.name || "Unassigned", Boolean(row.birthday && row.name))}</Button>{critical && <Chip label="Issue" size="small" sx={{ ml: 0.5, height: 17, fontSize: 9, color: "#be123c" }} />}{!critical && warning && <Chip label="Warn" size="small" sx={{ ml: 0.5, height: 17, fontSize: 9, color: "#b45309" }} />}</Cell>
              <Cell><Typography fontSize={12}>{row.level}</Typography></Cell>
              <Cell><Typography component={row.pager ? "a" : "span"} href={row.pager ? `tel:${row.pager}` : undefined} fontSize={12} fontWeight={800} sx={{ color: row.pager ? "#2563eb" : "text.secondary", textDecoration: "none" }}>{row.pager || "—"}</Typography></Cell>
            </Row>
          );
        })}
      </Box>
    </Box>
  );
}

function AllServicesTable({ rows, onOpenResident }: {
  rows: Array<{ service: string; residentId: string; name: string; level: string; activeChief?: boolean; birthday?: boolean }>;
  onOpenResident: (residentId: string) => void;
}) {
  return <Box>{rows.map((row, index) => <Row key={`${row.residentId}-${index}`} columns="1.3fr 1.3fr .7fr" index={index}><Cell><Typography fontWeight={850}>{row.service}</Typography></Cell><Cell><Stack direction="row" spacing={0.5} alignItems="center"><Button onClick={() => onOpenResident(row.residentId)} sx={{ p: 0, textTransform: "none", color: "#0f172a", fontWeight: 800 }}>{birthdayName(row.name, Boolean(row.birthday))}</Button>{row.activeChief && <Chip label="Active Chief" size="small" sx={{ height: 19, fontSize: 9.5, fontWeight: 900, color: "#c2410c", backgroundColor: "#fff7ed", border: "1px solid #fed7aa" }} />}</Stack></Cell><Cell>{row.level}</Cell></Row>)}{!rows.length && <Typography color="text.secondary" sx={{ p: 2 }}>No block assignments found.</Typography>}</Box>;
}

function AttendingTable({ rows, onOpenAttending, onOpenService }: {
  rows: Array<{ service: string; serviceProfileId?: ConsultServiceProfileId | null; consultant: string; attendingId: string; coverage: string; phone: string; birthday?: boolean }>;
  onOpenAttending: (id: string) => void;
  onOpenService?: (id: ConsultServiceProfileId | null | undefined) => void;
}) {
  return (
    <Box>
      <Box
        sx={{
          display: { xs: "none", sm: "grid" },
          gridTemplateColumns: "minmax(130px, 1fr) minmax(150px, 1fr) 88px minmax(135px, .9fr)",
          gap: 0.75,
          px: 1,
          py: 0.75,
          backgroundColor: "#e2e8f0",
        }}
      >
        {['Service', 'Attending', 'Coverage', 'Phone'].map((label) => (
          <Typography key={label} fontSize={11.5} fontWeight={850} color="text.secondary">
            {label}
          </Typography>
        ))}
      </Box>

      {rows.map((row, index) => (
        <Box
          key={`${row.service}-${index}`}
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr) auto",
              sm: "minmax(130px, 1fr) minmax(150px, 1fr) 88px minmax(135px, .9fr)",
            },
            gap: { xs: 0.45, sm: 0.75 },
            alignItems: "center",
            px: 1,
            py: 0.8,
            borderBottom: "1px solid #eef2f7",
            backgroundColor: index % 2 ? "#f8fafc" : "white",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {row.serviceProfileId ? (
              <Button
                onClick={() => onOpenService?.(row.serviceProfileId)}
                sx={{
                  p: 0,
                  minWidth: 0,
                  maxWidth: "100%",
                  justifyContent: "flex-start",
                  textTransform: "none",
                  color: "#0f172a",
                  fontWeight: 850,
                  fontSize: 12.5,
                }}
              >
                {row.service}
              </Button>
            ) : (
              <Typography fontSize={12.5} fontWeight={850} color="#0f172a" noWrap>
                {row.service}
              </Typography>
            )}
          </Box>

          <Chip
            label={row.coverage}
            size="small"
            sx={{
              height: 21,
              fontSize: 10.5,
              gridColumn: { xs: 2, sm: 3 },
              gridRow: 1,
            }}
          />

          <Box sx={{ minWidth: 0, gridColumn: { xs: "1 / -1", sm: 2 }, gridRow: { sm: 1 } }}>
            {row.attendingId ? (
              <Button
                onClick={() => onOpenAttending(row.attendingId)}
                sx={{
                  p: 0,
                  minWidth: 0,
                  maxWidth: "100%",
                  justifyContent: "flex-start",
                  textTransform: "none",
                  color: "#0f172a",
                  fontWeight: 800,
                  fontSize: 12.5,
                }}
              >
                {birthdayName(row.consultant || "Unassigned", Boolean(row.birthday && row.consultant))}
              </Button>
            ) : (
              <Typography
                fontSize={12.5}
                fontWeight={row.consultant ? 800 : 500}
                color={row.consultant ? "#0f172a" : "text.secondary"}
              >
                {birthdayName(row.consultant || "Unassigned", Boolean(row.birthday && row.consultant))}
              </Typography>
            )}
          </Box>

          <Stack
            direction="row"
            spacing={0.4}
            alignItems="center"
            sx={{
              minWidth: 0,
              gridColumn: { xs: "1 / -1", sm: 4 },
              gridRow: { sm: 1 },
            }}
          >
            {row.phone !== "—" && <PhoneIcon sx={{ fontSize: 15, color: "#2563eb" }} />}
            <Typography
              component={row.phone !== "—" ? "a" : "span"}
              href={row.phone !== "—" ? `tel:${row.phone}` : undefined}
              noWrap
              sx={{
                color: row.phone !== "—" ? "#2563eb" : "text.secondary",
                textDecoration: "none",
                fontWeight: 800,
                fontSize: 12.5,
              }}
            >
              {row.phone}
            </Typography>
          </Stack>
        </Box>
      ))}

      {!rows.length && (
        <Typography color="text.secondary" sx={{ p: 2 }}>
          No coverage found for this date.
        </Typography>
      )}
    </Box>
  );
}

function Row({ children, columns, header, index = 0 }: { children: React.ReactNode; columns: string; header?: boolean; index?: number }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: columns, justifyContent: "start", alignItems: "center", minWidth: 620, px: 1, py: header ? 0.8 : 0.65, borderBottom: "1px solid", borderColor: "#eef2f7", backgroundColor: header ? "#e2e8f0" : index % 2 ? "#f8fafc" : "white" }}>{children}</Box>;
}
function Cell({ children }: { children: React.ReactNode }) { return <Box sx={{ px: 0.75, minWidth: 0 }}>{typeof children === "string" ? <Typography fontSize={12} fontWeight={850} color="text.secondary">{children}</Typography> : children}</Box>; }
function formatIssueDateLabel(date?: string) {
  if (!date) return "Date unavailable";
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function IssuesPanel({ issues }: { issues: ScheduleIssue[] }) {
  if (!issues.length) {
    return (
      <Alert severity="success" sx={compactAlertSx}>
        No resident call conflicts detected.
      </Alert>
    );
  }

  return (
    <Card sx={{ mb: 1.25, borderRadius: 2.5 }}>
      <CardContent sx={{ p: 1, "&:last-child": { pb: 1 } }}>
        <Typography fontWeight={900} fontSize={13.5}>
          Schedule Issues ({issues.length})
        </Typography>
        <Stack spacing={0.5} sx={{ mt: 0.55 }}>
          {issues.slice(0, 5).map((issue) => {
            const style = issueSeverityStyle(issue.severity);
            return (
              <Box
                key={issue.id}
                sx={{
                  p: 0.7,
                  borderRadius: 1.5,
                  backgroundColor: style.bg,
                  border: `1px solid ${style.border}`,
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={0.45}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  sx={{ mb: 0.25 }}
                >
                  <Chip
                    label={formatIssueDateLabel(issue.date)}
                    size="small"
                    sx={{ height: 19, fontSize: 9.5, fontWeight: 850 }}
                  />
                  {issue.residentName && (
                    <Chip
                      label={issue.residentName}
                      size="small"
                      sx={{ height: 19, fontSize: 9.5, fontWeight: 850 }}
                    />
                  )}
                  {issue.serviceName && (
                    <Chip
                      label={issue.serviceName}
                      size="small"
                      sx={{ height: 19, fontSize: 9.5, fontWeight: 850 }}
                    />
                  )}
                  <Typography
                    fontSize={11.25}
                    fontWeight={900}
                    sx={{ color: style.color }}
                  >
                    {issue.title}
                  </Typography>
                </Stack>
                <Typography fontSize={10.75}>{issue.message}</Typography>
              </Box>
            );
          })}
          {issues.length > 5 && (
            <Typography fontSize={10.5} color="text.secondary">
              +{issues.length - 5} more issue{issues.length - 5 === 1 ? "" : "s"}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

const compactAlertSx = { mb: 1.5, borderRadius: 2, py: 0.4 };
