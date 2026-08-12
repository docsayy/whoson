import type { ShiftType } from "./schedule";

export interface MonthlyScheduleCell {
  serviceId: string;
  serviceName: string;
  date: string;
  residentId: string;
  residentName: string;
  training: string;
  pager: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  notes: string;
  warning?: string;
}

export interface MonthlySchedule {
  id: string;
  academicYear: string;
  month: string;
  status: "draft" | "published" | "archived";
  assignments: Record<string, MonthlyScheduleCell>;
  createdAt: string;
  updatedAt: string;
}