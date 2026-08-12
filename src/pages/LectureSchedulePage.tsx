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
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PlaceIcon from "@mui/icons-material/Place";
import PersonIcon from "@mui/icons-material/Person";
import ScheduleIcon from "@mui/icons-material/Schedule";

import { useAuth } from "../context/AuthContext";
import { useLectures } from "../hooks/useLectures";
import type { LectureAudience, LectureCategory, LectureEvent } from "../types/lecture";
import { canBuildSchedule } from "../utils/permissions";

const categories: LectureCategory[] = [
  "Morning Report",
  "Noon Conference",
  "Grand Rounds",
  "Board Review",
  "Journal Club",
  "M&M",
  "Simulation",
  "Orientation",
  "Business Meeting",
  "Residency Event",
  "Other",
];

const audiences: LectureAudience[] = ["Everyone", "PGY-1", "PGY-2", "PGY-3", "Faculty"];
const locationOptions = ["3C", "5th Floor / Auditorium", "Other"] as const;

const categoryDefaults: Partial<Record<LectureCategory, { startTime: string; endTime: string }>> = {
  "Morning Report": { startTime: "08:00", endTime: "09:00" },
  "M&M": { startTime: "08:00", endTime: "09:00" },
  "Grand Rounds": { startTime: "08:00", endTime: "09:00" },
  "Noon Conference": { startTime: "12:00", endTime: "13:00" },
  "Business Meeting": { startTime: "12:00", endTime: "13:00" },
};

function dateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function monthString(date: Date) { return dateString(date).slice(0, 7); }
function monthTitle(monthId: string) {
  const [year, month] = monthId.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function shiftMonth(monthId: string, amount: number) {
  const [year, month] = monthId.split("-").map(Number);
  return monthString(new Date(year, month - 1 + amount, 1));
}
function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}
function formatTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });
}
function emptyLecture(createdByUid?: string): LectureEvent {
  const now = new Date().toISOString();
  return {
    id: "", title: "", date: dateString(new Date()), startTime: "12:00", endTime: "13:00",
    location: "3C", presenter: "", audience: ["Everyone"], category: "Noon Conference",
    notes: "", active: true, createdAt: now, updatedAt: now, createdByUid,
  };
}

function LectureCard({ item, allowManage, onEdit, onDelete }: {
  item: LectureEvent;
  allowManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2.25, p: { xs: 1.25, sm: 1.5 }, bgcolor: "background.paper" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: { xs: 16, sm: 18 },
              lineHeight: 1.25,
              overflowWrap: "anywhere",
            }}
          >
            {item.title}
          </Typography>
          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
            <Chip label={item.category} size="small" sx={{ fontWeight: 800 }} />
            {item.audience.map((audience) => (
              <Chip key={audience} label={audience} variant="outlined" size="small" />
            ))}
          </Stack>
        </Box>
        {allowManage && (
          <Stack direction="row" spacing={0.1}>
            <IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton>
            <IconButton size="small" color="error" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton>
          </Stack>
        )}
      </Stack>

      <Divider sx={{ my: 1.1 }} />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 0.8 }}>
        <Stack direction="row" spacing={0.7} alignItems="center">
          <ScheduleIcon sx={{ fontSize: 19, color: "primary.main" }} />
          <Typography fontWeight={850} fontSize={13.5}>
            {formatTime(item.startTime)}–{formatTime(item.endTime)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.7} alignItems="center">
          <PersonIcon sx={{ fontSize: 19, color: "text.secondary" }} />
          <Typography fontSize={13.5}>{item.presenter || "Presenter TBD"}</Typography>
        </Stack>
        <Stack direction="row" spacing={0.7} alignItems="center">
          <PlaceIcon sx={{ fontSize: 19, color: "text.secondary" }} />
          <Typography fontSize={13.5}>{item.location || "Location TBD"}</Typography>
        </Stack>
      </Box>

      {item.notes && (
        <Typography color="text.secondary" fontSize={12.5} sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
          {item.notes}
        </Typography>
      )}
    </Box>
  );
}

