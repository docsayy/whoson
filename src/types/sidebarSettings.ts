import type { AppPage } from "./page";

export type AppThemeMode = "light" | "dark";

export type SidebarItemPreference = {
  page: AppPage;
  visibleToStandardUsers: boolean;
  visibleToManagers: boolean;
};

export type AppThemeSettings = {
  mode: AppThemeMode;
  primaryColor: string;
};

export type SidebarSettings = {
  version: 2;
  items: SidebarItemPreference[];
  theme: AppThemeSettings;
};
