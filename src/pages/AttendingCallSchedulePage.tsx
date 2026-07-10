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
  { id: "observation", name: "Observation", shortName: "OBS", displayOrder: 1, coverageStartTime: "07:00", coverageEndTime: "07:00", coverageNote: "24h" },
  { id: "2n2-tele-2n1-ccu-attending-on-call", name: "2N2 (Tele), 2N1, CCU Attending on Call", shortName: "2N/Tele/CCU", displayOrder: 2, coverageStartTime: "07:00", coverageEndTime: "07:00", coverageNote: "24h" },
  { id: "4n-1-2-3w-attending-on-record", name: "4 North 1&2, 3W Attending On Record", shortName: "4N/3W Record", displayOrder: 3, coverageStartTime: "07:00", coverageEndTime: "07:00", coverageNote: "24h" },
  { id: "4n-1-2-3w-attending-on-call", name: "4 North 1&2, 3W Attending On Call", shortName: "4N/3W Call", displayOrder: 4, coverageStartTime: "07:00", coverageEndTime: "07:00", coverageNote: "24h" },
  { id: "faculty-attending-on-call", name: "Faculty Attending on Call", shortName: "Faculty", displayOrder: 5, coverageStartTime: "07:00", coverageEndTime: "07:00", coverageNote: "24h" },
];

