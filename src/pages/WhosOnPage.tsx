import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

const rows = [
  ["2N-CCU", "7a-7p", "Gandapur", "PGY-1", "Secure message to app", "11279"],
  ["4N", "7a-7p", "Sallam", "PGY-1", "Secure message to app", "11287"],
  ["4N-3W PGY2", "7a-7p", "Ali", "PGY-2", "Secure message to app", "11155"],
  ["3W", "7a-7p", "Muslehuddin", "PGY-1", "Secure message to app", "11285"],
  ["Tele", "7a-7p", "Al-Gharazi", "PGY-1", "Secure message to app", "11273"],
  ["MICU", "7a-7a", "Burdynskyi", "PGY-1", "Secure message to app", "11275"],
  ["MICU Senior", "8a-8a", "Najera", "PGY-2", "Secure message to app", "11165"],
  ["Chief On Call", "7a-7p", "Al-Hashimi", "PGY-3", "Not ready", "534"],
  ["PGY3 NF", "7p-7a", "Rahman", "PGY-3", "Secure message to app", "541"],
  ["Faculty Attending On Call", "7a-7a", "Akbar Khan", "Attending", "Not ready", ""],
];

export default function WhosOnPage() {
  const now = new Date();

  const dateText = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const timeText = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Box>
      <Stack sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800}>
          Who&apos;s On
        </Typography>

        <Typography color="text.secondary">
          {dateText} · as of {timeText}
        </Typography>
      </Stack>

      <Card>
        <CardContent>
          <Box sx={{ overflowX: "auto" }}>
            <Box
              component="table"
              sx={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 900,
              }}
            >
              <Box component="thead">
                <Box
                  component="tr"
                  sx={{
                    backgroundColor: "#f1f5f9",
                  }}
                >
                  {["Service", "Time", "Name", "Training", "Contact", "Pager"].map(
                    (heading) => (
                      <Box
                        key={heading}
                        component="th"
                        sx={{
                          textAlign: "left",
                          p: 1.5,
                          borderBottom: "1px solid #e2e8f0",
                          fontWeight: 800,
                        }}
                      >
                        {heading}
                      </Box>
                    )
                  )}
                </Box>
              </Box>

              <Box component="tbody">
                {rows.map((row) => (
                  <Box component="tr" key={`${row[0]}-${row[2]}`}>
                    <Box component="td" sx={td}>
                      <Typography fontWeight={700}>{row[0]}</Typography>
                    </Box>

                    <Box component="td" sx={td}>
                      {row[1]}
                    </Box>

                    <Box component="td" sx={td}>
                      {row[2]}
                    </Box>

                    <Box component="td" sx={td}>
                      <Chip label={row[3]} size="small" />
                    </Box>

                    <Box component="td" sx={td}>
                      <Typography
                        color={row[4] === "Not ready" ? "text.secondary" : "primary"}
                      >
                        {row[4]}
                      </Typography>
                    </Box>

                    <Box component="td" sx={td}>
                      {row[5] || "-"}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

const td = {
  p: 1.5,
  borderBottom: "1px solid #e2e8f0",
};