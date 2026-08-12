export interface PublicResidentRow {
  service: string;
  time: string;
  name: string;
  level: string;
  birthday?: boolean;
}

export interface PublicAllServiceRow {
  service: string;
  name: string;
  level: string;
  activeChief?: boolean;
  birthday?: boolean;
}

export interface PublicAttendingRow {
  service: string;
  consultant: string;
  coverage: string;
  birthday?: boolean;
}

export interface PublicActiveChief {
  blockName: string;
  residentName: string;
  birthday?: boolean;
}

export interface PublicHolidayInfo {
  name: string;
  note: string;
}

export interface PublicWhoOnDay {
  date: string;
  callPublished: boolean;
  callRows: PublicResidentRow[];
  consultRows: PublicResidentRow[];
  allServices: PublicAllServiceRow[];
  admittingRows: PublicAttendingRow[];
  consultingRows: PublicAttendingRow[];
  activeChief?: PublicActiveChief;
  holiday?: PublicHolidayInfo;
}

export interface PublicWhoOnMonth {
  id: string;
  month: string;
  updatedAt: string;
  days: Record<string, PublicWhoOnDay>;
}
