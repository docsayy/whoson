import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";

import { useState } from "react";
import { Box, CircularProgress, GlobalStyles, Typography } from "@mui/material";

import { AuthProvider, useAuth } from "./context/AuthContext";
import DashboardLayout from "./layouts/DashboardLayout";
import AppThemeProvider from "./theme/AppThemeProvider";

import LoginPage from "./pages/LoginPage";
import WhosOnPage from "./pages/WhosOnPage";
import PhoneDirectoryPage from "./pages/PhoneDirectoryPage";
import ResidentsPage from "./pages/ResidentsPage";
import AttendingsPage from "./pages/AttendingsPage";
import AttendingCallSchedulePage from "./pages/AttendingCallSchedulePage";
import AttendingProfilePage from "./pages/AttendingProfilePage";
import ConsultServiceProfilePage from "./pages/ConsultServiceProfilePage";
import MonthlyScheduleMatrixPage from "./pages/MonthlyScheduleMatrixPage";
import BlockSchedulePage from "./pages/BlockSchedulePage";
import ResidentScheduleProfilePage from "./pages/ResidentScheduleProfilePage";
import CoverageRulesPage from "./pages/CoverageRulesPage";
import BackupRestorePage from "./pages/BackupRestorePage";
import InvitesPage from "./pages/InvitesPage";
import SettingsPage from "./pages/SettingsPage";

import type { AppPage } from "./types/page";
import type { ConsultServiceProfileId } from "./utils/consultServiceProfiles";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <Box>
      <Typography variant="h4" fontWeight={800}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        This section is currently under development.
      </Typography>
    </Box>
  );
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<AppPage>("whos-on");
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(
    null
  );
  const [selectedAttendingId, setSelectedAttendingId] = useState<string | null>(
    null
  );
  const [selectedConsultServiceId, setSelectedConsultServiceId] =
    useState<ConsultServiceProfileId | null>(null);

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user || !profile) return <LoginPage />;

  function handlePageChange(page: AppPage) {
    setCurrentPage(page);
    setSelectedResidentId(null);
    setSelectedAttendingId(null);
    setSelectedConsultServiceId(null);
  }

  const pageContent = selectedResidentId ? (
    <ResidentScheduleProfilePage
      residentId={selectedResidentId}
      onBack={() => setSelectedResidentId(null)}
    />
  ) : selectedAttendingId ? (
    <AttendingProfilePage
      attendingId={selectedAttendingId}
      onBack={() => setSelectedAttendingId(null)}
    />
  ) : selectedConsultServiceId ? (
    <ConsultServiceProfilePage
      serviceId={selectedConsultServiceId}
      onBack={() => setSelectedConsultServiceId(null)}
    />
  ) : (
    {
      "whos-on": (
        <WhosOnPage
          onOpenResidentProfile={setSelectedResidentId}
          onOpenAttendingProfile={setSelectedAttendingId}
          onOpenConsultServiceProfile={setSelectedConsultServiceId}
        />
      ),
      directory: <PhoneDirectoryPage />,
      residents: (
        <ResidentsPage onOpenResidentProfile={setSelectedResidentId} />
      ),
      attendings: (
        <AttendingsPage onOpenAttendingProfile={setSelectedAttendingId} />
      ),
      "attending-call-schedule": (
        <AttendingCallSchedulePage
          onOpenAttendingProfile={setSelectedAttendingId}
        />
      ),
      schedule: (
        <MonthlyScheduleMatrixPage
          onOpenResidentProfile={setSelectedResidentId}
        />
      ),
      "block-schedule": (
        <BlockSchedulePage onOpenResidentProfile={setSelectedResidentId} />
      ),
      "coverage-rules": <CoverageRulesPage />,
      invites: <InvitesPage />,
      "backup-restore": <BackupRestorePage />,
      "call-swaps": <PlaceholderPage title="Call Swaps" />,
      vacation: <PlaceholderPage title="Vacation" />,
      settings: <SettingsPage />,
    }[currentPage]
  );

  return (
    <DashboardLayout currentPage={currentPage} onPageChange={handlePageChange}>
      {pageContent}
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppThemeProvider>
        <GlobalStyles
          styles={{
            html: {
              fontFamily:
                '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            },
            body: {
              fontFamily:
                '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            },
            button: { fontFamily: "inherit" },
            input: { fontFamily: "inherit" },
            textarea: { fontFamily: "inherit" },
            select: { fontFamily: "inherit" },
            ".MuiTypography-root": { fontFamily: '"Inter", sans-serif !important' },
            ".MuiButton-root": { fontFamily: '"Inter", sans-serif !important' },
            ".MuiInputBase-root": { fontFamily: '"Inter", sans-serif !important' },
            ".MuiChip-root": { fontFamily: '"Inter", sans-serif !important' },
            ".MuiTab-root": { fontFamily: '"Inter", sans-serif !important' },
          }}
        />
        <AppContent />
      </AppThemeProvider>
    </AuthProvider>
  );
}
