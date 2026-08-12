export type ShiftType =
  | "Day"
  | "Night"
  | "Call"
  | "Backup"
  | "Clinic"
  | "Vacation"
  | "Off"
  | "Attending";

export type CoverageGroup = "Resident" | "Attending";

export type AttendingScheduleType = "Core" | "Specialty" | "None";

export type RequiredTraining =
  | "PGY-1"
  | "PGY-2"
  | "PGY-3"
  | "Chief Resident"
  | "Attending";

export interface ScheduleService {
  id: string;
  name: string;
  shortName: string;
  category: string;
  coverageGroup: CoverageGroup;
  attendingScheduleType: AttendingScheduleType;
  requiredTraining?: RequiredTraining[];
  defaultShiftType?: ShiftType;
  defaultStartTime: string;
  defaultEndTime: string;
  displayOrderCall: number;
  displayOrderAll: number;
  visibleOnCall: boolean;
  visibleOnAllServices: boolean;
  active: boolean;
}

export interface ScheduleAssignment {
  id: string;
  date: string;
  serviceId: string;
  serviceName: string;
  residentId: string;
  residentName: string;
  training: string;
  pager: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  visibleOnCall: boolean;
  visibleOnAllServices: boolean;
  displayOrder: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
