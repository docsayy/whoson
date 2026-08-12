import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import LockResetIcon from "@mui/icons-material/LockReset";
import PersonIcon from "@mui/icons-material/Person";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SaveIcon from "@mui/icons-material/Save";
import SecurityIcon from "@mui/icons-material/Security";
import TuneIcon from "@mui/icons-material/Tune";

import {
  THEME_COLOR_OPTIONS,
  createDefaultSidebarSettings,
  getNavItem,
  normalizeSidebarSettings,
} from "../config/navigation";
import { useAuth } from "../context/AuthContext";
import { useSidebarSettings } from "../hooks/useSidebarSettings";
import {
  getMyAccountDetails,
  saveMyAccountDetails,
  type MyAccountDetails,
} from "../services/accountService";
import {
  restoreDefaultSidebarSettings,
  saveSidebarSettings,
} from "../services/sidebarSettingsService";
import type { AppThemeMode, SidebarSettings } from "../types/sidebarSettings";
import { canManageResidents } from "../utils/permissions";

type SettingsTab = "profile" | "security" | "interface";
type Audience = "standard" | "manager";

const emptyAccount: MyAccountDetails = {
  firstName: "",
  lastName: "",
  displayName: "",
  email: "",
  phone: "",
  pager: "",
  linkedType: "user",
};

