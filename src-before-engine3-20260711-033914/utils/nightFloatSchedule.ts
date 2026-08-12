import { NIGHT_FLOAT_ROTATION_IDS } from "../config/rotationDefinitions";
import type { AcademicBlock } from "../types/block";
import type { BlockAssignment } from "../types/blockAssignment";
import type { MonthlyScheduleCell } from "../types/monthSchedule";
import type { Resident } from "../types/resident";
import type { RequiredTraining, ScheduleService } from "../types/schedule";

export const EXACT_NF_SERVICE_IDS = {
  pgy1TwoNorthCcu: NIGHT_FLOAT_ROTATION_IDS.pgy1TwoNorthCcu,
  pgy1FourNorthThreeWest: NIGHT_FLOAT_ROTATION_IDS.pgy1FourNorthThreeWest,
  pgy2TwoNorthCcu: NIGHT_FLOAT_ROTATION_IDS.pgy2TwoNorthCcu,
  pgy2FourNorthThreeWest: NIGHT_FLOAT_ROTATION_IDS.pgy2FourNorthThreeWest,
  pgy3: NIGHT_FLOAT_ROTATION_IDS.pgy3,
} as const;

export function isNightFloatService(serviceId: string) {
  return Object.values(EXACT_NF_SERVICE_IDS).some((id) => id === serviceId);
}

export function parseLocalDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function dayOfWeek(date: string) {
  return parseLocalDate(date).getDay();
}

export function isAutoNightFloatDate(serviceId: string, date: string) {
  const dow = dayOfWeek(date);

  // PGY1 NF works Thu, Fri, Sun, Mon, Tue, Wed nights; off Saturday.
  if (
    serviceId === EXACT_NF_SERVICE_IDS.pgy1TwoNorthCcu ||
    serviceId === EXACT_NF_SERVICE_IDS.pgy1FourNorthThreeWest
  ) {
    return dow >= 0 && dow <= 5;
  }

  // Senior NF works Sunday through Thursday nights.
  if (
    serviceId === EXACT_NF_SERVICE_IDS.pgy2TwoNorthCcu ||
    serviceId === EXACT_NF_SERVICE_IDS.pgy2FourNorthThreeWest ||
    serviceId === EXACT_NF_SERVICE_IDS.pgy3
  ) {
    return dow >= 0 && dow <= 4;
  }

  return false;
}

export function residentTraining(resident: { pgy: string }): RequiredTraining {
  if (resident.pgy === "PGY-1") return "PGY-1";
  if (resident.pgy === "PGY-2") return "PGY-2";
  return "PGY-3";
}

export function getCurrentBlockForDate(date: string, blocks: AcademicBlock[]) {
  return blocks.find((block) => date >= block.startDate && date <= block.endDate);
}

export function getAutoNightFloatCell({
  date,
  service,
  blocks,
  blockAssignments,
  residents,
}: {
  date: string;
  service: ScheduleService;
  blocks: AcademicBlock[];
  blockAssignments: BlockAssignment[];
  residents: Resident[];
}): MonthlyScheduleCell | undefined {
  if (!isNightFloatService(service.id)) return undefined;
  if (!isAutoNightFloatDate(service.id, date)) return undefined;

  const currentBlock = getCurrentBlockForDate(date, blocks);
  if (!currentBlock) return undefined;

  const assignment = blockAssignments.find(
    (item) =>
      item.blockId === currentBlock.id &&
      item.rotationId === service.id
  );

  if (!assignment) return undefined;

  const resident = residents.find(
    (item) => item.id === assignment.residentId && item.active
  );

  if (!resident) return undefined;

  return {
    date,
    serviceId: service.id,
    serviceName: service.name,
    residentId: resident.id,
    residentName: resident.displayName,
    training: residentTraining(resident),
    pager: resident.pager,
    shiftType: "Night",
    startTime: service.defaultStartTime,
    endTime: service.defaultEndTime,
    notes: "Auto from block schedule",
  };
}
