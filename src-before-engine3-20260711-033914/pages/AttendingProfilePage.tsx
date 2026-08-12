import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PrintIcon from "@mui/icons-material/Print";
import TodayIcon from "@mui/icons-material/Today";

import { useAttendings } from "../hooks/useAttendings";
import { useAttendingSchedule } from "../hooks/useAttendingSchedule";
import type { AttendingScheduleAssignment } from "../types/attendingSchedule";

type ProfileTab = "calendar" | "assignments";

type CalendarDay = {
  date: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  assignments: AttendingScheduleAssignment[];
};

function toDateInputValue(date: Date) {
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
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDate(value: string) {
  const date = parseDate(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRange(startDate: string, endDate: string) {
  if (startDate === endDate) return formatDate(startDate);
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function isActiveOnDate(assignment: AttendingScheduleAssignment, date: string) {
  return assignment.startDate <= date && assignment.endDate >= date;
}

function assignmentColor(assignment: AttendingScheduleAssignment) {
  if (assignment.group === "Core") {
    return {
      color: "#2563eb",
      backgroundColor: "#eff6ff",
      borderColor: "#bfdbfe",
    };
  }

  return {
    color: "#7c3aed",
    backgroundColor: "#f5f3ff",
    borderColor: "#ddd6fe",
  };
}

function shortServiceName(name: string) {
  return name
    .replace(/\s+Attending On Call$/i, "")
    .replace(/\s+Attending on Call$/i, "")
    .replace(/\s+On Call$/i, "")
    .replace(/\s+Consulting$/i, "")
    .trim();
}

function buildCalendarDays({
  visibleMonth,
  assignments,
}: {
  visibleMonth: Date;
  assignments: AttendingScheduleAssignment[];
}): CalendarDay[] {
  const firstOfMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1
  );
  const lastOfMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0
  );

  const firstWeekday = firstOfMonth.getDay();
  const calendarStart = addDays(firstOfMonth, -firstWeekday);

  const totalDays = Math.ceil((firstWeekday + lastOfMonth.getDate()) / 7) * 7;
  const today = toDateInputValue(new Date());

  return Array.from({ length: totalDays }, (_, index) => {
    const date = addDays(calendarStart, index);
    const dateValue = toDateInputValue(date);

    return {
      date: dateValue,
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === visibleMonth.getMonth(),
      isToday: dateValue === today,
      assignments: assignments.filter((assignment) =>
        isActiveOnDate(assignment, dateValue)
      ),
    };
  });
}

export default function AttendingProfilePage({
  attendingId,
  onBack,
}: {
  attendingId: string;
  onBack: () => void;
}) {
  const { attendings, loading: attendingsLoading, error: attendingsError } =
    useAttendings();
  const {
    assignments,
    loading: assignmentsLoading,
    error: assignmentsError,
  } = useAttendingSchedule();

  const [tab, setTab] = useState<ProfileTab>("calendar");
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());

  const attending = useMemo(
    () => attendings.find((item) => item.id === attendingId) || null,
    [attendingId, attendings]
  );

  const attendingAssignments = useMemo(() => {
    return assignments
      .filter((assignment) => assignment.attendingId === attendingId)
      .sort((a, b) => {
        const startSort = a.startDate.localeCompare(b.startDate);
        if (startSort !== 0) return startSort;
        return a.serviceName.localeCompare(b.serviceName);
      });
  }, [assignments, attendingId]);

  const calendarDays = useMemo(
    () =>
      buildCalendarDays({
        visibleMonth,
        assignments: attendingAssignments,
      }),
    [attendingAssignments, visibleMonth]
  );

  const visibleMonthAssignments = useMemo(() => {
    const monthStart = toDateInputValue(
      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    );
    const monthEnd = toDateInputValue(
      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0)
    );

    return attendingAssignments.filter(
      (assignment) =>
        assignment.startDate <= monthEnd && assignment.endDate >= monthStart
    );
  }, [attendingAssignments, visibleMonth]);

  const coreCount = visibleMonthAssignments.filter(
    (assignment) => assignment.group === "Core"
  ).length;
  const specialtyCount = visibleMonthAssignments.filter(
    (assignment) => assignment.group === "Specialty"
  ).length;

  const loading = attendingsLoading || assignmentsLoading;
  const error = attendingsError || assignmentsError;

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          Loading attending profile...
        </Typography>
      </Stack>
    );
  }

  if (!attending) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }}>
          Back
        </Button>
        <Alert severity="warning">Attending profile not found.</Alert>
      </Box>
    );
  }

  return (
    <Box id="attending-profile-print-area" sx={{ width: "100%", maxWidth: "none" }}>
      <style>{`
        .attending-profile-print-title { display: none; }
        @media print {
          @page { size: portrait; margin: 0.35in; }
          body * { visibility: hidden !important; }
          #attending-profile-print-area, #attending-profile-print-area * { visibility: visible !important; }
          #attending-profile-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .attending-profile-print-hide { display: none !important; }
          .attending-profile-print-title { display: block !important; margin-bottom: 10px !important; }
          .MuiCard-root { box-shadow: none !important; }
        }
      `}</style>

      <Box className="attending-profile-print-title">
        <Typography variant="h5" fontWeight={900}>
          {attending.displayName} — {monthTitle(visibleMonth)}
        </Typography>
        <Typography fontSize={13}>
          WhosOn Attending Profile
        </Typography>
      </Box>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        sx={{ mb: 1.5 }}
        className="attending-profile-print-hide"
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            Back
          </Button>

          <Box>
            <Typography
            variant="h4"
            fontWeight={900}
              sx={{ lineHeight: 1, fontSize: { xs: 22, md: 28 } }}
            >
              {attending.displayName}
            </Typography>
            <Typography color="text.secondary" fontSize={14}>
              Attending profile, monthly calendar, and assignment history.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" onClick={() => setVisibleMonth((current) => addMonths(current, -1))}>
            <ChevronLeftIcon />
          </Button>

          <Box
            sx={{
              height: 38,
              px: 2,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              border: "1px solid",
              borderColor: "divider",
              backgroundColor: "#f8fafc",
              fontWeight: 900,
              minWidth: 160,
            }}
          >
            {monthTitle(visibleMonth)}
          </Box>

          <Button variant="outlined" onClick={() => setVisibleMonth((current) => addMonths(current, 1))}>
            <ChevronRightIcon />
          </Button>

          <Button
            variant="outlined"
            startIcon={<TodayIcon />}
            onClick={() => setVisibleMonth(new Date())}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            This Month
          </Button>

          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            Print / PDF
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }} className="attending-profile-print-hide">
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 1.5, borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 1.25, md: 2 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.25}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <Box>
              <Typography fontWeight={900} fontSize={20}>
                {attending.displayName}
              </Typography>

              <Typography color="text.secondary" fontSize={13.5}>
                {attending.specialty || "Medicine"}
                {attending.phone ? ` • ${attending.phone}` : ""}
                {attending.email ? ` • ${attending.email}` : ""}
              </Typography>

              {attending.notes && (
                <Typography color="text.secondary" fontSize={13} sx={{ mt: 0.5 }}>
                  {attending.notes}
                </Typography>
              )}
            </Box>

            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Chip
                label={attending.active ? "Active" : "Inactive"}
                size="small"
                sx={{
                  fontWeight: 900,
                  color: attending.active ? "#15803d" : "#64748b",
                  backgroundColor: attending.active ? "#ecfdf5" : "#f1f5f9",
                  border: "1px solid",
                  borderColor: attending.active ? "#bbf7d0" : "#e2e8f0",
                }}
              />
              <Chip
                label={`${visibleMonthAssignments.length} assignment${visibleMonthAssignments.length === 1 ? "" : "s"} this month`}
                size="small"
                sx={{ fontWeight: 900 }}
              />
              <Chip
                label={`Core: ${coreCount}`}
                size="small"
                sx={{
                  fontWeight: 900,
                  color: "#2563eb",
                  backgroundColor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                }}
              />
              <Chip
                label={`Consult: ${specialtyCount}`}
                size="small"
                sx={{
                  fontWeight: 900,
                  color: "#7c3aed",
                  backgroundColor: "#f5f3ff",
                  border: "1px solid #ddd6fe",
                }}
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 1, borderRadius: 2 }} className="attending-profile-print-hide">
        <CardContent sx={{ p: 0.5 }}>
          <Tabs
            value={tab}
            onChange={(_, value: ProfileTab) => setTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 32,
              "& .MuiTab-root": {
                minHeight: 32,
                fontWeight: 850,
                fontSize: 12,
                py: 0.25,
                px: 1.25,
              },
            }}
          >
            <Tab label="Monthly Calendar" value="calendar" />
            <Tab label="Assignments" value="assignments" />
          </Tabs>
        </CardContent>
      </Card>

      {tab === "calendar" ? (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 0.75, md: 1 } }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <Box
                  key={day}
                  sx={{
                    p: 0.5,
                    backgroundColor: "#e2e8f0",
                    borderRight: "1px solid",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    textAlign: "center",
                    fontWeight: 900,
                    fontSize: { xs: 10, md: 12 },
                  }}
                >
                  {day}
                </Box>
              ))}

              {calendarDays.map((day) => (
                <Box
                  key={day.date}
                  sx={{
                    minHeight: { xs: 70, md: 94 },
                    p: { xs: 0.35, md: 0.5 },
                    borderRight: "1px solid",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    backgroundColor: day.inMonth ? "white" : "#f8fafc",
                    opacity: day.inMonth ? 1 : 0.55,
                    outline: day.isToday ? "2px solid #2563eb" : "none",
                    outlineOffset: -2,
                    minWidth: 0,
                  }}
                >
                  <Typography fontWeight={900} fontSize={{ xs: 10.5, md: 12 }}>
                    {day.dayNumber}
                  </Typography>

                  <Stack spacing={0.25} sx={{ mt: 0.25 }}>
                    {day.assignments.slice(0, 4).map((assignment) => {
                      const color = assignmentColor(assignment);

                      return (
                        <Box
                          key={`${assignment.id}-${day.date}`}
                          sx={{
                            px: 0.4,
                            py: 0.2,
                            borderRadius: 1,
                            color: color.color,
                            backgroundColor: color.backgroundColor,
                            border: "1px solid",
                            borderColor: color.borderColor,
                            minWidth: 0,
                          }}
                        >
                          <Typography fontSize={{ xs: 8.5, md: 10 }} fontWeight={900} noWrap>
                            {shortServiceName(assignment.serviceName)}
                          </Typography>
                          {assignment.coverageNote && (
                            <Typography fontSize={{ xs: 7.5, md: 8.5 }} noWrap>
                              {assignment.coverageNote}
                            </Typography>
                          )}
                        </Box>
                      );
                    })}

                    {day.assignments.length > 4 && (
                      <Typography variant="caption" color="text.secondary" fontSize={9}>
                        +{day.assignments.length - 4} more
                      </Typography>
                    )}
                  </Stack>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 1, md: 1.5 } }}>
            <Typography fontWeight={900} fontSize={18} sx={{ mb: 1 }}>
              Assignments
            </Typography>

            {attendingAssignments.length === 0 ? (
              <Typography color="text.secondary">
                No assignments found for this attending.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {attendingAssignments.map((assignment) => {
                  const color = assignmentColor(assignment);

                  return (
                    <Box
                      key={assignment.id}
                      sx={{
                        border: "1px solid",
                        borderColor: color.borderColor,
                        backgroundColor: color.backgroundColor,
                        borderRadius: 2,
                        p: 1,
                      }}
                    >
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={0.5}
                        justifyContent="space-between"
                      >
                        <Box>
                          <Typography fontWeight={900} sx={{ color: color.color }}>
                            {shortServiceName(assignment.serviceName)}
                          </Typography>
                          <Typography fontSize={13} color="text.secondary">
                            {formatRange(assignment.startDate, assignment.endDate)}
                            {assignment.coverageNote ? ` • ${assignment.coverageNote}` : ""}
                          </Typography>
                        </Box>

                        <Chip
                          label={assignment.group === "Core" ? "Admitting/Core" : "Consult"}
                          size="small"
                          sx={{
                            width: "fit-content",
                            fontWeight: 900,
                            color: color.color,
                            backgroundColor: "#ffffff",
                            border: "1px solid",
                            borderColor: color.borderColor,
                          }}
                        />
                      </Stack>

                      {assignment.notes && (
                        <>
                          <Divider sx={{ my: 0.75 }} />
                          <Typography fontSize={13} color="text.secondary">
                            {assignment.notes}
                          </Typography>
                        </>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
