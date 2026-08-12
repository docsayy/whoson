import { useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import ArchiveIcon from "@mui/icons-material/Archive";
import BuildIcon from "@mui/icons-material/Build";
import DownloadIcon from "@mui/icons-material/Download";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import {
  archiveExactDuplicateSchedulingData,
  archiveMaintenanceRecord,
  repairLegacySchedulingReferences,
  scanLegacySchedulingData,
  type AttendingOverlapDetail,
  type DuplicateBlockDetail,
  type MaintenanceScanSummary,
} from "../services/dataMaintenanceService";
import { canBuildSchedule } from "../utils/permissions";

type BackupDocument = { id: string; data: Record<string, unknown> };
type BackupFile = {
  appName: "WhosOn";
  version: number;
  exportedAt: string;
  collections: Record<string, BackupDocument[]>;
};

const BACKUP_COLLECTIONS = [
  "users",
  "inviteCodes",
  "residents",
  "attendings",
  "rotations",
  "academicBlocks",
  "blockAssignments",
  "scheduleMonths",
  "attendingScheduleAssignments",
  "services",
  "calendarSubscriptions",
  "notifications",
  "callSwapRequests",
  "lectureEvents",
  "hospitalHolidays",
  "maintenanceArchive",
] as const;

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function validBackup(value: unknown): value is BackupFile {
  if (!value || typeof value !== "object") return false;
  const file = value as Partial<BackupFile>;
  return (
    file.appName === "WhosOn" &&
    typeof file.version === "number" &&
    file.version >= 1 &&
    Boolean(file.collections && typeof file.collections === "object")
  );
}

function formatDate(value?: string) {
  if (!value) return "—";
  const parsed = new Date(`${value.length === 10 ? `${value}T12:00:00` : value}`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function issueTotal(scan: MaintenanceScanSummary) {
  return (
    scan.staleAttendingReferences +
    scan.unresolvedAttendingReferences +
    scan.exactDuplicateAttendingAssignments +
    scan.overlappingAttendingAssignments +
    scan.staleBlockRotationReferences +
    scan.unresolvedBlockRotationReferences +
    scan.duplicateDraftBlockAssignments +
    scan.legacyCallCells +
    scan.legacyMonthlyScheduleDocuments
  );
}

function StatChip({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <Chip
      size="small"
      label={`${label}: ${value}`}
      color={warning && value > 0 ? "warning" : value === 0 ? "success" : "default"}
      variant="outlined"
    />
  );
}

export default function BackupRestorePage() {
  const { profile } = useAuth();
  const allowManage = canBuildSchedule(profile?.role);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [scan, setScan] = useState<MaintenanceScanSummary | null>(null);

  async function createAndDownloadBackup() {
    const backup: BackupFile = {
      appName: "WhosOn",
      version: 5,
      exportedAt: new Date().toISOString(),
      collections: {},
    };
    const nextSummary: Record<string, number> = {};

    for (const name of BACKUP_COLLECTIONS) {
      const snapshot = await getDocs(collection(db, name));
      backup.collections[name] = snapshot.docs.map((item) => ({
        id: item.id,
        data: item.data(),
      }));
      nextSummary[name] = snapshot.docs.length;
    }

    downloadJson(
      `whoson-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      backup
    );
    setSummary(nextSummary);
  }

  async function exportBackup() {
    if (!allowManage) return;
    try {
      setBusy(true);
      setError("");
      setMessage("");
      await createAndDownloadBackup();
      setMessage("Backup downloaded successfully.");
    } catch (err) {
      console.error(err);
      setError("Unable to export backup.");
    } finally {
      setBusy(false);
    }
  }

  async function restore(file: File) {
    if (!allowManage) return;
    if (
      !window.confirm(
        "Restore this backup? Matching Firestore documents will be overwritten; unrelated documents will not be deleted."
      )
    ) {
      return;
    }

    try {
      setBusy(true);
      setError("");
      setMessage("");
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!validBackup(parsed)) throw new Error("Invalid backup file");

      const collections = { ...parsed.collections };
      if (!collections.scheduleMonths && collections.monthlySchedules) {
        collections.scheduleMonths = collections.monthlySchedules;
      }

      let restored = 0;
      let batch = writeBatch(db);
      let batchCount = 0;

      async function commit(force = false) {
        if (!batchCount || (!force && batchCount < 400)) return;
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }

      for (const name of BACKUP_COLLECTIONS) {
        for (const item of collections[name] || []) {
          batch.set(doc(db, name, item.id), item.data, { merge: true });
          batchCount += 1;
          restored += 1;
          await commit(false);
        }
      }
      await commit(true);
      setMessage(`Restore completed. ${restored} document(s) restored.`);
    } catch (err) {
      console.error(err);
      setError("Unable to restore backup. Confirm this is a valid WhosOn JSON backup.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function scanData() {
    if (!allowManage) return;
    try {
      setBusy(true);
      setError("");
      setMessage("");
      const result = await scanLegacySchedulingData();
      setScan(result);
      setMessage(
        issueTotal(result) === 0
          ? "Data scan completed. No scheduling-data problems were found."
          : "Data scan completed. Exact people, dates, and records are shown below."
      );
    } catch (err) {
      console.error(err);
      setError("Unable to scan Firestore scheduling data.");
    } finally {
      setBusy(false);
    }
  }

  async function repairReferences() {
    if (!allowManage) return;
    if (
      !window.confirm(
        "Repair old attending names/IDs, rotation references, and call-service IDs? A complete JSON backup will download first."
      )
    ) {
      return;
    }

    try {
      setBusy(true);
      setError("");
      setMessage("");
      await createAndDownloadBackup();
      const result = await repairLegacySchedulingReferences();
      const nextScan = await scanLegacySchedulingData();
      setScan(nextScan);
      setMessage(
        `Repair completed: ${result.repairedAttendingAssignments} attending record(s), ${result.repairedBlockAssignments} block record(s), and ${result.repairedCallCells} call cell(s) updated.`
      );
    } catch (err) {
      console.error(err);
      setError("Unable to repair legacy scheduling references.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveDuplicates() {
    if (!allowManage) return;
    if (
      !window.confirm(
        "Archive exact duplicates? A complete JSON backup will download first. Different attending assignments that merely overlap will not be removed."
      )
    ) {
      return;
    }

    try {
      setBusy(true);
      setError("");
      setMessage("");
      await createAndDownloadBackup();
      const result = await archiveExactDuplicateSchedulingData();
      setScan(await scanLegacySchedulingData());
      setMessage(
        `Archived ${result.archivedAttendingAssignments} duplicate attending assignment(s), ${result.archivedBlockAssignments} duplicate draft block assignment(s), and ${result.archivedLegacyMonthlySchedules} legacy month document(s).`
      );
    } catch (err) {
      console.error(err);
      setError("Unable to archive duplicate scheduling data.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveSpecific(params: {
    collectionName: "attendingScheduleAssignments" | "blockAssignments";
    id: string;
    reason: string;
  }) {
    if (!window.confirm(`Archive this record?\n\n${params.reason}`)) return;
    try {
      setBusy(true);
      await createAndDownloadBackup();
      await archiveMaintenanceRecord(params);
      setScan(await scanLegacySchedulingData());
      setMessage("Selected record archived. The original data was copied to maintenanceArchive.");
    } catch (err) {
      console.error(err);
      setError("Unable to archive the selected record.");
    } finally {
      setBusy(false);
    }
  }

  if (!allowManage) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={800}>Backup / Restore</Typography>
        <Alert severity="warning" sx={{ mt: 1 }}>You do not have permission to use this tool.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", maxWidth: 1180, mx: "auto" }}>
      <Typography variant="h4" fontWeight={800}>Backup / Restore</Typography>
      <Typography color="text.secondary" fontSize={12.5} sx={{ mb: 1.5 }}>
        Backup version 5 includes calendar subscriptions, holiday configuration, published schedules, and maintenance archives.
      </Typography>

      {message && <Alert severity="success" sx={{ mb: 1 }} onClose={() => setMessage("")}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError("")}>{error}</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.25 }}>
        <Card sx={{ borderRadius: 2.5 }}>
          <CardContent sx={{ p: 1.5 }}>
            <Typography fontWeight={800} fontSize={15}>Export Backup</Typography>
            <Typography color="text.secondary" fontSize={12} sx={{ mb: 1 }}>
              Downloads the current Firestore scheduling database as JSON.
            </Typography>
            <Button variant="contained" startIcon={busy ? <CircularProgress size={16} /> : <DownloadIcon />} disabled={busy} onClick={exportBackup}>
              Export Backup
            </Button>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 2.5 }}>
          <CardContent sx={{ p: 1.5 }}>
            <Typography fontWeight={800} fontSize={15}>Restore Backup</Typography>
            <Typography color="text.secondary" fontSize={12} sx={{ mb: 1 }}>
              Older backups are accepted. Existing unrelated documents are not deleted.
            </Typography>
            <input ref={fileRef} hidden type="file" accept=".json,application/json" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void restore(file);
            }} />
            <Button variant="outlined" startIcon={busy ? <CircularProgress size={16} /> : <UploadFileIcon />} disabled={busy} onClick={() => fileRef.current?.click()}>
              Choose Backup File
            </Button>
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ mt: 1.25, borderRadius: 2.5 }}>
        <CardContent sx={{ p: 1.5 }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
            <Box>
              <Typography fontWeight={800} fontSize={15}>Firestore Data Maintenance</Typography>
              <Typography color="text.secondary" fontSize={12}>
                Shows exact people, services, dates, old names, and duplicate documents before any repair.
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
              <Button variant="outlined" size="small" startIcon={<SearchIcon />} disabled={busy} onClick={scanData}>Scan Data</Button>
              <Button variant="outlined" size="small" startIcon={<BuildIcon />} disabled={busy} onClick={repairReferences}>Repair Names & IDs</Button>
              <Button variant="outlined" size="small" color="warning" startIcon={<ArchiveIcon />} disabled={busy} onClick={archiveDuplicates}>Archive Exact Duplicates</Button>
            </Stack>
          </Stack>

          {scan && (
            <Box sx={{ mt: 1.25 }}>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                <StatChip label="Old attending references" value={scan.staleAttendingReferences} />
                <StatChip label="Unresolved attendings" value={scan.unresolvedAttendingReferences} warning />
                <StatChip label="Duplicate attending rows" value={scan.exactDuplicateAttendingAssignments} warning />
                <StatChip label="Attending overlaps" value={scan.overlappingAttendingAssignments} warning />
                <StatChip label="Old rotation references" value={scan.staleBlockRotationReferences} />
                <StatChip label="Unknown rotations" value={scan.unresolvedBlockRotationReferences} warning />
                <StatChip label="Duplicate draft blocks" value={scan.duplicateDraftBlockAssignments} warning />
                <StatChip label="Old call cells" value={scan.legacyCallCells} />
                <StatChip label="Legacy months" value={scan.legacyMonthlyScheduleDocuments} />
              </Stack>

              {scan.details.length > 0 && (
                <Alert severity="warning" sx={{ mb: 1 }}>
                  {scan.details.map((detail) => <Box key={detail}>• {detail}</Box>)}
                </Alert>
              )}

              <MaintenanceDetails scan={scan} busy={busy} onArchive={archiveSpecific} />
            </Box>
          )}
        </CardContent>
      </Card>

      {Object.keys(summary).length > 0 && (
        <Card sx={{ mt: 1.25, borderRadius: 2.5 }}>
          <CardContent sx={{ p: 1.5 }}>
            <Typography fontWeight={800} fontSize={14} sx={{ mb: 0.75 }}>Last export</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {Object.entries(summary).map(([name, count]) => (
                <Chip key={name} size="small" label={`${name}: ${count}`} variant="outlined" />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

function MaintenanceDetails({
  scan,
  busy,
  onArchive,
}: {
  scan: MaintenanceScanSummary;
  busy: boolean;
  onArchive: (params: {
    collectionName: "attendingScheduleAssignments" | "blockAssignments";
    id: string;
    reason: string;
  }) => Promise<void>;
}) {
  return (
    <Stack spacing={0.75}>
      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={800} fontSize={12.5}>Attending overlaps ({scan.attendingOverlaps.length})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {scan.attendingOverlaps.length === 0 ? (
            <Typography color="text.secondary" fontSize={12}>No overlapping attending coverage found.</Typography>
          ) : (
            <Stack spacing={0.8}>
              {scan.attendingOverlaps.map((item) => (
                <AttendingOverlapCard key={item.id} item={item} busy={busy} onArchive={onArchive} />
              ))}
            </Stack>
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={800} fontSize={12.5}>Duplicate draft block assignments ({scan.duplicateDraftBlocks.length})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {scan.duplicateDraftBlocks.length === 0 ? (
            <Typography color="text.secondary" fontSize={12}>No duplicate draft block groups found.</Typography>
          ) : (
            <Stack spacing={0.8}>
              {scan.duplicateDraftBlocks.map((item) => (
                <DuplicateBlockCard key={item.id} item={item} busy={busy} onArchive={onArchive} />
              ))}
            </Stack>
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={800} fontSize={12.5}>Old and unresolved attending names ({scan.staleAttendingDetails.length + scan.unresolvedAttendingDetails.length})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={0.5}>
            {scan.staleAttendingDetails.map((item) => (
              <Box key={item.id} sx={{ p: 0.75, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                <Typography fontWeight={800} fontSize={12}>{item.serviceName}</Typography>
                <Typography fontSize={11.5}>Stored: {item.storedName} → Current: {item.currentName}</Typography>
                <Typography color="text.secondary" fontSize={10.75}>{formatDate(item.startDate)}–{formatDate(item.endDate)}</Typography>
              </Box>
            ))}
            {scan.unresolvedAttendingDetails.map((item) => (
              <Box key={item.id} sx={{ p: 0.75, border: "1px solid", borderColor: "warning.light", borderRadius: 1.5 }}>
                <Typography fontWeight={800} fontSize={12}>{item.serviceName}</Typography>
                <Typography fontSize={11.5}>Unresolved stored name: {item.storedName}</Typography>
                <Typography color="text.secondary" fontSize={10.75}>{formatDate(item.startDate)}–{formatDate(item.endDate)}</Typography>
              </Box>
            ))}
            {scan.staleAttendingDetails.length + scan.unresolvedAttendingDetails.length === 0 && (
              <Typography color="text.secondary" fontSize={12}>No stale or unresolved attending references.</Typography>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={800} fontSize={12.5}>Rotation and call-service references ({scan.staleRotationDetails.length + scan.unknownRotationDetails.length + scan.legacyCallCellDetails.length})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={0.5}>
            {scan.staleRotationDetails.map((item) => (
              <Box key={item.id} sx={{ p: 0.7, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                <Typography fontSize={11.5}><b>{item.residentName}</b>, Block {item.blockNumber}: {item.storedRotationName} ({item.storedRotationId}) → {item.resolvedRotationName} ({item.resolvedRotationId})</Typography>
              </Box>
            ))}
            {scan.unknownRotationDetails.map((item) => (
              <Box key={item.id} sx={{ p: 0.7, border: "1px solid", borderColor: "warning.light", borderRadius: 1.5 }}>
                <Typography fontSize={11.5}><b>{item.residentName}</b>, Block {item.blockNumber}: unknown rotation {item.storedRotationName} ({item.storedRotationId})</Typography>
              </Box>
            ))}
            {scan.legacyCallCellDetails.map((item) => (
              <Box key={`${item.monthId}_${item.originalKey}`} sx={{ p: 0.7, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                <Typography fontSize={11.5}><b>{formatDate(item.date)} · {item.residentName}</b></Typography>
                <Typography color="text.secondary" fontSize={10.75}>{item.storedServiceName || item.storedServiceId} → {item.canonicalServiceName} ({item.canonicalServiceId})</Typography>
              </Box>
            ))}
            {scan.staleRotationDetails.length + scan.unknownRotationDetails.length + scan.legacyCallCellDetails.length === 0 && (
              <Typography color="text.secondary" fontSize={12}>No outdated rotation or call-service references.</Typography>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}

function AttendingOverlapCard({
  item,
  busy,
  onArchive,
}: {
  item: AttendingOverlapDetail;
  busy: boolean;
  onArchive: (params: {
    collectionName: "attendingScheduleAssignments" | "blockAssignments";
    id: string;
    reason: string;
  }) => Promise<void>;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ p: 1.1, "&:last-child": { pb: 1.1 } }}>
        <Typography fontWeight={800} fontSize={12.5}>{item.serviceName}</Typography>
        <Typography color="warning.main" fontWeight={700} fontSize={11.25}>
          Overlap: {formatDate(item.overlapStart)}–{formatDate(item.overlapEnd)}
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 0.75, mt: 0.7 }}>
          {[item.first, item.second].map((record, index) => (
            <Box key={record.id} sx={{ p: 0.75, backgroundColor: "action.hover", borderRadius: 1.5 }}>
              <Typography fontWeight={800} fontSize={11.75}>{index === 0 ? "Assignment A" : "Assignment B"}: {record.displayName}</Typography>
              {record.storedName && record.storedName !== record.displayName && (
                <Typography color="text.secondary" fontSize={10.5}>Stored name: {record.storedName}</Typography>
              )}
              <Typography fontSize={10.75}>{formatDate(record.startDate)}–{formatDate(record.endDate)}</Typography>
              <Typography color="text.secondary" fontSize={10.5}>Coverage: {record.coverage || "—"}</Typography>
              <Typography color="text.secondary" fontSize={10.5}>Updated: {formatDate(record.updatedAt)}</Typography>
              <Button
                size="small"
                color="warning"
                variant="outlined"
                startIcon={<ArchiveIcon />}
                disabled={busy}
                onClick={() => void onArchive({
                  collectionName: "attendingScheduleAssignments",
                  id: record.id,
                  reason: `Manual review of overlap for ${item.serviceName}, ${item.overlapStart} through ${item.overlapEnd}`,
                })}
                sx={{ mt: 0.5 }}
              >
                Archive {index === 0 ? "A" : "B"}
              </Button>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

function DuplicateBlockCard({
  item,
  busy,
  onArchive,
}: {
  item: DuplicateBlockDetail;
  busy: boolean;
  onArchive: (params: {
    collectionName: "attendingScheduleAssignments" | "blockAssignments";
    id: string;
    reason: string;
  }) => Promise<void>;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ p: 1.1, "&:last-child": { pb: 1.1 } }}>
        <Typography fontWeight={800} fontSize={12.5}>{item.residentName} · {item.pgy}</Typography>
        <Typography color="text.secondary" fontSize={10.75}>{item.blockName}: {formatDate(item.blockStart)}–{formatDate(item.blockEnd)}</Typography>
        <Divider sx={{ my: 0.6 }} />
        <Stack spacing={0.5}>
          {item.records.map((record, index) => (
            <Box key={record.id} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr auto" }, gap: 0.5, p: 0.65, backgroundColor: index === 0 ? "#f0fdf4" : "action.hover", borderRadius: 1.25 }}>
              <Box>
                <Typography fontWeight={800} fontSize={11.5}>{record.rotationName} {index === 0 ? "· newest" : ""}</Typography>
                <Typography color="text.secondary" fontSize={10.5}>Source: {record.source}{record.importedFileName ? ` · ${record.importedFileName}` : ""}</Typography>
                <Typography color="text.secondary" fontSize={10.5}>Updated: {formatDate(record.updatedAt)}</Typography>
                {record.notes && <Typography fontSize={10.5}>Notes: {record.notes}</Typography>}
              </Box>
              <Button
                size="small"
                color="warning"
                variant="outlined"
                startIcon={<ArchiveIcon />}
                disabled={busy}
                onClick={() => void onArchive({
                  collectionName: "blockAssignments",
                  id: record.id,
                  reason: `Manual duplicate-block review for ${item.residentName}, ${item.blockName}`,
                })}
              >
                Archive
              </Button>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
