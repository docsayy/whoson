import type { Attending } from "../types/attending";
import type { Resident } from "../types/resident";

export type PersonProfile = Resident | Attending;

function clean(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(dr|md|do)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sourceParts(value: string) {
  const withoutTitle = value.replace(/\b(dr\.?|md|do)\b/gi, "").trim();
  if (withoutTitle.includes(",")) {
    const [last, first = ""] = withoutTitle.split(",");
    return { first: clean(first), last: clean(last) };
  }
  const parts = clean(withoutTitle).split(" ").filter(Boolean);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
}

export function findProfile<T extends PersonProfile>(sourceName: string, profiles: T[]) {
  const source = sourceParts(sourceName);
  if (!source.last) return undefined;
  return profiles.find((profile) => {
    const first = clean(profile.firstName);
    const last = clean(profile.lastName);
    const display = clean(profile.displayName);
    const direct = clean(sourceName);
    const firstMatches = !source.first || first === source.first || first.startsWith(source.first) || source.first.startsWith(first.slice(0, 1));
    return (last === source.last && firstMatches) || display === direct;
  });
}
