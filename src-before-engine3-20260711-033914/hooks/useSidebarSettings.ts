import { useEffect, useState } from "react";

import { createDefaultSidebarSettings } from "../config/navigation";
import { subscribeToSidebarSettings } from "../services/sidebarSettingsService";
import type { SidebarSettings } from "../types/sidebarSettings";

export function useSidebarSettings() {
  const [settings, setSettings] = useState<SidebarSettings>(
    createDefaultSidebarSettings()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToSidebarSettings(
      (nextSettings) => {
        setSettings(nextSettings);
        setError(null);
        setLoading(false);
      },
      (subscriptionError) => {
        console.error("Unable to load interface settings:", subscriptionError);
        setError(
          "Unable to load interface settings. Default settings are being used."
        );
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return {
    settings,
    loading,
    error,
  };
}
