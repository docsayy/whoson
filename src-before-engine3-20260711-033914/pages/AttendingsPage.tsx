import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
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
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

import { useAuth } from "../context/AuthContext";
import { useAttendings } from "../hooks/useAttendings";
import type { Attending } from "../types/attending";
import { canManageResidents } from "../utils/permissions";

type AttendingTab = "All" | "Admitting" | "Specialty" | "Inactive";

const specialtyOptions = [
  "Medicine",
  "Observation",
  "Faculty",
  "Cardiology",
  "Gastroenterology",
  "Neurology",
  "Pulmonary",
  "MICU",
  "Infectious Disease",
  "Nephrology",
  "Rheumatology",
  "Hematology",
  "Oncology",
  "Endocrinology",
  "Other",
];

const emptyAttending: Attending = {
  id: "",
  firstName: "",
  lastName: "",
  displayName: "",
  specialty: "",
  email: "",
  pager: "",
  phone: "",
  active: true,
  availableForScheduling: true,
  notes: "",
};

function isAdmittingAttending(attending: Attending) {
  const text = `${attending.specialty} ${attending.notes}`.toLowerCase();

  if (!attending.specialty?.trim()) return true;

  return (
    text.includes("admitting") ||
    text.includes("observation") ||
    text.includes("faculty") ||
    text.includes("medicine") ||
    text.includes("general")
  );
}