export default function LectureSchedulePage() {
  const { user, profile } = useAuth();
  const allowManage = canBuildSchedule(profile?.role);
  const { lectures, loading, saving, error, addLecture, saveLecture, removeLecture } = useLectures();
  const [monthId, setMonthId] = useState(monthString(new Date()));
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<LectureEvent | null>(null);
  const [adding, setAdding] = useState(false);

  const visible = useMemo(() => lectures
    .filter((item) => item.active && item.date.startsWith(monthId))
    .filter((item) => `${item.title} ${item.category} ${item.presenter} ${item.location} ${item.notes}`
      .toLowerCase().includes(search.trim().toLowerCase())), [lectures, monthId, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, LectureEvent[]>();
    for (const item of visible) map.set(item.date, [...(map.get(item.date) || []), item]);
    return Array.from(map.entries())
      .map(([date, items]) => [date, items.sort((a, b) => a.startTime.localeCompare(b.startTime))] as const)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  async function handleSave(item: LectureEvent) {
    const now = new Date().toISOString();
    if (item.id) {
      await saveLecture({ ...item, updatedAt: now });
      setEditing(null);
    } else {
      const { id: _id, ...data } = item;
      await addLecture({ ...data, createdAt: now, updatedAt: now });
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this lecture or residency event?")) return;
    await removeLecture(id);
  }

  return (
    <Box sx={{ width: "100%", maxWidth: 1040, mx: "auto" }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1} sx={{ mb: 1.5 }}>
        <Box>
          <Typography variant="h4" fontWeight={900}>Lecture Schedule</Typography>
          <Typography color="text.secondary" fontSize={12.5}>Conferences, teaching sessions, and residency events.</Typography>
        </Box>
        {allowManage && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>Add Event</Button>}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      <Card sx={{ mb: 1.25, borderRadius: 2.5 }}>
        <CardContent sx={{ p: 1.25, "&:last-child": { pb: 1.25 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} alignItems="center">
            <Stack direction="row" spacing={0.5} alignItems="center">
              <IconButton size="small" onClick={() => setMonthId(shiftMonth(monthId, -1))}><ChevronLeftIcon /></IconButton>
              <Typography fontWeight={900} sx={{ minWidth: 150, textAlign: "center" }}>{monthTitle(monthId)}</Typography>
              <IconButton size="small" onClick={() => setMonthId(shiftMonth(monthId, 1))}><ChevronRightIcon /></IconButton>
            </Stack>
            <TextField size="small" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, presenter, location, or notes" sx={{ flex: 1, minWidth: { xs: "100%", sm: 280 } }} />
            <Button variant="outlined" onClick={() => setMonthId(monthString(new Date()))}>This Month</Button>
          </Stack>
        </CardContent>
      </Card>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 7 }}><CircularProgress /><Typography color="text.secondary" sx={{ mt: 1 }}>Loading lectures…</Typography></Stack>
      ) : grouped.length === 0 ? (
        <Alert severity="info">No lectures or residency events are scheduled for this month.</Alert>
      ) : (
        <Stack spacing={1.2}>
          {grouped.map(([date, items]) => (
            <Card key={date} sx={{ borderRadius: 2.5 }}>
              <CardContent sx={{ p: { xs: 1.25, sm: 1.5 }, "&:last-child": { pb: { xs: 1.25, sm: 1.5 } } }}>
                <Typography fontWeight={900} fontSize={17} sx={{ mb: 1 }}>{formatDate(date)}</Typography>
                <Stack spacing={0.9}>
                  {items.map((item) => (
                    <LectureCard key={item.id} item={item} allowManage={allowManage} onEdit={() => setEditing(item)} onDelete={() => void handleDelete(item.id)} />
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {(adding || editing) && (
        <LectureDialog open saving={saving} lecture={editing || emptyLecture(user?.uid)} onClose={() => { setAdding(false); setEditing(null); }} onSave={handleSave} />
      )}
    </Box>
  );
}

function LectureDialog({ open, saving, lecture, onClose, onSave }: {
  open: boolean;
  saving: boolean;
  lecture: LectureEvent;
  onClose: () => void;
  onSave: (lecture: LectureEvent) => Promise<void>;
}) {
  const [form, setForm] = useState(lecture);
  const knownLocation = locationOptions.includes(form.location as typeof locationOptions[number]) ? form.location : "Other";

  function toggleAudience(value: LectureAudience) {
    const exists = form.audience.includes(value);
    let next = exists ? form.audience.filter((item) => item !== value) : [...form.audience, value];
    if (value === "Everyone" && !exists) next = ["Everyone"];
    if (value !== "Everyone") next = next.filter((item) => item !== "Everyone");
    if (!next.length) next = ["Everyone"];
    setForm({ ...form, audience: next });
  }

  function changeCategory(category: LectureCategory) {
    const defaults = categoryDefaults[category];
    setForm({
      ...form,
      category,
      ...(defaults || {}),
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{form.id ? "Edit Lecture / Event" : "Add Lecture / Event"}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField label="Lecture Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <TextField select label="Category" value={form.category} onChange={(e) => changeCategory(e.target.value as LectureCategory)}>
            {categories.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField type="date" label="Date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField type="time" label="Start" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField type="time" label="End" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} InputLabelProps={{ shrink: true }} fullWidth />
          </Stack>
          <TextField label="Presenter" value={form.presenter} onChange={(e) => setForm({ ...form, presenter: e.target.value })} />
          <TextField
            select
            label="Location"
            value={knownLocation}
            onChange={(e) => {
              const value = e.target.value;
              setForm({ ...form, location: value === "Other" ? "" : value });
            }}
          >
            {locationOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
          {knownLocation === "Other" && (
            <TextField label="Other location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Enter location" />
          )}
          <Box>
            <Typography fontSize={12} fontWeight={850} sx={{ mb: 0.5 }}>Audience</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {audiences.map((item) => (
                <Chip key={item} label={item} clickable color={form.audience.includes(item) ? "primary" : "default"} variant={form.audience.includes(item) ? "filled" : "outlined"} onClick={() => toggleAudience(item)} />
              ))}
            </Stack>
          </Box>
          <TextField label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} multiline minRows={3} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button disabled={saving || !form.title.trim() || !form.date} variant="contained" onClick={() => void onSave(form)}>{saving ? "Saving…" : "Save"}</Button>
      </DialogActions>
    </Dialog>
  );
}
