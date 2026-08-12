import type { Attending } from "../types/attending";
import type {
  AttendingScheduleAssignment,
  AttendingScheduleGroup,
} from "../types/attendingSchedule";

export type CanonicalAttendingServiceKey =
  | "observation"
  | "2n-tele-ccu"
  | "4n-3w-on-record"
  | "4n-3w-on-call"
  | "faculty-on-call"
  | "id"
  | "gi"
  | "heme-onc"
  | "neuro"
  | "pulm"
  | "cardio-ccu"
  | "endo"
  | "rheum"
  | "nephro"
  | "nephro-rheum-endo"
  | "micu"
  | string;

export const CORE_ATTENDING_SERVICE_ORDER: CanonicalAttendingServiceKey[] = [
  "observation",
  "2n-tele-ccu",
  "4n-3w-on-record",
  "4n-3w-on-call",
  "faculty-on-call",
];

export const SPECIALTY_ATTENDING_SERVICE_ORDER: CanonicalAttendingServiceKey[] = [
  "id",
  "gi",
  "heme-onc",
  "neuro",
  "pulm",
  "cardio-ccu",
  "endo",
  "rheum",
  "nephro",
  "nephro-rheum-endo",
  "micu",
];

export function normalizeAttendingText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function containsAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(normalizeAttendingText(term)));
}

export function canonicalAttendingServiceKey(
  assignment: Pick<
    AttendingScheduleAssignment,
    "serviceId" | "serviceName" | "group"
  >
): CanonicalAttendingServiceKey {
  const source = normalizeAttendingText(
    `${assignment.serviceId} ${assignment.serviceName}`
  );

  if (assignment.group === "Core") {
    if (containsAny(source, ["observation", "obs"])) return "observation";

    if (
      containsAny(source, [
        "2n2",
        "2n1",
        "2n tele ccu",
        "tele 2n ccu",
        "ccu attending on call",
      ])
    ) {
      return "2n-tele-ccu";
    }

    if (
      containsAny(source, ["on record", "attending on record"]) &&
      containsAny(source, ["4n", "3w", "four north", "three west"])
    ) {
      return "4n-3w-on-record";
    }

    if (
      containsAny(source, ["4n", "3w", "four north", "three west"]) &&
      containsAny(source, ["on call", "attending"])
    ) {
      return "4n-3w-on-call";
    }

    if (containsAny(source, ["faculty attending", "faculty on call"])) {
      return "faculty-on-call";
    }
  }

  if (containsAny(source, ["infectious disease", "infectious", "id on call"])) {
    return "id";
  }
  if (containsAny(source, ["gastroenterology", "gastro", "gi on call"])) {
    return "gi";
  }
  if (
    containsAny(source, [
      "hematology oncology",
      "hematology",
      "oncology",
      "heme onc",
      "hem onc",
    ])
  ) {
    return "heme-onc";
  }
  if (containsAny(source, ["neurology", "neuro"])) return "neuro";
  if (containsAny(source, ["pulmonology", "pulmonary", "pulm"])) return "pulm";
  if (containsAny(source, ["cardiology", "cardio", "ccu"])) return "cardio-ccu";
  const hasNephrology = containsAny(source, ["nephrology", "nephro"]);
  const hasRheumatology = containsAny(source, ["rheumatology", "rheum"]);
  const hasEndocrinology = containsAny(source, ["endocrinology", "endo"]);

  if (
    [hasNephrology, hasRheumatology, hasEndocrinology].filter(Boolean).length > 1
  ) {
    return "nephro-rheum-endo";
  }
  if (hasEndocrinology) return "endo";
  if (hasRheumatology) return "rheum";
  if (hasNephrology) return "nephro";
  if (containsAny(source, ["micu", "medical icu", "critical care"])) return "micu";

  return `${assignment.group.toLowerCase()}:${normalizeAttendingText(
    assignment.serviceId || assignment.serviceName
  )}`;
}

