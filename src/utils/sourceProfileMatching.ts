import type { Attending } from "../types/attending";
import type { Resident } from "../types/resident";
import {
  sourceNameKey,
  type SourcePersonType,
  type SourceProfileLink,
} from "../services/sourceProfileLinkService";

export type PersonProfile = Resident | Attending;

function clean(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(dr|md|do)\b/g, " ")
    .replace(/\(\d+\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string) {
  return clean(value)
    .split(" ")
    .filter((part) => part.length >= 3);
}

function sourceParts(value: string) {
  const withoutTitle = value.replace(/\b(dr\.?|md|do)\b/gi, "").trim();
  const compactAlias = withoutTitle.match(/^([A-Z][a-z]+)([A-Z])$/);
  if (compactAlias)
    return {
      first: compactAlias[2].toLowerCase(),
      last: compactAlias[1].toLowerCase(),
    };
  if (withoutTitle.includes(",")) {
    const [last, first = ""] = withoutTitle.split(",");
    return { first: clean(first), last: clean(last) };
  }
  const parts = clean(withoutTitle).split(" ").filter(Boolean);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
}

export function findProfile<T extends PersonProfile>(
  sourceName: string,
  profiles: T[],
) {
  const source = sourceParts(sourceName);
  if (!source.last) return undefined;
  return profiles.find((profile) => {
    const first = clean(profile.firstName);
    const last = clean(profile.lastName);
    const display = clean(profile.displayName);
    const direct = clean(sourceName);
    const firstMatches =
      !source.first ||
      first === source.first ||
      first.startsWith(source.first) ||
      source.first.startsWith(first.slice(0, 1));
    return (last === source.last && firstMatches) || display === direct;
  });
}

export function findLinkedProfile<T extends PersonProfile>(
  sourceName: string,
  personType: SourcePersonType,
  profiles: T[],
  links: SourceProfileLink[],
) {
  const saved = links.find(
    (link) =>
      link.personType === personType &&
      sourceNameKey(link.sourceName) === sourceNameKey(sourceName),
  );
  if (saved) return profiles.find((profile) => profile.id === saved.profileId);
  const direct = findProfile(sourceName, profiles);
  if (direct) return direct;
  const incoming = tokens(sourceName);
  const aliasProfileIds = new Set(
    links
      .filter(
        (link) => {
          if (link.personType !== personType) return false;
          const alias = tokens(link.sourceName);
          const shared = incoming.filter((part) => alias.includes(part));
          return incoming.length === 1
            ? shared.length === 1
            : shared.length >= 2;
        },
      )
      .map((link) => link.profileId),
  );
  return aliasProfileIds.size === 1
    ? profiles.find((profile) => aliasProfileIds.has(profile.id))
    : undefined;
}
