import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LoginIcon from "@mui/icons-material/Login";
import TodayIcon from "@mui/icons-material/Today";
import { useNavigate } from "react-router-dom";

import { getPublicWhoOnMonth } from "../services/publicWhosOnService";
import { birthdayName } from "../utils/birthday";
import type {
  PublicAllServiceRow,
  PublicAttendingRow,
  PublicResidentRow,
  PublicWhoOnMonth,
} from "../types/publicWhosOn";

type WhosOnMode = "call" | "all" | "admitting" | "consulting";

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromDateInputValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function serviceIcon(service: string) {
  const lower = service.toLowerCase();
  if (lower.includes("short duty")) return "⏱️";
  if (lower.includes("chief") || lower.includes("pgy3 nf")) return "👑";
  if (lower.includes("nf")) return "🌙";
  if (lower.includes("micu") || lower.includes("pulm")) return "🫁";
  if (lower.includes("ccu") || lower.includes("card")) return "🫀";
  if (lower.includes("tele")) return "🖥️";
  if (lower.includes("neuro")) return "🧠";
  if (lower.includes("gi")) return "🍽️";
  if (lower.includes("heme")) return "🩸";
  if (lower.includes("id")) return "🦠";
  return "🏥";
}

export default function PublicWhosOnPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<WhosOnMode>("call");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthData, setMonthData] = useState<PublicWhoOnMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const dateKey = toDateInputValue(selectedDate);
  const monthId = dateKey.slice(0, 7);
  const day = monthData?.days?.[dateKey];

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await getPublicWhoOnMonth(monthId);
        if (active) setMonthData(data);
      } catch (err) {
        console.error(err);
        if (active) {
          setMonthData(null);
          setError("Unable to load the public Who's On schedule.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [monthId]);

  const content = useMemo(() => {
    if (!day) return null;
    if (mode === "call") return day.callRows;
    if (mode === "all") return day.allServices;
    if (mode === "admitting") return day.admittingRows;
    return day.consultingRows;
  }, [day, mode]);

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          backgroundColor: "white",
          color: "#0f172a",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 62 }, px: { xs: 1.5, sm: 2 } }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            sx={{ width: "100%" }}
          >
            <Box>
              <Typography fontWeight={900} sx={{ fontSize: { xs: 19, sm: 22 } }}>
                WhosOn
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ fontSize: 11.5, display: { xs: "none", sm: "block" } }}
              >
                Public published coverage view
              </Typography>
            </Box>

            <Button
              variant="contained"
              startIcon={<LoginIcon />}
              onClick={() => navigate("/login")}
              sx={{ textTransform: "none", fontWeight: 850 }}
            >
              Sign in / Sign up
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box sx={{ width: "100%", maxWidth: 1180, mx: "auto", p: { xs: 1, sm: 1.5, md: 2 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={1}
          sx={{ mb: 1.25 }}
        >
          <Box>
            <Typography variant="h4" fontWeight={900} sx={{ fontSize: { xs: 22, md: 28 } }}>
              Who&apos;s On
            </Typography>
            <Typography color="text.secondary" fontSize={13}>
              Published resident, admitting, and consultation coverage.
            </Typography>
          </Box>

          <TextField
            select
            size="small"
            value={mode}
            onChange={(event) => setMode(event.target.value as WhosOnMode)}
            sx={{ width: { xs: "100%", sm: 230 } }}
          >
            <MenuItem value="call">Resident Calls</MenuItem>
            <MenuItem value="all">All Services</MenuItem>
            <MenuItem value="admitting">Admitting Attendings</MenuItem>
            <MenuItem value="consulting">Consulting Services</MenuItem>
          </TextField>
        </Stack>

        <Stack direction="row" spacing={0.65} alignItems="center" sx={{ mb: 1.25 }}>
          <Button
            variant="outlined"
            onClick={() => setSelectedDate((date) => addDays(date, -1))}
            sx={{ minWidth: 42, px: 0.5 }}
          >
            <ChevronLeftIcon />
          </Button>
          <TextField
            type="date"
            size="small"
            value={dateKey}
            onChange={(event) => setSelectedDate(fromDateInputValue(event.target.value))}
            sx={{ flex: 1, maxWidth: 210 }}
          />
          <Button
            variant="outlined"
            onClick={() => setSelectedDate((date) => addDays(date, 1))}
            sx={{ minWidth: 42, px: 0.5 }}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="outlined"
            startIcon={<TodayIcon />}
            onClick={() => setSelectedDate(new Date())}
            sx={{ textTransform: "none", display: { xs: "none", sm: "inline-flex" } }}
          >
            Today
          </Button>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
        {day?.holiday && (
          <Alert severity="info" sx={{ mb: 1 }}>
            <b>{day.holiday.name}</b>: {day.holiday.note}
          </Alert>
        )}

        <Card sx={{ borderRadius: 3, overflow: "hidden" }}>
          <CardContent sx={{ p: { xs: 0.75, sm: 1.25 } }}>
            {loading ? (
              <Stack alignItems="center" sx={{ py: 6 }}>
                <CircularProgress />
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Loading public schedule...
                </Typography>
              </Stack>
            ) : !monthData || !day ? (
              <Alert severity="info">
                A published public schedule is not available for this month yet.
              </Alert>
            ) : mode === "call" && !day.callPublished ? (
              <Alert severity="info">The resident call schedule is not currently published.</Alert>
            ) : mode === "call" ? (
              <Stack spacing={1.5}>
                <Box>
                  <Typography fontWeight={900} fontSize={14} sx={{ mb: 0.75 }}>
                    Resident Calls
                  </Typography>
                  <PublicResidentTable rows={day.callRows} />
                </Box>
                {day.consultRows.length > 0 && (
                  <Box>
                    <Typography fontWeight={900} fontSize={14} sx={{ mb: 0.75 }}>
                      Resident Consult Coverage
                    </Typography>
                    <PublicResidentTable rows={day.consultRows} />
                  </Box>
                )}
              </Stack>
            ) : mode === "all" ? (
              <PublicAllServicesTable rows={day.allServices} />
            ) : (
              <PublicAttendingTable rows={content as PublicAttendingRow[]} />
            )}
          </CardContent>
        </Card>

        {day?.activeChief && (
          <Card
            sx={{
              mt: 1,
              borderRadius: 2,
              boxShadow: "none",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <CardContent sx={{ py: 0.8, px: 1.25, "&:last-child": { pb: 0.8 } }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "220px 1fr" },
                  gap: 0.25,
                }}
              >
                <Typography fontSize={12} fontWeight={900} color="text.secondary">
                  Active Chief · {day.activeChief.blockName}
                </Typography>
                <Typography fontSize={13} fontWeight={850}>
                  {birthdayName(day.activeChief.residentName, Boolean(day.activeChief.birthday))}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}

        <Typography color="text.secondary" fontSize={10.5} sx={{ mt: 1, textAlign: "center" }}>
          Contact information and profile links are available only after signing in.
        </Typography>
      </Box>
    </Box>
  );
}

function PublicResidentTable({ rows }: { rows: PublicResidentRow[] }) {
  return (
    <Box>
      <Box sx={{ display: { xs: "none", sm: "grid" }, gridTemplateColumns: "1.2fr .7fr 1.2fr .9fr", px: 1, py: 0.7, backgroundColor: "#e2e8f0" }}>
        {['Service', 'Time', 'Resident', 'Level'].map((label) => (
          <Typography key={label} fontSize={11.5} fontWeight={850} color="text.secondary">
            {label}
          </Typography>
        ))}
      </Box>

      {rows.map((row, index) => (
        <Box
          key={`${row.service}-${index}`}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr auto", sm: "1.2fr .7fr 1.2fr .9fr" },
            gap: { xs: 0.4, sm: 0 },
            alignItems: "center",
            px: 1,
            py: 0.75,
            borderBottom: "1px solid #eef2f7",
            backgroundColor: index % 2 ? "#f8fafc" : "white",
          }}
        >
          <Stack direction="row" spacing={0.55} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography>{serviceIcon(row.service)}</Typography>
            <Typography fontSize={12.5} fontWeight={850} noWrap>{row.service}</Typography>
          </Stack>
          <Chip label={row.time} size="small" sx={{ height: 21, fontSize: 10.5 }} />
          <Typography fontSize={12.5} fontWeight={800} sx={{ gridColumn: { xs: "1 / 2", sm: "auto" } }}>
            {birthdayName(row.name || "Unassigned", Boolean(row.birthday && row.name))}
          </Typography>
          <Typography fontSize={11.5} color="text.secondary" sx={{ textAlign: { xs: "right", sm: "left" } }}>
            {row.level}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function PublicAllServicesTable({ rows }: { rows: PublicAllServiceRow[] }) {
  if (!rows.length) {
    return <Typography color="text.secondary" sx={{ p: 2 }}>No published block assignments found.</Typography>;
  }

  return (
    <Box>
      {rows.map((row, index) => (
        <Box
          key={`${row.service}-${row.name}-${index}`}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr auto", sm: "1.2fr 1.2fr .7fr" },
            gap: 0.5,
            alignItems: "center",
            px: 1,
            py: 0.75,
            borderBottom: "1px solid #eef2f7",
            backgroundColor: index % 2 ? "#f8fafc" : "white",
          }}
        >
          <Typography fontWeight={850}>{row.service}</Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography fontWeight={800}>{birthdayName(row.name, Boolean(row.birthday))}</Typography>
            {row.activeChief && (
              <Chip label="Active Chief" size="small" sx={{ height: 19, fontSize: 9.5 }} />
            )}
          </Stack>
          <Typography fontSize={11.5} color="text.secondary" sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}>
            {row.level}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function PublicAttendingTable({ rows }: { rows: PublicAttendingRow[] }) {
  if (!rows.length) {
    return <Typography color="text.secondary" sx={{ p: 2 }}>No coverage found for this date.</Typography>;
  }

  return (
    <Box>
      {rows.map((row, index) => (
        <Box
          key={`${row.service}-${index}`}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr auto", sm: "minmax(140px, 1fr) minmax(150px, 1fr) 90px" },
            gap: { xs: 0.4, sm: 0.75 },
            alignItems: "center",
            px: 1,
            py: 0.8,
            borderBottom: "1px solid #eef2f7",
            backgroundColor: index % 2 ? "#f8fafc" : "white",
          }}
        >
          <Typography fontSize={12.5} fontWeight={850}>{row.service}</Typography>
          <Chip label={row.coverage} size="small" sx={{ height: 21, fontSize: 10.5, gridColumn: { xs: "2", sm: "3" }, gridRow: { xs: "1", sm: "1" } }} />
          <Typography fontSize={12.5} fontWeight={800} sx={{ gridColumn: { xs: "1 / -1", sm: "2" }, gridRow: { sm: "1" } }}>
            {birthdayName(row.consultant || "Unassigned", Boolean(row.birthday && row.consultant))}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
