import { useMemo } from "react";
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import HotelIcon from "@mui/icons-material/Hotel";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import NightlightIcon from "@mui/icons-material/Nightlight";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PublishedWithChangesIcon from "@mui/icons-material/PublishedWithChanges";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { useNavigate } from "react-router-dom";

import { getResidentCallServicesForDate } from "../config/scheduleServices";
import { useAuth } from "../context/AuthContext";
import { useAcademicBlocks } from "../hooks/useAcademicBlocks";
import { useAttendingSchedule } from "../hooks/useAttendingSchedule";
import { useBlockAssignments } from "../hooks/useBlockAssignments";
import { useCallSwaps } from "../hooks/useCallSwaps";
import { useMonthlyScheduleRange } from "../hooks/useMonthlyScheduleRange";
import { useNotifications } from "../hooks/useNotifications";
import { useResidents } from "../hooks/useResidents";
import { useRotations } from "../hooks/useRotations";
import { useServices } from "../hooks/useServices";
import { useDataAccessDiagnostics } from "../hooks/useDataAccessDiagnostics";
import { getDraftAssignmentsForYear } from "../services/blockAssignmentService";
import { buildBlockValidations } from "../utils/blockValidation";
import { isNightFloatService } from "../utils/nightFloatSchedule";
import { canBuildSchedule } from "../utils/permissions";
import { detectDailyScheduleIssues, issueSeverityStyle } from "../utils/schedulingIntelligence";

function dateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthId(date: Date) {
  return dateString(date).slice(0, 7);
}

function monthDates(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) =>
    dateString(new Date(year, month, index + 1))
  );
}

