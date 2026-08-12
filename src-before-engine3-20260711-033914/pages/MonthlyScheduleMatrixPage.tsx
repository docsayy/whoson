import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import TodayIcon from "@mui/icons-material/Today";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import {
  getResidentCallServicesForDate,
  getServiceTimingForDate,
  isServiceAvailableOnDate,
  isShortDutyService,
  RESIDENT_CALL_SERVICES,
  type ResidentCallServiceDefinition,
} from "../config/scheduleServices";
import { useAuth } from "../context/AuthContext";
import { useAcademicBlocks } from "../hooks/useAcademicBlocks";
import { useBlockAssignments } from "../hooks/useBlockAssignments";
import { useMonthlyScheduleRange } from "../hooks/useMonthlyScheduleRange";
import { useResidents } from "../hooks/useResidents";
import {
  getDraftAssignmentsForYear,
  getLatestPublishedAssignmentsForYear,
} from "../services/blockAssignmentService";
import type { MonthlyScheduleCell } from "../types/monthSchedule";
import type { RequiredTraining, ScheduleService } from "../types/schedule";
import {
  parseCallScheduleWorkbook,
  type CallImportPreviewRow,
} from "../utils/callScheduleImport";
import { getHospitalHoliday, isHospitalHoliday } from "../utils/holidayRules";
import {
  getAutoNightFloatCell,
  isNightFloatService,
  parseLocalDate,
  residentTraining,
} from "../utils/nightFloatSchedule";
import { canBuildSchedule } from "../utils/permissions";
import {
  detectDailyScheduleIssues,
  issueSeverityStyle,
  type ScheduleIssue,
} from "../utils/schedulingIntelligence";

type SchedulePerson = {
  id: string;
  displayName: string;
  training: RequiredTraining;
  pager: string;
};

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getThursdayStart(date: Date) {
  const current = new Date(date);
  const day = current.getDay();
  const diff = day >= 4 ? 4 - day : -3 - day;
  current.setDate(current.getDate() + diff);
  return current;
}

function getWeekDays(start: string) {
  const startDate = parseLocalDate(start);
  return Array.from({ length: 7 }, (_, index) =>
    toDateInputValue(addDays(startDate, index))
  );
}

function isWeekend(date: string) {
  const day = parseLocalDate(date).getDay();
  return day === 0 || day === 6;
}

function formatDay(date: string) {
  const parsed = parseLocalDate(date);
  return `${parsed.toLocaleDateString("en-US", { weekday: "short" })} ${parsed.getDate()}`;
}

