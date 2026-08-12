import type { AttendingScheduleAssignment } from "../types/attendingSchedule";

export const consultServiceProfiles = {
  gi: { title: "GI", serviceIds: ["gi-on-call"], terms: ["gastro", "gi"] },
  id: { title: "Infectious Disease", serviceIds: ["infectious-disease-on-call"], terms: ["infectious", "id"] },
  "cardiology-ccu": { title: "Cardiology / CCU", serviceIds: ["cardiology-on-call"], terms: ["cardiology", "cardio", "ccu"] },
  "micu-pulm": { title: "MICU / Pulmonary", serviceIds: ["micu-attending-on-call", "pulmonology-on-call"], terms: ["micu", "pulmonary", "pulm"] },
  neuro: { title: "Neurology", serviceIds: ["neurology-on-call"], terms: ["neurology", "neuro"] },
  "heme-onc": { title: "Heme-Onc", serviceIds: ["hematology-on-call", "oncology-on-call"], terms: ["hematology", "heme", "oncology", "heme onc", "hem onc"] },
  "nephro-rheum-endo": { title: "Nephro / Rheum / Endo", serviceIds: ["nephrology-on-call", "rheumatology-on-call", "endocrinology-on-call"], terms: ["nephrology", "nephro", "rheumatology", "rheum", "endocrinology", "endo"] },
} as const;

export type ConsultServiceProfileId = keyof typeof consultServiceProfiles;

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getConsultServiceProfileId(
  assignment: Pick<AttendingScheduleAssignment, "serviceId" | "serviceName">
): ConsultServiceProfileId | null {
  for (const [id, profile] of Object.entries(consultServiceProfiles) as [
    ConsultServiceProfileId,
    (typeof consultServiceProfiles)[ConsultServiceProfileId]
  ][]) {
    if (profile.serviceIds.includes(assignment.serviceId as never)) return id;

    const serviceName = normalize(assignment.serviceName);
    if (profile.terms.some((term) => serviceName.includes(normalize(term)))) {
      return id;
    }
  }

  return null;
}

export function matchesConsultServiceProfile(
  assignment: Pick<AttendingScheduleAssignment, "serviceId" | "serviceName">,
  profileId: ConsultServiceProfileId
) {
  return getConsultServiceProfileId(assignment) === profileId;
}
