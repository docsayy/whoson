import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Button,
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
import SourceProfileLinkDialog from "../components/SourceProfileLinkDialog";
import { useAuth } from "../context/AuthContext";
import { canManageResidents } from "../utils/permissions";

const academicYear = (date: string) => {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const start = month >= 7 ? year : year - 1;
  return `${start}-${start + 1}`;
};

const promotionIdentity = (resident: SourceRecord) =>
  `${resident.first_name} ${resident.last_name}`
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const assignmentForBlock = (
  sources: SourceRecord[],
  block: SourceRecord,
  assignments: Record<string, unknown>,
  rotationMap: Map<string, SourceRecord>,
) =>
  sources
    .map((resident) => {
      const rotationId = assignments[`${resident.id}:${block.id}`];
      const rotation = rotationMap.get(String(rotationId));
      return { resident, rotation };
    })
    .filter(
      (item): item is { resident: SourceRecord; rotation: SourceRecord } =>
        Boolean(item.rotation) &&
        !/^off\s+pgy[- ]?\d+$/i.test(String(item.rotation!.code || "")),
    )
    .sort(
      (a, b) =>
        Number(b.resident.cohort_id || 0) -
        Number(a.resident.cohort_id || 0),
    )[0]?.rotation;

const rotationStyle = (code: string) => {
  const normalized = code.toLowerCase();
  if (normalized.includes("vacation")) return { background: "#fef3c7", accent: "#d97706" };
  if (normalized === "nf") return { background: "#ede9fe", accent: "#7c3aed" };
  if (normalized.includes("micu") || normalized.includes("icu")) return { background: "#fee2e2", accent: "#dc2626" };
  if (normalized === "amb") return { background: "#dcfce7", accent: "#16a34a" };
  if (normalized === "tele") return { background: "#ffedd5", accent: "#ea580c" };
  if (normalized === "2n") return { background: "#dbeafe", accent: "#2563eb" };
  if (normalized === "3w") return { background: "#e0e7ff", accent: "#4f46e5" };
  if (normalized === "4n") return { background: "#fef9c3", accent: "#ca8a04" };
  if (normalized === "id") return { background: "#ccfbf1", accent: "#0f766e" };
  if (normalized === "jeo") return { background: "#fae8ff", accent: "#a21caf" };
  if (normalized === "adm") return { background: "#ffe4e6", accent: "#e11d48" };
  return { background: "#f1f5f9", accent: "#64748b" };
};

export default function SourceBlockSchedulePage({
  onOpenResidentProfile,
}: {
  onOpenResidentProfile?: (id: string) => void;
}) {
  const { profile: userProfile } = useAuth();
  const canLink = canManageResidents(userProfile?.role);
  const [data, setData] = useState<SourceRecord | null>(null);
  const [profiles, setProfiles] = useState<Resident[]>([]);
  const [links, setLinks] = useState<SourceProfileLink[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedPgy, setSelectedPgy] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linkTarget, setLinkTarget] = useState("");
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
        // Source Scheduler creates a second record when a resident is promoted
        // mid-year (for example "Ramsha Khan (1)" -> "Ramsha Khan"). Group
        // those records by the full normalized name, not by current PGY/profile.
        // Initial-based aliases such as KhanR and KhanS remain distinct.
        const key = `person:${promotionIdentity(resident)}`;
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
                        <Stack direction="row" spacing={0.5} alignItems="center">
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
                          {canLink && (
                            <Button
                              size="small"
                              variant="text"
                              onClick={() =>
                                setLinkTarget(
                                  `${row.sources[0].first_name} ${row.sources[0].last_name}`,
                                )
                              }
                              sx={{ p: 0, minWidth: 0, fontSize: 9, textTransform: "none" }}
                            >
                              Change
                            </Button>
                          )}
                        </Stack>
                      ) : canLink ? (
                        <Button
                          size="small"
                          variant="text"
                          onClick={() =>
                            setLinkTarget(
                              `${row.sources[0].first_name} ${row.sources[0].last_name}`,
                            )
                          }
                          sx={{
                            p: 0,
                            minWidth: 0,
                            fontWeight: 900,
                            fontSize: 12,
                            textTransform: "none",
                          }}
                        >
                          {row.name} · Link profile
                        </Button>
                      ) : (
                        <strong>{row.name}</strong>
                      )}
                    </td>
                    {model.blocks.map((block) => {
                      const rotation = assignmentForBlock(
                        row.sources,
                        block,
                        model.assignments,
                        model.rotationMap,
                      );
                      const colors = rotationStyle(String(rotation?.code || ""));
                      return (
                        <td
                          key={String(block.id)}
                          style={{
                            background: rotation ? colors.background : "transparent",
                            boxShadow: rotation
                              ? `inset 4px 0 0 ${colors.accent}`
                              : "none",
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
      <SourceProfileLinkDialog
        open={Boolean(linkTarget)}
        sourceName={linkTarget}
        personType="resident"
        profiles={profiles}
        onClose={() => setLinkTarget("")}
        onSaved={() =>
          void getSourceProfileLinks().then((savedLinks) =>
            setLinks(savedLinks),
          )
        }
      />
    </Box>
  );
}
