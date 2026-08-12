import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";

import { getResidentCallServicesForDate } from "../config/scheduleServices";
import { useAuth } from "../context/AuthContext";
import { useAcademicBlocks } from "../hooks/useAcademicBlocks";
import { useAttendingSchedule } from "../hooks/useAttendingSchedule";
import { useBlockAssignments } from "../hooks/useBlockAssignments";
import { useMonthlyScheduleRange } from "../hooks/useMonthlyScheduleRange";
import { useResidents } from "../hooks/useResidents";
import {
  calendarFeedUrl,
  createCalendarSubscription,
  disableCalendarSubscription,
  getCalendarSubscription,
  regenerateCalendarSubscription,
  saveCalendarSubscription,
  type CalendarFeedScope,
  type CalendarSubscriptionSettings,
} from "../services/calendarSubscriptionService";
import { getLatestPublishedAssignmentsForYear } from "../services/blockAssignmentService";
import { CONFIRMED_2026_HOSPITAL_HOLIDAYS } from "../utils/holidayRules";
import { createIcsCalendar, downloadTextFile, type IcsEvent } from "../utils/ics";
import { canBuildSchedule } from "../utils/permissions";
import { getEffectiveMonthlyCell } from "../utils/schedulingIntelligence";

function academicYearFor(date: Date) {
  const year = date.getFullYear();
  return date.getMonth() >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function monthIdsForAcademicYear(academicYear: string) {
  const startYear = Number(academicYear.slice(0, 4));
  return [
    ...Array.from({ length: 6 }, (_, index) => `${startYear}-${String(index + 7).padStart(2, "0")}`),
    ...Array.from({ length: 6 }, (_, index) => `${startYear + 1}-${String(index + 1).padStart(2, "0")}`),
  ];
}

function dateRange(start: string, end: string) {
  const values: string[] = [];
  const current = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (current <= last) {
    values.push(
      `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`
    );
    current.setDate(current.getDate() + 1);
  }
  return values;
}

export default function CalendarSubscriptionPage() {
  const { user, profile } = useAuth();
  const manager = canBuildSchedule(profile?.role);
  const currentAcademicYear = academicYearFor(new Date());
  const monthIds = useMemo(
    () => monthIdsForAcademicYear(currentAcademicYear),
    [currentAcademicYear]
  );
  const [settings, setSettings] = useState<CalendarSubscriptionSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { residents, loading: residentsLoading } = useResidents();
  const { blocks, loading: blocksLoading } = useAcademicBlocks();
  const { assignments: allBlockAssignments, loading: blockAssignmentsLoading } = useBlockAssignments();
  const { assignments: attendingAssignments, loading: attendingLoading } = useAttendingSchedule();
  const {
    assignments: monthlyAssignments,
    schedules,
    loading: monthlyLoading,
  } = useMonthlyScheduleRange(monthIds);

  useEffect(() => {
    async function load() {
      if (!user || !profile) return;
      try {
        setLoadingSettings(true);
        setSettings(await getCalendarSubscription(user.uid));
      } catch (err) {
        console.error(err);
        setError("Unable to load calendar settings.");
      } finally {
        setLoadingSettings(false);
      }
    }
    void load();
  }, [profile, user]);

  const publishedBlockAssignments = useMemo(
    () => getLatestPublishedAssignmentsForYear(allBlockAssignments, currentAcademicYear),
    [allBlockAssignments, currentAcademicYear]
  );

  const feedUrl = settings?.token ? calendarFeedUrl(settings.token) : "";

  const calendarEvents = useMemo(() => {
    if (!settings) return [];
    const events: IcsEvent[] = [];
    const program = settings.scope === "program" && manager;
    const residentId = settings.residentId || profile?.residentId;
    const attendingId = settings.attendingId || profile?.attendingId;

    if (settings.includeBlocks) {
      for (const assignment of publishedBlockAssignments) {
        if (!program && assignment.residentId !== residentId) continue;
        const block = blocks.find((item) => item.id === assignment.blockId);
        if (!block) continue;
        events.push({
          uid: `block-${assignment.id}`,
          title: program
            ? `${assignment.residentName} — ${assignment.rotationName}`
            : `Block ${assignment.blockNumber}: ${assignment.rotationName}`,
          startDate: block.startDate,
          endDate: block.endDate,
          allDay: true,
          description: `${assignment.residentName}, ${assignment.rotationName}`,
        });
      }
    }

    if (settings.includeCalls) {
      const dates = blocks
        .filter((block) => block.academicYear === currentAcademicYear)
        .flatMap((block) => dateRange(block.startDate, block.endDate));
      for (const date of Array.from(new Set(dates))) {
        const schedule = schedules[date.slice(0, 7)];
        if (schedule?.status !== "published") continue;
        for (const service of getResidentCallServicesForDate(date)) {
          const effective = getEffectiveMonthlyCell({
            date,
            service,
            monthlyAssignments,
            blocks,
            blockAssignments: publishedBlockAssignments,
            residents,
          }).cell;
          if (!effective) continue;
          if (!program && effective.residentId !== residentId) continue;
          events.push({
            uid: `call-${date}-${service.id}-${effective.residentId}`,
            title: program
              ? `${service.name} — ${effective.residentName}`
              : service.name,
            startDate: date,
            startTime: effective.startTime,
            endTime: effective.endTime,
            description: `${effective.residentName} (${effective.training})${effective.notes ? ` — ${effective.notes}` : ""}`,
            location: "Flushing Hospital Medical Center",
          });
        }
      }
    }

    if (settings.includeActiveChief) {
      for (const block of blocks.filter((item) => item.academicYear === currentAcademicYear)) {
        const chief = block.activeChiefPublished;
        if (!chief) continue;
        if (!program && chief.residentId !== residentId) continue;
        events.push({
          uid: `active-chief-${block.id}-${chief.residentId}`,
          title: program ? `Active Chief — ${chief.residentName}` : "Active Chief",
          startDate: block.startDate,
          endDate: block.endDate,
          allDay: true,
          description: `${chief.residentName} is Active Chief for ${block.name}.`,
        });
      }
    }

    if (settings.includeAttendingAssignments) {
      for (const assignment of attendingAssignments) {
        if (!program && assignment.attendingId !== attendingId) continue;
        events.push({
          uid: `attending-${assignment.id}`,
          title: program
            ? `${assignment.serviceName} — ${assignment.attendingName}`
            : assignment.serviceName,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          allDay: true,
          description: `${assignment.attendingName}. ${assignment.coverageNote || assignment.notes || ""}`,
        });
      }
    }

    if (settings.includeHolidays) {
      for (const holiday of CONFIRMED_2026_HOSPITAL_HOLIDAYS) {
        events.push({
          uid: `holiday-${holiday.date}`,
          title: holiday.name,
          startDate: holiday.date,
          allDay: true,
          description: "Hospital-observed holiday; weekend coverage rules apply.",
        });
      }
    }

    return events;
  }, [
    attendingAssignments,
    blocks,
    currentAcademicYear,
    manager,
    monthlyAssignments,
    profile?.attendingId,
    profile?.residentId,
    publishedBlockAssignments,
    residents,
    schedules,
    settings,
  ]);

  async function createFeed() {
    if (!user || !profile) return;
    try {
      setSaving(true);
      const created = await createCalendarSubscription({
        uid: user.uid,
        role: profile.role,
        displayName: profile.displayName,
        residentId: profile.residentId,
        attendingId: profile.attendingId,
        scope: "personal",
      });
      setSettings(created);
      setMessage("Private static calendar path created.");
    } catch (err) {
      console.error(err);
      setError("Unable to create calendar settings.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings() {
    if (!settings) return;
    try {
      setSaving(true);
      const next = { ...settings, updatedAt: new Date().toISOString() };
      await saveCalendarSubscription(next);
      setSettings(next);
      setMessage("Calendar settings saved. Regenerate the static file after schedule publication.");
    } catch (err) {
      console.error(err);
      setError("Unable to save calendar settings.");
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    if (!settings || !window.confirm("Create a new private path? The previous URL will no longer be used.")) return;
    try {
      setSaving(true);
      const next = await regenerateCalendarSubscription(settings);
      setSettings(next);
      setMessage("Private calendar path regenerated.");
    } catch (err) {
      console.error(err);
      setError("Unable to regenerate the calendar path.");
    } finally {
      setSaving(false);
    }
  }

  async function disable() {
    if (!settings || !window.confirm("Disable this calendar path?")) return;
    try {
      setSaving(true);
      const next = await disableCalendarSubscription(settings);
      setSettings(next);
      setMessage("Calendar path disabled.");
    } catch (err) {
      console.error(err);
      setError("Unable to disable the calendar path.");
    } finally {
      setSaving(false);
    }
  }

  function downloadFeed() {
    if (!settings) return;
    const name = settings.scope === "program" && manager
      ? "WhosOn Program Schedule"
      : `WhosOn — ${settings.displayName}`;
    downloadTextFile(
      createIcsCalendar(name, calendarEvents),
      `${settings.token}.ics`
    );
    setMessage(`Downloaded ${settings.token}.ics with ${calendarEvents.length} published events.`);
  }

  const loading =
    loadingSettings ||
    residentsLoading ||
    blocksLoading ||
    blockAssignmentsLoading ||
    attendingLoading ||
    monthlyLoading;

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
        <Typography color="text.secondary" sx={{ mt: 1 }}>Preparing calendar feed…</Typography>
      </Stack>
    );
  }

  return (
    <Box sx={{ width: "100%", maxWidth: 980, mx: "auto" }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1} sx={{ mb: 1.5 }}>
        <Box>
          <Typography variant="h4" fontWeight={900}>Free Static Calendar Feed</Typography>
          <Typography color="text.secondary" fontSize={12.5}>
            No Cloud Functions, no Blaze plan, and no automatic schedule creation. Only published schedules are exported.
          </Typography>
        </Box>
        <Chip icon={<CalendarMonthIcon />} label={settings?.enabled ? "Path active" : "Path inactive"} color={settings?.enabled ? "success" : "default"} variant="outlined" />
      </Stack>

      {message && <Alert severity="success" sx={{ mb: 1 }} onClose={() => setMessage("")}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError("")}>{error}</Alert>}

      {!settings ? (
        <Card sx={{ borderRadius: 2.5 }}>
          <CardContent>
            <Typography fontWeight={900}>Create a private calendar filename</Typography>
            <Typography color="text.secondary" fontSize={12.5} sx={{ mt: 0.5 }}>
              This creates a long random token. It does not create a paid backend.
            </Typography>
            <Button variant="contained" startIcon={<CalendarMonthIcon />} onClick={() => void createFeed()} disabled={saving} sx={{ mt: 1.5 }}>
              Create Calendar Path
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.25}>
          <Card sx={{ borderRadius: 2.5 }}>
            <CardContent>
              <Typography fontWeight={900}>Static subscription URL</Typography>
              <TextField fullWidth size="small" value={feedUrl} InputProps={{ readOnly: true }} sx={{ mt: 1 }} />
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                <Button variant="contained" startIcon={<DownloadIcon />} onClick={downloadFeed} disabled={!settings.enabled}>
                  Download Updated .ics
                </Button>
                <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => { void navigator.clipboard.writeText(feedUrl); setMessage("Calendar URL copied."); }}>
                  Copy URL
                </Button>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void regenerate()}>
                  New Private Path
                </Button>
                <Button variant="outlined" color="warning" startIcon={<LinkOffIcon />} onClick={() => void disable()}>
                  Disable
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 2.5 }}>
            <CardContent>
              <Typography fontWeight={900} sx={{ mb: 0.75 }}>Feed contents</Typography>
              {manager && (
                <TextField select size="small" label="Scope" value={settings.scope} onChange={(event) => setSettings({ ...settings, scope: event.target.value as CalendarFeedScope })} sx={{ width: { xs: "100%", sm: 280 }, mb: 1 }}>
                  <MenuItem value="personal">My published schedule</MenuItem>
                  <MenuItem value="program">Entire published program</MenuItem>
                </TextField>
              )}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
                <FormControlLabel control={<Checkbox checked={settings.includeBlocks} onChange={(event) => setSettings({ ...settings, includeBlocks: event.target.checked })} />} label="Block rotations" />
                <FormControlLabel control={<Checkbox checked={settings.includeCalls} onChange={(event) => setSettings({ ...settings, includeCalls: event.target.checked })} />} label="Daily calls and Night Float" />
                <FormControlLabel control={<Checkbox checked={settings.includeActiveChief} onChange={(event) => setSettings({ ...settings, includeActiveChief: event.target.checked })} />} label="Active Chief" />
                <FormControlLabel control={<Checkbox checked={settings.includeAttendingAssignments} onChange={(event) => setSettings({ ...settings, includeAttendingAssignments: event.target.checked })} />} label="Attending assignments" />
                <FormControlLabel control={<Checkbox checked={settings.includeHolidays} onChange={(event) => setSettings({ ...settings, includeHolidays: event.target.checked })} />} label="Hospital holidays" />
              </Box>
              <Button variant="contained" startIcon={<SaveIcon />} onClick={() => void saveSettings()} disabled={saving} sx={{ mt: 1 }}>
                Save Settings
              </Button>
              <Chip size="small" label={`${calendarEvents.length} events ready`} sx={{ ml: 1, mt: 1 }} />
            </CardContent>
          </Card>

          <Alert severity="info">
            <b>Free deployment workflow:</b> after publishing schedules, download the updated file, place it at <code>public/calendar/{settings.token}.ics</code>, run <code>npm run build</code>, and deploy Firebase Hosting. The URL stays the same, so Apple Calendar, Google Calendar, and Outlook can refresh it. The included <code>npm run calendars:generate -- backup.json</code> script can generate every enabled feed from a WhosOn backup at once.
          </Alert>
        </Stack>
      )}
    </Box>
  );
}
