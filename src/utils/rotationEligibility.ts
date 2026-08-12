import type { Resident } from "../types/resident";
import type { RotationRequirement, RotationStaffingSlot } from "../types/rotation";

export type ResidentPgy = Resident["pgy"];
export type RotationEligibilityMode = "normal" | "override" | "not-allowed";

const allPgy: ResidentPgy[] = ["PGY-1", "PGY-2", "PGY-3"];

export function normalAllowedPgyForRotation(
  rotation: RotationRequirement
): ResidentPgy[] {
  return rotation.normalAllowedPGY || rotation.allowedPGY || allPgy;
}

export function overrideAllowedPgyForRotation(
  rotation: RotationRequirement
): ResidentPgy[] {
  return rotation.overrideAllowedPGY || [];
}

export function getRotationEligibility(
  resident: Pick<Resident, "pgy">,
  rotation: RotationRequirement
): RotationEligibilityMode {
  if (normalAllowedPgyForRotation(rotation).includes(resident.pgy)) {
    return "normal";
  }

  if (overrideAllowedPgyForRotation(rotation).includes(resident.pgy)) {
    return "override";
  }

  return "not-allowed";
}

export function isResidentEligibleForRotation(
  resident: Pick<Resident, "pgy">,
  rotation: RotationRequirement
) {
  return getRotationEligibility(resident, rotation) === "normal";
}

export function canResidentOverrideIntoRotation(
  resident: Pick<Resident, "pgy">,
  rotation: RotationRequirement
) {
  return getRotationEligibility(resident, rotation) === "override";
}

export function eligibleSlotsForResident(
  resident: Pick<Resident, "pgy">,
  rotation: RotationRequirement,
  includeOverride = false
): RotationStaffingSlot[] {
  return (rotation.staffingSlots || []).filter((slot) => {
    if (slot.normalPGY.includes(resident.pgy)) return true;
    return includeOverride && Boolean(slot.overridePGY?.includes(resident.pgy));
  });
}
