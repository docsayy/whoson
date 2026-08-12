import { useEffect, useState } from "react";
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
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import PhoneIcon from "@mui/icons-material/Phone";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
  getSourceAttendingCoverage,
  getSourceCallDay,
  getSourceServiceDay,
  type SourceRecord,
} from "../services/sourceSchedulerService";
import { getResidents } from "../services/residentService";
import { getAttendings } from "../services/attendingService";
import type { Resident } from "../types/resident";
import type { Attending } from "../types/attending";
import {
  findLinkedProfile,
  type PersonProfile,
} from "../utils/sourceProfileMatching";
import {
  getSourceProfileLinks,
  type SourcePersonType,
  type SourceProfileLink,
} from "../services/sourceProfileLinkService";
import SourceProfileLinkDialog from "../components/SourceProfileLinkDialog";
import { useAuth } from "../context/AuthContext";
import { canManageResidents } from "../utils/permissions";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const moveDate = (date: string, days: number) => {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
};
const nightRole = (role: string) => /\bnf\b|night/i.test(role);
export default function SourceWhosOnPage({
  onOpenResidentProfile,
  onOpenAttendingProfile,
}: {
  onOpenResidentProfile?: (id: string) => void;
  onOpenAttendingProfile?: (id: string) => void;
  onOpenConsultServiceProfile?: (id: string) => void;
}) {
  const { profile: userProfile } = useAuth();
  const canLink = canManageResidents(userProfile?.role);
  const [date, setDate] = useState(today());
  const [tab, setTab] = useState(0);
  const [call, setCall] = useState<SourceRecord | null>(null);
  const [inpatient, setInpatient] = useState<SourceRecord | null>(null);
  const [clinic, setClinic] = useState<SourceRecord | null>(null);
  const [attending, setAttending] = useState<SourceRecord[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [attendings, setAttendings] = useState<Attending[]>([]);
  const [links, setLinks] = useState<SourceProfileLink[]>([]);
  const [linkTarget, setLinkTarget] = useState<{
    name: string;
    type: SourcePersonType;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = () =>
    Promise.all([
      getSourceCallDay(date),
      getSourceServiceDay(date, "inpatient"),
      getSourceServiceDay(date, "clinic"),
      getSourceAttendingCoverage(date, date),
      userProfile ? getResidents(true) : Promise.resolve([]),
      userProfile ? getAttendings(true) : Promise.resolve([]),
      userProfile ? getSourceProfileLinks() : Promise.resolve([]),
    ]).then(
      ([
        calls,
        services,
        clinics,
        coverage,
        residentProfiles,
        attendingProfiles,
        savedLinks,
      ]) => {
        setCall(calls);
        setInpatient(services);
        setClinic(clinics);
        setAttending(coverage);
        setResidents(residentProfiles);
        setAttendings(attendingProfiles);
        setLinks(savedLinks);
      },
    );
  useEffect(() => {
    setLoading(true);
    setError("");
    void load()
      .catch(() => setError("Unable to load the cached daily schedule."))
      .finally(() => setLoading(false));
  }, [date, userProfile]);
  const personLink = (name: string, type: SourcePersonType) => {
    const profiles: PersonProfile[] =
      type === "resident" ? residents : attendings;
    const profile = findLinkedProfile(name, type, profiles, links);
    const open =
      type === "resident" ? onOpenResidentProfile : onOpenAttendingProfile;
    return profile ? (
      <Stack direction="row" spacing={0.6} alignItems="center">
        {open ? (
          <Link
            component="button"
            underline="hover"
            onClick={() => open(profile.id)}
            sx={{ fontSize: 12, fontWeight: 800, textAlign: "right" }}
          >
            {name}
          </Link>
        ) : (
          <Typography fontSize={12}>{name}</Typography>
        )}
        {type === "attending" && profile.phone && (
          <Link
            href={`tel:${profile.phone}`}
            aria-label={`Call ${profile.displayName}`}
          >
            <PhoneIcon sx={{ fontSize: 16 }} />
          </Link>
        )}
      </Stack>
    ) : canLink ? (
      <Button
        size="small"
        variant="text"
        onClick={() => setLinkTarget({ name, type })}
        sx={{
          fontSize: 11.5,
          fontWeight: 800,
          p: 0,
          minWidth: 0,
          textTransform: "none",
        }}
      >
        {name || "Unassigned"} · Link
      </Button>
    ) : (
      <Typography fontSize={12}>{name || "Unassigned"}</Typography>
    );
  };
  const callEntries = ((call?.entries as SourceRecord[]) || []).filter(
    (item) => ((item.residents as SourceRecord[]) || []).length,
  );
  const services: Array<SourceRecord & { kind: string }> = [
    ...((inpatient?.entries as SourceRecord[] | undefined) || []).map(
      (item): SourceRecord & { kind: string } => ({
        ...item,
        kind: "Inpatient",
      }),
    ),
    ...((clinic?.entries as SourceRecord[] | undefined) || []).map(
      (item): SourceRecord & { kind: string } => ({ ...item, kind: "Clinic" }),
    ),
  ].filter((item) => Boolean(item.coverage));
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
            Who&apos;s On
          </Typography>
          <Typography color="text.secondary">
            Compact daily coverage from Source Scheduler.
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <IconButton
            size="small"
            onClick={() => setDate(moveDate(date, -1))}
            aria-label="Previous day"
          >
            <ChevronLeftIcon />
          </IconButton>
          <TextField
            size="small"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <IconButton
            size="small"
            onClick={() => setDate(moveDate(date, 1))}
            aria-label="Next day"
          >
            <ChevronRightIcon />
          </IconButton>
          <Button variant="outlined" onClick={() => setDate(today())}>
            Today
          </Button>
        </Stack>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : (
        <Card>
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            variant="scrollable"
            sx={{
              borderBottom: "1px solid",
              borderColor: "divider",
              px: 1,
              minHeight: 40,
              "& .MuiTab-root": { minHeight: 40, py: 0.5 },
            }}
          >
            <Tab label="Residents" />
            <Tab label="Attending coverage" />
            <Tab label="Services" />
          </Tabs>
          <Box sx={{ p: 0.8 }}>
            {tab === 0 && (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr)",
                  gap: 0.25,
                }}
              >
                {callEntries.map((item, index) => {
                  const role = String(
                    (item.role as SourceRecord)?.code || "Call",
                  );
                  const night = nightRole(role);
                  return (
                    <Box
                      key={index}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "minmax(150px,35%) minmax(0,1fr)",
                        alignItems: "center",
                        px: 0.65,
                        py: 0.28,
                        minHeight: 29,
                        borderRadius: 1.2,
                        bgcolor: night ? "#eef2ff" : "#ecfdf5",
                        border: "1px solid",
                        borderColor: night ? "#c7d2fe" : "#bbf7d0",
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        justifyContent="flex-end"
                      >
                        <Typography fontWeight={900} fontSize={12}>
                          {role}
                        </Typography>
                        <Chip
                          label={night ? "Night" : "Day"}
                          size="small"
                          sx={{
                            height: 17,
                            fontSize: 9,
                            fontWeight: 900,
                            bgcolor: night ? "#4338ca" : "#15803d",
                            color: "white",
                          }}
                        />
                      </Stack>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        justifyContent="flex-start"
                        sx={{ pl: 1.5 }}
                      >
                        {((item.residents as SourceRecord[]) || []).map(
                          (person, i) => (
                            <Box key={i}>
                              {personLink(String(person.name), "resident")}
                            </Box>
                          ),
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            )}
            {tab === 1 && (
              <Stack spacing={0}>
                {attending.map((item, index) => (
                  <Box
                    key={String(item.id || index)}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "minmax(180px,35%) minmax(0,1fr)",
                      alignItems: "center",
                      py: 0.4,
                      borderBottom:
                        index < attending.length - 1 ? "1px solid" : "none",
                      borderColor: "divider",
                    }}
                  >
                    <Typography fontWeight={850} fontSize={12}>
                      {String(
                        item.label ||
                          item.service_name ||
                          item.floor_label ||
                          item.coverage_type,
                      )}
                    </Typography>
                    <Box sx={{ pl: 1.5 }}>
                      {personLink(
                        String(item.attending_name || ""),
                        "attending",
                      )}
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
            {tab === 2 && (
              <Stack spacing={0}>
                {services.map((item, index) => {
                  const coverage = item.coverage as SourceRecord;
                  const serviceAttending = coverage.attending as
                    SourceRecord | undefined;
                  const serviceResidents =
                    (coverage.residents as SourceRecord[]) || [];
                  return (
                    <Box
                      key={index}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "28% 32% 40%" },
                        alignItems: "center",
                        columnGap: 1,
                        py: 0.65,
                        borderBottom:
                          index < services.length - 1 ? "1px solid" : "none",
                        borderColor: "divider",
                      }}
                    >
                      <Typography fontWeight={850} fontSize={12}>
                        {String(
                          (item.service as SourceRecord)?.name || "Service",
                        )}
                      </Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {serviceAttending ? (
                          personLink(String(serviceAttending.name), "attending")
                        ) : (
                          <Typography fontSize={12}>—</Typography>
                        )}
                      </Stack>
                      <Stack
                        direction="row"
                        spacing={0.6}
                        alignItems="center"
                        flexWrap="wrap"
                      >
                        {serviceResidents.length ? (
                          serviceResidents.map((person, i) => (
                            <Box key={i}>
                              {personLink(
                                `${person.first_name} ${person.last_name}`,
                                "resident",
                              )}
                            </Box>
                          ))
                        ) : (
                          <Typography fontSize={12}>—</Typography>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Card>
      )}
      <SourceProfileLinkDialog
        open={Boolean(linkTarget)}
        sourceName={linkTarget?.name || ""}
        personType={linkTarget?.type || "resident"}
        profiles={linkTarget?.type === "attending" ? attendings : residents}
        onClose={() => setLinkTarget(null)}
        onSaved={() => void load()}
      />
    </Box>
  );
}
