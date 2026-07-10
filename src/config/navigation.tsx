import type { ReactNode } from "react";

import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ContactsIcon from "@mui/icons-material/Contacts";
import PeopleIcon from "@mui/icons-material/People";
import BadgeIcon from "@mui/icons-material/Badge";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import BeachAccessIcon from "@mui/icons-material/BeachAccess";
import SettingsIcon from "@mui/icons-material/Settings";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import BackupIcon from "@mui/icons-material/Backup";
import VpnKeyIcon from "@mui/icons-material/VpnKey";

import type { AppPage } from "../types/page";
import type {
  AppThemeSettings,
  SidebarItemPreference,
  SidebarSettings,
} from "../types/sidebarSettings";

export type NavItem = {
  label: string;
  page: AppPage;
  icon: ReactNode;
  managerOnly?: boolean;
  requiredForManagers?: boolean;
};

export const THEME_COLOR_OPTIONS = [
  { label: "Blue", value: "#2563eb" },
  { label: "Indigo", value: "#4f46e5" },
  { label: "Teal", value: "#0f766e" },
  { label: "Green", value: "#15803d" },
  { label: "Purple", value: "#7e22ce" },
  { label: "Rose", value: "#be123c" },
  { label: "Orange", value: "#c2410c" },
  { label: "Slate", value: "#334155" },
] as const;

export const DEFAULT_THEME_SETTINGS: AppThemeSettings = {
  mode: "light",
  primaryColor: "#2563eb",
};

export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: "Who's On", page: "whos-on", icon: <CalendarTodayIcon /> },
  { label: "Phone Directory", page: "directory", icon: <ContactsIcon /> },
  { label: "Daily Call Schedule", page: "schedule", icon: <CalendarMonthIcon /> },
  { label: "Block Schedule", page: "block-schedule", icon: <ViewWeekIcon /> },
  {
    label: "Attending Call Schedule",
    page: "attending-call-schedule",
    icon: <LocalHospitalIcon />,
  },
  { label: "Residents", page: "residents", icon: <PeopleIcon /> },
  { label: "Attendings", page: "attendings", icon: <BadgeIcon /> },
  {
    label: "Invitations",
    page: "invites",
    icon: <VpnKeyIcon />,
    managerOnly: true,
  },
  {
    label: "Backup / Restore",
    page: "backup-restore",
    icon: <BackupIcon />,
    managerOnly: true,
  },
  { label: "Call Swaps", page: "call-swaps", icon: <SwapHorizIcon /> },
  { label: "Vacation", page: "vacation", icon: <BeachAccessIcon /> },
  { label: "Coverage Rules", page: "coverage-rules", icon: <MenuBookIcon /> },
  {
    label: "Settings",
    page: "settings",
    icon: <SettingsIcon />,
    managerOnly: true,
    requiredForManagers: true,
  },
];

const NAV_ITEM_BY_PAGE = new Map(
  DEFAULT_NAV_ITEMS.map((item) => [item.page, item])
);

export function getNavItem(page: AppPage): NavItem | undefined {
  return NAV_ITEM_BY_PAGE.get(page);
}

export function createDefaultSidebarSettings(): SidebarSettings {
  return {
    version: 2,
    items: DEFAULT_NAV_ITEMS.map((item) => ({
      page: item.page,
      visibleToStandardUsers: !item.managerOnly,
      visibleToManagers: true,
    })),
    theme: { ...DEFAULT_THEME_SETTINGS },
  };
}

function isThemeMode(value: unknown): value is AppThemeSettings["mode"] {
  return value === "light" || value === "dark";
}

function normalizeTheme(input: unknown): AppThemeSettings {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_THEME_SETTINGS };
  }

  const candidate = input as Partial<AppThemeSettings>;

  const mode: AppThemeSettings["mode"] = isThemeMode(candidate.mode)
    ? candidate.mode
    : DEFAULT_THEME_SETTINGS.mode;

  const primaryColor: string =
    typeof candidate.primaryColor === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(candidate.primaryColor)
      ? candidate.primaryColor
      : DEFAULT_THEME_SETTINGS.primaryColor;

  return { mode, primaryColor };
}

export function normalizeSidebarSettings(
  input?: Record<string, unknown> | Partial<SidebarSettings> | null
): SidebarSettings {
  const defaults = createDefaultSidebarSettings();
  const rawItems = Array.isArray(input?.items) ? input.items : [];
  const seen = new Set<AppPage>();
  const items: SidebarItemPreference[] = [];

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object") continue;

    const candidate = rawItem as {
      page?: AppPage;
      visible?: boolean;
      visibleToStandardUsers?: boolean;
      visibleToManagers?: boolean;
    };

    if (!candidate.page || seen.has(candidate.page)) continue;

    const navItem = getNavItem(candidate.page);
    if (!navItem) continue;

    seen.add(candidate.page);

    const standardVisibility =
      typeof candidate.visibleToStandardUsers === "boolean"
        ? candidate.visibleToStandardUsers
        : typeof candidate.visible === "boolean"
          ? candidate.visible
          : !navItem.managerOnly;

    const managerVisibility =
      typeof candidate.visibleToManagers === "boolean"
        ? candidate.visibleToManagers
        : true;

    items.push({
      page: candidate.page,
      visibleToStandardUsers: navItem.managerOnly
        ? false
        : standardVisibility,
      visibleToManagers: navItem.requiredForManagers
        ? true
        : managerVisibility,
    });
  }

  for (const defaultItem of defaults.items) {
    if (!seen.has(defaultItem.page)) items.push(defaultItem);
  }

  return {
    version: 2,
    items,
    theme: normalizeTheme(input?.theme),
  };
}
