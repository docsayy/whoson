import { useMemo, useState } from "react";
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
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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

function downloadDataset(name: string, value: unknown, start: string, end: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rsb-${name}-${start}-to-${end}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function previewJson(value: unknown) {
  const full = JSON.stringify(value, null, 2) || "No data returned.";
  const limit = 30_000;
  return full.length > limit
    ? `${full.slice(0, limit)}\n\n… Preview shortened. Download the JSON file to inspect the complete dataset.`
    : full;
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
  const datasets = result?.datasets || {};

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
        <Card sx={{ mb: 2 }}>
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

      {Object.keys(datasets).length > 0 && (
        <Card>
          <CardContent>
            <Typography fontWeight={800} sx={{ mb: 0.5 }}>
              Schedule data preview
            </Typography>
            <Typography color="text.secondary" fontSize={13} sx={{ mb: 1.5 }}>
              Expand a dataset to inspect the records returned by RSB. This is
              read-only and does not overwrite your Firestore schedules.
            </Typography>

            {Object.entries(datasets).map(([name, data]) => (
              <Accordion key={name} disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={750}>{name}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ sm: "center" }}
                    spacing={1}
                    sx={{ mb: 1 }}
                  >
                    <Typography color="text.secondary" fontSize={13}>
                      Raw read-only response from RSB
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={() => downloadDataset(name, data, start, end)}
                    >
                      Download JSON
                    </Button>
                  </Stack>
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 1.5,
                      maxHeight: 480,
                      overflow: "auto",
                      borderRadius: 1.5,
                      bgcolor: "grey.950",
                      color: "grey.100",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 12,
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {previewJson(data)}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
