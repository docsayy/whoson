import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";

import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import RestoreIcon from "@mui/icons-material/Restore";

import {
  collection,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { canBuildSchedule } from "../utils/permissions";

type BackupDocument = {
  id: string;
  data: Record<string, unknown>;
};

type BackupFile = {
  appName: "WhosOn";
  version: 1;
  exportedAt: string;
  collections: Record<string, BackupDocument[]>;
};

const BACKUP_COLLECTIONS = [
  "residents",
  "attendings",
  "rotations",
  "academicBlocks",
  "blockAssignments",
  "monthlySchedules",
  "attendingScheduleAssignments",
  "services",
] as const;

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  link.click();

  URL.revokeObjectURL(url);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function validateBackupFile(value: unknown): value is BackupFile {
  if (!value || typeof value !== "object") return false;

  const file = value as BackupFile;

  if (file.appName !== "WhosOn") return false;
  if (file.version !== 1) return false;
  if (!file.collections || typeof file.collections !== "object") return false;

  return true;
}

export default function BackupRestorePage() {
  const { profile } = useAuth();
  const allowManage = canBuildSchedule(profile?.role);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function exportBackup() {
    if (!allowManage) return;

    try {
      setBusy(true);
      setMessage("");
      setError("");

      const backup: BackupFile = {
        appName: "WhosOn",
        version: 1,
        exportedAt: new Date().toISOString(),
        collections: {},
      };

      for (const collectionName of BACKUP_COLLECTIONS) {
        const snapshot = await getDocs(collection(db, collectionName));

        backup.collections[collectionName] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          data: docSnap.data(),
        }));
      }

      downloadJson(`whoson-backup-${timestampForFile()}.json`, backup);

      setMessage("Backup downloaded successfully.");
    } catch (err) {
      console.error(err);
      setError("Unable to export backup.");
    } finally {
      setBusy(false);
    }
  }

  async function restoreBackup(file: File) {
    if (!allowManage) return;

    const confirmed = window.confirm(
      "Restore this backup? This will overwrite matching documents in Firestore. It will not delete documents that are not included in the backup."
    );

    if (!confirmed) return;

    try {
      setBusy(true);
      setMessage("");
      setError("");

      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      if (!validateBackupFile(parsed)) {
        throw new Error("Invalid backup file.");
      }

      let restoredDocs = 0;
      let batch = writeBatch(db);
      let batchCount = 0;

      async function commitIfNeeded(force = false) {
        if (batchCount === 0) return;
        if (!force && batchCount < 450) return;

        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }

      for (const collectionName of BACKUP_COLLECTIONS) {
        const docs = parsed.collections[collectionName] || [];

        for (const backupDoc of docs) {
          batch.set(
            doc(db, collectionName, backupDoc.id),
            backupDoc.data,
            { merge: true }
          );

          batchCount += 1;
          restoredDocs += 1;

          await commitIfNeeded(false);
        }
      }

      await commitIfNeeded(true);

      setMessage(`Restore completed. ${restoredDocs} document(s) restored.`);
    } catch (err) {
      console.error(err);
      setError("Unable to restore backup. Make sure this is a valid WhosOn backup JSON file.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  if (!allowManage) {
    return (
      <Box sx={{ width: "100%", maxWidth: "none" }}>
        <Typography variant="h4" fontWeight={900} sx={{ mb: 2 }}>
          Backup / Restore
        </Typography>

        <Alert severity="warning">
          You do not have permission to backup or restore the database.
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
            Backup / Restore
          </Typography>

          <Typography color="text.secondary" fontSize={14}>
            Export or restore the Firestore scheduling database.
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Chip
            label="Admin tool"
            size="small"
            sx={{
              fontWeight: 850,
              color: "#2563eb",
              backgroundColor: "#eff6ff",
              border: "1px solid #bfdbfe",
            }}
          />

          <Chip
            label="JSON backup"
            size="small"
            sx={{
              fontWeight: 850,
              color: "#15803d",
              backgroundColor: "#ecfdf5",
              border: "1px solid #bbf7d0",
            }}
          />
        </Stack>
      </Stack>

      {message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
        }}
      >
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Box>
                <Typography fontWeight={900} fontSize={18}>
                  Export Backup
                </Typography>

                <Typography color="text.secondary" fontSize={13.5}>
                  Downloads a JSON file containing residents, attendings, rotations,
                  blocks, daily call schedules, attending schedules, and services.
                </Typography>
              </Box>

              <Button
                variant="contained"
                startIcon={busy ? <CircularProgress size={18} /> : <DownloadIcon />}
                onClick={exportBackup}
                disabled={busy}
                sx={{ textTransform: "none", fontWeight: 850, width: "fit-content" }}
              >
                Export Backup
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Box>
                <Typography fontWeight={900} fontSize={18}>
                  Restore Backup
                </Typography>

                <Typography color="text.secondary" fontSize={13.5}>
                  Upload a WhosOn backup JSON file. Matching document IDs will be
                  overwritten. Extra documents not in the backup are not deleted.
                </Typography>
              </Box>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) restoreBackup(file);
                }}
              />

              <Button
                variant="outlined"
                startIcon={busy ? <CircularProgress size={18} /> : <UploadFileIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                sx={{ textTransform: "none", fontWeight: 850, width: "fit-content" }}
              >
                Choose Backup File
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ mt: 2, borderRadius: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <RestoreIcon color="warning" />
              <Typography fontWeight={900}>
                Important restore behavior
              </Typography>
            </Stack>

            <Typography fontSize={13.5} color="text.secondary">
              Restore uses merge mode. It updates or recreates documents from the backup,
              but it does not delete newer documents that are not present in the backup.
              This is safer for accidental restores.
            </Typography>

            <Typography fontSize={13.5} color="text.secondary">
              Before changing Firebase projects or moving to a shorter project name,
              export a backup here, switch your Firebase config, deploy the app, and
              restore the backup into the new Firestore database.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}