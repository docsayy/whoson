import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";

import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { getAttendings } from "../services/attendingService";
import { createInviteCode, generateInviteCode } from "../services/inviteService";
import { getResidents } from "../services/residentService";
import type { Attending } from "../types/attending";
import type { InviteCode, InvitePersonType } from "../types/inviteCode";
import type { Resident } from "../types/resident";
import type { AppRole } from "../types/userProfile";
import { canManageResidents } from "../utils/permissions";

type InviteTab = "active" | "used" | "expired" | "revoked" | "all";
type InviteTargetType = "resident" | "attending" | "admin";

type InviteRow = InviteCode & {
  id: string;
};

const roleOptions: AppRole[] = [
  "Resident",
  "Chief Resident",
  "Attending",
  "Program Coordinator",
  "Admin",
];

function normalizeBool(value: boolean | string | undefined) {
  return value === true || value === "true";
}

function formatDateTime(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isInviteExpired(invite: InviteCode) {
  if (!invite.expiresAt) return true;
  return new Date(invite.expiresAt).getTime() < Date.now();
}

function getInviteStatus(invite: InviteCode): InviteTab {
  if (!normalizeBool(invite.active)) return "revoked";
  if (normalizeBool(invite.used)) return "used";
  if (isInviteExpired(invite)) return "expired";
  return "active";
}

function statusLabel(status: InviteTab) {
  if (status === "active") return "Active";
  if (status === "used") return "Used";
  if (status === "expired") return "Expired";
  if (status === "revoked") return "Revoked";
  return "All";
}

function statusChipStyle(status: InviteTab) {
  if (status === "active") {
    return {
      color: "#15803d",
      backgroundColor: "#ecfdf5",
      borderColor: "#bbf7d0",
    };
  }

  if (status === "used") {
    return {
      color: "#2563eb",
      backgroundColor: "#eff6ff",
      borderColor: "#bfdbfe",
    };
  }

  if (status === "expired") {
    return {
      color: "#b45309",
      backgroundColor: "#fffbeb",
      borderColor: "#fde68a",
    };
  }

  if (status === "revoked") {
    return {
      color: "#dc2626",
      backgroundColor: "#fef2f2",
      borderColor: "#fecaca",
    };
  }

  return {
    color: "#475569",
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
  };
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function roleForResident(resident: Resident): AppRole {
  if (resident.role === "Chief Resident") return "Chief Resident";
  if (resident.role === "Program Coordinator") return "Program Coordinator";
  return "Resident";
}

function safeText(value?: string) {
  return value?.trim() || "—";
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export default function InvitesPage() {
  const { profile } = useAuth();
  const allowManage = canManageResidents(profile?.role);

  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [attendings, setAttendings] = useState<Attending[]>([]);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionBusyCode, setActionBusyCode] = useState("");

  const [tab, setTab] = useState<InviteTab>("active");
  const [search, setSearch] = useState("");

  const [targetType, setTargetType] = useState<InviteTargetType>("resident");
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [selectedAttending, setSelectedAttending] = useState<Attending | null>(null);
  const [manualDisplayName, setManualDisplayName] = useState("");
  const [manualRole, setManualRole] = useState<AppRole>("Admin");
  const [expiresInDays, setExpiresInDays] = useState(7);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [latestCode, setLatestCode] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const inviteQuery = query(
        collection(db, "inviteCodes"),
        orderBy("createdAt", "desc")
      );

      const [inviteSnapshot, residentList, attendingList] = await Promise.all([
        getDocs(inviteQuery),
        getResidents(),
        getAttendings(),
      ]);

      const inviteRows = inviteSnapshot.docs.map((docSnap) => {
        const data = docSnap.data() as InviteCode;

        return {
          id: docSnap.id,
          ...data,
          code: data.code || docSnap.id,
        };
      });

      setInvites(inviteRows);
      setResidents(residentList);
      setAttendings(attendingList);
    } catch (err) {
      console.error(err);
      setError("Unable to load invites.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredInvites = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return invites
      .filter((invite) => {
        const status = getInviteStatus(invite);
        if (tab === "all") return true;
        return status === tab;
      })
      .filter((invite) => {
        if (!cleanSearch) return true;

        const text = [
          invite.code,
          invite.displayName,
          invite.role,
          invite.personType,
          invite.usedByEmail,
          invite.residentId,
          invite.attendingId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(cleanSearch);
      });
  }, [invites, search, tab]);

  const activeCount = useMemo(
    () => invites.filter((invite) => getInviteStatus(invite) === "active").length,
    [invites]
  );

  const usedCount = useMemo(
    () => invites.filter((invite) => getInviteStatus(invite) === "used").length,
    [invites]
  );

  const expiredCount = useMemo(
    () => invites.filter((invite) => getInviteStatus(invite) === "expired").length,
    [invites]
  );

  const revokedCount = useMemo(
    () => invites.filter((invite) => getInviteStatus(invite) === "revoked").length,
    [invites]
  );

  function resetCreateForm() {
    setSelectedResident(null);
    setSelectedAttending(null);
    setManualDisplayName("");
    setManualRole("Admin");
    setExpiresInDays(7);
  }

  function buildInvitePayload(): InviteCode {
    const code = generateInviteCode();
    const expiresAt = addDays(expiresInDays);

    if (targetType === "resident") {
      if (!selectedResident) {
        throw new Error("Please choose a resident.");
      }

      return {
        code,
        displayName: selectedResident.displayName,
        role: roleForResident(selectedResident),
        personType: "resident",
        residentId: selectedResident.id,
        expiresAt,
        used: false,
        active: true,
        createdAt: new Date().toISOString(),
        createdByUid: profile?.uid,
      };
    }

    if (targetType === "attending") {
      if (!selectedAttending) {
        throw new Error("Please choose an attending.");
      }

      return {
        code,
        displayName: selectedAttending.displayName,
        role: "Attending",
        personType: "attending",
        attendingId: selectedAttending.id,
        expiresAt,
        used: false,
        active: true,
        createdAt: new Date().toISOString(),
        createdByUid: profile?.uid,
      };
    }

    if (!manualDisplayName.trim()) {
      throw new Error("Please enter a display name.");
    }

    return {
      code,
      displayName: manualDisplayName.trim(),
      role: manualRole,
      personType: "admin" as InvitePersonType,
      expiresAt,
      used: false,
      active: true,
      createdAt: new Date().toISOString(),
      createdByUid: profile?.uid,
    };
  }

  async function handleCreateInvite() {
    if (!allowManage) return;

    try {
      setCreating(true);
      setError("");
      setMessage("");
      setLatestCode("");

      const invite = buildInvitePayload();
      const code = await createInviteCode(invite);

      setLatestCode(code);
      setMessage(`Invite created for ${invite.displayName}.`);
      resetCreateForm();
      await loadData();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to create invite.");
    } finally {
      setCreating(false);
    }
  }

  async function handleCopyInvite(code: string) {
    try {
      await copyText(code);
      setMessage(`Copied ${code}`);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Unable to copy invite code.");
    }
  }

  async function handleRevokeInvite(invite: InviteRow) {
    if (!allowManage) return;

    const confirmed = window.confirm(
      `Revoke invite ${invite.code} for ${invite.displayName}?`
    );

    if (!confirmed) return;

    try {
      setActionBusyCode(invite.code);
      setError("");
      setMessage("");

      await updateDoc(doc(db, "inviteCodes", invite.code), {
        active: false,
        revokedAt: new Date().toISOString(),
        revokedByUid: profile?.uid || "",
      });

      setMessage(`Invite revoked for ${invite.displayName}.`);
      await loadData();
    } catch (err) {
      console.error(err);
      setError("Unable to revoke invite.");
    } finally {
      setActionBusyCode("");
    }
  }

  async function handleReactivateInvite(invite: InviteRow) {
    if (!allowManage) return;

    try {
      setActionBusyCode(invite.code);
      setError("");
      setMessage("");

      await updateDoc(doc(db, "inviteCodes", invite.code), {
        active: true,
        used: false,
        expiresAt: addDays(7),
        reactivatedAt: new Date().toISOString(),
        reactivatedByUid: profile?.uid || "",
      });

      setMessage(`Invite reactivated for ${invite.displayName}.`);
      await loadData();
    } catch (err) {
      console.error(err);
      setError("Unable to reactivate invite.");
    } finally {
      setActionBusyCode("");
    }
  }

  if (!allowManage) {
    return (
      <Box sx={{ width: "100%", maxWidth: "none" }}>
        <Typography variant="h4" fontWeight={900} sx={{ mb: 2 }}>
          Invitations
        </Typography>

        <Alert severity="warning">
          You do not have permission to manage invitations.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", maxWidth: "none", minWidth: 0 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography
            variant="h4"
            fontWeight={900}
            sx={{ lineHeight: 1, fontSize: { xs: 25, md: 34 } }}
          >
            Invitations
          </Typography>

          <Typography color="text.secondary" fontSize={14}>
            Generate invite codes so users can sign up with their own email and
            password.
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Chip
            label={`${activeCount} active`}
            size="small"
            sx={{
              fontWeight: 850,
              color: "#15803d",
              backgroundColor: "#ecfdf5",
              border: "1px solid #bbf7d0",
            }}
          />

          <Chip
            label={`${usedCount} used`}
            size="small"
            sx={{
              fontWeight: 850,
              color: "#2563eb",
              backgroundColor: "#eff6ff",
              border: "1px solid #bfdbfe",
            }}
          />

          <Chip
            label={`${expiredCount} expired`}
            size="small"
            sx={{
              fontWeight: 850,
              color: "#b45309",
              backgroundColor: "#fffbeb",
              border: "1px solid #fde68a",
            }}
          />

          <Chip
            label={`${revokedCount} revoked`}
            size="small"
            sx={{
              fontWeight: 850,
              color: "#dc2626",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
            }}
          />
        </Stack>
      </Stack>

      {message && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
          {message}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {latestCode && (
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
                  New invite code
                </Typography>

                <Typography
                  fontFamily="monospace"
                  fontWeight={900}
                  fontSize={{ xs: 18, md: 22 }}
                  color="#14532d"
                >
                  {latestCode}
                </Typography>
              </Box>

              <Button
                variant="contained"
                startIcon={<ContentCopyIcon />}
                onClick={() => handleCopyInvite(latestCode)}
                sx={{ textTransform: "none", fontWeight: 850 }}
              >
                Copy Code
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 2, borderRadius: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <PersonAddIcon color="primary" />
              <Box>
                <Typography fontWeight={900} fontSize={18}>
                  Create Invite
                </Typography>
                <Typography color="text.secondary" fontSize={13.5}>
                  Choose a resident, attending, or admin/coordinator profile.
                  The invite can be used once.
                </Typography>
              </Box>
            </Stack>

            <Divider />

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "190px minmax(260px, 1fr) 170px auto",
                },
                gap: 1.5,
                alignItems: "center",
              }}
            >
              <FormControl fullWidth size="small">
                <InputLabel>Invite Type</InputLabel>
                <Select
                  label="Invite Type"
                  value={targetType}
                  onChange={(event) => {
                    setTargetType(event.target.value as InviteTargetType);
                    setSelectedResident(null);
                    setSelectedAttending(null);
                    setManualDisplayName("");
                  }}
                >
                  <MenuItem value="resident">Resident</MenuItem>
                  <MenuItem value="attending">Attending</MenuItem>
                  <MenuItem value="admin">Admin / Coordinator</MenuItem>
                </Select>
              </FormControl>

              {targetType === "resident" && (
                <Autocomplete
                  size="small"
                  options={residents.filter((resident) => resident.active)}
                  value={selectedResident}
                  onChange={(_, value) => setSelectedResident(value)}
                  getOptionLabel={(option) =>
                    `${option.displayName} • ${option.pgy} • ${option.role}`
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Resident"
                      placeholder="Choose resident"
                    />
                  )}
                />
              )}

              {targetType === "attending" && (
                <Autocomplete
                  size="small"
                  options={attendings.filter((attending) => attending.active)}
                  value={selectedAttending}
                  onChange={(_, value) => setSelectedAttending(value)}
                  getOptionLabel={(option) =>
                    `${option.displayName} • ${option.specialty || "Attending"}`
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Attending"
                      placeholder="Choose attending"
                    />
                  )}
                />
              )}

              {targetType === "admin" && (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    size="small"
                    label="Display Name"
                    value={manualDisplayName}
                    onChange={(event) => setManualDisplayName(event.target.value)}
                    fullWidth
                  />

                  <FormControl size="small" fullWidth>
                    <InputLabel>Role</InputLabel>
                    <Select
                      label="Role"
                      value={manualRole}
                      onChange={(event) => setManualRole(event.target.value as AppRole)}
                    >
                      {roleOptions.map((role) => (
                        <MenuItem key={role} value={role}>
                          {role}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              )}

              <FormControl fullWidth size="small">
                <InputLabel>Expires</InputLabel>
                <Select
                  label="Expires"
                  value={expiresInDays}
                  onChange={(event) => setExpiresInDays(Number(event.target.value))}
                >
                  <MenuItem value={1}>1 day</MenuItem>
                  <MenuItem value={3}>3 days</MenuItem>
                  <MenuItem value={7}>7 days</MenuItem>
                  <MenuItem value={14}>14 days</MenuItem>
                  <MenuItem value={30}>30 days</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="contained"
                startIcon={creating ? <CircularProgress size={18} /> : <AddIcon />}
                onClick={handleCreateInvite}
                disabled={creating}
                sx={{
                  textTransform: "none",
                  fontWeight: 900,
                  minHeight: 40,
                  whiteSpace: "nowrap",
                }}
              >
                Create Invite
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 1.5 }}>
          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", md: "center" }}
            >
              <Tabs
                value={tab}
                onChange={(_, value: InviteTab) => setTab(value)}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Active" value="active" />
                <Tab label="Used" value="used" />
                <Tab label="Expired" value="expired" />
                <Tab label="Revoked" value="revoked" />
                <Tab label="All" value="all" />
              </Tabs>

              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  label="Search invites"
                  placeholder="Name, code, role, email"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />

                <Tooltip title="Refresh">
                  <IconButton onClick={loadData}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            <Divider />

            {loading ? (
              <Stack alignItems="center" sx={{ py: 6 }}>
                <CircularProgress />
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  Loading invites...
                </Typography>
              </Stack>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Box sx={{ minWidth: 980 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns:
                        "190px minmax(180px, 1.2fr) 150px 130px 170px 170px 130px",
                      gap: 1,
                      px: 1,
                      py: 0.75,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <HeaderText>Code</HeaderText>
                    <HeaderText>Person</HeaderText>
                    <HeaderText>Role</HeaderText>
                    <HeaderText>Status</HeaderText>
                    <HeaderText>Expires</HeaderText>
                    <HeaderText>Used By</HeaderText>
                    <HeaderText>Actions</HeaderText>
                  </Box>

                  {filteredInvites.map((invite, index) => {
                    const status = getInviteStatus(invite);
                    const chipStyle = statusChipStyle(status);
                    const isBusy = actionBusyCode === invite.code;

                    return (
                      <Box
                        key={invite.id}
                        sx={{
                          display: "grid",
                          gridTemplateColumns:
                            "190px minmax(180px, 1.2fr) 150px 130px 170px 170px 130px",
                          gap: 1,
                          alignItems: "center",
                          px: 1,
                          py: 0.65,
                          minHeight: 48,
                          borderBottom: "1px solid",
                          borderColor: "#eef2f7",
                          backgroundColor: index % 2 === 0 ? "white" : "#f8fafc",
                        }}
                      >
                        <Typography
                          fontFamily="monospace"
                          fontSize={12.5}
                          fontWeight={900}
                        >
                          {invite.code}
                        </Typography>

                        <Box>
                          <Typography fontSize={13.5} fontWeight={850}>
                            {invite.displayName}
                          </Typography>

                          <Typography variant="caption" color="text.secondary">
                            {invite.personType}
                          </Typography>
                        </Box>

                        <Chip
                          label={invite.role}
                          size="small"
                          sx={{
                            width: "fit-content",
                            height: 22,
                            fontSize: 11,
                            fontWeight: 850,
                            color: invite.role === "Admin" ? "#7c2d12" : "#1e3a8a",
                            backgroundColor:
                              invite.role === "Admin" ? "#fff7ed" : "#eff6ff",
                            border: "1px solid",
                            borderColor:
                              invite.role === "Admin" ? "#fed7aa" : "#bfdbfe",
                          }}
                        />

                        <Chip
                          label={statusLabel(status)}
                          size="small"
                          icon={
                            status === "active" ? (
                              <CheckCircleIcon />
                            ) : status === "revoked" ? (
                              <BlockIcon />
                            ) : undefined
                          }
                          sx={{
                            width: "fit-content",
                            height: 22,
                            fontSize: 11,
                            fontWeight: 850,
                            color: chipStyle.color,
                            backgroundColor: chipStyle.backgroundColor,
                            border: "1px solid",
                            borderColor: chipStyle.borderColor,
                            "& .MuiChip-icon": {
                              fontSize: 15,
                              color: chipStyle.color,
                            },
                          }}
                        />

                        <Typography fontSize={12.5} color="text.secondary">
                          {formatDateTime(invite.expiresAt)}
                        </Typography>

                        <Box>
                          <Typography fontSize={12.5} fontWeight={700}>
                            {safeText(invite.usedByEmail)}
                          </Typography>

                          {invite.usedAt && (
                            <Typography variant="caption" color="text.secondary">
                              {formatDateTime(invite.usedAt)}
                            </Typography>
                          )}
                        </Box>

                        <Stack direction="row" spacing={0.25}>
                          <Tooltip title="Copy code">
                            <IconButton
                              size="small"
                              onClick={() => handleCopyInvite(invite.code)}
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {status === "active" && (
                            <Tooltip title="Revoke invite">
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  disabled={isBusy}
                                  onClick={() => handleRevokeInvite(invite)}
                                >
                                  {isBusy ? (
                                    <CircularProgress size={17} />
                                  ) : (
                                    <BlockIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}

                          {(status === "revoked" || status === "expired") && (
                            <Tooltip title="Reactivate for 7 days">
                              <span>
                                <IconButton
                                  size="small"
                                  color="success"
                                  disabled={isBusy}
                                  onClick={() => handleReactivateInvite(invite)}
                                >
                                  {isBusy ? (
                                    <CircularProgress size={17} />
                                  ) : (
                                    <RefreshIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </Stack>
                      </Box>
                    );
                  })}

                  {filteredInvites.length === 0 && (
                    <Stack alignItems="center" sx={{ py: 5 }}>
                      <AdminPanelSettingsIcon
                        sx={{ fontSize: 42, color: "#94a3b8", mb: 1 }}
                      />
                      <Typography fontWeight={850}>No invites found</Typography>
                      <Typography color="text.secondary" fontSize={13.5}>
                        Create a new invite above or change the filter.
                      </Typography>
                    </Stack>
                  )}
                </Box>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>
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
