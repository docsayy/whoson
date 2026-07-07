import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteIcon from "@mui/icons-material/Delete";

import { useAuth } from "../context/AuthContext";
import { useResidents } from "../hooks/useResidents";
import { useSchedule } from "../hooks/useSchedule";
import type { ScheduleAssignment, ShiftType } from "../types/schedule";
import { canBuildSchedule } from "../utils/permissions";

const shiftTypes: ShiftType[] = [
  "Day",
  "Night",
  "Call",
  "Backup",
  "Clinic",
  "Vacation",
  "Off",
];

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getMonthDays(currentMonth: Date) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const days: (Date | null)[] = [];

  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

export default function SchedulePage() {
  const { profile } = useAuth();
  const allowBuild = canBuildSchedule(profile?.role);

  const { residents } = useResidents();
  const { assignments, loading, error, addAssignment, removeAssignment } =
    useSchedule();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const activeResidents = useMemo(
    () => residents.filter((resident) => resident.active),
    [residents]
  );

  const monthDays = useMemo(() => getMonthDays(currentMonth), [currentMonth]);

  const assignmentsByDate = useMemo(() => {
    const grouped: Record<string, ScheduleAssignment[]> = {};

    for (const assignment of assignments) {
      if (!grouped[assignment.date]) grouped[assignment.date] = [];
      grouped[assignment.date].push(assignment);
    }

    return grouped;
  }, [assignments]);

  const monthTitle = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function goToPreviousMonth() {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  }

  function goToNextMonth() {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  }

  async function handleAddAssignment(data: {
    date: string;
    residentId: string;
    shiftType: ShiftType;
    notes: string;
  }) {
    const resident = residents.find((item) => item.id === data.residentId);
    if (!resident) return;

    const now = new Date().toISOString();

    await addAssignment({
      date: data.date,
      residentId: resident.id,
      residentName: resident.displayName,
      shiftType: data.shiftType,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    });

    setSelectedDate(null);
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Schedule Builder
          </Typography>
          <Typography color="text.secondary">
            Monthly resident schedule calendar.
          </Typography>
        </Box>

        {allowBuild && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setSelectedDate(toDateInputValue(new Date()))}
          >
            Add Assignment
          </Button>
        )}
      </Stack>

      {!allowBuild && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You have view-only access. Chiefs, program coordinators, and admins can
          build or edit the schedule.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 2 }}
          >
            <Button startIcon={<ChevronLeftIcon />} onClick={goToPreviousMonth}>
              Previous
            </Button>

            <Typography variant="h5" fontWeight={800}>
              {monthTitle}
            </Typography>

            <Button endIcon={<ChevronRightIcon />} onClick={goToNextMonth}>
              Next
            </Button>
          </Stack>

          {loading ? (
            <Stack alignItems="center" sx={{ py: 5 }}>
              <CircularProgress />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                Loading schedule...
              </Typography>
            </Stack>
          ) : (
            <>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  borderTop: "1px solid",
                  borderLeft: "1px solid",
                  borderColor: "divider",
                }}
              >
                {weekDays.map((day) => (
                  <Box
                    key={day}
                    sx={{
                      p: 1,
                      fontWeight: 800,
                      backgroundColor: "#f1f5f9",
                      borderRight: "1px solid",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      textAlign: "center",
                    }}
                  >
                    {day}
                  </Box>
                ))}

                {monthDays.map((day, index) => {
                  const dateKey = day ? toDateInputValue(day) : "";
                  const dayAssignments = dateKey
                    ? assignmentsByDate[dateKey] || []
                    : [];

                  return (
                    <Box
                      key={index}
                      sx={{
                        minHeight: 130,
                        p: 1,
                        borderRight: "1px solid",
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        backgroundColor: day ? "white" : "#f8fafc",
                        cursor: day && allowBuild ? "pointer" : "default",
                      }}
                      onClick={() => {
                        if (day && allowBuild) setSelectedDate(dateKey);
                      }}
                    >
                      {day && (
                        <>
                          <Typography fontWeight={800} sx={{ mb: 1 }}>
                            {day.getDate()}
                          </Typography>

                          <Stack spacing={0.75}>
                            {dayAssignments.map((assignment) => (
                              <Box
                                key={assignment.id}
                                sx={{
                                  p: 0.75,
                                  borderRadius: 1,
                                  backgroundColor: "#eef2ff",
                                  border: "1px solid #c7d2fe",
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                  alignItems="center"
                                  spacing={1}
                                >
                                  <Box>
                                    <Typography
                                      variant="body2"
                                      fontWeight={700}
                                    >
                                      {assignment.residentName}
                                    </Typography>
                                    <Chip
                                      label={assignment.shiftType}
                                      size="small"
                                      sx={{ mt: 0.5 }}
                                    />
                                  </Box>

                                  {allowBuild && (
                                    <Button
                                      size="small"
                                      color="error"
                                      onClick={() =>
                                        removeAssignment(assignment.id)
                                      }
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </Button>
                                  )}
                                </Stack>
                              </Box>
                            ))}
                          </Stack>
                        </>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      {selectedDate && allowBuild && (
        <ScheduleAssignmentDialog
          open={Boolean(selectedDate)}
          selectedDate={selectedDate}
          residents={activeResidents}
          onCancel={() => setSelectedDate(null)}
          onSave={handleAddAssignment}
        />
      )}
    </Box>
  );
}

function ScheduleAssignmentDialog({
  open,
  selectedDate,
  residents,
  onCancel,
  onSave,
}: {
  open: boolean;
  selectedDate: string;
  residents: { id: string; displayName: string }[];
  onCancel: () => void;
  onSave: (data: {
    date: string;
    residentId: string;
    shiftType: ShiftType;
    notes: string;
  }) => Promise<void>;
}) {
  const [date, setDate] = useState(selectedDate);
  const [residentId, setResidentId] = useState("");
  const [shiftType, setShiftType] = useState<ShiftType>("Day");
  const [notes, setNotes] = useState("");

  async function handleSave() {
    if (!date || !residentId) return;

    await onSave({
      date,
      residentId,
      shiftType,
      notes,
    });
  }

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>Add Schedule Assignment</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          <TextField
            select
            label="Resident"
            value={residentId}
            onChange={(e) => setResidentId(e.target.value)}
            fullWidth
          >
            {residents.map((resident) => (
              <MenuItem key={resident.id} value={resident.id}>
                {resident.displayName}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Shift Type"
            value={shiftType}
            onChange={(e) => setShiftType(e.target.value as ShiftType)}
            fullWidth
          >
            {shiftTypes.map((shift) => (
              <MenuItem key={shift} value={shift}>
                {shift}
              </MenuItem>
            ))}
          </TextField>

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

      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}