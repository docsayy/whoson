import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";

import {
  getExternalScheduleBundle,
  type ExternalScheduleResponse,
  type ExternalSyncSummary,
} from "../services/externalScheduleService";

function currentMonthBounds() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const pad = (value: number) => String(value).padStart(2, "0");

  return {
    start: `${year}-${pad(month + 1)}-01`,
    end: `${year}-${pad(month + 1)}-${pad(
      new Date(year, month + 1, 0).getDate()
    )}`,
  };
}

export default function ExternalScheduleSyncPage() {
  const defaults = useMemo(currentMonthBounds, []);
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ExternalScheduleResponse | null>(null);

  async function testConnection() {
    try {
      setLoading(true);
      setError("");
      setResult(await getExternalScheduleBundle(start, end));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Connection failed.");
    } finally {
      setLoading(false);
    }
  }

  const summary: ExternalSyncSummary | undefined = result?.summary;

  return (
    <Box>
      <Typography variant="h4" fontWeight={850}>
        External Schedule Source
      </Typography>

      <Typography color="text.secondary" sx={{ mb: 2 }}>
        WhosOn connects through Cloudflare to the RSB scheduling API while your
        existing Firebase login and Firestore database remain unchanged.
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        The RSB email and password are Cloudflare secrets. They are never sent
        to the browser or stored in the WhosOn source code.
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ sm: "center" }}
          >
            <TextField
              type="date"
              size="small"
              label="Start"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              type="date"
              size="small"
              label="End"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button
              variant="contained"
              startIcon={
                loading ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SyncIcon />
                )
              }
              disabled={loading || !start || !end || end < start}
              onClick={testConnection}
            >
              Test Source
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardContent>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              spacing={1}
              sx={{ mb: 1.5 }}
            >
              <Typography fontWeight={800}>RSB datasets</Typography>
              {result?.fetchedAt && (
                <Typography color="text.secondary" fontSize={13}>
                  Fetched {new Date(result.fetchedAt).toLocaleString()}
                </Typography>
              )}
            </Stack>

            <Stack spacing={1}>
              {Object.entries(summary).map(([name, item]) => (
                <Stack
                  key={name}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ sm: "center" }}
                >
                  <Chip
                    size="small"
                    color={item.ok ? "success" : "error"}
                    label={item.ok ? "Connected" : "Failed"}
                  />
                  <Typography fontWeight={700}>{name}</Typography>
                  <Typography color="text.secondary" fontSize={13}>
                    {item.ok
                      ? `${item.count ?? 0} records/items detected`
                      : item.error || "Unknown error"}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
