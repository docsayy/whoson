import { useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";

import { AuthProvider, useAuth } from "./context/AuthContext";
import DashboardLayout from "./layouts/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import ResidentsPage from "./pages/ResidentsPage";
import SchedulePage from "./pages/SchedulePage";
import WhosOnPage from "./pages/WhosOnPage";
import type { AppPage } from "./types/page";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <Box>
      <Typography variant="h4" fontWeight={800}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        This section will be built next.
      </Typography>
    </Box>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<AppPage>("whos-on");

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

  if (!user) {
    return <LoginPage />;
  }

  const pageContent = {
    "whos-on": <WhosOnPage />,
    residents: <ResidentsPage />,
    schedule: <SchedulePage />,
    "block-schedule": <PlaceholderPage title="Block Schedule" />,
    "call-swaps": <PlaceholderPage title="Call Swaps" />,
    vacation: <PlaceholderPage title="Vacation Requests" />,
    settings: <PlaceholderPage title="Settings" />,
  }[currentPage];

  return (
    <DashboardLayout currentPage={currentPage} onPageChange={setCurrentPage}>
      {pageContent}
    </DashboardLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;