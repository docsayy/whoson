import { useRef, useState } from "react";
import {
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
import RestoreIcon from "@mui/icons-material/Restore";
import SearchIcon from "@mui/icons-material/Search";
import SecurityIcon from "@mui/icons-material/Security";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import {
  archiveExactDuplicateSchedulingData,
  repairLegacySchedulingReferences,
  scanLegacySchedulingData,
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

function label(name: string) {
  const labels: Record<string, string> = {
    users: "User profiles",
    inviteCodes: "Invite codes",
    residents: "Residents",
    attendings: "Attendings",
    rotations: "Rotations",
    academicBlocks: "Academic blocks",
    blockAssignments: "Block assignments and publication versions",
    scheduleMonths: "Daily call schedules",
    attendingScheduleAssignments: "Attending schedules",
    services: "Services",
    maintenanceArchive: "Maintenance archive",
  };
  return labels[name] || name;
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
      version: 4,
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
      setError(
        "Unable to restore backup. Confirm this is a valid WhosOn JSON backup."
      );
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
          ? "Data scan completed. No legacy scheduling problems were found."
          : "Data scan completed. Review the findings below."
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
        "Repair old attending names/IDs, rotation references, and call service IDs? A complete JSON backup will download first."
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
        "Archive exact duplicate scheduling records? A complete JSON backup will download first. Records are moved to maintenanceArchive before removal."
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
      const nextScan = await scanLegacySchedulingData();
      setScan(nextScan);
      setMessage(
        `Archived ${result.archivedAttendingAssignments} duplicate attending assignment(s), ${result.archivedBlockAssignments} duplicate draft block assignment(s), and ${result.archivedLegacyMonthlySchedules} duplicated legacy month document(s).`
      );
    } catch (err) {
      console.error(err);
      setError("Unable to archive duplicate scheduling data.");
    } finally {
      setBusy(false);
    }
  }

  if (!allowManage) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={900}>
          Backup / Restore
        </Typography>
        <Alert severity="warning" sx={{ mt: 2 }}>
          You do not have permission to use this tool.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <Typography variant="h4" fontWeight={900}>
        Backup / Restore
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Backup version 4 includes schedule versions and the maintenance archive.
      </Typography>

      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
        }}
      >
        <Card>
          <CardContent>
            <Typography fontWeight={900} fontSize={18}>
              Export Backup
            </Typography>
            <Typography color="text.secondary" fontSize={13.5} sx={{ mb: 1.5 }}>
              Downloads all current Firestore scheduling data.
            </Typography>
            <Button
              variant="contained"
              startIcon={busy ? <CircularProgress size={18} /> : <DownloadIcon />}
              disabled={busy}
              onClick={exportBackup}
            >
              Export Backup
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography fontWeight={900} fontSize={18}>
              Restore Backup
            </Typography>
            <Typography color="text.secondary" fontSize={13.5} sx={{ mb: 1.5 }}>
              Older backups are accepted; monthlySchedules is restored into scheduleMonths.
            </Typography>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void restore(file);
              }}
            />
            <Button
              variant="outlined"
              startIcon={busy ? <CircularProgress size={18} /> : <UploadFileIcon />}
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              Choose Backup File
            </Button>
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ mt: 2, borderRadius: 3 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Box>
              <Typography fontWeight={900} fontSize={18}>
                Firestore Data Maintenance
              </Typography>
              <Typography color="text.secondary" fontSize={13.5}>
                Detects stale names and IDs, old call-service IDs, exact duplicates,
                overlapping attending coverage, and legacy monthly collections.
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Button
                variant="outlined"
                startIcon={<SearchIcon />}
                disabled={busy}
                onClick={scanData}
              >
                Scan Data
              </Button>
              <Button
                variant="outlined"
                startIcon={<BuildIcon />}
                disabled={busy}
                onClick={repairReferences}
              >
                Repair Names & IDs
              </Button>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<ArchiveIcon />}
                disabled={busy}
                onClick={archiveDuplicates}
              >
                Archive Exact Duplicates
              </Button>
            </Stack>
          </Stack>

          {scan && (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 1.5 }} />
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                <MaintenanceChip label="Old attending references" count={scan.staleAttendingReferences} />
                <MaintenanceChip label="Unresolved attendings" count={scan.unresolvedAttendingReferences} />
                <MaintenanceChip label="Duplicate attending rows" count={scan.exactDuplicateAttendingAssignments} />
                <MaintenanceChip label="Overlapping attending rows" count={scan.overlappingAttendingAssignments} warning />
                <MaintenanceChip label="Old rotation references" count={scan.staleBlockRotationReferences} />
                <MaintenanceChip label="Unknown rotations" count={scan.unresolvedBlockRotationReferences} warning />
                <MaintenanceChip label="Duplicate draft blocks" count={scan.duplicateDraftBlockAssignments} />
                <MaintenanceChip label="Old call cells" count={scan.legacyCallCells} />
                <MaintenanceChip label="Legacy month documents" count={scan.legacyMonthlyScheduleDocuments} warning />
              </Stack>

              {scan.details.length > 0 ? (
                <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                  {scan.details.map((detail) => (
                    <Typography key={detail} fontSize={12.5} color="text.secondary">
                      • {detail}
                    </Typography>
                  ))}
                </Stack>
              ) : (
                <Alert severity="success" sx={{ mt: 1.5 }}>
                  No legacy scheduling problems were found.
                </Alert>
              )}

              {scan.overlappingAttendingAssignments > 0 && (
                <Alert severity="warning" sx={{ mt: 1.5 }}>
                  Overlapping assignments are reported but never removed automatically.
                  Review those service dates in the Attending Call Schedule.
                </Alert>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center">
            <SecurityIcon color="primary" />
            <Typography fontWeight={900}>Included collections</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {BACKUP_COLLECTIONS.map((name) => (
              <Chip key={name} label={label(name)} size="small" />
            ))}
          </Stack>
        </CardContent>
      </Card>

      {Object.keys(summary).length > 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography fontWeight={900}>Last export summary</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              {Object.entries(summary).map(([name, count]) => (
                <Chip key={name} label={`${label(name)}: ${count}`} size="small" />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Alert severity="info" icon={<RestoreIcon />} sx={{ mt: 2 }}>
        Firebase Authentication passwords are not part of a Firestore backup.
      </Alert>
    </Box>
  );
}

function MaintenanceChip({
  label: chipLabel,
  count,
  warning = false,
}: {
  label: string;
  count: number;
  warning?: boolean;
}) {
  const hasIssue = count > 0;
  return (
    <Chip
      label={`${chipLabel}: ${count}`}
      size="small"
      sx={{
        fontWeight: 800,
        color: hasIssue ? (warning ? "#b45309" : "#be123c") : "#15803d",
        backgroundColor: hasIssue
          ? warning
            ? "#fffbeb"
            : "#fff1f2"
          : "#ecfdf5",
        border: "1px solid",
        borderColor: hasIssue
          ? warning
            ? "#fde68a"
            : "#fecdd3"
          : "#bbf7d0",
      }}
    />
  );
}
