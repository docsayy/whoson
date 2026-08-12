export type AttendingScheduleGroup = "Core" | "Specialty";

export interface AttendingScheduleAssignment {
  id: string;
  serviceId: string;
  serviceName: string;
  group: AttendingScheduleGroup;

  attendingId: string;
  attendingName: string;

  startDate: string;
  endDate: string;

  coverageStartTime: string;
  coverageEndTime: string;
  coverageNote: string;

  phone: string;
  pager: string;

  notes: string;

  archived?: boolean;
  archivedAt?: string;
  archivedReason?: string;
  createdAt: string;
  updatedAt: string;
}