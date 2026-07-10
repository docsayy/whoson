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
  IconButton,
  MenuItem,
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
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { useAuth } from "../context/AuthContext";
import { createInviteCode, generateInviteCode } from "../services/inviteService";
import { useResidents } from "../hooks/useResidents";
import type { InviteCode } from "../types/inviteCode";
import type { PGY, Resident, ResidentRole } from "../types/resident";
import type { AppRole } from "../types/userProfile";
import { canManageResidents } from "../utils/permissions";

type ResidentTab = "Everyone" | "PGY-1" | "PGY-2" | "PGY-3";

const emptyResident: Resident = {
  id: "",
  firstName: "",
  lastName: "",
  displayName: "",
  email: "",
  pager: "",
  phone: "",
  pgy: "PGY-1",
  role: "Resident",
  active: true,
};

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function roleForResident(resident: Resident): AppRole {
  if (resident.role === "Chief Resident") return "Chief Resident";
  if (resident.role === "Program Coordinator") return "Program Coordinator";
  if (resident.role === "Attending") return "Attending";
  return "Resident";
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export default function ResidentsPage({
  onOpenResidentProfile,
}: {
  onOpenResidentProfile?: (residentId: string) => void;
}) {
  const { profile } = useAuth();
  const allowManage = canManageResidents(profile?.role);

  const {
    residents,
    loading,
    error,
    addResident,
    saveResident,
    removeResident,
  } = useResidents();

  const [tab, setTab] = useState<ResidentTab>("Everyone");
  const [search, setSearch] = useState("");
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [addingResident, setAddingResident] = useState(false);

  const [inviteBusyResidentId, setInviteBusyResidentId] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [latestInviteCode, setLatestInviteCode] = useState("");
  const [latestInviteName, setLatestInviteName] = useState("");

  const filteredResidents = useMemo(() => {
    return residents
      .filter((resident) => {
        if (tab === "Everyone") return true;
        return resident.pgy === tab;
      })
      .filter((resident) => {
        const text =
          `${resident.displayName} ${resident.firstName} ${resident.lastName} ${resident.email} ${resident.pgy} ${resident.role} ${resident.pager}`.toLowerCase();

        return text.includes(search.toLowerCase());
      })
      .sort((a, b) => {
        const pgySort = a.pgy.localeCompare(b.pgy);
        if (pgySort !== 0) return pgySort;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [residents, search, tab]);

  async function deactivateResident(id: string) {
    if (!allowManage) return;
    const resident = residents.find((item) => item.id === id);
    if (!resident) return;
    await saveResident({ ...resident, active: false });
  }

  async function activateResident(id: string) {
    if (!allowManage) return;
    const resident = residents.find((item) => item.id === id);
    if (!resident) return;
    await saveResident({ ...resident, active: true });
  }

  async function saveEditedResident(updated: Resident) {
    if (!allowManage) return;
    await saveResident(updated);
    setEditingResident(null);
  }

  async function handleAddResident(newResident: Resident) {
    if (!allowManage) return;

    const { id, ...residentWithoutId } = newResident;
    void id;

    await addResident({
      ...residentWithoutId,
      active: true,
    });

    setAddingResident(false);
  }

  async function handleDeleteResident(id: string) {
    if (!allowManage) return;

    const confirmed = window.confirm("Delete this resident?");
    if (!confirmed) return;

    await removeResident(id);
  }

  async function handleGenerateInvite(resident: Resident) {
    if (!allowManage) return;

    try {
      setInviteBusyResidentId(resident.id);
      setInviteError("");
      setInviteMessage("");
      setLatestInviteCode("");
      setLatestInviteName("");

      const code = generateInviteCode();

      const invite: InviteCode = {
        code,
        displayName: resident.displayName,
        role: roleForResident(resident),
        personType: "resident",
        residentId: resident.id,
        expiresAt: addDays(7),
        used: false,
        active: true,
        createdAt: new Date().toISOString(),
        createdByUid: profile?.uid,
      };

      const createdCode = await createInviteCode(invite);

      setLatestInviteCode(createdCode);
      setLatestInviteName(resident.displayName);
      setInviteMessage(`Invite created for ${resident.displayName}.`);
    } catch (err) {
      console.error(err);
      setInviteError(
        err instanceof Error ? err.message : "Unable to generate invite."
      );
    } finally {
      setInviteBusyResidentId("");
    }
  }

  async function handleCopyLatestInvite() {
    try {
      if (!latestInviteCode) return;
      await copyText(latestInviteCode);
      setInviteMessage(`Copied invite code for ${latestInviteName}.`);
      setInviteError("");
    } catch (err) {
      console.error(err);
      setInviteError("Unable to copy invite code.");
    }
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
            Residents
          </Typography>
          <Typography color="text.secondary">
            Click a resident name to open their monthly calendar and block schedule.
          </Typography>
        </Box>

        {allowManage && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddingResident(true)}
          >
            Add Resident
          </Button>
        )}
      </Stack>

      {!allowManage && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You have view-only access. Chiefs, program coordinators, and admins can
          edit resident profiles.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {inviteError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {inviteError}
        </Alert>
      )}

      {inviteMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {inviteMessage}
        </Alert>
      )}

      {latestInviteCode && (
        <Card
          sx={{
            mb: 2,
            borderRadius: 3,
            border: "1px solid #bbf7d0",
            backgroundColor: "#f0fdf4",
          }}
        >
          <CardContent sx={{ p: 2 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", sm: "center" }}
              spacing={1.5}
            >
              <Box>
                <Typography fontWeight={900} color="#166534">
                  New invite for {latestInviteName}
                </Typography>

                <Typography
                  fontFamily="monospace"
                  fontWeight={900}
                  fontSize={{ xs: 18, md: 22 }}
                  color="#14532d"
                >
                  {latestInviteCode}
                </Typography>

                <Typography fontSize={13} color="text.secondary">
                  This code expires in 7 days and can be used once.
                </Typography>
              </Box>

              <Button
                variant="contained"
                startIcon={<ContentCopyIcon />}
                onClick={handleCopyLatestInvite}
                sx={{ textTransform: "none", fontWeight: 850 }}
              >
                Copy Code
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent sx={{ p: 1.5 }}>
          <Stack spacing={1.5}>
            <Tabs
              value={tab}
              onChange={(_, value: ResidentTab) => setTab(value)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="Everyone" value="Everyone" />
              <Tab label="PGY1" value="PGY-1" />
              <Tab label="PGY2" value="PGY-2" />
              <Tab label="PGY3" value="PGY-3" />
            </Tabs>

            <TextField
              size="small"
              fullWidth
              label="Search residents"
              placeholder="Search by name, pager, PGY, role, or email"
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
                Loading residents...
              </Typography>
            </Stack>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Box sx={{ minWidth: allowManage ? 960 : 680 }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: allowManage
                      ? "minmax(220px,1.5fr) 100px 150px 100px 300px"
                      : "minmax(220px,1.5fr) 100px 150px 100px",
                    gap: 1,
                    px: 1,
                    py: 0.75,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <HeaderText>Name</HeaderText>
                  <HeaderText>Pager</HeaderText>
                  <HeaderText>PGY / Role</HeaderText>
                  <HeaderText>Status</HeaderText>
                  {allowManage && <HeaderText>Controls</HeaderText>}
                </Box>

                {filteredResidents.map((resident, index) => (
                  <Box
                    key={resident.id}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: allowManage
                        ? "minmax(220px,1.5fr) 100px 150px 100px 300px"
                        : "minmax(220px,1.5fr) 100px 150px 100px",
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
                        onClick={() => onOpenResidentProfile?.(resident.id)}
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
                        {resident.displayName}
                      </Button>

                      <Typography variant="caption" color="text.secondary" display="block">
                        {resident.email || `${resident.firstName} ${resident.lastName}`}
                      </Typography>
                    </Box>

                    <Typography fontSize={13} fontWeight={700}>
                      {resident.pager ? `📟 ${resident.pager}` : "—"}
                    </Typography>

                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <LevelChip level={resident.pgy} />
                      {resident.role !== "Resident" && (
                        <Chip
                          label={resident.role}
                          size="small"
                          sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                        />
                      )}
                    </Stack>

                    <Chip
                      label={resident.active ? "Active" : "Inactive"}
                      size="small"
                      sx={{
                        width: "fit-content",
                        height: 22,
                        fontSize: 11,
                        fontWeight: 800,
                        color: resident.active ? "#15803d" : "#64748b",
                        backgroundColor: resident.active ? "#ecfdf5" : "#f1f5f9",
                        border: "1px solid",
                        borderColor: resident.active ? "#bbf7d0" : "#e2e8f0",
                      }}
                    />

                    {allowManage && (
                      <Stack direction="row" spacing={0.25} alignItems="center">
                        <Tooltip title="Open schedule profile">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => onOpenResidentProfile?.(resident.id)}
                          >
                            <CalendarMonthIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Generate signup invite">
                          <span>
                            <IconButton
                              size="small"
                              color="success"
                              disabled={
                                !resident.active ||
                                inviteBusyResidentId === resident.id
                              }
                              onClick={() => handleGenerateInvite(resident)}
                            >
                              {inviteBusyResidentId === resident.id ? (
                                <CircularProgress size={17} />
                              ) : (
                                <VpnKeyIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>

                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => setEditingResident(resident)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title={resident.active ? "Deactivate" : "Activate"}>
                          <IconButton
                            size="small"
                            color={resident.active ? "warning" : "success"}
                            onClick={() =>
                              resident.active
                                ? deactivateResident(resident.id)
                                : activateResident(resident.id)
                            }
                          >
                            {resident.active ? (
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
                            onClick={() => handleDeleteResident(resident.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )}
                  </Box>
                ))}

                {filteredResidents.length === 0 && (
                  <Typography color="text.secondary" sx={{ p: 2 }}>
                    No residents found.
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {editingResident && allowManage && (
        <ResidentFormDialog
          title="Edit Resident"
          resident={editingResident}
          open={Boolean(editingResident)}
          onCancel={() => setEditingResident(null)}
          onSave={saveEditedResident}
        />
      )}

      {addingResident && allowManage && (
        <ResidentFormDialog
          title="Add Resident"
          resident={emptyResident}
          open={addingResident}
          onCancel={() => setAddingResident(false)}
          onSave={handleAddResident}
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

function LevelChip({ level }: { level: string }) {
  const style =
    level === "PGY-1"
      ? { color: "#dc2626", bg: "#fff1f2", border: "#fecdd3" }
      : level === "PGY-2"
        ? { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" }
        : { color: "#15803d", bg: "#ecfdf5", border: "#bbf7d0" };

  return (
    <Chip
      label={level}
      size="small"
      sx={{
        height: 20,
        fontSize: 11,
        fontWeight: 900,
        color: style.color,
        backgroundColor: style.bg,
        border: "1px solid",
        borderColor: style.border,
      }}
    />
  );
}

function ResidentFormDialog({
  title,
  resident,
  open,
  onCancel,
  onSave,
}: {
  title: string;
  resident: Resident;
  open: boolean;
  onCancel: () => void;
  onSave: (resident: Resident) => void;
}) {
  const [form, setForm] = useState<Resident>(resident);

  function handleSave() {
    const displayName =
      form.displayName.trim() ||
      `${form.firstName.trim()} ${form.lastName.trim()}`.trim();

    onSave({
      ...form,
      displayName,
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
            select
            label="PGY"
            value={form.pgy}
            onChange={(e) => setForm({ ...form, pgy: e.target.value as PGY })}
            fullWidth
          >
            <MenuItem value="PGY-1">PGY-1</MenuItem>
            <MenuItem value="PGY-2">PGY-2</MenuItem>
            <MenuItem value="PGY-3">PGY-3</MenuItem>
          </TextField>

          <TextField
            select
            label="Role"
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as ResidentRole })
            }
            fullWidth
          >
            <MenuItem value="Resident">Resident</MenuItem>
            <MenuItem value="Chief Resident">Chief Resident</MenuItem>
            <MenuItem value="Attending">Attending</MenuItem>
            <MenuItem value="Program Coordinator">Program Coordinator</MenuItem>
          </TextField>
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