import type { AppRole } from "./userProfile";

export type InvitePersonType = "resident" | "attending" | "admin";

export interface InviteCode {
  code: string;
  displayName: string;
  role: AppRole;
  personType: InvitePersonType;
  residentId?: string;
  attendingId?: string;
  expiresAt: string;
  used: boolean | string;
  active: boolean | string;
  usedByUid?: string;
  usedByEmail?: string;
  usedAt?: string;
  createdAt: string;
  createdByUid?: string;
}