function formatRange(days: string[]) {
  if (!days.length) return "";
  return `${parseLocalDate(days[0]).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${parseLocalDate(days[days.length - 1]).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function serviceIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("short duty")) return "⏱️";
  if (lower.includes("chief") || lower.includes("pgy3 nf")) return "👑";
  if (lower.includes("nf")) return "🌙";
  if (lower.includes("micu")) return "🫁";
  if (lower.includes("ccu")) return "🫀";
  if (lower.includes("tele")) return "🖥️";
  return "🏥";
}

function downloadCsv(rows: MonthlyScheduleCell[], filename: string) {
  const header = "Date,Service,Resident,PGY,Start,End,Notes";
  const lines = rows.map((cell) =>
    [cell.date, cell.serviceName, cell.residentName, cell.training, cell.startTime, cell.endTime, cell.notes]
      .map((value) => `"${String(value || "").replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function MonthlyScheduleMatrixPage({
  onOpenResidentProfile,
}: {
  onOpenResidentProfile?: (residentId: string) => void;
}) {
  const { profile } = useAuth();
  const allowBuild = canBuildSchedule(profile?.role);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [weekStartDate, setWeekStartDate] = useState(
    toDateInputValue(getThursdayStart(new Date()))
  );
  const [editingCell, setEditingCell] = useState<{
    date: string;
    service: ScheduleService;
  } | null>(null);
  const [importRows, setImportRows] = useState<CallImportPreviewRow[]>([]);
  const [replaceDifferent, setReplaceDifferent] = useState(false);
  const [message, setMessage] = useState("");

  const days = useMemo(() => getWeekDays(weekStartDate), [weekStartDate]);
  const monthIds = useMemo(
    () => Array.from(new Set(days.map((date) => date.slice(0, 7)))),
    [days]
  );

  const { residents } = useResidents();
  const { blocks } = useAcademicBlocks();
  const { assignments: allBlockAssignments } = useBlockAssignments();
  const {
    assignments: monthlyAssignments,
    loading,
    saving,
    error,
    allPublished,
    updateCell,
    removeCell,
    setRangeStatus,
    importCells,
  } = useMonthlyScheduleRange(monthIds);

  const relevantYears = useMemo(
    () =>
      Array.from(
        new Set(
          blocks
            .filter((block) => days.some((date) => date >= block.startDate && date <= block.endDate))
            .map((block) => block.academicYear)
        )
      ),
    [blocks, days]
  );

  const blockAssignments = useMemo(
    () =>
      relevantYears.flatMap((year) =>
        allowBuild
          ? getDraftAssignmentsForYear(allBlockAssignments, year)
          : getLatestPublishedAssignmentsForYear(allBlockAssignments, year)
      ),
    [allBlockAssignments, allowBuild, relevantYears]
  );

  const canViewSchedule = allowBuild || allPublished;

  const scheduleIssues = useMemo(
    () =>
      days.flatMap((date) =>
        detectDailyScheduleIssues({
          date,
          services: getResidentCallServicesForDate(date),
          monthlyAssignments,
          blocks,
          blockAssignments,
          residents,
        })
      ),
    [blockAssignments, blocks, days, monthlyAssignments, residents]
  );

  function getManualCell(date: string, service: ScheduleService) {
    return monthlyAssignments[`${date}_${service.id}`];
  }

  function getAutoCell(date: string, service: ScheduleService) {
    return getAutoNightFloatCell({
      date,
      service,
      blocks,
      blockAssignments,
      residents,
    });
  }

  function getCell(date: string, service: ScheduleService) {
    return getManualCell(date, service) || getAutoCell(date, service);
  }

  function getEligiblePeople(
    service: ScheduleService,
    date: string,
    includeCoverageOverride = false
  ): SchedulePerson[] {
    const required = service.requiredTraining || [];
    let eligibleResidents = residents.filter((resident) => {
      if (!resident.active) return false;
      return required.length === 0 || required.includes(residentTraining(resident));
    });

    if (isShortDutyService(service) && !includeCoverageOverride) {
      const definition = service as ResidentCallServiceDefinition;
      const currentBlock = blocks.find(
        (block) => date >= block.startDate && date <= block.endDate
      );

      if (currentBlock && definition.floorRotationId) {
        const floorResidentIds = new Set(
          blockAssignments
            .filter(
              (assignment) =>
                assignment.blockId === currentBlock.id &&
                assignment.rotationId === definition.floorRotationId
            )
            .map((assignment) => assignment.residentId)
        );

        eligibleResidents = eligibleResidents.filter((resident) =>
          floorResidentIds.has(resident.id)
        );
      } else {
        eligibleResidents = [];
      }
    }

    return eligibleResidents
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((resident) => ({
        id: resident.id,
        displayName: resident.displayName,
        training: residentTraining(resident),
        pager: resident.pager,
      }));
  }

  async function saveCell(data: {
    date: string;
    service: ScheduleService;
    personId: string;
    notes: string;
  }) {
    const person = getEligiblePeople(data.service, data.date, true).find(
      (item) => item.id === data.personId
    );
    if (!person) return;

    const timing = getServiceTimingForDate(data.service, data.date);

    await updateCell({
      date: data.date,
      serviceId: data.service.id,
      serviceName: data.service.name,
      residentId: person.id,
      residentName: person.displayName,
      training: person.training,
      pager: person.pager,
      shiftType: data.service.defaultShiftType || "Day",
      startTime: timing.startTime,
      endTime: timing.endTime,
      notes: data.notes,
    });
    setEditingCell(null);
  }

  async function handleImport(file: File) {
    const rows = await parseCallScheduleWorkbook({
      file,
      residents,
      existingAssignments: monthlyAssignments,
      blocks,
      blockAssignments,
    });
    setImportRows(rows);
    setReplaceDifferent(false);
  }

  async function applyImport() {
    const cells = importRows
      .filter((row) => {
        if (!row.cell || row.action === "review" || row.action === "same") return false;
        if (row.action === "replace" && !replaceDifferent) return false;
        return true;
      })
      .map((row) => row.cell!);

    await importCells(cells, replaceDifferent);
    setImportRows([]);
    setMessage(`Imported ${cells.length} call assignment${cells.length === 1 ? "" : "s"} as draft.`);
  }

  return (
    <Box sx={{ width: "100%", maxWidth: "none", minWidth: 0 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }} className="no-print">
        <Box>
          <Typography variant="h4" fontWeight={900} sx={{ fontSize: { xs: 25, md: 34 }, lineHeight: 1 }}>
            Daily Call Schedule
          </Typography>
          <Typography color="text.secondary" fontSize={14}>
            Thursday-to-Wednesday weekly schedule with Excel import and block-aware conflict checks.
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()} sx={{ textTransform: "none" }}>Print/PDF</Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => downloadCsv(Object.values(monthlyAssignments).filter((cell) => days.includes(cell.date)), `whoson-call-${days[0]}-${days[days.length - 1]}.csv`)} sx={{ textTransform: "none" }}>CSV</Button>
          {allowBuild && (
            <>
              <input ref={fileInputRef} hidden type="file" accept=".xlsx,.xls" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImport(file); event.currentTarget.value = ""; }} />
              <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => fileInputRef.current?.click()} sx={{ textTransform: "none" }}>Import Excel</Button>
              <Button variant={allPublished ? "outlined" : "contained"} color={allPublished ? "warning" : "primary"} onClick={() => setRangeStatus(allPublished ? "draft" : "published")} sx={{ textTransform: "none", fontWeight: 850 }}>
                {allPublished ? "Unpublish" : "Publish"}
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5 }} className="no-print">
        <Button variant="outlined" onClick={() => setWeekStartDate(toDateInputValue(addDays(parseLocalDate(weekStartDate), -7)))} sx={{ minWidth: 42 }}><ChevronLeftIcon /></Button>
        <Box sx={{ flex: 1, minWidth: 0, height: 38, display: "grid", placeItems: "center", border: "1px solid", borderColor: "divider", borderRadius: 2, fontWeight: 850, backgroundColor: "#f8fafc" }}>{formatRange(days)}</Box>
        <Button variant="outlined" onClick={() => setWeekStartDate(toDateInputValue(addDays(parseLocalDate(weekStartDate), 7)))} sx={{ minWidth: 42 }}><ChevronRightIcon /></Button>
        <Button variant="outlined" startIcon={<TodayIcon />} onClick={() => setWeekStartDate(toDateInputValue(getThursdayStart(new Date())))} sx={{ textTransform: "none" }}>Current</Button>
      </Stack>

      {message && <Alert severity="success" sx={compactAlertSx}>{message}</Alert>}
      {error && <Alert severity="error" sx={compactAlertSx}>{error}</Alert>}
      {!allowBuild && !allPublished && <Alert severity="warning" sx={compactAlertSx}>Schedule is not published yet.</Alert>}
      {allowBuild && <Alert severity={allPublished ? "success" : "warning"} sx={compactAlertSx}>Displayed months are <b>{allPublished ? "Published" : "Draft"}</b>.</Alert>}
      {allowBuild && <IssuesPanel issues={scheduleIssues} />}

      <Card sx={{ borderRadius: 3, overflow: "hidden" }}>
        <CardContent sx={{ p: { xs: 0.75, md: 1.25 } }}>
          {loading ? (
            <Stack alignItems="center" sx={{ py: 5 }}><CircularProgress /><Typography sx={{ mt: 1 }} color="text.secondary">Loading call schedule...</Typography></Stack>
          ) : !canViewSchedule ? (
            <Typography color="text.secondary" sx={{ p: 2 }}>Schedule is not published yet.</Typography>
          ) : (
            <Box sx={{ overflow: "auto", maxHeight: "calc(100vh - 240px)", border: "1px solid", borderColor: "divider", borderRadius: 2 }} className="print-area">
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: `minmax(118px,max-content) repeat(${days.length},minmax(82px,max-content))`, md: `180px repeat(${days.length},minmax(105px,1fr))` }, minWidth: { xs: "max-content", md: 180 + days.length * 105 }, width: { xs: "max-content", md: "100%" } }}>
                <Box sx={topLeftCell}>Service</Box>
                {days.map((date) => {
                  const holiday = getHospitalHoliday(date);
                  return (
                    <Box key={date} sx={{ ...headerCell, backgroundColor: holiday ? "#fecaca" : isWeekend(date) ? "#fed7aa" : "#e2e8f0" }}>
                      <Typography fontSize={11} fontWeight={900}>{formatDay(date)}</Typography>
                      {holiday && <Typography fontSize={8.5} color="#991b1b" noWrap>{holiday.name}</Typography>}
                    </Box>
                  );
                })}

                {RESIDENT_CALL_SERVICES.map((service) => (
                  <Box key={service.id} sx={{ display: "contents" }}>
                    <Box sx={{ ...serviceCell, backgroundColor: isNightFloatService(service.id) ? "#eef2ff" : "#f8fafc" }}>
                      <Stack direction="row" spacing={0.6} alignItems="center"><Typography>{serviceIcon(service.name)}</Typography><Box><Typography fontWeight={850} fontSize={12} noWrap>{service.name}</Typography><Typography fontSize={9.5} color="text.secondary">{(service as ResidentCallServiceDefinition).shortDuty ? "Weekend only • until dismissed" : (service as ResidentCallServiceDefinition).displayTime}</Typography></Box></Stack>
                    </Box>

                    {days.map((date) => {
                      const available = isServiceAvailableOnDate(service, date);
                      const cell = available ? getCell(date, service) : undefined;
                      const manual = getManualCell(date, service);
                      const auto = !manual && Boolean(getAutoCell(date, service));
                      const issues = scheduleIssues.filter((issue) => issue.date === date && issue.serviceId === service.id);
                      const critical = issues.some((issue) => issue.severity === "critical");
                      const warning = issues.some((issue) => issue.severity === "warning");
                      return (
                        <Box key={`${service.id}-${date}`} onClick={() => { if (allowBuild && available) setEditingCell({ date, service }); }} sx={{ ...matrixCell, cursor: allowBuild && available ? "pointer" : "default", backgroundColor: !available ? "#f1f5f9" : critical ? "#fff1f2" : warning ? "#fffbeb" : auto ? "#f5f3ff" : isHospitalHoliday(date) ? "#fff7ed" : "white", opacity: available ? 1 : 0.65 }}>
                          {cell ? (
                            <Stack spacing={0.15}>
                              <Button variant="text" onClick={(event) => { event.stopPropagation(); onOpenResidentProfile?.(cell.residentId); }} sx={{ p: 0, minWidth: 0, maxWidth: "100%", justifyContent: "flex-start", textTransform: "none", color: "#0f172a", fontWeight: 850, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cell.residentName}</Button>
                              {critical && <Chip label="Issue" size="small" sx={{ height: 16, fontSize: 9, width: "fit-content", color: "#be123c", backgroundColor: "#ffe4e6" }} />}
                              {!critical && warning && <Chip label="Warn" size="small" sx={{ height: 16, fontSize: 9, width: "fit-content", color: "#b45309", backgroundColor: "#fef3c7" }} />}
                              {allowBuild && manual && <Button size="small" color="error" onClick={(event) => { event.stopPropagation(); void removeCell(date, service.id); }} sx={{ minWidth: 0, width: "fit-content", p: "0 3px", fontSize: 9, textTransform: "none" }}>Clear</Button>}
                            </Stack>
                          ) : <Typography fontSize={10} color="text.secondary">{!available ? "Weekend only" : allowBuild ? "Assign" : "—"}</Typography>}
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
          )}
          {saving && <Typography fontSize={12} color="text.secondary" sx={{ mt: 1 }}>Saving...</Typography>}
        </CardContent>
      </Card>

      {editingCell && allowBuild && (
        <CellDialog
          date={editingCell.date}
          service={editingCell.service}
          people={getEligiblePeople(editingCell.service, editingCell.date)}
          overridePeople={getEligiblePeople(editingCell.service, editingCell.date, true)}
          existingCell={getCell(editingCell.date, editingCell.service)}
          isAutoOnly={!getManualCell(editingCell.date, editingCell.service) && Boolean(getAutoCell(editingCell.date, editingCell.service))}
          onCancel={() => setEditingCell(null)}
          onSave={saveCell}
        />
      )}

      <CallImportDialog open={importRows.length > 0} rows={importRows} replaceDifferent={replaceDifferent} onReplaceDifferent={setReplaceDifferent} onCancel={() => setImportRows([])} onApply={applyImport} />
      <style>{`@media print {.no-print,.MuiAppBar-root,.MuiDrawer-root{display:none!important}.print-area{overflow:visible!important;max-height:none!important}main{padding:0!important}}`}</style>
    </Box>
  );
}

function CellDialog({ date, service, people, overridePeople, existingCell, isAutoOnly, onCancel, onSave }: {
  date: string;
  service: ScheduleService;
  people: SchedulePerson[];
  overridePeople: SchedulePerson[];
  existingCell?: MonthlyScheduleCell;
  isAutoOnly: boolean;
  onCancel: () => void;
  onSave: (data: { date: string; service: ScheduleService; personId: string; notes: string }) => Promise<void>;
}) {
  const shortDuty = isShortDutyService(service);
  const [showCoverageOverride, setShowCoverageOverride] = useState(false);
  const availablePeople = shortDuty && showCoverageOverride ? overridePeople : people;
  const [personId, setPersonId] = useState(existingCell?.residentId || "");
  const [notes, setNotes] = useState(isAutoOnly ? "" : existingCell?.notes || "");
  const timing = getServiceTimingForDate(service, date);
  const definition = service as ResidentCallServiceDefinition;

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>{service.name} — {date}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {isAutoOnly && (
            <Alert severity="info">
              Auto-filled from Block Schedule. Saving creates a manual override.
            </Alert>
          )}

          {shortDuty && (
            <Alert severity="info">
              <b>{timing.displayTime}.</b> {definition.dutyInstructions}
              The regular list is limited to PGY1 residents assigned to the
              matching floor in this block.
            </Alert>
          )}

          {shortDuty && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={showCoverageOverride}
                  onChange={(event) => {
                    setShowCoverageOverride(event.target.checked);
                    setPersonId("");
                  }}
                />
              }
              label="Show all PGY1 residents for coverage override"
            />
          )}

          <TextField
            select
            label="Resident"
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
            helperText={
              availablePeople.length
                ? shortDuty && !showCoverageOverride
                  ? "Floor-based eligible residents"
                  : "PGY-eligible residents"
                : "No eligible resident found"
            }
            fullWidth
          >
            {availablePeople.map((person) => (
              <MenuItem key={person.id} value={person.id}>
                {person.displayName} — {person.training}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            multiline
            minRows={3}
            placeholder={
              shortDuty && showCoverageOverride
                ? "Document why this resident is covering a different floor."
                : ""
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!personId}
          onClick={() => onSave({ date, service, personId, notes })}
        >
          Save Assignment
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CallImportDialog({ open, rows, replaceDifferent, onReplaceDifferent, onCancel, onApply }: {
  open: boolean;
  rows: CallImportPreviewRow[];
  replaceDifferent: boolean;
  onReplaceDifferent: (value: boolean) => void;
  onCancel: () => void;
  onApply: () => Promise<void>;
}) {
  const counts = rows.reduce<Record<string, number>>((result, row) => { result[row.action] = (result[row.action] || 0) + 1; return result; }, {});
  const applyCount = (counts.new || 0) + (replaceDifferent ? counts.replace || 0 : 0);
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="lg">
      <DialogTitle>Call Schedule Excel Import Preview</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>{Object.entries(counts).map(([action, count]) => <Chip key={action} label={`${action}: ${count}`} size="small" />)}</Stack>
        {(counts.replace || 0) > 0 && <FormControlLabel control={<Checkbox checked={replaceDifferent} onChange={(event) => onReplaceDifferent(event.target.checked)} />} label={`Replace ${counts.replace} different assignment${counts.replace === 1 ? "" : "s"}`} />}
        <Box sx={{ maxHeight: 430, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
          {rows.slice(0, 700).map((row, index) => <Box key={`${row.sourceDate}-${row.sourceService}-${index}`} sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr .6fr 1.6fr", gap: 1, p: 0.7, borderBottom: "1px solid #eef2f7" }}><Typography fontSize={12}>{row.sourceDate}</Typography><Typography fontSize={12} fontWeight={800}>{row.sourceService}</Typography><Typography fontSize={12}>{row.sourceResident}</Typography><Chip label={row.action} size="small" sx={{ height: 20, fontSize: 10, width: "fit-content" }} /><Typography fontSize={11.5} color={row.action === "review" ? "error" : "text.secondary"}>{row.message}</Typography></Box>)}
        </Box>
      </DialogContent>
      <DialogActions><Button onClick={onCancel}>Cancel</Button><Button variant="contained" disabled={applyCount === 0} onClick={onApply}>Import {applyCount} as Draft</Button></DialogActions>
    </Dialog>
  );
}

function IssuesPanel({ issues }: { issues: ScheduleIssue[] }) {
  if (!issues.length) return <Alert severity="success" sx={compactAlertSx}>No schedule conflicts detected.</Alert>;
  return <Card sx={{ mb: 1.5, borderRadius: 2 }}><CardContent sx={{ p: 1.25 }}><Typography fontWeight={900} sx={{ mb: 0.5 }}>Schedule Warnings ({issues.length})</Typography><Stack spacing={0.4}>{issues.slice(0, 4).map((issue) => { const style = issueSeverityStyle(issue.severity); return <Box key={issue.id} sx={{ p: 0.6, borderRadius: 1.5, backgroundColor: style.bg, border: `1px solid ${style.border}` }}><Typography fontSize={11.5} fontWeight={900} sx={{ color: style.color }}>{issue.title}</Typography><Typography fontSize={11} color="text.secondary">{issue.message}</Typography></Box>; })}{issues.length > 4 && <Typography fontSize={11} color="text.secondary">+{issues.length - 4} more</Typography>}</Stack></CardContent></Card>;
}

const compactAlertSx = { mb: 1.5, borderRadius: 2, py: 0.4 };
const topLeftCell = { p: 0.6, fontWeight: 900, fontSize: 12, backgroundColor: "#e2e8f0", borderRight: "1px solid", borderBottom: "1px solid", borderColor: "divider", position: "sticky", top: 0, left: 0, zIndex: 5 };
const headerCell = { p: 0.5, borderRight: "1px solid", borderBottom: "1px solid", borderColor: "divider", position: "sticky", top: 0, zIndex: 3, textAlign: "center" };
const serviceCell = { p: 0.55, borderRight: "1px solid", borderBottom: "1px solid", borderColor: "divider", position: "sticky", left: 0, zIndex: 2 };
const matrixCell = { minHeight: 46, p: 0.5, borderRight: "1px solid", borderBottom: "1px solid", borderColor: "divider", minWidth: 0 };