export default function SettingsPage() {
  const { user, profile, resetPassword, refreshProfile } = useAuth();
  const { settings, loading: settingsLoading, error: settingsError } =
    useSidebarSettings();
  const canManage = canManageResidents(profile?.role);

  const [tab, setTab] = useState<SettingsTab>("profile");
  const [account, setAccount] = useState<MyAccountDetails>(emptyAccount);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountSaving, setAccountSaving] = useState(false);
  const [draft, setDraft] = useState<SidebarSettings>(
    createDefaultSidebarSettings()
  );
  const [interfaceSaving, setInterfaceSaving] = useState(false);
  const [message, setMessage] = useState<{
    severity: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    setDraft(normalizeSidebarSettings(settings));
  }, [settings]);

  useEffect(() => {
    async function loadAccount() {
      if (!profile) return;
      try {
        setAccountLoading(true);
        setAccount(await getMyAccountDetails(profile));
      } catch (error) {
        console.error(error);
        setMessage({ severity: "error", text: "Unable to load your profile." });
      } finally {
        setAccountLoading(false);
      }
    }
    void loadAccount();
  }, [profile]);

  const counts = useMemo(
    () => ({
      standard: draft.items.filter((item) => item.visibleToStandardUsers).length,
      manager: draft.items.filter((item) => item.visibleToManagers).length,
    }),
    [draft.items]
  );

  async function saveAccount() {
    if (!profile) return;
    try {
      setAccountSaving(true);
      setMessage(null);
      await saveMyAccountDetails(profile, account);
      await refreshProfile();
      setMessage({
        severity: "success",
        text: "Your profile was updated. The current name, phone, and pager will be used throughout WhosOn.",
      });
    } catch (error) {
      console.error(error);
      setMessage({
        severity: "error",
        text: error instanceof Error ? error.message : "Unable to update profile.",
      });
    } finally {
      setAccountSaving(false);
    }
  }

  async function sendResetEmail() {
    const email = profile?.email || user?.email || "";
    if (!email) return;
    try {
      await resetPassword(email);
      setMessage({
        severity: "success",
        text: `Password-reset email sent to ${email}.`,
      });
    } catch (error) {
      console.error(error);
      setMessage({ severity: "error", text: "Unable to send reset email." });
    }
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.items.length) return;
    setDraft((current) => {
      const items = [...current.items];
      const [moved] = items.splice(index, 1);
      items.splice(target, 0, moved);
      return { ...current, items };
    });
  }

  function toggleVisibility(index: number, audience: Audience) {
    const preference = draft.items[index];
    const navItem = getNavItem(preference.page);
    if (!navItem) return;
    if (audience === "standard" && navItem.managerOnly) return;
    if (audience === "manager" && navItem.requiredForManagers) return;

    setDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex !== index
          ? item
          : audience === "standard"
            ? {
                ...item,
                visibleToStandardUsers: !item.visibleToStandardUsers,
              }
            : { ...item, visibleToManagers: !item.visibleToManagers }
      ),
    }));
  }

  async function saveInterface() {
    if (!user || !canManage) return;
    try {
      setInterfaceSaving(true);
      await saveSidebarSettings(draft, user.uid);
      setMessage({
        severity: "success",
        text: "Sidebar order, visibility, and theme were saved for the app.",
      });
    } catch (error) {
      console.error(error);
      setMessage({ severity: "error", text: "Unable to save app settings." });
    } finally {
      setInterfaceSaving(false);
    }
  }

  async function restoreDefaults() {
    if (!user || !canManage) return;
    try {
      setInterfaceSaving(true);
      await restoreDefaultSidebarSettings(user.uid);
      setMessage({ severity: "success", text: "Default interface restored." });
    } catch (error) {
      console.error(error);
      setMessage({ severity: "error", text: "Unable to restore defaults." });
    } finally {
      setInterfaceSaving(false);
    }
  }

  const visibleTabs: SettingsTab[] = canManage
    ? ["profile", "security", "interface"]
    : ["profile", "security"];

  useEffect(() => {
    if (!visibleTabs.includes(tab)) setTab("profile");
  }, [canManage, tab]);

  return (
    <Box sx={{ width: "100%", maxWidth: 1080, mx: "auto" }}>
      <Box sx={{ mb: 1.25 }}>
        <Typography variant="h4">Settings</Typography>
        <Typography color="text.secondary" fontSize={12.5}>
          Maintain your profile and security. Managers can also control the
          shared app interface.
        </Typography>
      </Box>

      {message && (
        <Alert
          severity={message.severity}
          onClose={() => setMessage(null)}
          sx={{ mb: 1.25 }}
        >
          {message.text}
        </Alert>
      )}

      <Card variant="outlined" sx={{ mb: 1.25 }}>
        <Tabs
          value={tab}
          onChange={(_, value: SettingsTab) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<PersonIcon />} iconPosition="start" label="My Profile" value="profile" />
          <Tab icon={<SecurityIcon />} iconPosition="start" label="Security" value="security" />
          {canManage && (
            <Tab icon={<TuneIcon />} iconPosition="start" label="App Interface" value="interface" />
          )}
        </Tabs>
      </Card>

      {tab === "profile" && (
        <Card variant="outlined">
          <CardContent>
            {accountLoading ? (
              <Stack alignItems="center" sx={{ py: 5 }}>
                <CircularProgress size={28} />
              </Stack>
            ) : (
              <Stack spacing={1.25}>
                <Box>
                  <Typography variant="h6">My Profile</Typography>
                  <Typography color="text.secondary" fontSize={11.5}>
                    Linked {account.linkedType} profile. Changes are written to
                    the canonical person record so updated details appear across
                    schedules and profiles.
                  </Typography>
                </Box>
                <Divider />
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 1,
                  }}
                >
                  <TextField
                    size="small"
                    label="First name"
                    value={account.firstName}
                    onChange={(event) =>
                      setAccount({ ...account, firstName: event.target.value })
                    }
                    disabled={account.linkedType === "user"}
                  />
                  <TextField
                    size="small"
                    label="Last name"
                    value={account.lastName}
                    onChange={(event) =>
                      setAccount({ ...account, lastName: event.target.value })
                    }
                    disabled={account.linkedType === "user"}
                  />
                  <TextField
                    size="small"
                    required
                    label="Display name"
                    value={account.displayName}
                    onChange={(event) =>
                      setAccount({ ...account, displayName: event.target.value })
                    }
                  />
                  <TextField size="small" label="Email" value={account.email} disabled />
                  <TextField
                    size="small"
                    label="Phone"
                    value={account.phone}
                    onChange={(event) =>
                      setAccount({ ...account, phone: event.target.value })
                    }
                  />
                  <TextField
                    size="small"
                    label="Pager"
                    value={account.pager}
                    onChange={(event) =>
                      setAccount({ ...account, pager: event.target.value })
                    }
                    disabled={account.linkedType === "user"}
                  />
                </Box>
                <Button
                  variant="contained"
                  startIcon={
                    accountSaving ? <CircularProgress size={16} /> : <SaveIcon />
                  }
                  disabled={accountSaving || !account.displayName.trim()}
                  onClick={saveAccount}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Save Profile
                </Button>
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "security" && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.25}>
              <Box>
                <Typography variant="h6">Password & Account Security</Typography>
                <Typography color="text.secondary" fontSize={11.5}>
                  WhosOn never displays or stores your existing password.
                </Typography>
              </Box>
              <Divider />
              <Box>
                <Typography fontWeight={800} fontSize={12.5}>
                  Signed-in email
                </Typography>
                <Typography color="text.secondary" fontSize={12}>
                  {profile?.email || user?.email || "—"}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={<LockResetIcon />}
                onClick={sendResetEmail}
                sx={{ alignSelf: "flex-start" }}
              >
                Email Me a Password-Reset Link
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {tab === "interface" && canManage && (
        <Stack spacing={1.25}>
          {settingsError && <Alert severity="warning">{settingsError}</Alert>}
          {settingsLoading ? (
            <Stack alignItems="center" sx={{ py: 5 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : (
            <>
              <Card variant="outlined">
                <CardContent>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Box>
                      <Typography variant="h6">Theme</Typography>
                      <Typography color="text.secondary" fontSize={11.5}>
                        Shared across users and devices.
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.75}>
                      <Button
                        variant="outlined"
                        startIcon={<RestartAltIcon />}
                        onClick={restoreDefaults}
                        disabled={interfaceSaving}
                      >
                        Restore Defaults
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<SaveIcon />}
                        onClick={saveInterface}
                        disabled={interfaceSaving}
                      >
                        Save App Settings
                      </Button>
                    </Stack>
                  </Stack>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    sx={{ mt: 1.25 }}
                  >
                    <FormControl size="small" sx={{ minWidth: 170 }}>
                      <InputLabel>Appearance</InputLabel>
                      <Select
                        label="Appearance"
                        value={draft.theme.mode}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            theme: {
                              ...current.theme,
                              mode: event.target.value as AppThemeMode,
                            },
                          }))
                        }
                      >
                        <MenuItem value="light">Light</MenuItem>
                        <MenuItem value="dark">Dark</MenuItem>
                      </Select>
                    </FormControl>
                    <Box>
                      <Typography fontWeight={800} fontSize={11.5} sx={{ mb: 0.6 }}>
                        Accent color
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={0.6}>
                        {THEME_COLOR_OPTIONS.map((option) => {
                          const selected =
                            draft.theme.primaryColor.toLowerCase() ===
                            option.value.toLowerCase();
                          return (
                            <Tooltip title={option.label} key={option.value}>
                              <Button
                                aria-label={`Use ${option.label}`}
                                onClick={() =>
                                  setDraft((current) => ({
                                    ...current,
                                    theme: {
                                      ...current.theme,
                                      primaryColor: option.value,
                                    },
                                  }))
                                }
                                sx={{
                                  minWidth: 34,
                                  width: 34,
                                  height: 34,
                                  p: 0,
                                  borderRadius: "50%",
                                  backgroundColor: option.value,
                                  border: selected
                                    ? "3px solid currentColor"
                                    : "2px solid transparent",
                                  "&:hover": { backgroundColor: option.value },
                                }}
                              />
                            </Tooltip>
                          );
                        })}
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    spacing={0.5}
                    sx={{ mb: 1 }}
                  >
                    <Box>
                      <Typography variant="h6">Sidebar Pages</Typography>
                      <Typography color="text.secondary" fontSize={11.5}>
                        The saved order is the exact order rendered in the left menu.
                      </Typography>
                    </Box>
                    <Typography color="text.secondary" fontSize={11}>
                      Standard: {counts.standard} · Managers: {counts.manager}
                    </Typography>
                  </Stack>
                  <Divider />
                  <Stack spacing={0.6} sx={{ mt: 1 }}>
                    {draft.items.map((preference, index) => {
                      const navItem = getNavItem(preference.page);
                      if (!navItem) return null;
                      return (
                        <Box
                          key={preference.page}
                          sx={{
                            display: "grid",
                            gridTemplateColumns: {
                              xs: "auto 1fr",
                              md: "80px minmax(190px,1fr) 180px 180px",
                            },
                            alignItems: "center",
                            gap: 0.5,
                            p: 0.65,
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1.5,
                          }}
                        >
                          <Stack direction="row" spacing={0}>
                            <IconButton
                              size="small"
                              onClick={() => moveItem(index, -1)}
                              disabled={index === 0}
                            >
                              <ArrowUpwardIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => moveItem(index, 1)}
                              disabled={index === draft.items.length - 1}
                            >
                              <ArrowDownwardIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Box sx={{ color: "text.secondary", display: "flex" }}>
                              {navItem.icon}
                            </Box>
                            <Typography fontWeight={800} fontSize={12}>
                              {navItem.label}
                            </Typography>
                          </Stack>
                          <Stack direction="row" alignItems="center">
                            <Switch
                              size="small"
                              checked={preference.visibleToStandardUsers}
                              onChange={() => toggleVisibility(index, "standard")}
                              disabled={Boolean(navItem.managerOnly)}
                            />
                            <Typography fontSize={10.5}>Standard</Typography>
                          </Stack>
                          <Stack direction="row" alignItems="center">
                            <Switch
                              size="small"
                              checked={preference.visibleToManagers}
                              onChange={() => toggleVisibility(index, "manager")}
                              disabled={Boolean(navItem.requiredForManagers)}
                            />
                            <Typography fontSize={10.5}>Managers</Typography>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            </>
          )}
        </Stack>
      )}
    </Box>
  );
}
