import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

function RuleCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card sx={{ borderRadius: 3, height: "100%" }}>
      <CardContent sx={{ p: 2 }}>
        <Typography fontWeight={900} fontSize={17}>
          {title}
        </Typography>

        {subtitle && (
          <Typography color="text.secondary" fontSize={13} sx={{ mb: 1 }}>
            {subtitle}
          </Typography>
        )}

        <Stack spacing={0.75}>{children}</Stack>
      </CardContent>
    </Card>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <Typography fontSize={13.5} sx={{ lineHeight: 1.55 }}>
      • {children}
    </Typography>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        width: "fit-content",
        fontWeight: 850,
        color: "#2563eb",
        backgroundColor: "#eff6ff",
        border: "1px solid #bfdbfe",
      }}
    />
  );
}

export default function CoverageRulesPage() {
  return (
    <Box sx={{ width: "100%", maxWidth: "none" }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={900} sx={{ lineHeight: 1 }}>
            Coverage Rules
          </Typography>
          <Typography color="text.secondary" fontSize={14}>
            Residency schedule structure reference for chiefs, coordinators, residents, and attendings.
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Tag label="Draft reference" />
          <Tag label="Used later for validation" />
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            lg: "repeat(2, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        <RuleCard title="Block Timing">
          <Rule>Each block starts on Thursday morning.</Rule>
          <Rule>Each night float block starts on the night between Thursday and Friday.</Rule>
        </RuleCard>

        <RuleCard title="Night Float">
          <Rule>NF intern works Thursday, Friday, Sunday, Monday, Tuesday, and Wednesday nights.</Rule>
          <Rule>NF intern is off Saturday night.</Rule>
          <Rule>NF PGY2 works Thursday, Sunday, Monday, Tuesday, and Wednesday nights.</Rule>
          <Rule>NF PGY2 is off Friday and Saturday nights.</Rule>
          <Rule>PGY3 NF works Thursday, Sunday, Monday, Tuesday, and Wednesday nights.</Rule>
          <Rule>PGY3 NF is off Friday and Saturday nights.</Rule>
          <Rule>2N-CCU NF has one PGY1 and one PGY2 covering 2N-CCU and Tele from 7 PM to 7 AM.</Rule>
          <Rule>4N-3W NF has one PGY1 and one PGY2 covering 4N and 3W from 7 PM to 7 AM.</Rule>
          <Rule>PGY3 NF covers RRT, Code 66, and significant overnight events from 7 PM to 7 AM.</Rule>
        </RuleCard>

        <RuleCard title="Daytime Floor Coverage" subtitle="Usually 7 AM to 4 PM">
          <Rule>2N has one PGY2 with two PGY1 residents.</Rule>
          <Rule>2N-CCU has one senior with one PGY1. The senior also covers medicine consult until 4 PM.</Rule>
          <Rule>Tele has one PGY3 with one PGY1 and one PGY2 with two PGY1 residents.</Rule>
          <Rule>4N has two seniors and four interns: one PGY3 with two interns and one PGY2 with two interns.</Rule>
          <Rule>3W has one senior, PGY2 or PGY3, with two interns.</Rule>
        </RuleCard>

        <RuleCard title="Day Call Coverage" subtitle="7 AM to 7 PM">
          <Rule>Tele day call is a separate PGY1 from 7 AM to 7 PM.</Rule>
          <Rule>Tele day call may come from the current PGY1 team or from clinic/on-call pool.</Rule>
          <Rule>2N-CCU PGY1 day call is from 7 AM to 7 PM and may come from 2N, 2N-CCU, clinic, or another rotation.</Rule>
          <Rule>2N-CCU PGY2 day call covers 2N-CCU and Tele patients after 4 PM until 7 PM.</Rule>
          <Rule>4N PGY1 call may come from current interns or another resident in the hospital.</Rule>
          <Rule>3W PGY1 call may come from current interns or another resident in the hospital.</Rule>
          <Rule>4N-3W PGY2 call is 7 AM to 7 PM.</Rule>
          <Rule>PGY3 day call is 7 AM to 7 PM and covers RRT, Code 66, and significant events.</Rule>
        </RuleCard>

        <RuleCard title="MICU / Pulmonary">
          <Rule>MICU team includes four PGY1 residents.</Rule>
          <Rule>MICU team includes two MICU seniors, PGY2 or PGY3.</Rule>
          <Rule>MICU team includes two Pulmonary seniors, PGY2 or PGY3.</Rule>
          <Rule>MICU intern call is 24 hours, generally 7 AM to 7 AM.</Rule>
          <Rule>MICU senior call is generally 8 AM to 8 AM.</Rule>
          <Rule>Intern and senior are usually paired and stay on call together.</Rule>
          <Rule>After a 24-hour call, intern and senior are off for the next 24 hours.</Rule>
          <Rule>During the day, MICU senior may be on call or cover MICU consults from 8 AM to 4 PM.</Rule>
          <Rule>Pulmonary senior may be on call every fourth day or cover pulmonary consults from 7 AM to 4 PM.</Rule>
          <Rule>After 4 PM, the MICU senior covers MICU consults.</Rule>
          <Rule>No pulmonary consult service after 4 PM until the next morning.</Rule>
        </RuleCard>

        <RuleCard title="Consult Services">
          <Rule>Cardiology consult and CCU patients are covered by a senior, usually PGY2.</Rule>
          <Rule>Infectious Disease consult has a PGY3 senior.</Rule>
          <Rule>Infectious Disease consult also has an intern.</Rule>
          <Rule>Neurology has one senior resident.</Rule>
          <Rule>Hematology-Oncology has a PGY3 senior.</Rule>
          <Rule>Nephro-Endo-Rheum has a PGY3 senior.</Rule>
          <Rule>Pulmonary, MICU, Cardiology, and GI are senior consult services.</Rule>
        </RuleCard>

        <RuleCard title="Admission Block">
          <Rule>Admission is not a consult service.</Rule>
          <Rule>Admission block has one senior and one intern.</Rule>
          <Rule>Admission block runs 7 AM to 4 PM.</Rule>
          <Rule>Admission team takes up to five admissions.</Rule>
          <Rule>After five admissions, the rest go to floor teams.</Rule>
        </RuleCard>

        <RuleCard title="Future Validation Use">
          <Rule>These rules will later power block validation, call validation, staffing warnings, and fairness reports.</Rule>
          <Rule>The app should warn, not block, because chiefs may need manual exceptions for sick calls or special circumstances.</Rule>
        </RuleCard>
      </Box>
    </Box>
  );
}