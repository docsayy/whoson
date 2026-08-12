import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { getResidents } from "../services/residentService";
import {
  getSourceBlockSchedule,
  getSourceCallDays,
  getSourceSyncStatus,
  type SourceRecord,
} from "../services/sourceSchedulerService";
import type { Resident } from "../types/resident";
import { findLinkedProfile } from "../utils/sourceProfileMatching";
import {
  getSourceProfileLinks,
  type SourceProfileLink,
} from "../services/sourceProfileLinkService";

const value = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthValue = (d: Date) => value(d).slice(0, 7);
const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  return monthValue(new Date(y, m - 1 + n, 1));
};
export default function SourceResidentProfilePage({
  residentId,
  onBack,
}: {
  residentId: string;
  onBack: () => void;
}) {
  const [resident, setResident] = useState<Resident | null>(null);
  const [data, setData] = useState<SourceRecord | null>(null);
  const [calls, setCalls] = useState<SourceRecord[]>([]);
  const [links, setLinks] = useState<SourceProfileLink[]>([]);
  const [month, setMonth] = useState(monthValue(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    void Promise.all([
      getResidents(),
      getSourceBlockSchedule(),
      getSourceSyncStatus(),
      getSourceProfileLinks(),
    ])
      .then(async ([people, blocks, status, savedLinks]) => {
        const person = people.find((item) => item.id === residentId) || null;
        setResident(person);
        setData(blocks);
        setLinks(savedLinks);
        if (status?.start && status?.end)
          setCalls(await getSourceCallDays(status.start, status.end));
      })
      .catch(() =>
        setError("Unable to load this resident's synchronized schedule."),
      )
      .finally(() => setLoading(false));
  }, [residentId]);
  const model = useMemo(() => {
    if (!resident || !data) return null;
    const sourceResidents = (data.residents as SourceRecord[]) || [];
    const source = sourceResidents.find((item) =>
      findLinkedProfile(
        `${item.first_name} ${item.last_name}`,
        "resident",
        [resident],
        links,
      ),
    );
    if (!source) return null;
    const blocks = (data.blocks as SourceRecord[]) || [];
    const rotations = (data.rotations as SourceRecord[]) || [];
    const assignments = (data.assignments as Record<string, unknown>) || {};
    const rotationMap = new Map(
      rotations.map((item) => [String(item.id), item]),
    );
    const rows = blocks.map((block) => {
      const rotation = rotationMap.get(
        String(assignments[`${source.id}:${block.id}`]),
      );
      return { block, rotation };
    });
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      if (row.rotation) {
        const code = String(row.rotation.code);
        counts.set(code, (counts.get(code) || 0) + 1);
      }
    });
    const personalCalls = calls.flatMap((day) =>
      ((day.entries as SourceRecord[]) || []).flatMap((entry) =>
        ((entry.residents as SourceRecord[]) || [])
          .filter((person) => String(person.id) === String(source.id))
          .map(() => ({
            date: String(day.date),
            role: String((entry.role as SourceRecord)?.code || "Call"),
          })),
      ),
    );
    return {
      source,
      rows,
      counts: [...counts.entries()].sort(),
      personalCalls,
    };
  }, [calls, data, links, resident]);
  const monthDays = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() - 4 + 7) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return { date: value(day), inMonth: day.getMonth() === m - 1 };
    });
  }, [month]);
  if (loading)
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  if (!resident)
    return (
      <Box>
        <Button onClick={onBack} startIcon={<ArrowBackIcon />}>
          Back
        </Button>
        <Alert severity="error">Resident profile not found.</Alert>
      </Box>
    );
  return (
    <Box>
      <Button onClick={onBack} startIcon={<ArrowBackIcon />} sx={{ mb: 1 }}>
        Back
      </Button>
      <Card sx={{ p: 1.5, mb: 1 }}>
        <Typography variant="h4" fontWeight={900}>
          {resident.displayName}
        </Typography>
        <Typography color="text.secondary">
          {resident.pgy} · Firestore profile linked to Source Scheduler
        </Typography>
      </Card>
      {error && <Alert severity="error">{error}</Alert>}
      {!model ? (
        <Alert severity="warning">
          This Firestore resident could not be matched to a Source Scheduler
          resident. Check the spelling of the first and last name.
        </Alert>
      ) : (
        <Stack spacing={1}>
          <Card sx={{ p: 1.2 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography fontWeight={900}>
                Personal monthly call schedule
              </Typography>
              <Stack direction="row" alignItems="center">
                <IconButton onClick={() => setMonth(shiftMonth(month, -1))}>
                  <ChevronLeftIcon />
                </IconButton>
                <Typography fontWeight={850}>
                  {new Date(`${month}-01T12:00:00`).toLocaleDateString(
                    "en-US",
                    { month: "long", year: "numeric" },
                  )}
                </Typography>
                <IconButton onClick={() => setMonth(shiftMonth(month, 1))}>
                  <ChevronRightIcon />
                </IconButton>
              </Stack>
            </Stack>
            <Typography color="text.secondary" fontSize={11}>
              Each row is one schedule week: Thursday through Wednesday.
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7,minmax(0,1fr))",
                mt: 1,
                borderTop: "1px solid",
                borderLeft: "1px solid",
                borderColor: "divider",
              }}
            >
              {["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"].map((day) => (
                <Box
                  key={day}
                  sx={{
                    p: 0.45,
                    bgcolor: "grey.100",
                    borderRight: "1px solid",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    textAlign: "center",
                    fontWeight: 900,
                    fontSize: 11,
                  }}
                >
                  {day}
                </Box>
              ))}
              {monthDays.map((day) => {
                const items = model.personalCalls.filter(
                  (item) => item.date === day.date,
                );
                const isToday = day.date === value(new Date());
                return (
                  <Box
                    key={day.date}
                    sx={{
                      minHeight: 72,
                      p: 0.5,
                      borderRight: "1px solid",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      bgcolor: isToday
                        ? "#fff8db"
                        : day.inMonth
                          ? "white"
                          : "grey.50",
                      opacity: day.inMonth ? 1 : 0.45,
                      outline: isToday ? "2px solid #f59e0b" : "none",
                      outlineOffset: -2,
                    }}
                  >
                    <Typography fontWeight={900} fontSize={11}>
                      {Number(day.date.slice(-2))}
                    </Typography>
                    {items.map((item, i) => (
                      <Chip
                        key={i}
                        label={item.role}
                        size="small"
                        sx={{
                          mt: 0.3,
                          mr: 0.3,
                          height: 20,
                          fontSize: 9.5,
                          fontWeight: 850,
                        }}
                      />
                    ))}
                  </Box>
                );
              })}
            </Box>
          </Card>
          <Card sx={{ p: 1.2 }}>
            <Typography fontWeight={900} sx={{ mb: 0.8 }}>
              Personal block schedule
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2,1fr)",
                  sm: "repeat(4,1fr)",
                  lg: "repeat(6,1fr)",
                },
                gap: 0.6,
              }}
            >
              {model.rows.map(({ block, rotation }) => (
                <Box
                  key={String(block.id)}
                  sx={{
                    p: 0.7,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1.5,
                    bgcolor: String(rotation?.color || "white"),
                  }}
                >
                  <Typography fontWeight={900} fontSize={11}>
                    B{String(block.number)} ·{" "}
                    {String(block.start_date).slice(5)}–
                    {String(block.end_date).slice(5)}
                  </Typography>
                  <Typography fontWeight={800}>
                    {rotation ? String(rotation.code) : "Unassigned"}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography fontWeight={900} sx={{ mt: 1 }}>
              Rotation counts
            </Typography>
            <Stack
              direction="row"
              spacing={0.5}
              flexWrap="wrap"
              useFlexGap
              sx={{ mt: 0.5 }}
            >
              {model.counts.map(([name, count]) => (
                <Chip key={name} label={`${name}: ${count}`} size="small" />
              ))}
            </Stack>
          </Card>
        </Stack>
      )}
    </Box>
  );
}