function todayDate() {
  return toDateInputValue(new Date());
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

function shortServiceName(name: string) {
  const cleaned = displayServiceName(name);
  const lower = cleaned.toLowerCase();

  if (lower.includes("observation")) return "OBS";
  if (lower.includes("gastro") || lower === "gi") return "GI";
  if (lower.includes("neuro")) return "Neuro";
  if (lower.includes("card") || lower.includes("ccu")) return "Card/CCU";
  if (lower.includes("pulm")) return "Pulm";
  if (lower.includes("micu")) return "MICU";
  if (lower.includes("infect") || lower === "id") return "ID";
  if (lower.includes("neph")) return "Neph";
  if (lower.includes("rheum")) return "Rheum";
  if (lower.includes("heme")) return "Heme";
  if (lower.includes("onc")) return "Onc";
  if (lower.includes("faculty")) return "Faculty";
  if (lower.includes("4 north") || lower.includes("4n")) return "4N/3W";
  if (lower.includes("2n") || lower.includes("tele")) return "2N/Tele";

  return cleaned.length > 18 ? cleaned.slice(0, 18) : cleaned;
}

function shortAttendingName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name;
  const last = parts[parts.length - 1];
  const firstInitial = parts[0][0] ? `${parts[0][0]}.` : "";
  return `${firstInitial} ${last}`;
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

function attendingMatchesService(attending: Attending, service?: ScheduleService | null) {
  if (!service) return true;

  if (service.attendingScheduleType === "Core") {
    const combined = normalizeText(`${attending.specialty} ${attending.notes}`);
    const serviceKey = serviceSpecialtyKey(service.name);

    if (serviceKey.includes("observation")) {
      return combined.includes("observation") || combined.includes("medicine") || combined.includes("faculty");
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

export default function AttendingCallSchedulePage() {
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
    setWeekStartDate((current) => toDateInputValue(addDays(parseDate(current), -7)));
  }

  function goNextWeek() {
    setWeekStartDate((current) => toDateInputValue(addDays(parseDate(current), 7)));
  }

  function goToday() {
    setWeekStartDate(toDateInputValue(getMonday(new Date())));
  }

  return (
    <Box sx={{ width: "100%", maxWidth: "none", minWidth: 0 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={{ xs: 1, md: 1.5 }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        sx={{ mb: { xs: 1, md: 1.5 } }}
      >
        <Box>
          <Typography
            variant="h4"
            fontWeight={850}
            sx={{ lineHeight: 1, fontSize: { xs: 25, md: 34 } }}
          >
            Attending Call Schedule
          </Typography>
          <Typography
            color="text.secondary"
            fontSize={14}
            sx={{ display: { xs: "none", md: "block" } }}
          >
            Weekly attending coverage for admitting/core and specialty consulting services.
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} alignItems="center">
          <Button
            variant="outlined"
            onClick={goPreviousWeek}
            sx={{ minWidth: { xs: 42, md: 48 }, px: { xs: 0.75, md: 1.5 } }}
          >
            <ChevronLeftIcon />
          </Button>

          <Box
            sx={{
              height: 38,
              px: { xs: 1, md: 2 },
              borderRadius: 2,
              fontWeight: 850,
              display: "grid",
              placeItems: "center",
              backgroundColor: "#f8fafc",
              border: "1px solid",
              borderColor: "divider",
              fontSize: { xs: 12, md: 14 },
              flex: { xs: 1, md: "unset" },
              minWidth: 0,
              whiteSpace: "nowrap",
            }}
          >
            {formatWeekRange(weekDays)}
          </Box>

          <Button
            variant="outlined"
            onClick={goNextWeek}
            sx={{ minWidth: { xs: 42, md: 48 }, px: { xs: 0.75, md: 1.5 } }}
          >
            <ChevronRightIcon />
          </Button>

          <Button
            variant="outlined"
            startIcon={<TodayIcon />}
            onClick={goToday}
            sx={{
              textTransform: "none",
              fontWeight: 800,
              minWidth: { xs: 42, md: 92 },
              px: { xs: 1, md: 1.5 },
              "& .MuiButton-startIcon": {
                mr: { xs: 0, md: 0.75 },
              },
            }}
          >
            <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
              This Week
            </Box>
          </Button>

          {allowBuild && tab === "Specialty" && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddingAssignment({ tab: "Specialty" })}
              sx={{
                display: { xs: "none", sm: "inline-flex" },
                textTransform: "none",
                fontWeight: 800,
              }}
            >
              Add Consult
            </Button>
          )}
        </Stack>

        {allowBuild && tab === "Specialty" && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddingAssignment({ tab: "Specialty" })}
            sx={{
              display: { xs: "inline-flex", sm: "none" },
              textTransform: "none",
              fontWeight: 800,
            }}
          >
            Add Consult
          </Button>
        )}
      </Stack>

      {!allowBuild && (
        <Alert severity="info" sx={compactAlertSx}>
          View-only access.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={compactAlertSx}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: { xs: 1, md: 1.5 }, borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 0.5, md: 1 } }}>
          <Tabs
            value={tab}
            onChange={(_, value: ScheduleTab) => setTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 38,
              "& .MuiTab-root": {
                minHeight: 38,
                py: 0.75,
                px: { xs: 1.25, md: 2 },
                fontSize: { xs: 12, md: 13 },
                fontWeight: 850,
              },
            }}
          >
            <Tab label="Admitting / Core" value="Core" />
            <Tab label="Specialty / Consulting" value="Specialty" />
          </Tabs>
        </CardContent>
      </Card>

      <Card
        sx={{
          borderRadius: { xs: 2, md: 3 },
          boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
          overflow: "hidden",
        }}
      >
        <CardContent sx={{ p: { xs: 0.75, md: 1 } }}>
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
            <>
              <DesktopMatrix
                tab={tab}
                weekDays={weekDays}
                visibleServices={visibleServices}
                assignments={assignments}
                allowBuild={allowBuild}
                onAdd={(date, service) => setAddingAssignment({ tab, date, service })}
                onEdit={setEditingAssignment}
                onDelete={handleDelete}
              />

              <MobileCards
                tab={tab}
                weekDays={weekDays}
                visibleServices={visibleServices}
                assignments={assignments}
                allowBuild={allowBuild}
                onAdd={(date, service) => setAddingAssignment({ tab, date, service })}
                onEdit={setEditingAssignment}
                onDelete={handleDelete}
              />
            </>
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

function DesktopMatrix({
  tab,
  weekDays,
  visibleServices,
  assignments,
  allowBuild,
  onAdd,
  onEdit,
  onDelete,
}: {
  tab: ScheduleTab;
  weekDays: string[];
  visibleServices: ScheduleService[];
  assignments: AttendingScheduleAssignment[];
  allowBuild: boolean;
  onAdd: (date: string, service: ScheduleService) => void;
  onEdit: (assignment: AttendingScheduleAssignment) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Box
      sx={{
        display: { xs: "none", md: "block" },
        overflow: "auto",
        maxHeight: "calc(100vh - 205px)",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `180px repeat(7, minmax(105px, 1fr))`,
          minWidth: 180 + 7 * 105,
          width: "100%",
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
                <Typography fontWeight={850} fontSize={12} lineHeight={1.15} noWrap>
                  {service.shortName || shortServiceName(service.name)}
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

                    if (assignment) onEdit(assignment);
                    else onAdd(day, service);
                  }}
                >
                  {assignment ? (
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      spacing={0.35}
                      sx={{ minWidth: 0 }}
                    >
                      <Tooltip title={assignment.attendingName}>
                        <Typography fontWeight={850} fontSize={11.5} noWrap>
                          {shortAttendingName(assignment.attendingName)}
                        </Typography>
                      </Tooltip>

                      {allowBuild && (
                        <Stack direction="row" spacing={0.1} sx={{ flexShrink: 0 }}>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(assignment);
                              }}
                              sx={{ p: 0.15 }}
                            >
                              <EditIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(assignment.id);
                              }}
                              sx={{ p: 0.15 }}
                            >
                              <DeleteIcon sx={{ fontSize: 13 }} />
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
  );
}

function MobileCards({
  tab,
  weekDays,
  visibleServices,
  assignments,
  allowBuild,
  onAdd,
  onEdit,
  onDelete,
}: {
  tab: ScheduleTab;
  weekDays: string[];
  visibleServices: ScheduleService[];
  assignments: AttendingScheduleAssignment[];
  allowBuild: boolean;
  onAdd: (date: string, service: ScheduleService) => void;
  onEdit: (assignment: AttendingScheduleAssignment) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Stack spacing={1} sx={{ display: { xs: "flex", md: "none" } }}>
      {visibleServices.map((service) => (
        <Box
          key={service.id}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            overflow: "hidden",
            backgroundColor: tab === "Core" ? "#eff6ff" : "#f5f3ff",
          }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ p: 0.8 }}>
            <Box sx={serviceIconBox}>{serviceIcon(service.name)}</Box>
            <Typography fontWeight={900} fontSize={13} noWrap>
              {service.shortName || shortServiceName(service.name)}
            </Typography>
          </Stack>

          {weekDays.map((day, index) => {
            const header = formatDayHeader(day);
            const weekend = isWeekend(day);
            const today = day === todayDate();

            const assignment = findAssignmentForCell({
              assignments,
              serviceId: service.id,
              date: day,
              group: tab,
            });

            return (
              <Box
                key={`${service.id}-${day}`}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "58px 1fr 44px",
                  alignItems: "center",
                  gap: 0.5,
                  minHeight: 34,
                  px: 0.8,
                  py: 0.45,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  backgroundColor: assignment
                    ? "#ffffff"
                    : weekend
                      ? "#fff7ed"
                      : index % 2 === 0
                        ? "#ffffff"
                        : "#f8fafc",
                  outline: today ? "2px solid #2563eb" : "none",
                  outlineOffset: -2,
                  cursor: allowBuild ? "pointer" : "default",
                }}
                onClick={() => {
                  if (!allowBuild) return;
                  if (assignment) onEdit(assignment);
                  else onAdd(day, service);
                }}
              >
                <Typography fontSize={11.5} fontWeight={900} color={weekend ? "#c2410c" : "text.secondary"}>
                  {header.weekday} {header.day}
                </Typography>

                <Typography fontSize={12.5} fontWeight={850} noWrap color={assignment ? "text.primary" : "text.secondary"}>
                  {assignment ? assignment.attendingName : allowBuild ? "Assign" : "—"}
                </Typography>

                {assignment && allowBuild ? (
                  <Stack direction="row" spacing={0.1}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(assignment);
                      }}
                      sx={{ p: 0.2 }}
                    >
                      <EditIcon sx={{ fontSize: 14 }} />
                    </IconButton>

                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(assignment.id);
                      }}
                      sx={{ p: 0.2 }}
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Stack>
                ) : (
                  <Box />
                )}
              </Box>
            );
          })}
        </Box>
      ))}
    </Stack>
  );
}

