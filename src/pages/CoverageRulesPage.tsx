import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GroupsIcon from "@mui/icons-material/Groups";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import NightlightIcon from "@mui/icons-material/Nightlight";
import PersonIcon from "@mui/icons-material/Person";
import ShieldIcon from "@mui/icons-material/Shield";
import WeekendIcon from "@mui/icons-material/Weekend";

import { CONFIRMED_2026_HOSPITAL_HOLIDAYS } from "../utils/holidayRules";

type RuleRow = {
  title: string;
  detail: string;
  tag?: string;
};

const weekdayOrder = [
  "2N-CCU PGY1",
  "Tele PGY1",
  "2N-CCU PGY2",
  "4N PGY1",
  "3W PGY1",
  "4N-3W PGY2",
  "MICU PGY1",
  "MICU Senior",
  "Chief On Call",
  "2N-CCU PGY1 NF",
  "2N-CCU PGY2 NF",
  "4N-3W PGY1 NF",
  "4N-3W PGY2 NF",
  "PGY3 NF",
];

const weekendOrder = [
  "2N-CCU PGY1",
  "Short Duty 2N PGY1",
  "Tele PGY1",
  "Short Duty Tele PGY1",
  "2N-CCU PGY2",
  "4N PGY1",
  "Short Duty 4N PGY1",
  "3W PGY1",
  "4N-3W PGY2",
  "MICU PGY1",
  "MICU Senior",
  "Chief On Call",
  "2N-CCU PGY1 NF",
  "2N-CCU PGY2 NF",
  "4N-3W PGY1 NF",
  "4N-3W PGY2 NF",
  "PGY3 NF",
];

const eligibilityRows: RuleRow[] = [
  {
    title: "ER",
    detail: "PGY-3 only. No required minimum; zero or more may be assigned.",
    tag: "PGY-3",
  },
  {
    title: "Elective",
    detail: "Senior rotation for PGY-2 and PGY-3. PGY-1 is not eligible.",
    tag: "PGY-2/3",
  },
  {
    title: "GI and Neurology",
    detail: "One PGY-2 on each service. PGY-3 is not routinely assigned.",
    tag: "PGY-2",
  },
  {
    title: "Heme-Onc and Nephro/Rheum/Endo",
    detail: "PGY-3 only.",
    tag: "PGY-3",
  },
  {
    title: "Pulmonary and MICU senior",
    detail: "Senior rotations open to PGY-2 and PGY-3.",
    tag: "PGY-2/3",
  },
  {
    title: "Cardiology/CCU",
    detail:
      "PGY-2 is the normal assignment. PGY-3 is available only as a coverage/override assignment when needed.",
    tag: "Override-aware",
  },
  {
    title: "ID",
    detail: "One PGY-1 intern plus one senior; the senior may be PGY-2 or PGY-3.",
    tag: "Paired",
  },
  {
    title: "Admission",
    detail: "One PGY-1 plus one senior. Both report 7 AM–4 PM; after five admissions, additional admissions go to the floors.",
    tag: "Paired",
  },
  {
    title: "Jeopardy",
    detail: "Zero or more residents may be assigned. It may overlap with Chief On Call when clinically intended.",
    tag: "Flexible",
  },
];

