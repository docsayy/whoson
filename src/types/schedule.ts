export type ShiftType =
  | "Day"
  | "Night"
  | "Call"
  | "Backup"
  | "Clinic"
  | "Vacation"
  | "Off";

export interface ScheduleAssignment {
  id: string;
  date: string;
  residentId: string;
  residentName: string;
  shiftType: ShiftType;
  notes: string;
  createdAt: string;
  updatedAt: string;
}