export default function AttendingsPage({
  onOpenAttendingProfile,
}: {
  onOpenAttendingProfile?: (attendingId: string) => void;
}) {
  const { profile } = useAuth();
  const allowManage = canManageResidents(profile?.role);

  const {
    attendings,
    loading,
    error,
    addAttending,
    saveAttending,
    removeAttending,
  } = useAttendings();

  const [tab, setTab] = useState<AttendingTab>("All");
  const [search, setSearch] = useState("");
  const [editingAttending, setEditingAttending] = useState<Attending | null>(null);
  const [addingAttending, setAddingAttending] = useState(false);

  const filteredAttendings = useMemo(() => {
    return attendings
      .filter((attending) => {
        if (tab === "All") return true;
        if (tab === "Admitting") return attending.active && isAdmittingAttending(attending);
        if (tab === "Specialty") return attending.active && !isAdmittingAttending(attending);
        if (tab === "Inactive") return !attending.active;
        return true;
      })
      .filter((attending) => {
        const text =
          `${attending.displayName} ${attending.firstName} ${attending.lastName} ${attending.specialty} ${attending.email} ${attending.pager} ${attending.phone}`.toLowerCase();

        return text.includes(search.toLowerCase());
      })
      .sort((a, b) => {
        const specialtySort = (a.specialty || "").localeCompare(b.specialty || "");
        if (specialtySort !== 0) return specialtySort;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [attendings, search, tab]);

  async function handleAddAttending(attending: Attending) {
    if (!allowManage) return;

    const { id, ...attendingWithoutId } = attending;
    void id;

    await addAttending({
      ...attendingWithoutId,
      active: true,
      availableForScheduling: true,
    });

    setAddingAttending(false);
  }

  async function handleSaveAttending(attending: Attending) {
    if (!allowManage) return;
    await saveAttending(attending);
    setEditingAttending(null);
  }

  async function toggleActive(attending: Attending) {
    if (!allowManage) return;
    await saveAttending({ ...attending, active: !attending.active });
  }

  async function handleDeleteAttending(id: string) {
    if (!allowManage) return;

    const confirmed = window.confirm("Delete this attending?");
    if (!confirmed) return;

    await removeAttending(id);
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Attendings
          </Typography>
          <Typography color="text.secondary">
            Manage admitting attendings and specialty/consulting attendings.
          </Typography>
        </Box>

        {allowManage && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddingAttending(true)}
          >
            Add Attending
          </Button>
        )}
      </Stack>

      {!allowManage && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You have view-only access. Chiefs, coordinators, and admins can manage attendings.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent sx={{ p: 1.5 }}>
          <Stack spacing={1.5}>
            <Tabs
              value={tab}
              onChange={(_, value: AttendingTab) => setTab(value)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="All" value="All" />
              <Tab label="Admitting Attendings" value="Admitting" />
              <Tab label="Specialty / Consulting" value="Specialty" />
              <Tab label="Inactive" value="Inactive" />
            </Tabs>

            <TextField
              size="small"
              fullWidth
              label="Search attendings"
              placeholder="Search by name, specialty, pager, phone, or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 1.5 }}>
          {loading ? (
            <Stack alignItems="center" sx={{ py: 5 }}>
              <CircularProgress />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                Loading attendings...
              </Typography>
            </Stack>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Box sx={{ minWidth: allowManage ? 880 : 720 }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: allowManage
                      ? "minmax(210px,1.4fr) 190px 150px 130px 150px"
                      : "minmax(210px,1.4fr) 190px 150px 130px",
                    gap: 1,
                    px: 1,
                    py: 0.75,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <HeaderText>Name</HeaderText>
                  <HeaderText>Specialty</HeaderText>
                  <HeaderText>Phone</HeaderText>
                  <HeaderText>Status</HeaderText>
                  {allowManage && <HeaderText>Controls</HeaderText>}
                </Box>

                {filteredAttendings.map((attending, index) => (
                  <Box
                    key={attending.id}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: allowManage
                        ? "minmax(210px,1.4fr) 190px 150px 130px 150px"
                        : "minmax(210px,1.4fr) 190px 150px 130px",
                      gap: 1,
                      alignItems: "center",
                      px: 1,
                      py: 0.5,
                      minHeight: 42,
                      borderBottom: "1px solid",
                      borderColor: "#eef2f7",
                      backgroundColor: index % 2 === 0 ? "white" : "#f8fafc",
                    }}
                  >
                    <Box>
                      <Button
                        variant="text"
                        onClick={() => onOpenAttendingProfile?.(attending.id)}
                        sx={{
                          p: 0,
                          minWidth: 0,
                          textTransform: "none",
                          fontSize: 13.5,
                          fontWeight: 850,
                          color: "#0f172a",
                          justifyContent: "flex-start",
                          "&:hover": {
                            backgroundColor: "transparent",
                            textDecoration: "underline",
                          },
                        }}
                      >
                        {attending.displayName}
                      </Button>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {attending.email || `${attending.firstName} ${attending.lastName}`}
                      </Typography>
                    </Box>

                    <Typography fontSize={12.5} fontWeight={700}>
                      {attending.specialty || "Medicine"}
                    </Typography>

                    <Typography fontSize={13} fontWeight={700}>
                      {attending.phone ? `☎ ${attending.phone}` : "—"}
                    </Typography>

                    <Chip
                      label={attending.active ? "Active" : "Inactive"}
                      size="small"
                      sx={{
                        width: "fit-content",
                        height: 21,
                        fontSize: 11,
                        fontWeight: 800,
                        color: attending.active ? "#15803d" : "#64748b",
                        backgroundColor: attending.active ? "#ecfdf5" : "#f1f5f9",
                        border: "1px solid",
                        borderColor: attending.active ? "#bbf7d0" : "#e2e8f0",
                      }}
                    />

                    {allowManage && (
                      <Stack direction="row" spacing={0.25} alignItems="center">
                        <Tooltip title="Open attending profile">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => onOpenAttendingProfile?.(attending.id)}
                          >
                            <CalendarMonthIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => setEditingAttending(attending)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title={attending.active ? "Deactivate" : "Activate"}>
                          <IconButton
                            size="small"
                            color={attending.active ? "warning" : "success"}
                            onClick={() => toggleActive(attending)}
                          >
                            {attending.active ? (
                              <ToggleOffIcon fontSize="small" />
                            ) : (
                              <ToggleOnIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteAttending(attending.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )}
                  </Box>
                ))}

                {filteredAttendings.length === 0 && (
                  <Typography color="text.secondary" sx={{ p: 2 }}>
                    No attendings found.
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {addingAttending && allowManage && (
        <AttendingFormDialog
          title="Add Attending"
          attending={emptyAttending}
          open={addingAttending}
          onCancel={() => setAddingAttending(false)}
          onSave={handleAddAttending}
        />
      )}

      {editingAttending && allowManage && (
        <AttendingFormDialog
          title="Edit Attending"
          attending={editingAttending}
          open={Boolean(editingAttending)}
          onCancel={() => setEditingAttending(null)}
          onSave={handleSaveAttending}
        />
      )}
    </Box>
  );
}

function HeaderText({ children }: { children: React.ReactNode }) {
  return (
    <Typography fontSize={12} fontWeight={850} color="text.secondary">
      {children}
    </Typography>
  );
}

function AttendingFormDialog({
  title,
  attending,
  open,
  onCancel,
  onSave,
}: {
  title: string;
  attending: Attending;
  open: boolean;
  onCancel: () => void;
  onSave: (attending: Attending) => void;
}) {
  const [form, setForm] = useState<Attending>(attending);

  function handleSave() {
    const displayName =
      form.displayName.trim() ||
      `${form.firstName.trim()} ${form.lastName.trim()}`.trim();

    onSave({
      ...form,
      displayName,
      specialty: form.specialty.trim(),
    });
  }

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Display Name"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            fullWidth
          />

          <TextField
            label="First Name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            fullWidth
          />

          <TextField
            label="Last Name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            fullWidth
          />

          <Autocomplete
            freeSolo
            options={specialtyOptions}
            value={form.specialty || ""}
            onChange={(_, value) =>
              setForm({ ...form, specialty: value || "" })
            }
            onInputChange={(_, value) =>
              setForm({ ...form, specialty: value })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Specialty / Group"
                placeholder="Pick or type specialty"
                helperText="This controls filtered attending dropdowns in the attending schedule."
                fullWidth
              />
            )}
          />

          <TextField
            label="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            fullWidth
          />

          <TextField
            label="Pager"
            value={form.pager}
            onChange={(e) => setForm({ ...form, pager: e.target.value })}
            fullWidth
          />

          <TextField
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            fullWidth
          />

          <TextField
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            multiline
            minRows={3}
            placeholder="Optional notes. You can also add keywords here."
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