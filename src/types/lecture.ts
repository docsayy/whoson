export type LectureAudience = "Everyone" | "PGY-1" | "PGY-2" | "PGY-3" | "Faculty";

export type LectureCategory =
  | "Morning Report"
  | "Noon Conference"
  | "Grand Rounds"
  | "Board Review"
  | "Journal Club"
  | "M&M"
  | "Simulation"
  | "Orientation"
  | "Residency Event"
  | "Business Meeting"
  | "Other";

export interface LectureEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  presenter: string;
  audience: LectureAudience[];
  category: LectureCategory;
  notes: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdByUid?: string;
}
