import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";

import { lazy, Suspense } from "react";
import { Box, CircularProgress, GlobalStyles, Typography } from "@mui/material";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";
import DashboardLayout from "./layouts/DashboardLayout";
import AppThemeProvider from "./theme/AppThemeProvider";
import { pageForPath, pathForPage } from "./config/routes";
import type { AppPage } from "./types/page";
import type { ConsultServiceProfileId } from "./utils/consultServiceProfiles";
import PwaManager from "./components/PwaManager";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const WhosOnPage = lazy(() => import("./pages/WhosOnPage"));
const PublicWhosOnPage = lazy(() => import("./pages/PublicWhosOnPage"));
const PhoneDirectoryPage = lazy(() => import("./pages/PhoneDirectoryPage"));
const ResidentsPage = lazy(() => import("./pages/ResidentsPage"));
const AttendingsPage = lazy(() => import("./pages/AttendingsPage"));
const AttendingCallSchedulePage = lazy(
  () => import("./pages/AttendingCallSchedulePage")
);
const AttendingProfilePage = lazy(() => import("./pages/AttendingProfilePage"));
const ConsultServiceProfilePage = lazy(
  () => import("./pages/ConsultServiceProfilePage")
);
const MonthlyScheduleMatrixPage = lazy(
  () => import("./pages/MonthlyScheduleMatrixPage")
);
const BlockSchedulePage = lazy(() => import("./pages/BlockSchedulePage"));
const ResidentScheduleProfilePage = lazy(
  () => import("./pages/ResidentScheduleProfilePage")
);
const LectureSchedulePage = lazy(() => import("./pages/LectureSchedulePage"));
const CoverageRulesPage = lazy(() => import("./pages/CoverageRulesPage"));
const CalendarSubscriptionPage = lazy(
  () => import("./pages/CalendarSubscriptionPage")
);
const ScheduleIntegrityPage = lazy(
  () => import("./pages/ScheduleIntegrityPage")
);
const CallSwapsPage = lazy(() => import("./pages/CallSwapsPage"));
const BackupRestorePage = lazy(() => import("./pages/BackupRestorePage"));
const InvitesPage = lazy(() => import("./pages/InvitesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ExternalScheduleSyncPage = lazy(() => import("./pages/ExternalScheduleSyncPage"));

function LoadingScreen({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <StackLike fullPage={fullPage}>
      <CircularProgress size={28} />
      <Typography color="text.secondary" fontSize={12} sx={{ mt: 1 }}>
        Loading…
      </Typography>
    </StackLike>
  );
}

function StackLike({
  children,
  fullPage,
}: {
  children: React.ReactNode;
  fullPage?: boolean;
}) {
  return (
    <Box
      sx={{
        minHeight: fullPage ? "100vh" : 220,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </Box>
  );
}

function ResidentProfileRoute() {
  const { residentId = "" } = useParams();
  const navigate = useNavigate();
  return (
    <ResidentScheduleProfilePage
      residentId={residentId}
      onBack={() => navigate(-1)}
    />
  );
}

function AttendingProfileRoute() {
  const { attendingId = "" } = useParams();
  const navigate = useNavigate();
  return (
    <AttendingProfilePage
      attendingId={attendingId}
      onBack={() => navigate(-1)}
    />
  );
}

function ConsultProfileRoute() {
  const { serviceId = "" } = useParams();
  const navigate = useNavigate();
  return (
    <ConsultServiceProfilePage
      serviceId={serviceId as ConsultServiceProfileId}
      onBack={() => navigate(-1)}
    />
  );
}

function AuthenticatedApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = pageForPath(location.pathname);

  function openPage(page: AppPage) {
    navigate(pathForPage(page));
  }

  return (
    <DashboardLayout currentPage={currentPage} onPageChange={openPage}>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route
            path="/whos-on"
            element={
              <WhosOnPage
                onOpenResidentProfile={(id) => navigate(`/residents/${id}`)}
                onOpenAttendingProfile={(id) => navigate(`/attendings/${id}`)}
                onOpenConsultServiceProfile={(id) =>
                  navigate(`/consult-services/${id}`)
                }
              />
            }
          />
          <Route path="/directory" element={<PhoneDirectoryPage />} />
          <Route
            path="/residents"
            element={
              <ResidentsPage
                onOpenResidentProfile={(id) => navigate(`/residents/${id}`)}
              />
            }
          />
          <Route path="/residents/:residentId" element={<ResidentProfileRoute />} />
          <Route
            path="/attendings"
            element={
              <AttendingsPage
                onOpenAttendingProfile={(id) => navigate(`/attendings/${id}`)}
              />
            }
          />
          <Route path="/attendings/:attendingId" element={<AttendingProfileRoute />} />
          <Route
            path="/attending-call-schedule"
            element={
              <AttendingCallSchedulePage
                onOpenAttendingProfile={(id) => navigate(`/attendings/${id}`)}
              />
            }
          />
          <Route
            path="/daily-call-schedule"
            element={
              <MonthlyScheduleMatrixPage
                onOpenResidentProfile={(id) => navigate(`/residents/${id}`)}
              />
            }
          />
          <Route
            path="/block-schedule"
            element={
              <BlockSchedulePage
                onOpenResidentProfile={(id) => navigate(`/residents/${id}`)}
              />
            }
          />
          <Route path="/lectures" element={<LectureSchedulePage />} />
          <Route path="/coverage-rules" element={<CoverageRulesPage />} />
          <Route
            path="/calendar-subscription"
            element={<CalendarSubscriptionPage />}
          />
          <Route path="/backup-restore" element={<BackupRestorePage />} />
          <Route path="/invitations" element={<InvitesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/external-schedule" element={<ExternalScheduleSyncPage />} />
          <Route path="/call-swaps" element={<CallSwapsPage />} />
          <Route path="/scheduling-integrity" element={<ScheduleIntegrityPage />} />
          <Route
            path="/consult-services/:serviceId"
            element={<ConsultProfileRoute />}
          />
          <Route path="/vacation" element={<Navigate to="/block-schedule" replace />} />
          <Route path="/login" element={<Navigate to="/whos-on" replace />} />
          <Route path="/" element={<Navigate to="/whos-on" replace />} />
          <Route path="*" element={<Navigate to="/whos-on" replace />} />
        </Routes>
      </Suspense>
    </DashboardLayout>
  );
}

function AppContent() {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen fullPage />;

  if (!user || !profile) {
    return (
      <Suspense fallback={<LoadingScreen fullPage />}>
        <Routes>
          <Route path="/whos-on" element={<PublicWhosOnPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/whos-on" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppThemeProvider>
        <GlobalStyles
          styles={{
            html: {
              fontFamily:
                '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            },
            body: {
              fontFamily:
                '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: "12.5px",
            },
            button: { fontFamily: "inherit" },
            input: { fontFamily: "inherit" },
            textarea: { fontFamily: "inherit" },
            select: { fontFamily: "inherit" },
          }}
        />
        <AppContent />
        <PwaManager />
      </AppThemeProvider>
    </AuthProvider>
  );
}
