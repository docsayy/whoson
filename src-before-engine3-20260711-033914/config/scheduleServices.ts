import type { ScheduleService } from "../types/schedule";
import { NIGHT_FLOAT_ROTATION_IDS } from "./rotationDefinitions";

export type ShortDutyFloorRotationId = "2n" | "tele" | "4n";

export type ResidentCallServiceDefinition = ScheduleService & {
  aliases: string[];
  displayTime: string;
  weekendOnly?: boolean;
  shortDuty?: boolean;
  floorRotationId?: ShortDutyFloorRotationId;
  dutyInstructions?: string;
};

function service(
  id: string,
  name: string,
  category: string,
  order: number,
  requiredTraining: NonNullable<ScheduleService["requiredTraining"]>,
  start: string,
  end: string,
  displayTime: string,
  aliases: string[] = [],
  extras: Partial<ResidentCallServiceDefinition> = {}
): ResidentCallServiceDefinition {
  return {
    id,
    name,
    shortName: name,
    category,
    coverageGroup: "Resident",
    attendingScheduleType: "None",
    requiredTraining,
    defaultShiftType: category === "Night" ? "Night" : "Day",
    defaultStartTime: start,
    defaultEndTime: end,
    displayOrderCall: order,
    displayOrderAll: order,
    visibleOnCall: true,
    visibleOnAllServices: true,
    active: true,
    aliases,
    displayTime,
    ...extras,
  };
}

const SHORT_DUTY_INSTRUCTIONS =
  "See assigned patients, obtain needed consults, complete notes, follow pending labs, and leave when dismissed by the covering senior.";

