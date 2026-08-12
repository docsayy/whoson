import { useEffect, useState } from "react";
import { Alert, Skeleton } from "@mui/material";
import { getSourceSyncStatus, type SourceSyncStatus } from "../services/sourceSchedulerService";

export default function SourceSyncBanner() {
  const [status, setStatus] = useState<SourceSyncStatus | null | undefined>(undefined);
  useEffect(() => { void getSourceSyncStatus().then(setStatus).catch(() => setStatus(null)); }, []);
  if (status === undefined) return <Skeleton height={38} sx={{ mb: 1 }} />;
  if (!status) return <Alert severity="warning" sx={{ mb: 1 }}>The automatic Source Scheduler cache has not run yet.</Alert>;
  if (!status.ok) return <Alert severity="warning" sx={{ mb: 1 }}>The latest refresh failed. Showing the last successfully cached schedule. {status.failedAt ? `Last attempt: ${new Date(status.failedAt).toLocaleString()}.` : ""}</Alert>;
  return <Alert severity="success" sx={{ mb: 1 }}>Schedule supplied by Source Scheduler · Updated {status.completedAt ? new Date(status.completedAt).toLocaleString() : "recently"}</Alert>;
}
