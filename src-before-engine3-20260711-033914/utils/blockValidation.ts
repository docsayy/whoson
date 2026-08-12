import type { AcademicBlock } from "../types/block";
import type { BlockAssignment } from "../types/blockAssignment";
import type { Resident } from "../types/resident";
import type { RotationRequirement, RotationStaffingSlot } from "../types/rotation";
import { getRotationEligibility } from "./rotationEligibility";

export type BlockValidationIssueSeverity = "critical" | "warning" | "info";

export type BlockValidationIssue = {
  id: string;
  severity: BlockValidationIssueSeverity;
  blockId: string;
  blockName: string;
  rotationId?: string;
  rotationName?: string;
  residentId?: string;
  residentName?: string;
  message: string;
};

export type RotationSlotValidation = {
  slotId: string;
  slotLabel: string;
  required: number;
  assigned: number;
  missing: number;
  extra: number;
};

export type RotationBlockValidation = {
  rotationId: string;
  rotationName: string;
  slots: RotationSlotValidation[];
  issues: BlockValidationIssue[];
};

export type BlockValidation = {
  block: AcademicBlock;
  assignedResidents: number;
  totalResidents: number;
  completionPercent: number;
  missingResidents: Resident[];
  duplicateResidents: Array<{
    resident: Resident;
    assignments: BlockAssignment[];
  }>;
  rotationValidations: RotationBlockValidation[];
  issues: BlockValidationIssue[];
};

function assignmentSort(a: BlockAssignment, b: BlockAssignment) {
  const byTime = (a.createdAt || "").localeCompare(b.createdAt || "");
  if (byTime !== 0) return byTime;
  return a.residentName.localeCompare(b.residentName);
}

function slotCanTakeResident(
  slot: RotationStaffingSlot,
  resident: Resident,
  includeOverride: boolean
) {
  if (slot.normalPGY.includes(resident.pgy)) return true;
  return includeOverride && Boolean(slot.overridePGY?.includes(resident.pgy));
}

export function chooseSlotKeyForAssignment({
  rotation,
  resident,
  existingAssignments,
  residents,
  includeOverride,
}: {
  rotation: RotationRequirement;
  resident: Resident;
  existingAssignments: BlockAssignment[];
  residents: Resident[];
  includeOverride: boolean;
}) {
  const slots = rotation.staffingSlots || [];
  if (slots.length === 0) return undefined;

  const residentById = new Map(residents.map((item) => [item.id, item]));
  const eligibleSlots = slots.filter((slot) =>
    slotCanTakeResident(slot, resident, includeOverride)
  );

  if (eligibleSlots.length === 0) return undefined;

  const counts = new Map<string, number>();

  for (const assignment of existingAssignments.slice().sort(assignmentSort)) {
    const assignedResident = residentById.get(assignment.residentId);
    if (!assignedResident) continue;

    const explicit = assignment.slotKey
      ? slots.find((slot) => slot.id === assignment.slotKey)
      : undefined;

    if (explicit && slotCanTakeResident(explicit, assignedResident, true)) {
      counts.set(explicit.id, (counts.get(explicit.id) || 0) + 1);
      continue;
    }

    const inferred = slots.find((slot) => {
      if (!slotCanTakeResident(slot, assignedResident, true)) return false;
      return (counts.get(slot.id) || 0) < slot.required;
    });

    if (inferred) {
      counts.set(inferred.id, (counts.get(inferred.id) || 0) + 1);
    }
  }

  return (
    eligibleSlots.find((slot) => (counts.get(slot.id) || 0) < slot.required)?.id ||
    eligibleSlots[0].id
  );
}

function resolveAssignmentsToSlots({
  rotation,
  assignments,
  residents,
}: {
  rotation: RotationRequirement;
  assignments: BlockAssignment[];
  residents: Resident[];
}) {
  const slots = rotation.staffingSlots || [];
  const residentById = new Map(residents.map((resident) => [resident.id, resident]));
  const counts = new Map<string, number>();

  for (const assignment of assignments.slice().sort(assignmentSort)) {
    const resident = residentById.get(assignment.residentId);
    if (!resident) continue;

    const explicit = assignment.slotKey
      ? slots.find((slot) => slot.id === assignment.slotKey)
      : undefined;

    if (explicit && slotCanTakeResident(explicit, resident, true)) {
      counts.set(explicit.id, (counts.get(explicit.id) || 0) + 1);
      continue;
    }

    const inferred = slots.find((slot) => {
      if (!slotCanTakeResident(slot, resident, true)) return false;
      return (counts.get(slot.id) || 0) < slot.required;
    });

    if (inferred) {
      counts.set(inferred.id, (counts.get(inferred.id) || 0) + 1);
    }
  }

  return counts;
}

