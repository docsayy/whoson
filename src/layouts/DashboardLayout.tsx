import { useState } from "react";
import {
  AppBar,
  Box,
  Button,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PeopleIcon from "@mui/icons-material/People";
import BadgeIcon from "@mui/icons-material/Badge";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import BeachAccessIcon from "@mui/icons-material/BeachAccess";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import BackupIcon from "@mui/icons-material/Backup";
import VpnKeyIcon from "@mui/icons-material/VpnKey";

import { useAuth } from "../context/AuthContext";
import type { AppPage } from "../types/page";
import { canManageResidents } from "../utils/permissions";

const drawerWidth = 250;

type NavItem = {
  label: string;
  page: AppPage;
  icon: React.ReactNode;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { label: "Who's On", page: "whos-on", icon: <CalendarTodayIcon /> },
  { label: "Residents", page: "residents", icon: <PeopleIcon /> },
  { label: "Attendings", page: "attendings", icon: <BadgeIcon /> },
  {
    label: "Attending Call Schedule",
    page: "attending-call-schedule",
    icon: <LocalHospitalIcon />,
  },
  { label: "Daily Call Schedule", page: "schedule", icon: <CalendarMonthIcon /> },
  { label: "Block Schedule", page: "block-schedule", icon: <ViewWeekIcon /> },
  { label: "Coverage Rules", page: "coverage-rules", icon: <MenuBookIcon /> },
  {
    label: "Invitations",
    page: "invites",
    icon: <VpnKeyIcon />,
    adminOnly: true,
  },
  {
    label: "Backup / Restore",
    page: "backup-restore",
    icon: <BackupIcon />,
    adminOnly: true,
  },
  { label: "Call Swaps", page: "call-swaps", icon: <SwapHorizIcon /> },
  { label: "Vacation", page: "vacation", icon: <BeachAccessIcon /> },
  { label: "Settings", page: "settings", icon: <SettingsIcon /> },
];

export default function DashboardLayout({
  children,
  currentPage,
  onPageChange,
}: {
  children: React.ReactNode;
  currentPage: AppPage;
  onPageChange: (page: AppPage) => void;
}) {
  const { user, profile, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const allowManage = canManageResidents(profile?.role);

  const visibleNavItems = navItems.filter((item) => {
    if (!item.adminOnly) return true;
    return allowManage;
  });

  function handleNavigate(page: AppPage) {
    onPageChange(page);
    setDrawerOpen(false);
  }

  const drawerContent = (
    <>
      <Toolbar />

      <Box sx={{ p: 1.5 }}>
        <Typography variant="overline" sx={{ color: "#94a3b8" }}>
          Main Menu
        </Typography>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />

      <List dense>
        {visibleNavItems.map((item) => (
          <ListItemButton
            key={item.page}
            selected={item.page === currentPage}
            onClick={() => handleNavigate(item.page)}
            sx={{
              mx: 1,
              my: 0.25,
              py: 0.65,
              borderRadius: 1.5,
              color: "white",
              "&.Mui-selected": {
                backgroundColor: "rgba(255,255,255,0.16)",
              },
              "&.Mui-selected:hover": {
                backgroundColor: "rgba(255,255,255,0.22)",
              },
              "&:hover": {
                backgroundColor: "rgba(255,255,255,0.1)",
              },
            }}
          >
            <ListItemIcon sx={{ color: "inherit", minWidth: 34 }}>
              {item.icon}
            </ListItemIcon>

            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: 13 }}
            />
          </ListItemButton>
        ))}
      </List>
    </>
  );

  return (
    <Box sx={{ display: "flex", width: "100%", minWidth: 0 }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: "white",
          color: "#0f172a",
          boxShadow: "0 1px 3px rgba(15,23,42,0.08)",
        }}
      >
        <Toolbar
          sx={{
            justifyContent: "space-between",
            gap: 1,
            minHeight: { xs: 56, sm: 64 },
            px: { xs: 1, sm: 2 },
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <IconButton edge="start" onClick={() => setDrawerOpen(true)}>
              <MenuIcon />
            </IconButton>

            <Typography
              variant="h6"
              noWrap
              fontWeight={800}
              sx={{ fontSize: { xs: 17, sm: 20 } }}
            >
              WhosOn
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {profile?.displayName || user?.email}
              </Typography>

              <Typography variant="caption" color="text.secondary" noWrap>
                {profile?.role || "User"}
              </Typography>
            </Box>

            <Button
              size="small"
              variant="outlined"
              startIcon={<LogoutIcon />}
              onClick={logout}
              sx={{
                minWidth: { xs: 40, sm: 90 },
                px: { xs: 1, sm: 1.5 },
              }}
            >
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                Logout
              </Box>
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            backgroundColor: "#0f172a",
            color: "white",
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: "100%",
          maxWidth: "100vw",
          minHeight: "100vh",
          backgroundColor: "#f8fafc",
          p: { xs: 1, sm: 1.5, md: 2 },
          overflowX: "hidden",
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }} />
        <Box sx={{ width: "100%", minWidth: 0 }}>{children}</Box>
      </Box>
    </Box>
  );
}