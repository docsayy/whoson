import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  IconButton,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SourceSyncBanner from "../components/SourceSyncBanner";
import {
  getSourceCallDays,
  type SourceRecord,
} from "../services/sourceSchedulerService";
import { getResidents } from "../services/residentService";
import type { Resident } from "../types/resident";
import { findLinkedProfile } from "../utils/sourceProfileMatching";
import {
  getSourceProfileLinks,
  type SourceProfileLink,
} from "../services/sourceProfileLinkService";

const value = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const add = (d: Date, n: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};
const weekThursday = (d = new Date()) => {
  const day = d.getDay();
  const delta = day >= 4 ? 4 - day : -(day + 3);
  return add(d, delta);
};
export default function SourceCallSchedulePage({
  onOpenResidentProfile,
}: {
  onOpenResidentProfile?: (id: string) => void;
}) {
  const [start, setStart] = useState(() => value(weekThursday()));
  const [days, setDays] = useState<SourceRecord[]>([]);
  const [profiles, setProfiles] = useState<Resident[]>([]);
  const [links, setLinks] = useState<SourceProfileLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const end = useMemo(
    () => value(add(new Date(`${start}T12:00:00`), 6)),
    [start],
  );
  useEffect(() => {
    setLoading(true);
    setError("");
    void Promise.all([
      getSourceCallDays(start, end),
      getResidents(),
      getSourceProfileLinks(),
    ])
      .then(([schedule, people, savedLinks]) => {
        setDays(schedule);
        setProfiles(people);
        setLinks(savedLinks);
      })
      .catch(() => setError("Unable to load the cached call schedule."))
      .finally(() => setLoading(false));
  }, [start, end]);
  const shift = (n: number) =>
    setStart(value(add(new Date(`${start}T12:00:00`), n)));
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = value(add(new Date(`${start}T12:00:00`), index));
    return days.find((day) => String(day.date) === date) || { date, entries: [] };
  });
  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ md: "center" }}
        sx={{ mb: 1 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={900}>
            Daily Call Schedule
          </Typography>
          <Typography color="text.secondary">
            Weekly view runs Thursday through Wednesday.
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center">
          <IconButton onClick={() => shift(-7)}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography
            fontWeight={850}
            sx={{ minWidth: { xs: 180, sm: 255 }, textAlign: "center" }}
          >
            {new Date(`${start}T12:00:00`).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}{" "}
            –{" "}
            {new Date(`${end}T12:00:00`).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Typography>
          <IconButton onClick={() => shift(7)}>
            <ChevronRightIcon />
          </IconButton>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setStart(value(weekThursday()))}
          >
            This week
          </Button>
        </Stack>
      </Stack>
      <SourceSyncBanner />
      {error && <Alert severity="error">{error}</Alert>}
      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : (
        <Box sx={{ overflowX: "auto", pb: 0.5 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(155px,1fr))", minWidth: 1085, gap: 0.6 }}>
          {weekDays.map((day) => (
            <Card
              key={String(day.date)}
              sx={{
                p: 0.65,
                border:
                  String(day.date) === value(new Date())
                    ? "2px solid #f59e0b"
                    : undefined,
                bgcolor:
                  String(day.date) === value(new Date())
                    ? "#fffdf5"
                    : undefined,
              }}
            >
              <Typography fontWeight={900} fontSize={12} sx={{ mb: 0.55, textAlign: "center" }}>
                {new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </Typography>
              <Stack spacing={0.35}>
                {((day.entries as SourceRecord[]) || [])
                  .filter(
                    (entry) =>
                      ((entry.residents as SourceRecord[]) || []).length,
                  )
                  .map((entry, index) => (
                    <Box
                      key={index}
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        px: 0.45,
                        py: 0.35,
                        minWidth: 0,
                      }}
                    >
                      <Typography fontWeight={900} fontSize={10.5} noWrap>
                        {String((entry.role as SourceRecord)?.code || "")}
                      </Typography>
                      <Stack spacing={0.15} sx={{ minWidth: 0 }}>
                        {((entry.residents as SourceRecord[]) || []).map(
                          (person, i) => {
                            const name = String(person.name);
                            const profile = findLinkedProfile(
                              name,
                              "resident",
                              profiles,
                              links,
                            );
                            return profile && onOpenResidentProfile ? (
                              <Link
                                key={i}
                                component="button"
                                onClick={() =>
                                  onOpenResidentProfile(profile.id)
                                }
                                underline="hover"
                                sx={{ fontSize: 10.5, fontWeight: 800, textAlign: "left" }}
                              >
                                {name}
                              </Link>
                            ) : (
                              <Typography key={i} fontSize={10.5} noWrap>
                                {name}
                              </Typography>
                            );
                          },
                        )}
                      </Stack>
                    </Box>
                  ))}
              </Stack>
            </Card>
          ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
