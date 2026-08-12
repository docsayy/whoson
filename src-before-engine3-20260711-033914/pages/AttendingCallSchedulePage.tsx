import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PrintIcon from "@mui/icons-material/Print";
import TodayIcon from "@mui/icons-material/Today";

import { useAuth } from "../context/AuthContext";
import { useAttendings } from "../hooks/useAttendings";
import { useAttendingSchedule } from "../hooks/useAttendingSchedule";
import { useServices } from "../hooks/useServices";
import type { Attending } from "../types/attending";
import type {
  AttendingScheduleAssignment,
  AttendingScheduleGroup,
} from "../types/attendingSchedule";
import type { ScheduleService } from "../types/schedule";
import { canBuildSchedule } from "../utils/permissions";

type ScheduleTab = "Core" | "Specialty";

type CoreRow = {
  id: string;
  name: string;
  shortName: string;
  displayOrder: number;
  coverageStartTime: string;
  coverageEndTime: string;
  coverageNote: string;
};

const coreRows: CoreRow[] = [
  {
    id: "observation",
    name: "Observation",
    shortName: "Observation",
    displayOrder: 1,
    coverageStartTime: "07:00",
    coverageEndTime: "07:00",
    coverageNote: "24h",
  },
  {
    id: "2n2-tele-2n1-ccu-attending-on-call",
    name: "2N2 (Tele), 2N1, CCU Attending on Call",
    shortName: "2N2/2N1/CCU On Call",
    displayOrder: 2,
    coverageStartTime: "07:00",
    coverageEndTime: "07:00",
    coverageNote: "24h",
  },
  {
    id: "4n-1-2-3w-attending-on-record",
    name: "4 North 1&2, 3W Attending On Record",
    shortName: "4N/3W On Record",
    displayOrder: 3,
    coverageStartTime: "07:00",
    coverageEndTime: "07:00",
    coverageNote: "24h",
  },
  {
    id: "4n-1-2-3w-attending-on-call",
    name: "4 North 1&2, 3W Attending On Call",
    shortName: "4N/3W On Call",
    displayOrder: 4,
    coverageStartTime: "07:00",
    coverageEndTime: "07:00",
    coverageNote: "24h",
  },
  {
    id: "faculty-attending-on-call",
    name: "Faculty Attending on Call",
    shortName: "Faculty On Call",
    displayOrder: 5,
    coverageStartTime: "07:00",
    coverageEndTime: "07:00",
    coverageNote: "24h",
  },
];

function todayDate() {
  return toDateInputValue(new Date());
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getMonday(date: Date) {
  const current = new Date(date);
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + diff);
  return current;
}

function getWeekDays(weekStartDate: string) {
  const start = parseDate(weekStartDate);
  return Array.from({ length: 7 }, (_, index) =>
    toDateInputValue(addDays(start, index))
  );
}

