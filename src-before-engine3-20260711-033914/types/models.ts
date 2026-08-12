export type HospitalId = string;

export type UserRole =
  | "resident"
  | "chief"
  | "attending"
  | "coordinator"
  | "admin";

export type TrainingLevel = "PGY-1" | "PGY-2" | "PGY-3" | "Attending";

export type AssignmentType =
  | "call"
  | "rotation"
  | "vacation"
  | "attending";

export type ServiceCategory =
  | "floor"
  | "icu"
  | "elective"
  | "clinic"
  | "vacation"
  | "call"
  | "admission"
  | "night-float";

export type Resident = {
  id: string;
  hospitalId: HospitalId;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  pager: string;
  phone?: string;
  trainingLevel: TrainingLevel;
  role: UserRole;
  active: boolean;
};

export type DailyAssignment = {
  id: string;
  hospitalId: HospitalId;
  date: string;
  service: string;
  shift?: string;
  residentId: string;
  assignmentType: AssignmentType;
  note?: string;
  messageReady: boolean;
};

export type BlockRotation = {
  id: string;
  hospitalId: HospitalId;
  academicYear: string;
  residentId: string;
  rotation: string;
  startDate: string;
  endDate: string;
  blockNumber: number;
};

export type Service = {
  id: string;
  hospitalId: HospitalId;
  name: string;
  category: ServiceCategory;
  active: boolean;
};

export type AppUser = {
  uid: string;
  email: string;
  residentId?: string;
  hospitalId: HospitalId;
  role: UserRole;
  active: boolean;
};