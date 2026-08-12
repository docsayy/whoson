import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { getAttendings } from "../services/attendingService";
import {
  getSourceAttendingCoverage,
  getSourceServiceDays,
  getSourceSyncStatus,
  type SourceRecord,
} from "../services/sourceSchedulerService";
import type { Attending } from "../types/attending";
import { findLinkedProfile } from "../utils/sourceProfileMatching";
import {
  getSourceProfileLinks,
  type SourceProfileLink,
} from "../services/sourceProfileLinkService";
const value = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthValue = (d: Date) => value(d).slice(0, 7);
const shift = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  return monthValue(new Date(y, m - 1 + n, 1));
};
export default function SourceAttendingProfilePage({
  attendingId,
  onBack,
}: {
  attendingId: string;
  onBack: () => void;
}) {
  const [person, setPerson] = useState<Attending | null>(null);
  const [items, setItems] = useState<SourceRecord[]>([]);
  const [links, setLinks] = useState<SourceProfileLink[]>([]);
  const [month, setMonth] = useState(monthValue(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    void Promise.all([
      getAttendings(),
      getSourceSyncStatus(),
      getSourceProfileLinks(),
    ])
      .then(async ([people, status, savedLinks]) => {
        const found = people.find((item) => item.id === attendingId) || null;
        setPerson(found);
        setLinks(savedLinks);
        if (status?.start && status?.end) {
          const [calls, serviceDays] = await Promise.all([
            getSourceAttendingCoverage(status.start, status.end),
            getSourceServiceDays(status.start, status.end),
          ]);
          const serviceCoverage = serviceDays.flatMap((day) =>
            ((day.entries as SourceRecord[]) || []).flatMap((entry) => {
              const coverage = entry.coverage as SourceRecord | undefined;
              const attending = coverage?.attending as SourceRecord | undefined;
              return attending
                ? [
                    {
                      attending_name: attending.name,
                      start_date: day.date,
                      end_date: day.date,
                      label: (entry.service as SourceRecord)?.name || "Service",
                    },
                  ]
                : [];
            }),
          );
          setItems([...calls, ...serviceCoverage]);
        }
      })
      .catch(() =>
        setError("Unable to load this attending's synchronized schedule."),
      )
      .finally(() => setLoading(false));
  }, [attendingId]);
  const assignments = useMemo(
    () =>
      person
        ? items.filter((item) =>
            findLinkedProfile(
              String(item.attending_name || ""),
              "attending",
              [person],
              links,
            ),
          )
        : [],
    [items, links, person],
  );
  const days = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return {
        date: value(day),
        inMonth: day.getMonth() === m - 1,
        weekend: [0, 6].includes(day.getDay()),
      };
    });
  }, [month]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    assignments.forEach((item) => {
      const label = String(
        item.label ||
          item.service_name ||
          item.floor_label ||
          item.coverage_type,
      );
      map.set(label, (map.get(label) || 0) + 1);
    });
    return [...map.entries()].sort();
  }, [assignments]);
  if (loading)
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  if (!person)
    return (
      <Box>
        <Button onClick={onBack} startIcon={<ArrowBackIcon />}>
          Back
        </Button>
        <Alert severity="error">Attending profile not found.</Alert>
      </Box>
    );
  return (
    <Box>
      <Button onClick={onBack} startIcon={<ArrowBackIcon />} sx={{ mb: 1 }}>
        Back
      </Button>
      <Card sx={{ p: 1.5, mb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" fontWeight={900}>
              {[person.firstName, person.lastName].filter(Boolean).join(" ") ||
                person.displayName}
            </Typography>
            <Typography color="text.secondary">{person.specialty}</Typography>
          </Box>
          {person.phone && (
            <Link href={`tel:${person.phone}`} fontWeight={800}>
              {person.phone}
            </Link>
          )}
        </Stack>
      </Card>
      {error && <Alert severity="error">{error}</Alert>}
      <Card sx={{ p: 1.2 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box />
          <Stack direction="row" alignItems="center">
            <IconButton onClick={() => setMonth(shift(month, -1))}>
              <ChevronLeftIcon />
            </IconButton>
            <Typography fontWeight={850}>
              {new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </Typography>
            <IconButton onClick={() => setMonth(shift(month, 1))}>
              <ChevronRightIcon />
            </IconButton>
          </Stack>
        </Stack>
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
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <Box
              key={day}
              sx={{
                p: 0.45,
                bgcolor: day === "Sun" || day === "Sat" ? "grey.200" : "grey.100",
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
          {days.map((day) => {
            const date = day.date;
            const coverage = assignments.filter(
              (item) =>
                String(item.start_date) <= date &&
                String(item.end_date) >= date,
            );
            const isToday = date === value(new Date());
            return (
              <Box
                key={date}
                sx={{
                  minHeight: 80,
                  p: 0.5,
                  borderRight: "1px solid",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  bgcolor: isToday
                    ? "#fff8db"
                    : !day.inMonth
                      ? "grey.50"
                      : day.weekend
                        ? "#f1f5f9"
                        : "white",
                  opacity: day.inMonth ? 1 : 0.45,
                  outline: isToday ? "2px solid #f59e0b" : "none",
                  outlineOffset: -2,
                }}
              >
                <Typography fontWeight={900} fontSize={11}>
                  {Number(date.slice(-2))}
                </Typography>
                {coverage.map((item, i) => (
                  <Chip
                    key={i}
                    label={String(
                      item.label ||
                        item.floor_label ||
                        item.service_name ||
                        "Coverage",
                    )}
                    size="small"
                    sx={{
                      mt: 0.3,
                      maxWidth: "100%",
                      height: 20,
                      fontSize: 9,
                      "& .MuiChip-label": {
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      },
                    }}
                  />
                ))}
              </Box>
            );
          })}
        </Box>
        <Typography fontWeight={900} sx={{ mt: 1 }}>
          Coverage counts
        </Typography>
        <Stack
          direction="row"
          spacing={0.5}
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 0.5 }}
        >
          {counts.map(([name, count]) => (
            <Chip key={name} label={`${name}: ${count}`} size="small" />
          ))}
        </Stack>
      </Card>
    </Box>
  );
}
