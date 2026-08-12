import { useMemo, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
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
import LogoutIcon from "@mui/icons-material/Logout";

import { getNavItem } from "../config/navigation";
import { useAuth } from "../context/AuthContext";
import { useSidebarSettings } from "../hooks/useSidebarSettings";
import type { AppPage } from "../types/page";
import { canManageResidents } from "../utils/permissions";

const drawerWidth = 250;

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
  const { settings, error } = useSidebarSettings();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isManager = canManageResidents(profile?.role);

  const visibleNavItems = useMemo(
    () =>
      settings.items
        .filter((preference) =>
          isManager
            ? preference.visibleToManagers
            : preference.visibleToStandardUsers
        )
        .map((preference) => getNavItem(preference.page))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .filter((item) => !item.managerOnly || isManager),
    [isManager, settings.items]
  );

  function handleNavigate(page: AppPage) {
    onPageChange(page);
    setDrawerOpen(false);
  }

  const drawerContent = (
    <>
      <Toolbar />

      <Box sx={{ p: 1.5 }}>
        <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.62)" }}>
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
      <AppBar
        position="fixed"
        color="default"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          borderBottom: "1px solid",
          borderColor: "divider",
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
            backgroundColor: (theme) => theme.palette.primary.dark,
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
          backgroundColor: "background.default",
          p: { xs: 1, sm: 1.5, md: 2 },
          overflowX: "hidden",
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }} />

        {error && isManager && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ width: "100%", minWidth: 0 }}>{children}</Box>
      </Box>
    </Box>
  );
}