function academicYearFor(date: Date) {
  const year = date.getFullYear();
  return date.getMonth() >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

const CORE_ATTENDING_SERVICE_IDS = [
  "observation",
  "2n2-tele-2n1-ccu-attending-on-call",
  "4n-1-2-3w-attending-on-record",
  "4n-1-2-3w-attending-on-call",
  "faculty-attending-on-call",
];

export default function ScheduleIntegrityPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const manager = canBuildSchedule(profile?.role);
  const current = new Date();
  const currentMonthId = monthId(current);
  const dates = useMemo(() => monthDates(current), []);
  const academicYear = academicYearFor(current);

  const { residents, loading: residentsLoading } = useResidents();
  const { blocks, loading: blocksLoading } = useAcademicBlocks();
  const { assignments: allBlockAssignments, loading: assignmentsLoading } = useBlockAssignments();
  const { rotations, loading: rotationsLoading } = useRotations();
  const { assignments: attendingAssignments, loading: attendingLoading } = useAttendingSchedule();
  const { services, loading: servicesLoading } = useServices();
  const { requests, loading: swapsLoading } = useCallSwaps();
  const { unreadCount } = useNotifications(user?.uid, profile?.residentId);
  const diagnostics = useDataAccessDiagnostics();
  const {
    assignments: monthlyAssignments,
    schedules,
    loading: monthlyLoading,
  } = useMonthlyScheduleRange([currentMonthId]);

  const draftBlockAssignments = useMemo(
    () => getDraftAssignmentsForYear(allBlockAssignments, academicYear),
    [academicYear, allBlockAssignments]
  );

  const dailyIssues = useMemo(() => {
    const all = dates.flatMap((date) =>
      detectDailyScheduleIssues({
        date,
        services: getResidentCallServicesForDate(date),
        monthlyAssignments,
        blocks,
        blockAssignments: draftBlockAssignments,
        residents,
        includeMissingCoverage: true,
      })
    );
    return Array.from(new Map(all.map((issue) => [issue.id, issue])).values());
  }, [blocks, dates, draftBlockAssignments, monthlyAssignments, residents]);

  const missingCoverage = dailyIssues.filter((issue) => issue.category === "missing-coverage");
  const missingShortDuty = missingCoverage.filter((issue) =>
    Boolean(issue.serviceId?.startsWith("short-duty-"))
  );
  const missingNightFloat = missingCoverage.filter((issue) =>
    issue.serviceId ? isNightFloatService(issue.serviceId) : false
  );
  const conflicts = dailyIssues.filter((issue) => issue.category !== "missing-coverage");
  const criticalConflicts = conflicts.filter((issue) => issue.severity === "critical");

  const currentYearBlocks = blocks.filter((block) => block.academicYear === academicYear);
  const blockValidations = useMemo(
    () =>
      buildBlockValidations({
        blocks: currentYearBlocks,
        assignments: draftBlockAssignments,
        residents,
        rotations,
      }),
    [currentYearBlocks, draftBlockAssignments, residents, rotations]
  );
  const incompleteBlocks = blockValidations.filter((item) => item.completionPercent < 100);
  const blockIssues = blockValidations.flatMap((item) => item.issues);

  const today = dateString(current);
  const specialtyServiceIds = services
    .filter((service) => {
      const key = `${service.id} ${service.name}`.toLowerCase();
      return (
        service.active &&
        service.coverageGroup === "Attending" &&
        service.attendingScheduleType === "Specialty" &&
        !key.includes("endo")
      );
    })
    .map((service) => service.id);
  const expectedAttendingIds = new Set([
    ...CORE_ATTENDING_SERVICE_IDS,
    ...specialtyServiceIds,
  ]);
  const coveredAttendingIds = new Set(
    attendingAssignments
      .filter(
        (assignment) =>
          assignment.startDate <= today && assignment.endDate >= today
      )
      .map((assignment) => assignment.serviceId)
  );
  const missingAttending = Array.from(expectedAttendingIds).filter(
    (id) => !coveredAttendingIds.has(id)
  ).length;

  const pendingSwaps = requests.filter((request) =>
    ["pending-recipient", "pending-approval"].includes(request.status)
  ).length;
  const unpublished = schedules[currentMonthId]?.status !== "published" ? 1 : 0;

  const loading =
    residentsLoading ||
    blocksLoading ||
    assignmentsLoading ||
    rotationsLoading ||
    attendingLoading ||
    servicesLoading ||
    swapsLoading ||
    monthlyLoading;

  if (!manager) {
    return <Alert severity="warning">The Scheduling Integrity Center is available to chiefs, coordinators, and administrators.</Alert>;
  }

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 7 }}>
        <CircularProgress />
        <Typography color="text.secondary" sx={{ mt: 1 }}>Checking schedules…</Typography>
      </Stack>
    );
  }

  const cards = [
    {
      label: "Critical conflicts",
      value: criticalConflicts.length,
      icon: <ErrorOutlineIcon />,
      color: "#be123c",
      path: `/daily-call-schedule?date=${criticalConflicts[0]?.date || today}`,
    },
    {
      label: "Missing daily calls",
      value: missingCoverage.length,
      icon: <EventBusyIcon />,
      color: "#b45309",
      path: `/daily-call-schedule?date=${missingCoverage[0]?.date || today}`,
    },
    {
      label: "Missing short duty",
      value: missingShortDuty.length,
      icon: <HotelIcon />,
      color: "#7c3aed",
      path: `/daily-call-schedule?date=${missingShortDuty[0]?.date || today}`,
    },
    {
      label: "Missing Night Float",
      value: missingNightFloat.length,
      icon: <NightlightIcon />,
      color: "#2563eb",
      path: `/daily-call-schedule?date=${missingNightFloat[0]?.date || today}`,
    },
    {
      label: "Incomplete blocks",
      value: incompleteBlocks.length,
      icon: <AssignmentTurnedInIcon />,
      color: "#0f766e",
      path: "/block-schedule",
    },
    {
      label: "Block issues",
      value: blockIssues.length,
      icon: <ErrorOutlineIcon />,
      color: "#c2410c",
      path: "/block-schedule",
    },
    {
      label: "Missing attending today",
      value: missingAttending,
      icon: <LocalHospitalIcon />,
      color: "#9333ea",
      path: "/attending-call-schedule",
    },
    {
      label: "Unpublished call months",
      value: unpublished,
      icon: <PublishedWithChangesIcon />,
      color: "#475569",
      path: "/daily-call-schedule",
    },
    {
      label: "Pending call swaps",
      value: pendingSwaps,
      icon: <SwapHorizIcon />,
      color: "#0369a1",
      path: "/call-swaps",
    },
    {
      label: "Unread notifications",
      value: unreadCount,
      icon: <NotificationsIcon />,
      color: "#15803d",
      path: "/call-swaps",
    },
  ];

  return (
    <Box sx={{ width: "100%", maxWidth: 1280, mx: "auto" }}>
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="h4" fontWeight={900}>Scheduling Integrity Center</Typography>
        <Typography color="text.secondary" fontSize={12.5}>
          Manual scheduling remains fully controlled by chiefs and coordinators. This page only validates, reconciles, and points to missing work.
        </Typography>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, minmax(0, 1fr))" }, gap: 1 }}>
        {cards.map((card) => (
          <Card key={card.label} sx={{ borderRadius: 2.5 }}>
            <CardActionArea onClick={() => navigate(card.path)} sx={{ height: "100%" }}>
              <CardContent sx={{ p: 1.4 }}>
                <Box sx={{ color: card.color }}>{card.icon}</Box>
                <Typography fontSize={24} fontWeight={950} sx={{ lineHeight: 1.1, mt: 0.5 }}>{card.value}</Typography>
                <Typography fontSize={11.5} color="text.secondary" sx={{ mt: 0.25 }}>{card.label}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>


      <Card sx={{ mt: 1.5, borderRadius: 2.5 }}>
        <CardContent sx={{ p: 1.5 }}>
          <Typography fontWeight={900}>Firestore usage protection</Typography>
          <Typography color="text.secondary" fontSize={11.5} sx={{ mb: 1 }}>
            Browser-session diagnostics only. Firebase Console remains the source of truth for project-wide billing and quota usage.
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(5, 1fr)" }, gap: 0.75 }}>
            {[
              ["Server loads", diagnostics.serverLoads],
              ["Cache hits", diagnostics.cacheHits],
              ["Cache misses", diagnostics.cacheMisses],
              ["Active listeners", diagnostics.activeListeners],
              ["Skipped writes", diagnostics.writesSkipped],
            ].map(([label, value]) => (
              <Box key={String(label)} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, p: 0.85 }}>
                <Typography fontSize={19} fontWeight={950}>{value}</Typography>
                <Typography fontSize={10.5} color="text.secondary">{label}</Typography>
              </Box>
            ))}
          </Box>
          <Alert severity={diagnostics.activeListeners <= 4 ? "success" : "warning"} sx={{ mt: 1, py: 0.25 }}>
            {diagnostics.activeListeners <= 4
              ? "Listener count is within the intended range. Reference data is shared and cached across pages."
              : "More live listeners than expected are active in this browser tab. Close unused pages or reload the app."}
          </Alert>
        </CardContent>
      </Card>

      <Card sx={{ mt: 1.5, borderRadius: 2.5 }}>
        <CardContent sx={{ p: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography fontWeight={900}>Highest-priority issues</Typography>
            <Chip size="small" label={`${dailyIssues.length + blockIssues.length} total`} />
          </Stack>
          <Stack spacing={0.65}>
            {[...criticalConflicts, ...conflicts.filter((issue) => issue.severity === "warning"), ...missingCoverage]
              .slice(0, 15)
              .map((issue) => {
                const style = issueSeverityStyle(issue.severity);
                return (
                  <Box
                    key={issue.id}
                    component="button"
                    onClick={() => navigate(`/daily-call-schedule?date=${issue.date || today}`)}
                    sx={{
                      border: `1px solid ${style.border}`,
                      backgroundColor: style.bg,
                      borderRadius: 1.5,
                      p: 0.9,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <Typography fontSize={11.5} fontWeight={900} sx={{ color: style.color }}>{issue.title}</Typography>
                    <Typography fontSize={11} color="text.secondary">{issue.message}</Typography>
                  </Box>
                );
              })}
            {dailyIssues.length === 0 && blockIssues.length === 0 && <Alert severity="success">No scheduling issues detected.</Alert>}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
