import { useState } from "react";
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  Stack,
  Typography,
} from "@mui/material";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";

import { useNotifications } from "../hooks/useNotifications";
import { useUpcomingCall } from "../hooks/useUpcomingCall";
import type { AppPage } from "../types/page";

export default function NotificationCenter({
  uid,
  residentId,
  onNavigate,
}: {
  uid?: string;
  residentId?: string;
  onNavigate: (page: AppPage) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { notifications, unreadCount, loading, markRead, markAllRead } =
    useNotifications(uid, residentId);
  const upcomingCall = useUpcomingCall(residentId);

  return (
    <>
      <IconButton
        size="small"
        aria-label="Notifications"
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsNoneIcon fontSize="small" />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { width: { xs: 330, sm: 390 }, maxHeight: 480 } }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ px: 1.5, py: 0.75 }}
        >
          <Typography fontWeight={900}>Notifications</Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={() => void markAllRead()}>
              Mark all read
            </Button>
          )}
        </Stack>
        <Divider />
        {upcomingCall && (
          <Box sx={{ p: 1.2, backgroundColor: "#f0fdf4", borderBottom: "1px solid #dcfce7" }}>
            <Typography fontSize={10.5} color="success.main" fontWeight={850}>Upcoming call</Typography>
            <Typography fontSize={12.25} fontWeight={850}>{upcomingCall.serviceName}</Typography>
            <Typography fontSize={11.25} color="text.secondary">{upcomingCall.date} • {upcomingCall.startTime}–{upcomingCall.endTime}</Typography>
          </Box>
        )}
        {loading ? (
          <Stack alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={24} />
          </Stack>
        ) : notifications.length === 0 ? (
          <Typography color="text.secondary" fontSize={12} sx={{ p: 2 }}>
            No notifications yet.
          </Typography>
        ) : (
          notifications.slice(0, 30).map((notification) => (
            <Box
              key={notification.id}
              component="button"
              onClick={() => {
                if (!notification.readAt) void markRead(notification.id);
                if (notification.linkPage) onNavigate(notification.linkPage);
                setAnchorEl(null);
              }}
              sx={{
                width: "100%",
                border: 0,
                borderBottom: "1px solid #e5e7eb",
                textAlign: "left",
                p: 1.2,
                cursor: "pointer",
                backgroundColor: notification.readAt ? "white" : "#eff6ff",
                "&:hover": { backgroundColor: "#f8fafc" },
              }}
            >
              <Typography fontSize={12.25} fontWeight={850}>
                {notification.title}
              </Typography>
              <Typography fontSize={11.25} color="text.secondary" sx={{ mt: 0.2 }}>
                {notification.message}
              </Typography>
              <Typography fontSize={9.5} color="text.disabled" sx={{ mt: 0.45 }}>
                {new Date(notification.createdAt).toLocaleString()}
              </Typography>
            </Box>
          ))
        )}
      </Menu>
    </>
  );
}
