import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Link,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  getSourceBlockSchedule,
  type SourceRecord,
} from "../services/sourceSchedulerService";
import { getResidents } from "../services/residentService";
import type { Resident } from "../types/resident";
import { findLinkedProfile } from "../utils/sourceProfileMatching";
import {
  getSourceProfileLinks,
  type SourceProfileLink,
} from "../services/sourceProfileLinkService";

const academicYear = (date: string) => {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const start = month >= 7 ? year : year - 1;
  return `${start}-${start + 1}`;
};
export default function SourceBlockSchedulePage({
  onOpenResidentProfile,
}: {
  onOpenResidentProfile?: (id: string) => void;
}) {
  const [data, setData] = useState<SourceRecord | null>(null);
  const [profiles, setProfiles] = useState<Resident[]>([]);
  const [links, setLinks] = useState<SourceProfileLink[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedPgy, setSelectedPgy] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    void Promise.all([
      getSourceBlockSchedule(),
      getResidents(),
      getSourceProfileLinks(),
    ])
      .then(([schedule, people, savedLinks]) => {
        setData(schedule);
        setProfiles(people);
        setLinks(savedLinks);
      })
      .catch(() => setError("Unable to load the cached block schedule."))
      .finally(() => setLoading(false));
  }, []);
  const model = useMemo(() => {
    const allBlocks = (data?.blocks as SourceRecord[] | undefined) || [];
    const years = Array.from(
      new Set(allBlocks.map((block) => academicYear(String(block.start_date)))),
    ).sort();
    const current = academicYear(new Date().toISOString().slice(0, 10));
    const year =
      selectedYear ||
      years.find((item) => item === current) ||
      years.at(-1) ||
      current;
    const blocks = allBlocks.filter(
      (block) => academicYear(String(block.start_date)) === year,
    );
    const residents = (data?.residents as SourceRecord[] | undefined) || [];
    const rotations = (data?.rotations as SourceRecord[] | undefined) || [];
    const assignments =
      (data?.assignments as Record<string, unknown> | undefined) || {};
    return {
      years,
      year,
      blocks,
      residents,
      assignments,
      rotationMap: new Map(rotations.map((item) => [String(item.id), item])),
    };
  }, [data, selectedYear]);
  const residentRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string;
        name: string;
        pgys: Set<string>;
        profile?: Resident;
        sources: SourceRecord[];
      }
    >();
    model.residents
      .filter((resident) => resident.is_active !== false)
      .forEach((resident) => {
        const sourceName = `${resident.first_name} ${resident.last_name}`;
        const profile = findLinkedProfile(
          sourceName,
          "resident",
          profiles,
          links,
        );
        const key = profile ? `profile:${profile.id}` : `source:${resident.id}`;
        const existing = grouped.get(key);
        const sourcePgy = resident.cohort_id
          ? `PGY-${resident.cohort_id}`
          : undefined;
        if (existing) {
          existing.sources.push(resident);
          if (sourcePgy) existing.pgys.add(sourcePgy);
          if (profile?.pgy) existing.pgys.add(profile.pgy);
        }
        else
          grouped.set(key, {
            key,
            name:
              profile?.displayName || sourceName.replace(/\s*\(\d+\)\s*$/, ""),
            pgys: new Set([profile?.pgy, sourcePgy].filter(Boolean) as string[]),
            profile,
            sources: [resident],
          });
      });
    return [...grouped.values()].filter(
      (row) => selectedPgy === "all" || row.pgys.has(selectedPgy),
    );
  }, [links, model.residents, profiles, selectedPgy]);
  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ sm: "center" }}
        sx={{ mb: 1 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={900}>
            Block Schedule
          </Typography>
          <Typography color="text.secondary">
            Source Scheduler colors are preserved. Select a resident to open
            their profile.
          </Typography>
        </Box>
        <TextField
          select
          size="small"
          label="Academic year"
          value={model.year}
          onChange={(e) => setSelectedYear(e.target.value)}
          sx={{ minWidth: 155 }}
        >
          {model.years.map((year) => (
            <MenuItem key={year} value={year}>
              {year}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Tabs
        value={selectedPgy}
        onChange={(_, value) => setSelectedPgy(value)}
        sx={{ mb: 1, minHeight: 38, "& .MuiTab-root": { minHeight: 38 } }}
      >
        <Tab value="all" label="All residents" />
        <Tab value="PGY-1" label="PGY-1" />
        <Tab value="PGY-2" label="PGY-2" />
        <Tab value="PGY-3" label="PGY-3" />
      </Tabs>
      {error && <Alert severity="error">{error}</Alert>}
      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : !data ? (
        <Alert severity="info">
          No synchronized block schedule is available yet.
        </Alert>
      ) : (
        <Box
          sx={{
            overflow: "auto",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "background.paper",
          }}
        >
          <Box
            component="table"
            sx={{
              borderCollapse: "collapse",
              minWidth: 1100,
              width: "100%",
              "th,td": {
                borderBottom: "1px solid",
                borderRight: "1px solid",
                borderColor: "divider",
                p: 0.7,
                fontSize: 12,
              },
              th: {
                position: "sticky",
                top: 0,
                bgcolor: "grey.100",
                zIndex: 2,
                fontWeight: 900,
              },
              "th:first-of-type,td:first-of-type": {
                position: "sticky",
                left: 0,
                bgcolor: "background.paper",
                zIndex: 3,
                minWidth: 155,
              },
            }}
          >
            <thead>
              <tr>
                <th>Resident</th>
                {model.blocks.map((block) => (
                  <th key={String(block.id)}>
                    B{String(block.number)}
                    <br />
                    {String(block.start_date).slice(5)}–
                    {String(block.end_date).slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {residentRows.map((row) => {
                return (
                  <tr key={row.key}>
                    <td>
                      {row.profile && onOpenResidentProfile ? (
                        <Link
                          component="button"
                          underline="hover"
                          onClick={() => onOpenResidentProfile(row.profile!.id)}
                          sx={{
                            fontWeight: 900,
                            fontSize: 12,
                            textAlign: "left",
                          }}
                        >
                          {row.name}
                        </Link>
                      ) : (
                        <strong>{row.name}</strong>
                      )}
                    </td>
                    {model.blocks.map((block) => {
                      const rotationId = row.sources
                        .map(
                          (resident) =>
                            model.assignments[`${resident.id}:${block.id}`],
                        )
                        .find(Boolean);
                      const rotation = model.rotationMap.get(
                        String(rotationId),
                      );
                      return (
                        <td
                          key={String(block.id)}
                          style={{
                            background: String(
                              rotation?.color || "transparent",
                            ),
                            fontWeight: 700,
                          }}
                        >
                          {rotation ? String(rotation.code) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </Box>
        </Box>
      )}
    </Box>
  );
}