export function canonicalAttendingServiceLabel(
  key: CanonicalAttendingServiceKey,
  fallback: string
) {
  const labels: Record<string, string> = {
    observation: "Observation",
    "2n-tele-ccu": "2N2 (Tele), 2N1, CCU Attending On Call",
    "4n-3w-on-record": "4 North 1&2, 3W Attending On Record",
    "4n-3w-on-call": "4 North 1&2, 3W Attending On Call",
    "faculty-on-call": "Faculty Attending On Call",
    id: "ID",
    gi: "GI",
    "heme-onc": "Heme-Onc",
    neuro: "Neuro",
    pulm: "Pulm",
    "cardio-ccu": "Cardiology/CCU",
    endo: "Endo",
    rheum: "Rheum",
    nephro: "Nephro",
    "nephro-rheum-endo": "Endo/Rheum/Nephro",
    micu: "MICU",
  };

  return labels[key] || fallback;
}

function timestamp(assignment: AttendingScheduleAssignment) {
  return assignment.updatedAt || assignment.createdAt || "";
}

function serviceOrder(
  group: AttendingScheduleGroup,
  key: CanonicalAttendingServiceKey
) {
  const order =
    group === "Core"
      ? CORE_ATTENDING_SERVICE_ORDER
      : SPECIALTY_ATTENDING_SERVICE_ORDER;
  const index = order.indexOf(key);
  return index === -1 ? 999 : index;
}

export function getEffectiveAttendingAssignments(params: {
  assignments: AttendingScheduleAssignment[];
  date: string;
  group: AttendingScheduleGroup;
}) {
  const byService = new Map<
    CanonicalAttendingServiceKey,
    AttendingScheduleAssignment
  >();

  for (const assignment of params.assignments) {
    if (assignment.archived) continue;
    if (assignment.group !== params.group) continue;
    if (assignment.startDate > params.date || assignment.endDate < params.date) {
      continue;
    }

    const key = canonicalAttendingServiceKey(assignment);
    const current = byService.get(key);

    if (!current || timestamp(assignment) > timestamp(current)) {
      byService.set(key, assignment);
    }
  }

  return Array.from(byService.entries())
    .sort(([keyA, assignmentA], [keyB, assignmentB]) => {
      const orderDifference =
        serviceOrder(params.group, keyA) - serviceOrder(params.group, keyB);
      if (orderDifference !== 0) return orderDifference;
      return assignmentA.serviceName.localeCompare(assignmentB.serviceName);
    })
    .map(([key, assignment]) => ({ key, assignment }));
}

function uniqueAttendingMatch(
  attendings: Attending[],
  predicate: (attending: Attending) => boolean
) {
  const matches = attendings.filter(predicate);
  return matches.length === 1 ? matches[0] : undefined;
}

export function resolveAttendingProfile(
  assignment: Pick<
    AttendingScheduleAssignment,
    "attendingId" | "attendingName"
  >,
  attendings: Attending[]
) {
  if (assignment.attendingId) {
    const byId = attendings.find(
      (attending) => attending.id === assignment.attendingId
    );
    if (byId) return byId;
  }

  const oldName = normalizeAttendingText(assignment.attendingName || "");
  if (!oldName) return undefined;

  const byDisplayName = uniqueAttendingMatch(
    attendings,
    (attending) => normalizeAttendingText(attending.displayName) === oldName
  );
  if (byDisplayName) return byDisplayName;

  const byFullName = uniqueAttendingMatch(attendings, (attending) => {
    const fullName = normalizeAttendingText(
      `${attending.firstName} ${attending.lastName}`
    );
    return fullName === oldName;
  });
  if (byFullName) return byFullName;

  return uniqueAttendingMatch(attendings, (attending) => {
    const lastName = normalizeAttendingText(attending.lastName);
    return Boolean(lastName && (oldName === lastName || oldName.endsWith(lastName)));
  });
}

export function attendingDisplayValues(
  assignment: AttendingScheduleAssignment,
  attendings: Attending[]
) {
  const profile = resolveAttendingProfile(assignment, attendings);

  return {
    attendingId: profile?.id || assignment.attendingId || "",
    consultant:
      profile?.displayName || assignment.attendingName || "Unassigned",
    phone: profile?.phone || assignment.phone || "—",
    pager: profile?.pager || assignment.pager || "",
  };
}
