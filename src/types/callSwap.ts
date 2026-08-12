export type CallSwapStatus =
  | "pending-recipient"
  | "pending-approval"
  | "approved-draft"
  | "declined"
  | "rejected"
  | "cancelled";

export interface CallSwapHistoryEntry {
  status: CallSwapStatus;
  actorUid: string;
  actorName: string;
  note?: string;
  createdAt: string;
}

export interface CallSwapRequest {
  id: string;
  date: string;
  serviceId: string;
  serviceName: string;

  requesterUid: string;
  requesterResidentId: string;
  requesterName: string;

  targetUid?: string;
  targetResidentId: string;
  targetName: string;

  reason: string;
  status: CallSwapStatus;
  history: CallSwapHistoryEntry[];

  createdAt: string;
  updatedAt: string;
  approvedByUid?: string;
  approvedByName?: string;
  appliedAt?: string;
}
