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
  Typography,
} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PrintIcon from "@mui/icons-material/Print";
import TodayIcon from "@mui/icons-material/Today";

import { useAttendingSchedule } from "../hooks/useAttendingSchedule";
import type { AttendingScheduleAssignment } from "../types/attendingSchedule";
import {
  consultServiceProfiles,
  matchesConsultServiceProfile,
  type ConsultServiceProfileId,
} from "../utils/consultServiceProfiles";

type CalendarDay = {
  date: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  assignments: AttendingScheduleAssignment[];
};

function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function monthTitle(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function isActiveOnDate(assignment: AttendingScheduleAssignment, date: string) {
  return assignment.startDate <= date && assignment.endDate >= date;
}

function formatRange(assignment: AttendingScheduleAssignment) {
  const start = parseDate(assignment.startDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const end = parseDate(assignment.endDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return assignment.startDate === assignment.endDate ? end : `${start} – ${end}`;
}

function shortServiceName(name: string) {
  return name
    .replace(/\s+Attending On Call$/i, "")
    .replace(/\s+On Call$/i, "")
    .replace(/\s+Consulting$/i, "")
    .trim();
}

function buildCalendarDays(visibleMonth: Date, assignments: AttendingScheduleAssignment[]) {
  const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const last = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
  const start = addDays(first, -first.getDay());
  const count = Math.ceil((first.getDay() + last.getDate()) / 7) * 7;
  const today = dateValue(new Date());

  return Array.from({ length: count }, (_, index): CalendarDay => {
    const date = addDays(start, index);
    const value = dateValue(date);
    return {
      date: value,
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === visibleMonth.getMonth(),
      isToday: value === today,
      assignments: assignments.filter((assignment) => isActiveOnDate(assignment, value)),
    };
  });
}

export default function ConsultServiceProfilePage({
  serviceId,
  onBack,
}: {
  serviceId: ConsultServiceProfileId;
  onBack: () => void;
}) {
  const { assignments, loading, error } = useAttendingSchedule();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const service = consultServiceProfiles[serviceId];

  const serviceAssignments = useMemo(
    () =>
      assignments
        .filter((assignment) => matchesConsultServiceProfile(assignment, serviceId))
        .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.serviceName.localeCompare(b.serviceName)),
    [assignments, serviceId]
  );

  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth, serviceAssignments),
    [serviceAssignments, visibleMonth]
  );

  const currentAssignments = useMemo(
    () => serviceAssignments.filter((assignment) => isActiveOnDate(assignment, dateValue(new Date()))),
    [serviceAssignments]
  );

  const monthAssignments = useMemo(() => {
    const start = dateValue(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1));
    const end = dateValue(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0));
    return serviceAssignments.filter((assignment) => assignment.startDate <= end && assignment.endDate >= start);
  }, [serviceAssignments, visibleMonth]);

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
        <Typography color="text.secondary" sx={{ mt: 2 }}>Loading service profile...</Typography>
      </Stack>
    );
  }

  return (
    <Box id="consult-service-profile-print-area" sx={{ width: "100%", maxWidth: "none" }}>
      <style>{`
        .consult-service-print-title { display: none; }
        @media print {
          @page { size: portrait; margin: 0.35in; }
          body * { visibility: hidden !important; }
          #consult-service-profile-print-area, #consult-service-profile-print-area * { visibility: visible !important; }
          #consult-service-profile-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .consult-service-print-hide { display: none !important; }
          .consult-service-print-title { display: block !important; margin-bottom: 10px !important; }
          .MuiCard-root { box-shadow: none !important; }
        }
      `}</style>

      <Box className="consult-service-print-title">
        <Typography variant="h5" fontWeight={900}>{service.title} — {monthTitle(visibleMonth)}</Typography>
        <Typography fontSize={13}>WhosOn Consult Service Profile</Typography>
      </Box>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        sx={{ mb: 1 }}
        className="consult-service-print-hide"
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ textTransform: "none", fontWeight: 800 }}>Back</Button>
          <Box>
            <Typography variant="h4" fontWeight={900} sx={{ fontSize: { xs: 22, md: 28 }, lineHeight: 1 }}>{service.title}</Typography>
            <Typography color="text.secondary" fontSize={13}>Consult service coverage and monthly assignments.</Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" aria-label="Previous month" onClick={() => setVisibleMonth((month) => addMonths(month, -1))}><ChevronLeftIcon /></Button>
          <Box sx={{ height: 36, px: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 2, backgroundColor: "#f8fafc", display: "grid", placeItems: "center", fontWeight: 900, minWidth: 142, fontSize: 13 }}>{monthTitle(visibleMonth)}</Box>
          <Button variant="outlined" aria-label="Next month" onClick={() => setVisibleMonth((month) => addMonths(month, 1))}><ChevronRightIcon /></Button>
          <Button variant="outlined" startIcon={<TodayIcon />} onClick={() => setVisibleMonth(new Date())} sx={{ textTransform: "none", fontWeight: 800 }}>This Month</Button>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()} sx={{ textTransform: "none", fontWeight: 800 }}>Print / PDF</Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1 }} className="consult-service-print-hide">{error}</Alert>}

      <Card sx={{ mb: 1, borderRadius: 2.5 }}>
        <CardContent sx={{ p: { xs: 1, md: 1.25 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
            <Box>
              <Typography fontSize={13} fontWeight={900}>Current attending{currentAssignments.length === 1 ? "" : "s"}</Typography>
              {currentAssignments.length ? (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                  {currentAssignments.map((assignment) => <Chip key={assignment.id} label={assignment.attendingName} size="small" sx={{ fontWeight: 900, color: "#7c3aed", backgroundColor: "#f5f3ff", border: "1px solid #ddd6fe" }} />)}
                </Stack>
              ) : <Typography color="text.secondary" fontSize={13}>No attending assigned today.</Typography>}
            </Box>
            <Chip label={`${monthAssignments.length} assignment${monthAssignments.length === 1 ? "" : "s"} this month`} size="small" sx={{ width: "fit-content", fontWeight: 900 }} />
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 1, borderRadius: 2.5 }}>
        <CardContent sx={{ p: { xs: 0.5, md: 0.75 } }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", border: "1px solid", borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <Box key={day} sx={{ p: 0.4, textAlign: "center", fontWeight: 900, fontSize: { xs: 9.5, md: 11 }, backgroundColor: "#e2e8f0", borderRight: "1px solid", borderBottom: "1px solid", borderColor: "divider" }}>{day}</Box>)}
            {calendarDays.map((day) => (
              <Box key={day.date} sx={{ minHeight: { xs: 66, md: 82 }, p: 0.35, minWidth: 0, borderRight: "1px solid", borderBottom: "1px solid", borderColor: "divider", backgroundColor: day.inMonth ? "white" : "#f8fafc", opacity: day.inMonth ? 1 : 0.55, outline: day.isToday ? "2px solid #2563eb" : "none", outlineOffset: -2 }}>
                <Typography fontSize={{ xs: 10, md: 11 }} fontWeight={900}>{day.dayNumber}</Typography>
                <Stack spacing={0.2} sx={{ mt: 0.2 }}>
                  {day.assignments.slice(0, 2).map((assignment) => <Box key={`${assignment.id}-${day.date}`} sx={{ px: 0.35, py: 0.15, borderRadius: 0.75, backgroundColor: "#f5f3ff", border: "1px solid #ddd6fe", minWidth: 0 }}><Typography fontSize={{ xs: 7.5, md: 9 }} lineHeight={1.1} fontWeight={900} color="#7c3aed" noWrap>{assignment.attendingName}</Typography>{service.serviceIds.length > 1 && <Typography fontSize={{ xs: 7, md: 8 }} lineHeight={1.1} color="#6d28d9" noWrap>{shortServiceName(assignment.serviceName)}</Typography>}</Box>)}
                  {day.assignments.length > 2 && <Typography fontSize={8} color="text.secondary">+{day.assignments.length - 2} more</Typography>}
                </Stack>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 2.5 }}>
        <CardContent sx={{ p: { xs: 1, md: 1.25 } }}>
          <Typography fontWeight={900} fontSize={15} sx={{ mb: 0.75 }}>Assignments</Typography>
          {serviceAssignments.length === 0 ? <Typography color="text.secondary" fontSize={13}>No assignments found for this service.</Typography> : <Stack spacing={0.5}>{serviceAssignments.map((assignment) => <Box key={assignment.id} sx={{ p: 0.75, borderRadius: 1.5, border: "1px solid #ddd6fe", backgroundColor: "#faf9ff" }}><Stack direction={{ xs: "column", sm: "row" }} spacing={0.25} justifyContent="space-between"><Typography fontWeight={900} fontSize={13}>{assignment.attendingName || "Unassigned"}</Typography><Typography color="text.secondary" fontSize={12}>{formatRange(assignment)}</Typography></Stack><Typography color="text.secondary" fontSize={11.5}>{shortServiceName(assignment.serviceName)}{assignment.coverageNote ? ` • ${assignment.coverageNote}` : ""}</Typography></Box>)}</Stack>}
        </CardContent>
      </Card>
    </Box>
  );
}
