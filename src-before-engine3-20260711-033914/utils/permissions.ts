import type { AppRole } from "../types/userProfile";

function normalizeRole(role?: AppRole | string | null) {
  return (role || "").trim().toLowerCase();
}

export function canManageResidents(role?: AppRole | string | null) {
  const normalized = normalizeRole(role);

  return (
    normalized === "admin" ||
    normalized === "chief resident" ||
    normalized === "program coordinator"
  );
}

export function canBuildSchedule(role?: AppRole | string | null) {
  return canManageResidents(role);
}