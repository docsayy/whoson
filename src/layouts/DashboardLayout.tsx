import { useMemo, useState } from "react";
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

import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";

import { getNavItem, normalizeSidebarSettings } from "../config/navigation";
import { useAuth } from "../context/AuthContext";
import { useSidebarSettings } from "../hooks/useSidebarSettings";
import type { AppPage } from "../types/page";
import { canManageResidents } from "../utils/permissions";

const drawerWidth = 224;

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
  const { settings } = useSidebarSettings();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isManager = canManageResidents(profile?.role);

  const navItems = useMemo(() => {
    const normalized = normalizeSidebarSettings(settings);

    return normalized.items
      .map((preference) => {
        const item = getNavItem(preference.page);
        if (!item) return null;

        const visible = isManager
          ? preference.visibleToManagers
          : preference.visibleToStandardUsers;

        if (!visible) return null;

        return {
          ...item,
          page: preference.page,
        };
      })
      .filter(Boolean) as Array<{
      page: AppPage;
      label: string;
      icon: React.ReactNode;
    }>;
  }, [isManager, settings]);

  function handleNavigate(page: AppPage) {
    onPageChange(page);
    setDrawerOpen(false);
  }

  const drawerContent = (
    <>
      <Toolbar />
      <Box sx={{ px: 1.5, py: 0.8 }}>
        <Typography
          variant="overline"
          sx={{ color: "#94a3b8", fontSize: 9, fontWeight: 800 }}
        >
          Main Menu
        </Typography>
      </Box>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />
      <List dense sx={{ py: 0.65 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.page}
            selected={item.page === currentPage}
            onClick={() => handleNavigate(item.page)}
            sx={{
              mx: 0.75,
              my: 0.12,
              py: 0.45,
              minHeight: 34,
              borderRadius: 1.5,
              color: "white",
              "&.Mui-selected": {
                backgroundColor: "rgba(255,255,255,0.16)",
              },
              "&.Mui-selected:hover": {
                backgroundColor: "rgba(255,255,255,0.22)",
              },
              "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
            }}
          >
            <ListItemIcon
              sx={{
                color: "inherit",
                minWidth: 30,
                "& svg": { fontSize: 18 },
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: 11.5, fontWeight: 650 }}
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
            minHeight: { xs: 46, sm: 48 },
            px: { xs: 1, sm: 1.5 },
          }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
            <IconButton edge="start" size="small" onClick={() => setDrawerOpen(true)}>
              <MenuIcon />
            </IconButton>
            <Typography
              noWrap
              fontWeight={800}
              sx={{ fontSize: { xs: 13, sm: 14.5 }, letterSpacing: "-0.02em" }}
            >
              WhosOn
            </Typography>
          </Stack>

          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
            <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}>
              <Typography fontSize={11.25} fontWeight={700} noWrap>
                {profile?.displayName || user?.email}
              </Typography>
              <Typography fontSize={9.25} color="text.secondary" noWrap>
                {profile?.role || "User"}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<LogoutIcon />}
              onClick={logout}
              sx={{ minWidth: { xs: 34, sm: 78 }, px: { xs: 0.75, sm: 1.1 } }}
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
          p: { xs: 0.6, sm: 0.75, md: 0.9 },
          overflowX: "hidden",
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 46, sm: 48 } }} />
        <Box sx={{ width: "100%", minWidth: 0 }}>{children}</Box>
      </Box>
    </Box>
  );
}
