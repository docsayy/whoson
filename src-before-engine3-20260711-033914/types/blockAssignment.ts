export type BlockAssignmentStatus = "draft" | "published" | "archived";
export type BlockAssignmentSource = "manual" | "excel-import" | "migration" | "publish";

export interface BlockAssignment {
  id: string;
  academicYear: string;
  blockId: string;
  blockNumber: number;
  residentId: string;
  residentName: string;
  rotationId: string;
  rotationName: string;

  /** Optional hidden staffing slot. 2N still displays as one unit. */
  slotKey?: string;

  /** Legacy records without status are treated as editable draft data. */
  status?: BlockAssignmentStatus;
  version?: number;

  override?: boolean;
  overrideReason?: string;

  source?: BlockAssignmentSource;
  importedFileName?: string;
  importedAt?: string;

  notes: string;
  createdAt: string;
  updatedAt: string;
}
