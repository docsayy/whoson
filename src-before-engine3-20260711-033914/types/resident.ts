export type PGY = "PGY-1" | "PGY-2" | "PGY-3";

export type ResidentRole =
  | "Resident"
  | "Chief Resident"
  | "Attending"
  | "Program Coordinator";

export interface Resident {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  pager: string;
  phone: string;
  pgy: PGY;
  role: ResidentRole;
  active: boolean;
}