const compactAlertSx = {
  mb: { xs: 1, md: 1.5 },
  borderRadius: 2,
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
            disabled={tab === "Core" && Boolean(defaultService)}
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
              label={tab === "Core" ? "Date" : "Start Date"}
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (tab === "Core") setEndDate(e.target.value);
              }}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label={tab === "Core" ? "Same Date" : "End Date"}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              disabled={tab === "Core"}
              fullWidth
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
  p: 0.5,
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
};

const weekdayHeaderCell = {
  p: 0.5,
  backgroundColor: "#e2e8f0",
  borderRight: "1px solid",
  borderBottom: "1px solid",
  borderColor: "divider",
  position: "sticky",
  top: 0,
  zIndex: 3,
  textAlign: "center",
};

const weekendHeaderCell = {
  ...weekdayHeaderCell,
  backgroundColor: "#fed7aa",
};

const coreServiceCell = {
  p: 0.5,
  backgroundColor: "#eff6ff",
  borderRight: "1px solid",
  borderBottom: "1px solid",
  borderColor: "divider",
  position: "sticky",
  left: 0,
  zIndex: 2,
  minWidth: 0,
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
  minHeight: 34,
  p: 0.4,
  borderRight: "1px solid",
  borderBottom: "1px solid",
  borderColor: "divider",
  backgroundColor: "white",
  minWidth: 0,
  "&:hover": {
    backgroundColor: "#f8fafc",
  },
};