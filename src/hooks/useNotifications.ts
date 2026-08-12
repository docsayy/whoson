import { useEffect, useMemo, useState } from "react";

import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "../services/notificationService";
import type { AppNotification } from "../types/notification";

export function useNotifications(uid?: string, residentId?: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    return subscribeToNotifications(
      uid,
      residentId,
      (next) => {
        setNotifications(next);
        setLoading(false);
        setError("");
      },
      (err) => {
        console.error(err);
        setError("Unable to load notifications.");
        setLoading(false);
      }
    );
  }, [residentId, uid]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.readAt).length,
    [notifications]
  );

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markRead: markNotificationRead,
    markAllRead: () => markAllNotificationsRead(notifications),
  };
}
