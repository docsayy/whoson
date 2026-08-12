import type { Resident } from "../types/resident";

export type PersonMatchMethod =
  | "exact-display"
  | "exact-full"
  | "normalized"
  | "reversed"
  | "initials"
  | "unique-last-name"
  | "unique-first-name"
  | "none"
  | "ambiguous";

export type ResidentMatchResult = {
  resident?: Resident;
  confidence: number;
  method: PersonMatchMethod;
  normalizedSource: string;
  candidates: Resident[];
};

const TITLES = /\b(dr|doctor|md|do|mr|mrs|ms|miss)\b/gi;

export function normalizePersonName(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(TITLES, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function compact(value: string) {
  return normalizePersonName(value).replace(/\s/g, "");
}

function initials(value: string) {
  return normalizePersonName(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("");
}

function uniqueResidents(items: Resident[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export function matchResidentName(
  source: string,
  residents: Resident[]
): ResidentMatchResult {
  const active = residents.filter((resident) => resident.active);
  const normalizedSource = normalizePersonName(source);
  const sourceCompact = compact(source);
  const sourceParts = normalizedSource.split(" ").filter(Boolean);

  if (!normalizedSource) {
    return {
      confidence: 0,
      method: "none",
      normalizedSource,
      candidates: [],
    };
  }

  const exactDisplay = active.filter(
    (resident) => resident.displayName.trim().toLowerCase() === source.trim().toLowerCase()
  );
  if (exactDisplay.length === 1) {
    return {
      resident: exactDisplay[0],
      confidence: 100,
      method: "exact-display",
      normalizedSource,
      candidates: exactDisplay,
    };
  }

  const exactFull = active.filter(
    (resident) =>
      `${resident.firstName} ${resident.lastName}`.trim().toLowerCase() ===
      source.trim().toLowerCase()
  );
  if (exactFull.length === 1) {
    return {
      resident: exactFull[0],
      confidence: 99,
      method: "exact-full",
      normalizedSource,
      candidates: exactFull,
    };
  }

  const normalizedMatches = active.filter((resident) => {
    const values = [
      resident.displayName,
      `${resident.firstName} ${resident.lastName}`,
      `${resident.lastName} ${resident.firstName}`,
    ];
    return values.some((value) => compact(value) === sourceCompact);
  });
  if (normalizedMatches.length === 1) {
    return {
      resident: normalizedMatches[0],
      confidence: 96,
      method: "normalized",
      normalizedSource,
      candidates: normalizedMatches,
    };
  }
  if (normalizedMatches.length > 1) {
    return {
      confidence: 0,
      method: "ambiguous",
      normalizedSource,
      candidates: uniqueResidents(normalizedMatches),
    };
  }

  const reversedMatches = active.filter(
    (resident) =>
      compact(`${resident.lastName} ${resident.firstName}`) === sourceCompact
  );
  if (reversedMatches.length === 1) {
    return {
      resident: reversedMatches[0],
      confidence: 94,
      method: "reversed",
      normalizedSource,
      candidates: reversedMatches,
    };
  }

  if (sourceParts.length >= 2) {
    const sourceInitials = initials(source);
    const initialMatches = active.filter((resident) => {
      const first = normalizePersonName(resident.firstName);
      const last = normalizePersonName(resident.lastName);
      const sourceFirst = sourceParts[0];
      const sourceLast = sourceParts[sourceParts.length - 1];
      return (
        last === sourceLast &&
        (first === sourceFirst || first.startsWith(sourceFirst[0])) &&
        initials(`${resident.firstName} ${resident.lastName}`).startsWith(
          sourceInitials[0]
        )
      );
    });
    if (initialMatches.length === 1) {
      return {
        resident: initialMatches[0],
        confidence: 90,
        method: "initials",
        normalizedSource,
        candidates: initialMatches,
      };
    }
  }

  if (sourceParts.length === 1) {
    const only = sourceParts[0];
    const lastMatches = active.filter(
      (resident) => normalizePersonName(resident.lastName) === only
    );
    if (lastMatches.length === 1) {
      return {
        resident: lastMatches[0],
        confidence: 84,
        method: "unique-last-name",
        normalizedSource,
        candidates: lastMatches,
      };
    }

    const firstMatches = active.filter(
      (resident) => normalizePersonName(resident.firstName) === only
    );
    if (firstMatches.length === 1) {
      return {
        resident: firstMatches[0],
        confidence: 82,
        method: "unique-first-name",
        normalizedSource,
        candidates: firstMatches,
      };
    }

    const ambiguous = uniqueResidents([...lastMatches, ...firstMatches]);
    if (ambiguous.length > 1) {
      return {
        confidence: 0,
        method: "ambiguous",
        normalizedSource,
        candidates: ambiguous,
      };
    }
  }

  return {
    confidence: 0,
    method: "none",
    normalizedSource,
    candidates: [],
  };
}

export function matchMethodLabel(method: PersonMatchMethod) {
  const labels: Record<PersonMatchMethod, string> = {
    "exact-display": "Exact display-name match",
    "exact-full": "Exact first/last-name match",
    normalized: "Normalized name match",
    reversed: "Reversed name match",
    initials: "Initial/name match",
    "unique-last-name": "Unique last-name match",
    "unique-first-name": "Unique first-name match",
    none: "No match",
    ambiguous: "Ambiguous match",
  };
  return labels[method];
}
