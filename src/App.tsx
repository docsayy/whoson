import { useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";

import { AuthProvider, useAuth } from "./context/AuthContext";
import DashboardLayout from "./layouts/DashboardLayout";

import LoginPage from "./pages/LoginPage";
import WhosOnPage from "./pages/WhosOnPage";
import ResidentsPage from "./pages/ResidentsPage";
import AttendingsPage from "./pages/AttendingsPage";
import AttendingCallSchedulePage from "./pages/AttendingCallSchedulePage";
import MonthlyScheduleMatrixPage from "./pages/MonthlyScheduleMatrixPage";
import BlockSchedulePage from "./pages/BlockSchedulePage";
import ResidentScheduleProfilePage from "./pages/ResidentScheduleProfilePage";
import CoverageRulesPage from "./pages/CoverageRulesPage";
import BackupRestorePage from "./pages/BackupRestorePage";
import InvitesPage from "./pages/InvitesPage";

import type { AppPage } from "./types/page";

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

  if (!user || !profile) {
    return <LoginPage />;
  }

  function handlePageChange(page: AppPage) {
    setCurrentPage(page);
    setSelectedResidentId(null);
  }

  const pageContent = selectedResidentId ? (
    <ResidentScheduleProfilePage
      residentId={selectedResidentId}
      onBack={() => setSelectedResidentId(null)}
    />
  ) : (
    {
      "whos-on": <WhosOnPage onOpenResidentProfile={setSelectedResidentId} />,
      residents: (
        <ResidentsPage onOpenResidentProfile={setSelectedResidentId} />
      ),
      attendings: <AttendingsPage />,
      "attending-call-schedule": <AttendingCallSchedulePage />,
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
      settings: <PlaceholderPage title="Settings" />,
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
      <AppContent />
    </AuthProvider>
  );
}