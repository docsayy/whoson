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
import {
  compareSourceRoles,
  sourceRoleKey,
  sourceRoleLabel,
} from "../utils/sourceCallRole";

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
    return (
      days.find((day) => String(day.date) === date) || { date, entries: [] }
    );
  });
  const roles = Array.from(
    new Map(
      weekDays.flatMap((day) =>
        ((day.entries as SourceRecord[]) || [])
          .filter((entry) => ((entry.residents as SourceRecord[]) || []).length)
          .map((entry) => {
            const role = entry.role as SourceRecord;
            return [sourceRoleKey(role), role] as const;
          }),
      ),
    ).values(),
  ).sort(compareSourceRoles);
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
      {error && <Alert severity="error">{error}</Alert>}
      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : (
        <Card sx={{ overflowX: "auto" }}>
          <Box
            component="table"
            sx={{
              borderCollapse: "collapse",
              width: "100%",
              minWidth: 920,
              tableLayout: "fixed",
              "th,td": {
                borderRight: "1px solid",
                borderBottom: "1px solid",
                borderColor: "divider",
                px: 0.65,
                py: 0.55,
                verticalAlign: "middle",
              },
              th: { bgcolor: "#e2e8f0", fontWeight: 900, fontSize: 11.5 },
              "th:first-of-type,td:first-of-type": {
                width: 160,
                position: "sticky",
                left: 0,
                zIndex: 2,
                bgcolor: "#f8fafc",
              },
            }}
          >
            <thead>
              <tr>
                <th>Assignment</th>
                {weekDays.map((day) => {
                  const isToday = String(day.date) === value(new Date());
                  return (
                    <th
                      key={String(day.date)}
                      style={{
                        background: isToday ? "#fcd898" : undefined,
                        outline: isToday ? "2px solid #f59e0b" : undefined,
                        outlineOffset: -2,
                      }}
                    >
                      {new Date(`${day.date}T12:00:00`).toLocaleDateString(
                        "en-US",
                        { weekday: "short", month: "short", day: "numeric" },
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={sourceRoleKey(role)}>
                  <td>
                    <Typography fontWeight={900} fontSize={11.5}>
                      {sourceRoleLabel(role)}
                    </Typography>
                  </td>
                  {weekDays.map((day) => {
                    const entry = ((day.entries as SourceRecord[]) || []).find(
                      (item) =>
                        sourceRoleKey((item.role as SourceRecord) || {}) ===
                        sourceRoleKey(role),
                    );
                    const people =
                      (entry?.residents as SourceRecord[] | undefined) || [];
                    const isToday = String(day.date) === value(new Date());
                    return (
                      <td
                        key={String(day.date)}
                        style={{ background: isToday ? "#fff8db" : undefined }}
                      >
                        {people.length ? (
                          <Stack spacing={0.15}>
                            {people.map((person, i) => {
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
                                  sx={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    textAlign: "left",
                                  }}
                                >
                                  {profile.displayName}
                                </Link>
                              ) : (
                                <Typography key={i} fontSize={11}>
                                  {name}
                                </Typography>
                              );
                            })}
                          </Stack>
                        ) : (
                          <Typography fontSize={10.5} color="text.disabled">
                            —
                          </Typography>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </Box>
        </Card>
      )}
    </Box>
  );
}