const servicesById: Record<string, ResidentCallServiceDefinition> = {
  "2n-ccu-pgy1": service(
    "2n-ccu-pgy1",
    "2N-CCU PGY1",
    "Day",
    1,
    ["PGY-1"],
    "07:00",
    "19:00",
    "7a-7p",
    ["2n ccu pgy1", "2n-ccu intern", "2n ccu intern"]
  ),
  "short-duty-2n-pgy1": service(
    "short-duty-2n-pgy1",
    "Short Duty 2N PGY1",
    "Short Duty",
    2,
    ["PGY-1"],
    "07:00",
    "Until dismissed",
    "Weekend only",
    [
      "short duty 2n",
      "short call 2n",
      "2n short duty",
      "2n short call",
      "mini call 2n",
    ],
    {
      weekendOnly: true,
      shortDuty: true,
      floorRotationId: "2n",
      dutyInstructions: SHORT_DUTY_INSTRUCTIONS,
    }
  ),
  "tele-pgy1": service(
    "tele-pgy1",
    "Tele PGY1",
    "Day",
    3,
    ["PGY-1"],
    "07:00",
    "19:00",
    "7a-7p",
    ["tele intern", "telemetry pgy1", "telemetry intern"]
  ),
  "short-duty-tele-pgy1": service(
    "short-duty-tele-pgy1",
    "Short Duty Tele PGY1",
    "Short Duty",
    4,
    ["PGY-1"],
    "07:00",
    "Until dismissed",
    "Weekend only",
    [
      "short duty tele",
      "short call tele",
      "tele short duty",
      "tele short call",
      "mini call tele",
    ],
    {
      weekendOnly: true,
      shortDuty: true,
      floorRotationId: "tele",
      dutyInstructions: SHORT_DUTY_INSTRUCTIONS,
    }
  ),
  "2n-ccu-pgy2": service(
    "2n-ccu-pgy2",
    "2N-CCU PGY2",
    "Day",
    5,
    ["PGY-2"],
    "07:00",
    "19:00",
    "7a-7p",
    ["2n ccu pgy2", "2n-ccu senior", "2n ccu senior"]
  ),
  "4n-pgy1": service(
    "4n-pgy1",
    "4N PGY1",
    "Day",
    6,
    ["PGY-1"],
    "07:00",
    "19:00",
    "7a-7p",
    ["4n intern", "4 north pgy1", "4 north intern"]
  ),
  "short-duty-4n-pgy1": service(
    "short-duty-4n-pgy1",
    "Short Duty 4N PGY1",
    "Short Duty",
    7,
    ["PGY-1"],
    "07:00",
    "Until dismissed",
    "Weekend only",
    [
      "short duty 4n",
      "short call 4n",
      "4n short duty",
      "4n short call",
      "mini call 4n",
    ],
    {
      weekendOnly: true,
      shortDuty: true,
      floorRotationId: "4n",
      dutyInstructions: SHORT_DUTY_INSTRUCTIONS,
    }
  ),
  "3w-pgy1": service(
    "3w-pgy1",
    "3W PGY1",
    "Day",
    8,
    ["PGY-1"],
    "07:00",
    "19:00",
    "7a-7p",
    ["3w intern", "3 west pgy1", "3 west intern"]
  ),
  "4n-3w-pgy2": service(
    "4n-3w-pgy2",
    "4N-3W PGY2",
    "Day",
    9,
    ["PGY-2"],
    "07:00",
    "19:00",
    "7a-7p",
    ["4n 3w pgy2", "4n-3w senior"]
  ),
  "micu-pgy1": service(
    "micu-pgy1",
    "MICU PGY1",
    "ICU",
    10,
    ["PGY-1"],
    "07:00",
    "07:00",
    "7a-7a",
    ["micu intern"]
  ),
  "micu-senior": service(
    "micu-senior",
    "MICU Senior",
    "ICU",
    11,
    ["PGY-2", "PGY-3"],
    "08:00",
    "08:00",
    "8a-8a",
    ["micu", "micu senior call"]
  ),
  "chief-on-call": service(
    "chief-on-call",
    "Chief On Call",
    "Chief",
    12,
    ["PGY-3"],
    "07:00",
    "19:00",
    "7a-7p",
    ["chief on call", "chief"]
  ),
  [NIGHT_FLOAT_ROTATION_IDS.pgy1TwoNorthCcu]: service(
    NIGHT_FLOAT_ROTATION_IDS.pgy1TwoNorthCcu,
    "2N-CCU PGY1 NF",
    "Night",
    13,
    ["PGY-1"],
    "19:00",
    "07:00",
    "7p-7a",
    ["2n ccu pgy1 nf", "2n-ccu intern nf", "weekend nf intern 2"]
  ),
  [NIGHT_FLOAT_ROTATION_IDS.pgy2TwoNorthCcu]: service(
    NIGHT_FLOAT_ROTATION_IDS.pgy2TwoNorthCcu,
    "2N-CCU PGY2 NF",
    "Night",
    14,
    ["PGY-2"],
    "19:00",
    "07:00",
    "7p-7a",
    ["2n ccu pgy2 nf", "2n-ccu senior nf", "weekend nf senior 2"]
  ),
  [NIGHT_FLOAT_ROTATION_IDS.pgy1FourNorthThreeWest]: service(
    NIGHT_FLOAT_ROTATION_IDS.pgy1FourNorthThreeWest,
    "4N-3W PGY1 NF",
    "Night",
    15,
    ["PGY-1"],
    "19:00",
    "07:00",
    "7p-7a",
    ["4n 3w pgy1 nf", "4n-3w intern nf", "weekend nf intern 1"]
  ),
  [NIGHT_FLOAT_ROTATION_IDS.pgy2FourNorthThreeWest]: service(
    NIGHT_FLOAT_ROTATION_IDS.pgy2FourNorthThreeWest,
    "4N-3W PGY2 NF",
    "Night",
    16,
    ["PGY-2"],
    "19:00",
    "07:00",
    "7p-7a",
    ["4n 3w pgy2 nf", "4n-3w senior nf", "weekend nf senior 1"]
  ),
  [NIGHT_FLOAT_ROTATION_IDS.pgy3]: service(
    NIGHT_FLOAT_ROTATION_IDS.pgy3,
    "PGY3 NF",
    "Night",
    17,
    ["PGY-3"],
    "19:00",
    "07:00",
    "7p-7a",
    ["night float", "pgy3 night float", "weekend pgy3 nf"]
  ),
};