function RuleList({ rows }: { rows: RuleRow[] }) {
  return (
    <Stack divider={<Divider flexItem />}>
      {rows.map((row) => (
        <Box key={row.title} sx={{ py: 0.9 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={0.5}
          >
            <Box>
              <Typography fontWeight={800} fontSize={13}>
                {row.title}
              </Typography>
              <Typography color="text.secondary" fontSize={11.75}>
                {row.detail}
              </Typography>
            </Box>
            {row.tag && <Chip size="small" label={row.tag} variant="outlined" />}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

function OrderGrid({ items }: { items: string[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
        gap: 0.5,
      }}
    >
      {items.map((item, index) => (
        <Box
          key={item}
          sx={{
            display: "grid",
            gridTemplateColumns: "22px 1fr",
            alignItems: "center",
            gap: 0.5,
            p: 0.6,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
            backgroundColor: "background.paper",
          }}
        >
          <Typography fontSize={10.5} fontWeight={800} color="text.secondary">
            {index + 1}
          </Typography>
          <Typography fontSize={11.5} fontWeight={700}>
            {item}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function CoverageRulesPage() {
  return (
    <Box sx={{ width: "100%", maxWidth: 1180, mx: "auto" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Coverage Rules
          </Typography>
          <Typography color="text.secondary" fontSize={12.5}>
            Current block, call, Night Float, weekend, holiday, and chief coverage rules.
          </Typography>
        </Box>
        <Chip icon={<ShieldIcon />} label="Scheduling source of truth" size="small" color="primary" variant="outlined" />
      </Stack>

      <Alert severity="info" sx={{ mb: 1.25 }}>
        These rules guide eligibility and validation. Schedule builders may save a clinically necessary override with a reason; warnings should not silently delete or block approved coverage exceptions.
      </Alert>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: 1.25,
          mb: 1.25,
        }}
      >
        <Card sx={{ borderRadius: 2.5 }}>
          <CardContent sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
              <CalendarMonthIcon color="primary" fontSize="small" />
              <Typography fontWeight={800} fontSize={14}>
                Academic blocks
              </Typography>
            </Stack>
            <Typography fontSize={11.75} color="text.secondary">
              The academic year runs July 1–June 30. Block 1 begins July 1 and ends on a Wednesday. Subsequent two-week blocks begin Thursday morning and end Wednesday. Night Float begins Thursday night, the night between Thursday and Friday.
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 2.5 }}>
          <CardContent sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
              <PersonIcon color="primary" fontSize="small" />
              <Typography fontWeight={800} fontSize={14}>
                Active Chief vs Chief On Call
              </Typography>
            </Stack>
            <Typography fontSize={11.75} color="text.secondary">
              Active Chief is one of the four chief residents assigned for the entire block. It is an additional responsibility and does not replace or restrict that chief’s normal eligible rotation. Chief On Call is a separate daily call role that may be assigned to any PGY-3 resident.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Stack spacing={1}>
        <Accordion defaultExpanded disableGutters sx={{ borderRadius: "12px !important", overflow: "hidden" }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <GroupsIcon color="primary" fontSize="small" />
              <Typography fontWeight={800} fontSize={13.5}>Ward and ICU block staffing</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <RuleList
              rows={[
                {
                  title: "2N — one displayed unit with two internal teams",
                  detail:
                    "2NA: one PGY-2 senior with two PGY-1 interns. 2NC: one PGY-1 intern with one senior; PGY-2 is normal and PGY-3 is a coverage/override option. The UI may display 2N while validation keeps 2NA/2NC slots separate.",
                  tag: "3 interns + 2 seniors",
                },
                {
                  title: "Tele",
                  detail:
                    "Two teams: one PGY-3 with one PGY-1, and one PGY-2 with two PGY-1 residents.",
                  tag: "3 interns + 2 seniors",
                },
                {
                  title: "4N",
                  detail:
                    "Two teams: one PGY-3 with two PGY-1 residents, and one PGY-2 with two PGY-1 residents.",
                  tag: "4 interns + 2 seniors",
                },
                {
                  title: "3W",
                  detail: "One PGY-2 senior with two PGY-1 residents. PGY-3 is not routinely assigned.",
                  tag: "2 interns + 1 PGY-2",
                },
                {
                  title: "MICU and Pulmonary",
                  detail:
                    "MICU staffing is four PGY-1 residents plus two MICU seniors. Pulmonary has two seniors and remains a separate rotation from MICU Senior.",
                  tag: "ICU",
                },
              ]}
            />
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters sx={{ borderRadius: "12px !important", overflow: "hidden" }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <LocalHospitalIcon color="primary" fontSize="small" />
              <Typography fontWeight={800} fontSize={13.5}>Consult, admission, ER, elective, and jeopardy</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <RuleList rows={eligibilityRows} />
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters sx={{ borderRadius: "12px !important", overflow: "hidden" }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <NightlightIcon color="primary" fontSize="small" />
              <Typography fontWeight={800} fontSize={13.5}>Night Float and daily call coverage</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <RuleList
              rows={[
                {
                  title: "PGY-1 Night Float",
                  detail: "Works Thursday, Friday, Sunday, Monday, Tuesday, and Wednesday nights; off Saturday night.",
                  tag: "6 nights",
                },
                {
                  title: "PGY-2 and PGY-3 Night Float",
                  detail: "Work Thursday, Sunday, Monday, Tuesday, and Wednesday nights; off Friday and Saturday nights.",
                  tag: "5 nights",
                },
                {
                  title: "2N-CCU PGY1 On Call",
                  detail: "Covers 2N and CCU during the daytime call period.",
                  tag: "PGY-1",
                },
                {
                  title: "2N-CCU PGY2 On Call",
                  detail: "Covers 2N, CCU, and Tele. From 4 PM to 7 PM, this senior covers Tele.",
                  tag: "PGY-2",
                },
                {
                  title: "Tele PGY1 On Call",
                  detail: "Dedicated daytime PGY-1 call coverage for Tele.",
                  tag: "PGY-1",
                },
                {
                  title: "Overnight Tele coverage",
                  detail: "The 2N-CCU PGY1 and PGY2 Night Float team covers Tele overnight.",
                  tag: "Night Float",
                },
              ]}
            />
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters sx={{ borderRadius: "12px !important", overflow: "hidden" }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <WeekendIcon color="primary" fontSize="small" />
              <Typography fontWeight={800} fontSize={13.5}>Weekend Short Duty</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <RuleList
              rows={[
                {
                  title: "Weekend-only rows",
                  detail: "Short Duty 2N PGY1, Short Duty Tele PGY1, and Short Duty 4N PGY1. There is no Short Duty 3W row.",
                  tag: "Sat/Sun",
                },
                {
                  title: "Reporting time",
                  detail: "Saturday at 7:00 AM and Sunday at 6:30 AM.",
                  tag: "Weekend",
                },
                {
                  title: "Short Duty responsibilities",
                  detail: "See assigned patients, obtain needed consults, complete notes, follow pending labs, and leave when dismissed by the covering senior.",
                  tag: "Until dismissed",
                },
                {
                  title: "Conflict rule",
                  detail: "A resident may not be assigned to Night Float and Short Duty on the same date. Regular full call plus Short Duty should also warn.",
                  tag: "Critical warning",
                },
              ]}
            />
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters sx={{ borderRadius: "12px !important", overflow: "hidden" }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <CalendarMonthIcon color="primary" fontSize="small" />
              <Typography fontWeight={800} fontSize={13.5}>Who’s On row order</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Typography fontWeight={800} fontSize={12.5} sx={{ mb: 0.6 }}>Weekdays</Typography>
            <OrderGrid items={weekdayOrder} />
            <Typography fontWeight={800} fontSize={12.5} sx={{ mt: 1.25, mb: 0.6 }}>Weekends</Typography>
            <OrderGrid items={weekendOrder} />
            <Typography color="text.secondary" fontSize={11.5} sx={{ mt: 0.75 }}>
              Active Chief appears as a compact row at the bottom of the Who’s On page and remains separate from Chief On Call.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters sx={{ borderRadius: "12px !important", overflow: "hidden" }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <ShieldIcon color="primary" fontSize="small" />
              <Typography fontWeight={800} fontSize={13.5}>Holidays, publication, and exceptions</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Typography fontWeight={800} fontSize={12.5} sx={{ mb: 0.5 }}>2026 hospital-observed holidays</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {CONFIRMED_2026_HOSPITAL_HOLIDAYS.map((holiday) => (
                <Chip
                  key={holiday.date}
                  size="small"
                  label={`${holiday.date.slice(5)} · ${holiday.name}`}
                  variant="outlined"
                />
              ))}
            </Stack>
            <Typography color="text.secondary" fontSize={11.5} sx={{ mt: 0.75 }}>
              Holiday dates should be confirmed by an administrator each year. Holidays follow weekend-style coverage: consult services are off; the on-call floor senior and on-call PGY-1 report; other floor interns perform active work and may leave when the on-call senior agrees.
            </Typography>
            <Divider sx={{ my: 1 }} />
            <Typography fontWeight={800} fontSize={12.5}>Draft and published schedules</Typography>
            <Typography color="text.secondary" fontSize={11.5}>
              Builders work in draft. Residents see only the latest published snapshot. Excel imports should preview differences and never overwrite silently. Restoring a previous version publishes it as a new version.
            </Typography>
          </AccordionDetails>
        </Accordion>
      </Stack>
    </Box>
  );
}
