export interface ActiveChiefSelection {
  residentId: string;
  residentName: string;
  updatedAt: string;
  version?: number;
}

export interface AcademicBlock {
  id: string;
  academicYear: string;
  blockNumber: number;
  name: string;
  startDate: string;
  endDate: string;

  /** Builder-only selection until the block schedule is published. */
  activeChiefDraft?: ActiveChiefSelection | null;

  /** Selection visible with the latest published block schedule. */
  activeChiefPublished?: ActiveChiefSelection | null;

  /** Version history used when an older block schedule is restored. */
  activeChiefHistory?: Record<string, ActiveChiefSelection | null>;
}
