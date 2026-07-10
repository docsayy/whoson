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
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";

import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SaveIcon from "@mui/icons-material/Save";

import {
  THEME_COLOR_OPTIONS,
  createDefaultSidebarSettings,
  getNavItem,
  normalizeSidebarSettings,
} from "../config/navigation";
import { useAuth } from "../context/AuthContext";
import { useSidebarSettings } from "../hooks/useSidebarSettings";
import {
  restoreDefaultSidebarSettings,
  saveSidebarSettings,
} from "../services/sidebarSettingsService";
import type {
  AppThemeMode,
  SidebarSettings,
} from "../types/sidebarSettings";
import { canManageResidents } from "../utils/permissions";

type Audience = "standard" | "manager";

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const { settings, loading, error } = useSidebarSettings();

  const [draft, setDraft] = useState<SidebarSettings>(
    createDefaultSidebarSettings()
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    severity: "success" | "error";
    text: string;
  } | null>(null);

  const canManage = canManageResidents(profile?.role);

  useEffect(() => {
    setDraft(normalizeSidebarSettings(settings));
  }, [settings]);

  const counts = useMemo(
    () => ({
      standard: draft.items.filter((item) => item.visibleToStandardUsers).length,
      manager: draft.items.filter((item) => item.visibleToManagers).length,
    }),
    [draft.items]
  );

  function moveItem(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= draft.items.length) {
      return;
    }

    setDraft((current) => {
      const items = [...current.items];
      const [movedItem] = items.splice(index, 1);
      items.splice(targetIndex, 0, movedItem);

      return {
        ...current,
        items,
      };
    });

    setMessage(null);
  }

  function toggleVisibility(index: number, audience: Audience) {
    const preference = draft.items[index];
    const navItem = getNavItem(preference.page);

    if (!navItem) {
      return;
    }

    if (audience === "standard" && navItem.managerOnly) {
      return;
    }

    if (audience === "manager" && navItem.requiredForManagers) {
      return;
    }

    setDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        return audience === "standard"
          ? {
              ...item,
              visibleToStandardUsers: !item.visibleToStandardUsers,
            }
          : {
              ...item,
              visibleToManagers: !item.visibleToManagers,
            };
      }),
    }));

    setMessage(null);
  }

  function updateThemeMode(mode: AppThemeMode) {
    setDraft((current) => ({
      ...current,
      theme: {
        ...current.theme,
        mode,
      },
    }));
    setMessage(null);
  }

  function updatePrimaryColor(primaryColor: string) {
    setDraft((current) => ({
      ...current,
      theme: {
        ...current.theme,
        primaryColor,
      },
    }));
    setMessage(null);
  }

  async function handleSave() {
    if (!user || !canManage) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await saveSidebarSettings(draft, user.uid);
      setMessage({
        severity: "success",
        text: "Sidebar visibility, page order, and theme were saved for the entire app.",
      });
    } catch (saveError) {
      console.error("Unable to save interface settings:", saveError);
      setMessage({
        severity: "error",
        text: "The settings could not be saved. Check your Firestore permissions and try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreDefaults() {
    if (!user || !canManage) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await restoreDefaultSidebarSettings(user.uid);
      setMessage({
        severity: "success",
        text: "The default sidebar order, visibility, and theme were restored.",
      });
    } catch (restoreError) {
      console.error("Unable to restore interface settings:", restoreError);
      setMessage({
        severity: "error",
        text: "The default settings could not be restored.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <Alert severity="error">
        You do not have permission to manage application settings.
      </Alert>
    );
  }

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: 240,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", maxWidth: 1050, mx: "auto" }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "flex-start" }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Settings
          </Typography>

          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Control page visibility by user group, sidebar order, and the
            application theme.
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RestartAltIcon />}
            onClick={handleRestoreDefaults}
            disabled={saving}
          >
            Restore defaults
          </Button>

          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            Save all settings
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography variant="h6" fontWeight={800}>
            Color theme
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            These colors apply globally to all users and devices.
          </Typography>

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            sx={{ mt: 2 }}
          >
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel id="theme-mode-label">Appearance</InputLabel>
              <Select
                labelId="theme-mode-label"
                label="Appearance"
                value={draft.theme.mode}
                onChange={(event) =>
                  updateThemeMode(event.target.value as AppThemeMode)
                }
                disabled={saving}
              >
                <MenuItem value="light">Light</MenuItem>
                <MenuItem value="dark">Dark</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                Main accent color
              </Typography>

              <Stack direction="row" flexWrap="wrap" gap={1}>
                {THEME_COLOR_OPTIONS.map((option) => {
                  const selected =
                    draft.theme.primaryColor.toLowerCase() ===
                    option.value.toLowerCase();

                  return (
                    <Tooltip title={option.label} key={option.value}>
                      <Button
                        type="button"
                        aria-label={`Use ${option.label} theme`}
                        onClick={() => updatePrimaryColor(option.value)}
                        disabled={saving}
                        sx={{
                          minWidth: 44,
                          width: 44,
                          height: 44,
                          p: 0,
                          borderRadius: "50%",
                          backgroundColor: option.value,
                          border: selected
                            ? "4px solid"
                            : "2px solid transparent",
                          borderColor: selected
                            ? "text.primary"
                            : "transparent",
                          boxShadow: selected ? 3 : 0,
                          "&:hover": {
                            backgroundColor: option.value,
                            opacity: 0.88,
                          },
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
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            spacing={1}
            sx={{ mb: 1.5 }}
          >
            <Box>
              <Typography variant="h6" fontWeight={800}>
                Sidebar pages
              </Typography>

              <Typography variant="body2" color="text.secondary">
                Page order is shared. Visibility is controlled separately for
                each user group.
              </Typography>
            </Box>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 0, sm: 2 }}
            >
              <Typography variant="body2" color="text.secondary">
                Standard users: {counts.standard} visible
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Managers: {counts.manager} visible
              </Typography>
            </Stack>
          </Stack>

          <Divider />

          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {draft.items.map((preference, index) => {
              const navItem = getNavItem(preference.page);

              if (!navItem) {
                return null;
              }

              return (
                <Box
                  key={preference.page}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "auto minmax(0, 1fr)",
                      md: "auto minmax(220px, 1fr) 210px 240px",
                    },
                    alignItems: "center",
                    gap: { xs: 0.5, md: 1 },
                    p: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <Stack direction="row" spacing={0.25}>
                    <Tooltip title="Move up">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => moveItem(index, -1)}
                          disabled={index === 0 || saving}
                        >
                          <ArrowUpwardIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="Move down">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => moveItem(index, 1)}
                          disabled={
                            index === draft.items.length - 1 || saving
                          }
                        >
                          <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ minWidth: 0 }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        color: "text.secondary",
                      }}
                    >
                      {navItem.icon}
                    </Box>

                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={700} noWrap>
                        {navItem.label}
                      </Typography>

                      {navItem.managerOnly && (
                        <Typography variant="caption" color="text.secondary">
                          Management page
                        </Typography>
                      )}
                    </Box>
                  </Stack>

                  <FormControlLabel
                    sx={{
                      m: 0,
                      gridColumn: { xs: "2", md: "auto" },
                    }}
                    control={
                      <Switch
                        checked={preference.visibleToStandardUsers}
                        onChange={() => toggleVisibility(index, "standard")}
                        disabled={navItem.managerOnly || saving}
                      />
                    }
                    label={
                      navItem.managerOnly
                        ? "Residents: unavailable"
                        : preference.visibleToStandardUsers
                          ? "Residents: shown"
                          : "Residents: hidden"
                    }
                  />

                  <FormControlLabel
                    sx={{
                      m: 0,
                      gridColumn: { xs: "2", md: "auto" },
                    }}
                    control={
                      <Switch
                        checked={preference.visibleToManagers}
                        onChange={() => toggleVisibility(index, "manager")}
                        disabled={navItem.requiredForManagers || saving}
                      />
                    }
                    label={
                      navItem.requiredForManagers
                        ? "Managers: required"
                        : preference.visibleToManagers
                          ? "Managers: shown"
                          : "Managers: hidden"
                    }
                  />
                </Box>
              );
            })}
          </Stack>
        </CardContent>
      </Card>

      <Alert severity="info" sx={{ mt: 2 }}>
        “Managers” means admin, chief resident, and program coordinator.
        “Standard users” includes residents, attendings, and other signed-in
        users. Hiding a page only removes its sidebar link; route permissions
        remain separate.
      </Alert>
    </Box>
  );
}
