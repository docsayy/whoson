export const blockDates = [
  "7/1-7/16",
  "7/17-7/30",
  "7/31-8/13",
  "8/14-8/27",
  "8/28-9/10",
  "9/11-9/24",
  "9/25-10/8",
  "10/9-10/22",
];

export type BlockScheduleRow = {
  name: string;
  level: "PGY-1" | "PGY-2" | "PGY-3";
  rotations: string[];
};

export const blockScheduleRows: BlockScheduleRow[] = [
  {
    name: "Adhikari Ad",
    level: "PGY-1",
    rotations: ["MICU", "MICU", "Amb", "4N", "4N", "2N", "NF", "Vac"],
  },
  {
    name: "Alfardous Al",
    level: "PGY-1",
    rotations: ["4N", "4N", "JEO", "ID", "MICU", "MICU", "Amb", "2N"],
  },
  {
    name: "Al-Gharazi MAl",
    level: "PGY-1",
    rotations: ["4N", "4N", "Amb", "Tele", "NF", "Vac", "MICU", "MICU"],
  },
  {
    name: "Sayyar",
    level: "PGY-2",
    rotations: ["Tele", "Tele", "Amb", "ICU", "NF", "Vac", "2N", "4N"],
  },
];