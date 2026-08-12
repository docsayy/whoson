export type HospitalHoliday = {
  date: string;
  name: string;
  observed?: boolean;
};

export const CONFIRMED_2026_HOSPITAL_HOLIDAYS: HospitalHoliday[] = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-01-19", name: "Martin Luther King Jr. Day" },
  { date: "2026-02-16", name: "Presidents Day" },
  { date: "2026-05-25", name: "Memorial Day" },
  { date: "2026-06-19", name: "Juneteenth" },
  { date: "2026-07-03", name: "Independence Day (Observed)", observed: true },
  { date: "2026-09-07", name: "Labor Day" },
  { date: "2026-11-26", name: "Thanksgiving Day" },
  { date: "2026-12-25", name: "Christmas Day" },
];

const holidaysByDate = new Map(
  CONFIRMED_2026_HOSPITAL_HOLIDAYS.map((holiday) => [holiday.date, holiday])
);

export function getHospitalHoliday(date: string) {
  return holidaysByDate.get(date);
}

export function isHospitalHoliday(date: string) {
  return holidaysByDate.has(date);
}

export function holidayYearNeedsConfirmation(year: number) {
  return year !== 2026;
}
