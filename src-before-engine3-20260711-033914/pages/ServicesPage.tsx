import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";

import { useServices } from "../hooks/useServices";

type ServicesTab = "All" | "Core" | "Specialty";

export default function ServicesPage() {
  const { services, loading, error, seedServices } = useServices();
  const [tab, setTab] = useState<ServicesTab>("All");

  const attendingServices = useMemo(() => {
    return services.filter((service) => service.coverageGroup === "Attending");
  }, [services]);

  const visibleServices = useMemo(() => {
    return attendingServices.filter((service) => {
      if (tab === "All") return true;
      return service.attendingScheduleType === tab;
    });
  }, [attendingServices, tab]);

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Services
          </Typography>
          <Typography color="text.secondary">
            Manage attending, admission, and consulting schedule rows.
          </Typography>
        </Box>

        <Button variant="outlined" onClick={seedServices}>
          Update Services
        </Button>
      </Stack>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Card>
        <CardContent>
          <Tabs
            value={tab}
            onChange={(_, value: ServicesTab) => setTab(value)}
            sx={{ mb: 2 }}
          >
            <Tab label="All" value="All" />
            <Tab label="Core Attending" value="Core" />
            <Tab label="Specialty / Consulting" value="Specialty" />
          </Tabs>

          {loading ? (
            <Stack alignItems="center" sx={{ py: 5 }}>
              <CircularProgress />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                Loading services...
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={1}>
              {visibleServices.map((service) => (
                <Box
                  key={service.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "2fr 1fr 1fr 1fr",
                    },
                    gap: 1,
                    alignItems: "center",
                    p: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                  }}
                >
                  <Box>
                    <Typography fontWeight={800}>{service.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {service.id}
                    </Typography>
                  </Box>

                  <Chip label={service.attendingScheduleType} />

                  <Typography>
                    {service.defaultStartTime}-{service.defaultEndTime}
                  </Typography>

                  <Typography color="text.secondary">
                    Order {service.displayOrderAll}
                  </Typography>
                </Box>
              ))}

              {visibleServices.length === 0 && (
                <Typography color="text.secondary">
                  No attending or consulting services found.
                </Typography>
              )}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}