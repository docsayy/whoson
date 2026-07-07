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
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PeopleIcon from "@mui/icons-material/People";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import BeachAccessIcon from "@mui/icons-material/BeachAccess";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";

import { useAuth } from "../context/AuthContext";
import type { AppPage } from "../types/page";

const drawerWidth = 260;

const navItems: { label: string; page: AppPage; icon: React.ReactNode }[] = [
  { label: "Who's On", page: "whos-on", icon: <CalendarTodayIcon /> },
  { label: "Residents", page: "residents", icon: <PeopleIcon /> },
  { label: "Schedule", page: "schedule", icon: <CalendarMonthIcon /> },
  { label: "Block Schedule", page: "block-schedule", icon: <ViewWeekIcon /> },
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
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(
    null
  );

  function handleMobileNavigate(page: AppPage) {
    onPageChange(page);
    setMobileMenuAnchor(null);
  }

  return (
    <Box sx={{ display: "flex" }}>
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
        <Toolbar sx={{ justifyContent: "space-between", gap: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <IconButton
              edge="start"
              onClick={(event) => setMobileMenuAnchor(event.currentTarget)}
              sx={{ display: { xs: "inline-flex", md: "none" } }}
            >
              <MenuIcon />
            </IconButton>

            <Typography variant="h6" noWrap fontWeight={700}>
              Residency Scheduler
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}>
              <Typography variant="body2" fontWeight={700}>
                {profile?.displayName || user?.email}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {profile?.role || "User"}
              </Typography>
            </Box>

            <Button
              size="small"
              variant="outlined"
              startIcon={<LogoutIcon />}
              onClick={logout}
              sx={{ minWidth: { xs: 40, sm: 90 } }}
            >
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                Logout
              </Box>
            </Button>
          </Stack>
        </Toolbar>

        <Menu
          anchorEl={mobileMenuAnchor}
          open={Boolean(mobileMenuAnchor)}
          onClose={() => setMobileMenuAnchor(null)}
        >
          {navItems.map((item) => (
            <MenuItem
              key={item.page}
              selected={item.page === currentPage}
              onClick={() => handleMobileNavigate(item.page)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText>{item.label}</ListItemText>
            </MenuItem>
          ))}
        </Menu>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            backgroundColor: "#0f172a",
            color: "white",
          },
        }}
      >
        <Toolbar />

        <Box sx={{ p: 2 }}>
          <Typography variant="overline" sx={{ color: "#94a3b8" }}>
            Main Menu
          </Typography>
        </Box>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />

        <List>
          {navItems.map((item) => (
            <ListItemButton
              key={item.page}
              selected={item.page === currentPage}
              onClick={() => onPageChange(item.page)}
              sx={{
                mx: 1,
                my: 0.4,
                py: 0.8,
                borderRadius: 2,
                color: "white",
                "&.Mui-selected": {
                  backgroundColor: "rgba(255,255,255,0.14)",
                },
                "&.Mui-selected:hover": {
                  backgroundColor: "rgba(255,255,255,0.2)",
                },
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.1)",
                },
              }}
            >
              <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: 14 }}
              />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: "100vh",
          backgroundColor: "#f8fafc",
          p: { xs: 1.5, sm: 2, md: 3 },
          width: "100%",
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}