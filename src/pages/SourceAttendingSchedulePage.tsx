import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  IconButton,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PhoneIcon from "@mui/icons-material/Phone";
import {
  getSourceAttendingCoverage,
  type SourceRecord,
} from "../services/sourceSchedulerService";
import { getAttendings } from "../services/attendingService";
import type { Attending } from "../types/attending";
import { findLinkedProfile } from "../utils/sourceProfileMatching";
import {
  getSourceProfileLinks,
  type SourceProfileLink,
} from "../services/sourceProfileLinkService";

const value = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const move = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return value(d);
};
export default function SourceAttendingSchedulePage({
  onOpenAttendingProfile,
}: {
  onOpenAttendingProfile?: (id: string) => void;
}) {
  const [date, setDate] = useState(value(new Date()));
  const [items, setItems] = useState<SourceRecord[]>([]);
  const [profiles, setProfiles] = useState<Attending[]>([]);
  const [links, setLinks] = useState<SourceProfileLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setLoading(true);
    setError("");
    void Promise.all([
      getSourceAttendingCoverage(date, date),
      getAttendings(),
      getSourceProfileLinks(),
    ])
      .then(([coverage, people, savedLinks]) => {
        setItems(coverage);
        setProfiles(people);
        setLinks(savedLinks);
      })
      .catch(() => setError("Unable to load attending coverage."))
      .finally(() => setLoading(false));
  }, [date]);
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
            Attending Call Schedule
          </Typography>
          <Typography color="text.secondary">
            Coverage for one selected day. Names open matching Firestore
            profiles.
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <IconButton onClick={() => setDate(move(date, -1))}>
            <ChevronLeftIcon />
          </IconButton>
          <TextField
            size="small"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <IconButton onClick={() => setDate(move(date, 1))}>
            <ChevronRightIcon />
          </IconButton>
          <Button variant="outlined" onClick={() => setDate(value(new Date()))}>
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
        <Card sx={{ p: { xs: 1, md: 1.5 } }}>
          <Typography fontWeight={900} fontSize={17} sx={{ mb: 0.8 }}>
            {new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </Typography>
          {items.length === 0 ? (
            <Alert severity="info">
              No attending coverage is listed for this date.
            </Alert>
          ) : (
            items.map((item, index) => {
              const name = String(item.attending_name || "Unassigned");
              const profile = findLinkedProfile(
                name,
                "attending",
                profiles,
                links,
              );
              return (
                <Stack
                  key={String(item.id || index)}
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  sx={{
                    py: 0.8,
                    borderTop: index ? "1px solid" : "none",
                    borderColor: "divider",
                  }}
                >
                  <Typography fontWeight={850}>
                    {String(
                      item.label ||
                        item.service_name ||
                        item.floor_label ||
                        item.coverage_type,
                    )}
                  </Typography>
                  <Stack direction="row" spacing={0.7}>
                    {profile && onOpenAttendingProfile ? (
                      <Link
                        component="button"
                        underline="hover"
                        onClick={() => onOpenAttendingProfile(profile.id)}
                        sx={{ fontWeight: 800, textAlign: "right" }}
                      >
                        {name}
                      </Link>
                    ) : (
                      <Typography>{name}</Typography>
                    )}
                    {profile?.phone && (
                      <Link href={`tel:${profile.phone}`}>
                        <PhoneIcon sx={{ fontSize: 18 }} />
                      </Link>
                    )}
                  </Stack>
                </Stack>
              );
            })
          )}
        </Card>
      )}
    </Box>
  );
}
