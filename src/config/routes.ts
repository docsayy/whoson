import type { AppPage } from "../types/page";

export const PAGE_PATHS: Record<AppPage, string> = {
  "whos-on": "/whos-on",
  directory: "/directory",
  residents: "/residents",
  attendings: "/attendings",
  "attending-call-schedule": "/attending-call-schedule",
  schedule: "/daily-call-schedule",
  "block-schedule": "/block-schedule",
  lectures: "/lectures",
  "coverage-rules": "/coverage-rules",
  integrity: "/scheduling-integrity",
  "calendar-subscription": "/calendar-subscription",
  "backup-restore": "/backup-restore",
  invites: "/invitations",
  "call-swaps": "/call-swaps",
  vacation: "/block-schedule",
  "external-sync": "/external-schedule",
  settings: "/settings",
};

const PATH_PAGE_ENTRIES = Object.entries(PAGE_PATHS) as Array<[AppPage, string]>;

export function pathForPage(page: AppPage) {
  return PAGE_PATHS[page] || PAGE_PATHS["whos-on"];
}

export function pageForPath(pathname: string): AppPage {
  if (pathname.startsWith("/residents/")) return "residents";
  if (pathname.startsWith("/attendings/")) return "attendings";
  if (pathname.startsWith("/consult-services/")) return "whos-on";

  const exact = PATH_PAGE_ENTRIES.find(([, path]) => path === pathname);
  return exact?.[0] || "whos-on";
}
