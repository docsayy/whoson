import type { SourceRecord } from "../services/sourceSchedulerService";

const normalize = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export function sourceRoleKey(role: SourceRecord) {
  return String(role.id ?? `${role.cohort_id ?? "x"}:${normalize(role.code)}`);
}

export function sourceRoleLabel(role: SourceRecord) {
  const code = String(role.code || "Call");
  const normalized = normalize(code);
  const cohort = Number(role.cohort_id || 0);

  if (normalized === "icu") return "ICU intern";
  if (normalized === "nf") return "NF chief on call";
  if (cohort === 2 && normalized.startsWith("nf (")) {
    return `${code} senior`;
  }
  return code;
}

export function sourceRoleOrder(role: SourceRecord) {
  const normalized = normalize(role.code);
  const cohort = Number(role.cohort_id || 0);
  const helper = normalized.includes("helper");

  if (normalized === "2n") return 10;
  if (normalized === "2n helper") return 11;
  if (normalized === "tele") return 20;
  if (normalized === "tele helper") return 21;
  if (normalized === "2n/tele/ccu" && !helper) return 30;
  if (normalized === "3w") return 40;
  if (normalized === "4n") return 50;
  if (normalized === "4n helper") return 51;
  if (normalized === "3w/4n" && !helper) return 60;
  if (normalized === "chief on call") return 70;
  if (cohort === 1 && normalized === "nf (2n/tele/ccu)") return 80;
  if (cohort === 1 && normalized === "nf (3w/4n)") return 81;
  if (cohort === 2 && normalized === "nf (2n/tele/ccu)") return 82;
  if (cohort === 2 && normalized === "nf (3w/4n)") return 83;
  if (normalized === "nf") return 84;
  if (normalized === "icu") return 90;
  if (normalized === "icu senior") return 91;
  if (normalized === "chief resident") return 100;
  return 1000 + Number(role.sort_order ?? 999);
}

export function compareSourceRoles(a: SourceRecord, b: SourceRecord) {
  return (
    sourceRoleOrder(a) - sourceRoleOrder(b) ||
    sourceRoleLabel(a).localeCompare(sourceRoleLabel(b))
  );
}