export function buildBlockValidations({
  blocks,
  assignments,
  residents,
  rotations,
}: {
  blocks: AcademicBlock[];
  assignments: BlockAssignment[];
  residents: Resident[];
  rotations: RotationRequirement[];
}): BlockValidation[] {
  const activeResidents = residents.filter((resident) => resident.active);
  const residentById = new Map(activeResidents.map((resident) => [resident.id, resident]));
  const activeRotations = rotations.filter((rotation) => rotation.active);

  return blocks.map((block) => {
    const blockAssignments = assignments.filter(
      (assignment) => assignment.blockId === block.id
    );

    const assignmentsByResident = new Map<string, BlockAssignment[]>();
    for (const assignment of blockAssignments) {
      const current = assignmentsByResident.get(assignment.residentId) || [];
      current.push(assignment);
      assignmentsByResident.set(assignment.residentId, current);
    }

    const assignedResidentIds = new Set(
      blockAssignments
        .filter((assignment) => residentById.has(assignment.residentId))
        .map((assignment) => assignment.residentId)
    );

    const missingResidents = activeResidents.filter(
      (resident) => !assignedResidentIds.has(resident.id)
    );

    const duplicateResidents = Array.from(assignmentsByResident.entries())
      .filter(([, items]) => items.length > 1)
      .map(([residentId, residentAssignments]) => {
        const resident = residentById.get(residentId);
        return resident
          ? { resident, assignments: residentAssignments }
          : null;
      })
      .filter(Boolean) as Array<{
      resident: Resident;
      assignments: BlockAssignment[];
    }>;

    const issues: BlockValidationIssue[] = [];

    for (const resident of missingResidents) {
      issues.push({
        id: `missing-${block.id}-${resident.id}`,
        severity: "warning",
        blockId: block.id,
        blockName: block.name,
        residentId: resident.id,
        residentName: resident.displayName,
        message: `${resident.displayName} has no block assignment.`,
      });
    }

    for (const duplicate of duplicateResidents) {
      issues.push({
        id: `duplicate-${block.id}-${duplicate.resident.id}`,
        severity: "critical",
        blockId: block.id,
        blockName: block.name,
        residentId: duplicate.resident.id,
        residentName: duplicate.resident.displayName,
        message: `${duplicate.resident.displayName} has ${duplicate.assignments.length} block assignments.`,
      });
    }

    for (const assignment of blockAssignments) {
      const resident = residentById.get(assignment.residentId);
      const rotation = activeRotations.find((item) => item.id === assignment.rotationId);
      if (!resident || !rotation) continue;

      const eligibility = getRotationEligibility(resident, rotation);
      const explicitOverride = Boolean(assignment.override);

      if (eligibility === "not-allowed") {
        issues.push({
          id: `not-allowed-${block.id}-${assignment.id}`,
          severity: "critical",
          blockId: block.id,
          blockName: block.name,
          residentId: resident.id,
          residentName: resident.displayName,
          rotationId: rotation.id,
          rotationName: rotation.name,
          message: `${resident.displayName} (${resident.pgy}) is not eligible for ${rotation.name}.`,
        });
      } else if (eligibility === "override" && !explicitOverride) {
        issues.push({
          id: `override-missing-${block.id}-${assignment.id}`,
          severity: "warning",
          blockId: block.id,
          blockName: block.name,
          residentId: resident.id,
          residentName: resident.displayName,
          rotationId: rotation.id,
          rotationName: rotation.name,
          message: `${rotation.name} requires an explicit coverage/override reason for ${resident.pgy}.`,
        });
      }
    }

    const rotationValidations: RotationBlockValidation[] = [];

    for (const rotation of activeRotations) {
      if (rotation.capacityMode === "unlimited") continue;
      if (!rotation.staffingSlots || rotation.staffingSlots.length === 0) continue;

      const rotationAssignments = blockAssignments.filter(
        (assignment) => assignment.rotationId === rotation.id
      );

      const counts = resolveAssignmentsToSlots({
        rotation,
        assignments: rotationAssignments,
        residents: activeResidents,
      });

      const slotValidations = rotation.staffingSlots.map((slot) => {
        const assigned = counts.get(slot.id) || 0;
        return {
          slotId: slot.id,
          slotLabel: slot.label,
          required: slot.required,
          assigned,
          missing: Math.max(0, slot.required - assigned),
          extra: Math.max(0, assigned - slot.required),
        };
      });

      const rotationIssues: BlockValidationIssue[] = [];

      for (const slot of slotValidations) {
        if (slot.missing > 0) {
          rotationIssues.push({
            id: `slot-missing-${block.id}-${rotation.id}-${slot.slotId}`,
            severity: "warning",
            blockId: block.id,
            blockName: block.name,
            rotationId: rotation.id,
            rotationName: rotation.name,
            message: `${slot.slotLabel} needs ${slot.missing} more.`,
          });
        }

        if (slot.extra > 0) {
          rotationIssues.push({
            id: `slot-extra-${block.id}-${rotation.id}-${slot.slotId}`,
            severity: "info",
            blockId: block.id,
            blockName: block.name,
            rotationId: rotation.id,
            rotationName: rotation.name,
            message: `${slot.slotLabel} has ${slot.extra} extra.`,
          });
        }
      }

      issues.push(...rotationIssues);
      rotationValidations.push({
        rotationId: rotation.id,
        rotationName: rotation.name,
        slots: slotValidations,
        issues: rotationIssues,
      });
    }

    const assignedResidents = assignedResidentIds.size;
    const totalResidents = activeResidents.length;
    const completionPercent =
      totalResidents === 0
        ? 0
        : Math.round((assignedResidents / totalResidents) * 100);

    return {
      block,
      assignedResidents,
      totalResidents,
      completionPercent,
      missingResidents,
      duplicateResidents,
      rotationValidations,
      issues,
    };
  });
}