function formatWeekRange(days: string[]) {
  if (days.length === 0) return "";
  const first = parseDate(days[0]);
  const last = parseDate(days[6]);

  return `${first.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${last.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function formatDayHeader(date: string) {
  const localDate = parseDate(date);
  return {
    weekday: localDate.toLocaleDateString("en-US", { weekday: "short" }),
    day: localDate.getDate(),
  };
}

function isWeekend(date: string) {
  const day = parseDate(date).getDay();
  return day === 0 || day === 6;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function displayServiceName(name: string) {
  return name
    .replace(/\s+On Call$/i, "")
    .replace(/\s+Attending On Call$/i, "")
    .replace(/\s+Attending on Call$/i, "")
    .replace(/\s+Consulting$/i, "")
    .trim();
}

function serviceSpecialtyKey(serviceName: string) {
  const text = normalizeText(serviceName);

  if (text.includes("gastro") || text.includes("gi")) return "gastroenterology";
  if (text.includes("neuro")) return "neurology";
  if (text.includes("card") || text.includes("ccu")) return "cardiology";
  if (text.includes("pulm") || text.includes("micu")) return "pulmonary";
  if (text.includes("infect") || text === "id") return "infectiousdisease";
  if (text.includes("neph")) return "nephrology";
  if (text.includes("rheum")) return "rheumatology";
  if (text.includes("heme")) return "hematology";
  if (text.includes("onc")) return "oncology";
  if (text.includes("observ")) return "observation";
  if (text.includes("faculty")) return "faculty";
  if (text.includes("medicine")) return "medicine";

  return text;
}

function attendingMatchesService(
  attending: Attending,
  service?: ScheduleService | null
) {
  if (!service) return true;

  if (service.attendingScheduleType === "Core") {
    const combined = normalizeText(`${attending.specialty} ${attending.notes}`);
    const serviceKey = serviceSpecialtyKey(service.name);

    if (serviceKey.includes("observation")) {
      return (
        combined.includes("observation") ||
        combined.includes("medicine") ||
        combined.includes("faculty") ||
        combined.includes("hospitalist")
      );
    }

    if (serviceKey.includes("faculty")) {
      return combined.includes("faculty") || combined.includes("medicine");
    }

    return (
      combined.includes("medicine") ||
      combined.includes("faculty") ||
      combined.includes("hospitalist") ||
      combined.includes("admitting") ||
      combined.includes("general")
    );
  }

  const serviceKey = serviceSpecialtyKey(service.name);
  const attendingText = normalizeText(`${attending.specialty} ${attending.notes}`);

  if (!serviceKey) return true;

  if (serviceKey === "gastroenterology") {
    return attendingText.includes("gastroenterology") || attendingText.includes("gi");
  }

  if (serviceKey === "infectiousdisease") {
    return attendingText.includes("infectiousdisease") || attendingText.includes("id");
  }

  if (serviceKey === "hematology" || serviceKey === "oncology") {
    return attendingText.includes("hematology") || attendingText.includes("oncology");
  }

  if (serviceKey === "pulmonary") {
    return attendingText.includes("pulmonary") || attendingText.includes("pulm") || attendingText.includes("micu");
  }

  return attendingText.includes(serviceKey);
}

function serviceIcon(service: string) {
  const lower = service.toLowerCase();
  if (lower.includes("card") || lower.includes("ccu")) return "🫀";
  if (lower.includes("pulm") || lower.includes("micu")) return "🫁";
  if (lower.includes("neuro")) return "🧠";
  if (lower.includes("gi") || lower.includes("gastro")) return "🍽️";
  if (lower.includes("neph")) return "🫘";
  if (lower.includes("heme") || lower.includes("onc")) return "🩸";
  if (lower.includes("infect") || lower === "id") return "🦠";
  if (lower.includes("rheum")) return "🦴";
  if (lower.includes("observ")) return "👀";
  if (lower.includes("faculty")) return "⭐";
  if (lower.includes("tele")) return "🖥️";
  return "🏥";
}

function coreRowToService(row: CoreRow): ScheduleService {
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    category: "Core",
    coverageGroup: "Attending",
    attendingScheduleType: "Core",
    requiredTraining: ["Attending"],
    defaultStartTime: row.coverageStartTime,
    defaultEndTime: row.coverageEndTime,
    displayOrderCall: row.displayOrder,
    displayOrderAll: row.displayOrder,
    visibleOnCall: true,
    visibleOnAllServices: true,
    active: true,
  };
}

function isActiveOnDate(assignment: AttendingScheduleAssignment, date: string) {
  return assignment.startDate <= date && assignment.endDate >= date;
}

function findAssignmentForCell({
  assignments,
  serviceId,
  date,
  group,
}: {
  assignments: AttendingScheduleAssignment[];
  serviceId: string;
  date: string;
  group: ScheduleTab;
}) {
  return assignments.find(
    (assignment) =>
      assignment.group === group &&
      assignment.serviceId === serviceId &&
      isActiveOnDate(assignment, date)
  );
}

export default function AttendingCallSchedulePage({
  onOpenAttendingProfile,
}: {
  onOpenAttendingProfile?: (attendingId: string) => void;
}) {
  const { profile } = useAuth();
  const allowBuild = canBuildSchedule(profile?.role);

  const { attendings } = useAttendings();
  const { services } = useServices();

  const {
    assignments,
    loading,
    error,
    addAssignment,
    saveAssignment,
    removeAssignment,
  } = useAttendingSchedule();

  const [tab, setTab] = useState<ScheduleTab>("Core");
  const [weekStartDate, setWeekStartDate] = useState(
    toDateInputValue(getMonday(new Date()))
  );

  const [editingAssignment, setEditingAssignment] =
    useState<AttendingScheduleAssignment | null>(null);

  const [addingAssignment, setAddingAssignment] = useState<{
    tab: ScheduleTab;
    date?: string;
    service?: ScheduleService;
  } | null>(null);

  const weekDays = useMemo(() => getWeekDays(weekStartDate), [weekStartDate]);

  const activeAttendings = useMemo(() => {
    return attendings
      .filter((attending) => attending.active)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [attendings]);

  const specialtyServices = useMemo(() => {
    return services
      .filter((service) => service.active)
      .filter((service) => service.coverageGroup === "Attending")
      .filter((service) => service.attendingScheduleType === "Specialty")
      .sort((a, b) => a.displayOrderAll - b.displayOrderAll);
  }, [services]);

  const coreServices = useMemo(() => coreRows.map(coreRowToService), []);

  const visibleServices = tab === "Core" ? coreServices : specialtyServices;

  async function handleSave(data: {
    existing?: AttendingScheduleAssignment;
    service: ScheduleService;
    attending: Attending;
    startDate: string;
    endDate: string;
    coverageStartTime: string;
    coverageEndTime: string;
    coverageNote: string;
    notes: string;
  }) {
    if (!allowBuild) return;

    const now = new Date().toISOString();

    const payload: Omit<AttendingScheduleAssignment, "id"> = {
      serviceId: data.service.id,
      serviceName: data.service.name,
      group: data.service.attendingScheduleType as AttendingScheduleGroup,
      attendingId: data.attending.id,
      attendingName: data.attending.displayName,
      startDate: data.startDate,
      endDate: data.endDate,
      coverageStartTime: data.coverageStartTime,
      coverageEndTime: data.coverageEndTime,
      coverageNote: data.coverageNote,
      phone: data.attending.phone,
      pager: data.attending.pager,
      notes: data.notes,
      createdAt: data.existing?.createdAt || now,
      updatedAt: now,
    };

    if (data.existing) {
      await saveAssignment({ id: data.existing.id, ...payload });
      setEditingAssignment(null);
    } else {
      await addAssignment(payload);
      setAddingAssignment(null);
    }
  }

  async function handleDelete(id: string) {
    if (!allowBuild) return;
    const confirmed = window.confirm("Delete this attending assignment?");
    if (!confirmed) return;
    await removeAssignment(id);
    setEditingAssignment(null);
  }

  function goPreviousWeek() {
    setWeekStartDate((current) =>
      toDateInputValue(addDays(parseDate(current), -7))
    );
  }

  function goNextWeek() {
    setWeekStartDate((current) =>
      toDateInputValue(addDays(parseDate(current), 7))
    );
  }

  function goToday() {
    setWeekStartDate(toDateInputValue(getMonday(new Date())));
  }

  function handlePrint() {
    window.print();
  }

  return (
    <Box id="attending-schedule-print-area">
      <style>{`
        .attending-print-title { display: none; }
        @media print {
          @page { size: landscape; margin: 0.35in; }
          body * { visibility: hidden !important; }
          #attending-schedule-print-area, #attending-schedule-print-area * { visibility: visible !important; }
          #attending-schedule-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .attending-print-hide { display: none !important; }
          .attending-print-title { display: block !important; margin-bottom: 8px !important; }
          .MuiCard-root { box-shadow: none !important; }
        }
      `}</style>

      <Box className="attending-print-title">
        <Typography variant="h5" fontWeight={900}>
          WhosOn Attending Call Schedule
        </Typography>
        <Typography fontSize={13}>
          {tab === "Core" ? "Admitting / Core" : "Specialty / Consulting"} • {formatWeekRange(weekDays)}
        </Typography>
      </Box>

      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", lg: "center" }}
        sx={{ mb: 1.5 }}
        className="attending-print-hide"
      >
        <Box>
          <Typography variant="h4" fontWeight={850} sx={{ lineHeight: 1 }}>
            Attending Call Schedule
          </Typography>
          <Typography color="text.secondary" fontSize={14}>
            Weekly attending coverage for admitting/core and specialty consulting services.
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" onClick={goPreviousWeek}>
            <ChevronLeftIcon />
          </Button>

          <Box
            sx={{
              height: 40,
              px: 2,
              borderRadius: 2,
              fontWeight: 850,
              display: "grid",
              placeItems: "center",
              backgroundColor: "#f8fafc",
              border: "1px solid",
              borderColor: "divider",
              fontSize: 14,
              minWidth: 190,
            }}
          >
            {formatWeekRange(weekDays)}
          </Box>

          <Button variant="outlined" onClick={goNextWeek}>
            <ChevronRightIcon />
          </Button>

          <Button
            variant="outlined"
            startIcon={<TodayIcon />}
            onClick={goToday}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            This Week
          </Button>

          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            Print / PDF
          </Button>

          {allowBuild && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddingAssignment({ tab })}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              {tab === "Core" ? "Add Admitting" : "Add Consult"}
            </Button>
          )}
        </Stack>
      </Stack>

      {!allowBuild && (
        <Alert severity="info" sx={{ mb: 1.5 }} className="attending-print-hide">
          You have view-only access. Chiefs, coordinators, and admins can edit
          attending call schedules.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }} className="attending-print-hide">
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 1.5, borderRadius: 2 }} className="attending-print-hide">
        <CardContent sx={{ p: 1 }}>
          <Tabs
            value={tab}
            onChange={(_, value: ScheduleTab) => setTab(value)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Admitting / Core" value="Core" />
            <Tab label="Specialty / Consulting" value="Specialty" />
          </Tabs>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3, boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
        <CardContent sx={{ p: 1 }}>
          {loading ? (
            <Stack alignItems="center" sx={{ py: 5 }}>
              <CircularProgress />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                Loading attending schedule...
              </Typography>
            </Stack>
          ) : visibleServices.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 2 }}>
              No services found for this tab.
            </Typography>
          ) : (
            <Box
              sx={{
                overflow: "auto",
                maxHeight: { xs: "calc(100vh - 205px)", md: "calc(100vh - 205px)" },
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                "@media print": {
                  maxHeight: "none",
                  overflow: "visible",
                  border: "1px solid #94a3b8",
                },
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: `190px repeat(7, 120px)`,
                    md: `minmax(190px, 1.35fr) repeat(7, minmax(108px, 1fr))`,
                  },
                  minWidth: { xs: 190 + 7 * 120, md: 190 + 7 * 108 },
                  width: { xs: "max-content", md: "100%" },
                  "@media print": {
                    gridTemplateColumns: "190px repeat(7, 1fr)",
                    minWidth: "0 !important",
                    width: "100% !important",
                  },
                }}
              >
                <Box sx={topLeftCell}>Service</Box>

                {weekDays.map((day) => {
                  const header = formatDayHeader(day);
                  const weekend = isWeekend(day);
                  const today = day === todayDate();

                  return (
                    <Box
                      key={day}
                      sx={{
                        ...(weekend ? weekendHeaderCell : weekdayHeaderCell),
                        outline: today ? "2px solid #2563eb" : "none",
                        outlineOffset: -2,
                      }}
                    >
                      <Typography fontSize={11.5} fontWeight={900}>
                        {header.weekday}
                      </Typography>
                      <Typography fontSize={13} fontWeight={950}>
                        {header.day}
                      </Typography>
                    </Box>
                  );
                })}

                {visibleServices.map((service) => (
                  <Box key={service.id} sx={{ display: "contents" }}>
                    <Box sx={tab === "Core" ? coreServiceCell : specialtyServiceCell}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Box sx={serviceIconBox}>{serviceIcon(service.name)}</Box>
                        <Typography fontWeight={850} fontSize={12.5} lineHeight={1.15}>
                          {displayServiceName(service.name)}
                        </Typography>
                      </Stack>
                    </Box>

                    {weekDays.map((day) => {
                      const assignment = findAssignmentForCell({
                        assignments,
                        serviceId: service.id,
                        date: day,
                        group: tab,
                      });

                      const weekend = isWeekend(day);

                      return (
                        <Box
                          key={`${service.id}-${day}`}
                          sx={{
                            ...matrixCell,
                            backgroundColor: assignment
                              ? "#f0fdf4"
                              : weekend
                                ? "#fff7ed"
                                : "white",
                            cursor: allowBuild ? "pointer" : "default",
                          }}
                          onClick={() => {
                            if (!allowBuild) return;

                            if (assignment) {
                              setEditingAssignment(assignment);
                            } else {
                              setAddingAssignment({ tab, date: day, service });
                            }
                          }}
                        >
                          {assignment ? (
                            <Stack
                              direction="row"
                              alignItems="center"
                              justifyContent="space-between"
                              spacing={0.5}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Button
                                  variant="text"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenAttendingProfile?.(assignment.attendingId);
                                  }}
                                  sx={{
                                    p: 0,
                                    minWidth: 0,
                                    maxWidth: "100%",
                                    textTransform: "none",
                                    justifyContent: "flex-start",
                                    color: "#0f172a",
                                    fontWeight: 850,
                                    fontSize: 12.2,
                                    lineHeight: 1.1,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    "&:hover": {
                                      backgroundColor: "transparent",
                                      textDecoration: "underline",
                                    },
                                  }}
                                >
                                  {assignment.attendingName}
                                </Button>

                                {assignment.phone && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    fontSize={10.3}
                                    noWrap
                                    sx={{ display: "block" }}
                                  >
                                    {assignment.phone}
                                  </Typography>
                                )}
                              </Box>

                              {allowBuild && (
                                <Stack
                                  direction="row"
                                  spacing={0.1}
                                  sx={{ flexShrink: 0 }}
                                  className="attending-print-hide"
                                >
                                  <Tooltip title="Edit">
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingAssignment(assignment);
                                      }}
                                      sx={{ p: 0.2 }}
                                    >
                                      <EditIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </Tooltip>

                                  <Tooltip title="Delete">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(assignment.id);
                                      }}
                                      sx={{ p: 0.2 }}
                                    >
                                      <DeleteIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              )}
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.secondary" fontSize={10.5}>
                              {allowBuild ? "Assign" : "—"}
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {(addingAssignment || editingAssignment) && allowBuild && (
        <AttendingScheduleDialog
          open={Boolean(addingAssignment || editingAssignment)}
          tab={editingAssignment?.group || addingAssignment?.tab || tab}
          services={
            editingAssignment?.group === "Core" || addingAssignment?.tab === "Core"
              ? coreServices
              : specialtyServices
          }
          attendings={activeAttendings}
          existing={editingAssignment || undefined}
          defaultService={addingAssignment?.service}
          defaultDate={addingAssignment?.date}
          onCancel={() => {
            setAddingAssignment(null);
            setEditingAssignment(null);
          }}
          onDelete={editingAssignment ? () => handleDelete(editingAssignment.id) : undefined}
          onSave={handleSave}
        />
      )}
    </Box>
  );
}

function AttendingScheduleDialog({
  open,
  tab,
  services,
  attendings,
  existing,
  defaultService,
  defaultDate,
  onCancel,
  onDelete,
  onSave,
}: {
  open: boolean;
  tab: ScheduleTab;
  services: ScheduleService[];
  attendings: Attending[];
  existing?: AttendingScheduleAssignment;
  defaultService?: ScheduleService;
  defaultDate?: string;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  onSave: (data: {
    existing?: AttendingScheduleAssignment;
    service: ScheduleService;
    attending: Attending;
    startDate: string;
    endDate: string;
    coverageStartTime: string;
    coverageEndTime: string;
    coverageNote: string;
    notes: string;
  }) => Promise<void>;
}) {
  const defaultExistingService =
    services.find((service) => service.id === existing?.serviceId) || null;

  const defaultAttending =
    attendings.find((attending) => attending.id === existing?.attendingId) ||
    null;

  const [service, setService] = useState<ScheduleService | null>(
    defaultExistingService || defaultService || null
  );

  const filteredAttendings = useMemo(() => {
    return attendings.filter((attending) =>
      attendingMatchesService(attending, service)
    );
  }, [attendings, service]);

  const [attending, setAttending] = useState<Attending | null>(
    defaultAttending
  );

  const [startDate, setStartDate] = useState(
    existing?.startDate || defaultDate || todayDate()
  );

  const [endDate, setEndDate] = useState(
    existing?.endDate || defaultDate || todayDate()
  );

  const [coverageStartTime, setCoverageStartTime] = useState(
    existing?.coverageStartTime || defaultService?.defaultStartTime || "07:00"
  );

  const [coverageEndTime, setCoverageEndTime] = useState(
    existing?.coverageEndTime || defaultService?.defaultEndTime || "07:00"
  );

  const [coverageNote, setCoverageNote] = useState(
    existing?.coverageNote || (tab === "Core" ? "24h" : "7a-7a")
  );

  const [notes, setNotes] = useState(existing?.notes || "");
  const [saving, setSaving] = useState(false);

  function handleServiceChange(value: ScheduleService | null) {
    setService(value);
    setAttending(null);

    if (!existing && value) {
      setCoverageStartTime(value.defaultStartTime);
      setCoverageEndTime(value.defaultEndTime);
      if (tab === "Core") setCoverageNote("24h");
      if (tab === "Specialty") setCoverageNote("7a-7a");
    }
  }

  async function handleSave() {
    if (!service || !attending) return;

    if (endDate < startDate) {
      window.alert("End date cannot be before start date.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        existing,
        service,
        attending,
        startDate,
        endDate,
        coverageStartTime,
        coverageEndTime,
        coverageNote,
        notes,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>
        {existing ? "Edit" : "Add"}{" "}
        {tab === "Core" ? "Admitting/Core" : "Specialty"} Assignment
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Autocomplete
            options={services}
            value={service}
            onChange={(_, value) => handleServiceChange(value)}
            getOptionLabel={(option) => displayServiceName(option.name)}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="Service" />}
          />

          <Autocomplete
            options={filteredAttendings}
            value={attending}
            onChange={(_, value) => setAttending(value)}
            getOptionLabel={(option) =>
              `${option.displayName}${option.specialty ? ` — ${option.specialty}` : ""}`
            }
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Attending"
                helperText={
                  service
                    ? `Filtered for ${displayServiceName(service.name)}. Edit attending specialty if someone is missing.`
                    : "Select a service first."
                }
              />
            )}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (endDate < e.target.value) setEndDate(e.target.value);
              }}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              helperText={
                tab === "Core"
                  ? "Core/admitting can now be added for a date range."
                  : "Consult service coverage date range."
              }
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="Coverage Start"
              type="time"
              value={coverageStartTime}
              onChange={(e) => setCoverageStartTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label="Coverage End"
              type="time"
              value={coverageEndTime}
              onChange={(e) => setCoverageEndTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>

          <TextField
            label="Coverage Display"
            value={coverageNote}
            onChange={(e) => setCoverageNote(e.target.value)}
            placeholder="24h, 7a-7a, Until 4PM, Starting 4PM..."
            fullWidth
          />

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ justifyContent: "space-between" }}>
        <Box>
          {existing && onDelete && (
            <Button color="error" onClick={onDelete} disabled={saving}>
              Delete
            </Button>
          )}
        </Box>

        <Stack direction="row" spacing={1}>
          <Button onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!service || !attending || saving}
          >
            Save
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

const topLeftCell = {
  p: 0.55,
  fontWeight: 900,
  fontSize: 12,
  backgroundColor: "#e2e8f0",
  borderRight: "1px solid",
  borderBottom: "1px solid",
  borderColor: "divider",
  position: "sticky",
  top: 0,
  left: 0,
  zIndex: 5,
  "@media print": {
    position: "static",
  },
};

const weekdayHeaderCell = {
  p: 0.55,
  backgroundColor: "#e2e8f0",
  borderRight: "1px solid",
  borderBottom: "1px solid",
  borderColor: "divider",
  position: "sticky",
  top: 0,
  zIndex: 3,
  textAlign: "center",
  "@media print": {
    position: "static",
  },
};

const weekendHeaderCell = {
  ...weekdayHeaderCell,
  backgroundColor: "#fed7aa",
};

const coreServiceCell = {
  p: 0.55,
  backgroundColor: "#eff6ff",
  borderRight: "1px solid",
  borderBottom: "1px solid",
  borderColor: "divider",
  position: "sticky",
  left: 0,
  zIndex: 2,
  "@media print": {
    position: "static",
  },
};

const specialtyServiceCell = {
  ...coreServiceCell,
  backgroundColor: "#f5f3ff",
};

const serviceIconBox = {
  width: 22,
  height: 22,
  borderRadius: 1.25,
  display: "grid",
  placeItems: "center",
  backgroundColor: "#ffffff",
  border: "1px solid",
  borderColor: "#dbeafe",
  fontSize: 13,
  flexShrink: 0,
};

const matrixCell = {
  minHeight: 42,
  p: 0.45,
  borderRight: "1px solid",
  borderBottom: "1px solid",
  borderColor: "divider",
  backgroundColor: "white",
  "&:hover": {
    backgroundColor: "#f8fafc",
  },
  "@media print": {
    minHeight: 34,
    p: 0.35,
  },
};