const WEEKDAY_SERVICE_IDS = [
  "2n-ccu-pgy1",
  "tele-pgy1",
  "2n-ccu-pgy2",
  "4n-pgy1",
  "3w-pgy1",
  "4n-3w-pgy2",
  "micu-pgy1",
  "micu-senior",
  "chief-on-call",
  NIGHT_FLOAT_ROTATION_IDS.pgy1TwoNorthCcu,
  NIGHT_FLOAT_ROTATION_IDS.pgy2TwoNorthCcu,
  NIGHT_FLOAT_ROTATION_IDS.pgy1FourNorthThreeWest,
  NIGHT_FLOAT_ROTATION_IDS.pgy2FourNorthThreeWest,
  NIGHT_FLOAT_ROTATION_IDS.pgy3,
] as const;

const WEEKEND_SERVICE_IDS = [
  "2n-ccu-pgy1",
  "short-duty-2n-pgy1",
  "tele-pgy1",
  "short-duty-tele-pgy1",
  "2n-ccu-pgy2",
  "4n-pgy1",
  "short-duty-4n-pgy1",
  "3w-pgy1",
  "4n-3w-pgy2",
  "micu-pgy1",
  "micu-senior",
  "chief-on-call",
  NIGHT_FLOAT_ROTATION_IDS.pgy1TwoNorthCcu,
  NIGHT_FLOAT_ROTATION_IDS.pgy2TwoNorthCcu,
  NIGHT_FLOAT_ROTATION_IDS.pgy1FourNorthThreeWest,
  NIGHT_FLOAT_ROTATION_IDS.pgy2FourNorthThreeWest,
  NIGHT_FLOAT_ROTATION_IDS.pgy3,
] as const;

export const RESIDENT_CALL_SERVICES: ResidentCallServiceDefinition[] =
  WEEKEND_SERVICE_IDS.map((id) => servicesById[id]);

export function parseScheduleDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isWeekendScheduleDate(date: string) {
  const day = parseScheduleDate(date).getDay();
  return day === 0 || day === 6;
}

export function isSundayScheduleDate(date: string) {
  return parseScheduleDate(date).getDay() === 0;
}

export function getResidentCallServicesForDate(date: string) {
  const ids = isWeekendScheduleDate(date)
    ? WEEKEND_SERVICE_IDS
    : WEEKDAY_SERVICE_IDS;
  return ids.map((id) => servicesById[id]);
}

export function isShortDutyService(
  service: ScheduleService
): service is ResidentCallServiceDefinition {
  return Boolean((service as ResidentCallServiceDefinition).shortDuty);
}

export function isServiceAvailableOnDate(
  service: ScheduleService,
  date: string
) {
  const definition = service as ResidentCallServiceDefinition;
  return !definition.weekendOnly || isWeekendScheduleDate(date);
}

export function getServiceTimingForDate(
  service: ScheduleService,
  date: string
) {
  const definition = service as ResidentCallServiceDefinition;
  const isSunday = isSundayScheduleDate(date);
  const isWeekend = isWeekendScheduleDate(date);

  if (definition.shortDuty) {
    return {
      startTime: isSunday ? "06:30" : "07:00",
      endTime: "Until dismissed",
      displayTime: isSunday
        ? "6:30a-until dismissed"
        : "7a-until dismissed",
    };
  }

  const isStandardDayCall =
    definition.defaultShiftType !== "Night" &&
    !definition.id.startsWith("micu-");

  if (isWeekend && isStandardDayCall) {
    return {
      startTime: isSunday ? "06:30" : "07:00",
      endTime: "19:00",
      displayTime: isSunday ? "6:30a-7p" : "7a-7p",
    };
  }

  return {
    startTime: definition.defaultStartTime,
    endTime: definition.defaultEndTime,
    displayTime: definition.displayTime,
  };
}

export function normalizeScheduleText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findResidentCallService(value: string) {
  const normalized = normalizeScheduleText(value);

  return Object.values(servicesById).find((item) => {
    const candidates = [item.id, item.name, item.shortName, ...item.aliases];
    return candidates.some(
      (candidate) => normalizeScheduleText(candidate) === normalized
    );
  });
}
