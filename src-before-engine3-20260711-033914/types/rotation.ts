import type { PGY } from "./resident";

export type RotationCategory =
  | "Ward"
  | "ICU"
  | "Night Float"
  | "Ambulatory"
  | "Elective"
  | "Consult"
  | "Jeopardy"
  | "Vacation"
  | "Admission"
  | "Emergency Medicine"
  | "Other";

export type RotationCapacityMode = "staffed" | "unlimited";

export interface RotationStaffingSlot {
  id: string;
  label: string;
  required: number;
  normalPGY: PGY[];
  overridePGY?: PGY[];
}

export interface RotationRequirement {
  id: string;
  name: string;
  category: RotationCategory;

  /** Legacy count fields kept for old data and screens. */
  requiredPGY1: number;
  requiredPGY2: number;
  requiredPGY3: number;
  requiredSenior: number;

  /** Normal dropdown eligibility. */
  allowedPGY?: PGY[];
  normalAllowedPGY?: PGY[];

  /** PGY levels available only through explicit builder override. */
  overrideAllowedPGY?: PGY[];

  /** Exact staffing slots used by the new validator. */
  staffingSlots?: RotationStaffingSlot[];

  /** Zero-or-more rotations do not generate staffing shortage warnings. */
  capacityMode?: RotationCapacityMode;

  /** Excel/import aliases. */
  aliases?: string[];

  /** Ready for future annual requirement tracking; counts may be added later. */
  annualRequirementByPGY?: Partial<Record<PGY, number>>;

  active: boolean;
  displayOrder: number;
}
