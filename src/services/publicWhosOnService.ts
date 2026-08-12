import { doc, getDoc, setDoc } from "firebase/firestore";

import { db } from "../config/firebase";
import { isBirthdayOnDate } from "../utils/birthday";
import { CACHE_TTL, noteWrite, readThroughCache, setCachedValue } from "./dataCache";
import {
  getResidentCallServicesForDate,
  getServiceTimingForDate,
  normalizeScheduleText,
} from "../config/scheduleServices";
import { getAcademicBlocks } from "./blockService";
import {
  getBlockAssignments,
  getLatestPublishedAssignmentsForYear,
} from "./blockAssignmentService";
import { getMonthlySchedule } from "./monthScheduleService";
import { getResidents } from "./residentService";
import { getAttendings } from "./attendingService";
import { getAttendingScheduleAssignments } from "./attendingScheduleService";
import type { ScheduleService } from "../types/schedule";
import type {
  PublicAllServiceRow,
  PublicAttendingRow,
  PublicResidentRow,
  PublicWhoOnDay,
  PublicWhoOnMonth,
} from "../types/publicWhosOn";
import { getHospitalHoliday, isHospitalHoliday } from "../utils/holidayRules";
import {
  getAutoNightFloatCell,
  isNightFloatService,
} from "../utils/nightFloatSchedule";
import {
  attendingDisplayValues,
  canonicalAttendingServiceLabel,
  getEffectiveAttendingAssignments,
} from "../utils/attendingScheduleCanonical";

const PUBLIC_COLLECTION = "publicWhoOnMonths";

function publicCacheKey(monthId: string) {
  return `public-whos-on:${monthId}`;
}

type SharedPublicData = {
  residents: Awaited<ReturnType<typeof getResidents>>;
  attendings: Awaited<ReturnType<typeof getAttendings>>;
  blocks: Awaited<ReturnType<typeof getAcademicBlocks>>;
  allBlockAssignments: Awaited<ReturnType<typeof getBlockAssignments>>;
  attendingAssignments: Awaited<ReturnType<typeof getAttendingScheduleAssignments>>;
};

async function loadSharedPublicData(): Promise<SharedPublicData> {
  const [residents, attendings, blocks, allBlockAssignments, attendingAssignments] = await Promise.all([
    getResidents(),
    getAttendings(),
    getAcademicBlocks(),
    getBlockAssignments(),
    getAttendingScheduleAssignments(),
  ]);
  return { residents, attendings, blocks, allBlockAssignments, attendingAssignments };
}

function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedDeep(item)) as T;
  }

  if (value && typeof value === "object") {
    const cleaned = Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, removeUndefinedDeep(item)])
    );

    return cleaned as T;
  }

  return value;
}

type ResidentConsultKey =
  | "cardio-ccu"
  | "id-pgy1"
  | "id-senior"
  | "gi"
  | "endo-rheum-nephro"
  | "pulm"
  | "hem-onc"
  | "neuro";

const residentConsultRows: Array<{
  key: ResidentConsultKey;
  name: string;
  time: string;
  level: string;
}> = [
  {
    key: "cardio-ccu",
    name: "Cardio/CCU",
    time: "7a-4p",
    level: "PGY-2; PGY-3 override",
  },
  { key: "id-pgy1", name: "ID PGY1", time: "7a-4p", level: "PGY-1" },
  {
    key: "id-senior",
    name: "ID Senior",
    time: "7a-4p",
    level: "PGY-2, PGY-3",
  },
  { key: "gi", name: "GI", time: "7a-4p", level: "PGY-2" },
  {
    key: "endo-rheum-nephro",
    name: "Endo/Rheum/Nephro",
    time: "7a-4p",
    level: "PGY-3",
  },
  {
    key: "pulm",
    name: "Pulm",
    time: "7a-4p",
    level: "PGY-2, PGY-3",
  },
  { key: "hem-onc", name: "Heme-Onc", time: "7a-4p", level: "PGY-3" },
  { key: "neuro", name: "Neuro", time: "7a-4p", level: "PGY-2" },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getConsultKey(
  rotationId: string,
  residentPgy: string
): ResidentConsultKey | null {
  const id = normalize(rotationId);
  if (id === "id") return residentPgy === "PGY-1" ? "id-pgy1" : "id-senior";
  if (id === "ccucardio" || id === "cardio" || id === "cardiology") {
    return "cardio-ccu";
  }
  if (id === "gi") return "gi";
  if (id === "nephrorheumendo" || id === "endorheumnephro") {
    return "endo-rheum-nephro";
  }
  if (id === "pulm") return "pulm";
  if (id === "hemeonc") return "hem-onc";
  if (id === "neuro") return "neuro";
  return null;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isWeekday(value: string) {
  const day = parseDate(value).getDay();
  return day >= 1 && day <= 5;
}

function daysInMonth(monthId: string) {
  const [year, month] = monthId.split("-").map(Number);
  const count = new Date(year, month, 0).getDate();
  return Array.from(
    { length: count },
    (_, index) => `${monthId}-${String(index + 1).padStart(2, "0")}`
  );
}

function monthIdsInRange(startDate: string, endDate: string) {
  const start = parseDate(`${startDate.slice(0, 7)}-01`);
  const end = parseDate(`${endDate.slice(0, 7)}-01`);
  const result: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    result.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return result;
}

function academicYearForMonth(monthId: string) {
  const year = Number(monthId.slice(0, 4));
  const month = Number(monthId.slice(5, 7));
  return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

export async function getPublicWhoOnMonth(
  monthId: string,
  force = false
): Promise<PublicWhoOnMonth | null> {
  return readThroughCache(
    publicCacheKey(monthId),
    async () => {
      const snapshot = await getDoc(doc(db, PUBLIC_COLLECTION, monthId));
      if (!snapshot.exists()) return null;
      return {
        id: snapshot.id,
        ...(snapshot.data() as Omit<PublicWhoOnMonth, "id">),
      };
    },
    CACHE_TTL.public,
    force
  );
}

export async function publishPublicWhoOnMonth(
  monthId: string,
  options: { clearUnpublishedCalls?: boolean } = {},
  sharedData?: SharedPublicData
) {
  const shared = sharedData || (await loadSharedPublicData());
  const [schedule, previousPublicMonth] = await Promise.all([
    getMonthlySchedule(monthId),
    getPublicWhoOnMonth(monthId),
  ]);
  const {
    residents,
    attendings,
    blocks,
    allBlockAssignments,
    attendingAssignments,
  } = shared;

  const academicYear = academicYearForMonth(monthId);
  const publishedBlockAssignments = getLatestPublishedAssignmentsForYear(
    allBlockAssignments,
    academicYear
  );
  const residentById = new Map(residents.map((resident) => [resident.id, resident]));
  const monthlyAssignments = schedule?.assignments || {};
  const callPublished = schedule?.status === "published";
  const days: Record<string, PublicWhoOnDay> = {};

  function manualCell(date: string, service: ScheduleService) {
    const direct = monthlyAssignments[`${date}_${service.id}`];
    if (direct) return direct;

    const candidates = [
      service.id,
      service.name,
      ...(((service as unknown as { aliases?: string[] }).aliases || [])),
    ].map(normalizeScheduleText);

    return Object.values(monthlyAssignments).find(
      (cell) =>
        cell.date === date &&
        candidates.includes(normalizeScheduleText(cell.serviceName))
    );
  }

  for (const date of daysInMonth(monthId)) {
    const currentBlock = blocks.find(
      (block) => date >= block.startDate && date <= block.endDate
    );
    const activeChief = currentBlock?.activeChiefPublished || null;

    const previousDay = previousPublicMonth?.days?.[date];
    const preservePreviousCalls =
      !callPublished && !options.clearUnpublishedCalls && previousDay?.callPublished;

    const callRows: PublicResidentRow[] = callPublished
      ? getResidentCallServicesForDate(date).map((service) => {
          const manual = manualCell(date, service);
          const auto =
            !manual && isNightFloatService(service.id)
              ? getAutoNightFloatCell({
                  date,
                  service,
                  blocks,
                  blockAssignments: publishedBlockAssignments,
                  residents,
                })
              : undefined;
          const cell = manual || auto;
          const timing = getServiceTimingForDate(service, date);

          return {
            service: service.name,
            time: timing.displayTime,
            name: cell?.residentName || "",
            level:
              cell?.training || service.requiredTraining?.join(", ") || "",
            birthday: cell?.residentId
              ? isBirthdayOnDate(residentById.get(cell.residentId), date)
              : false,
          };
        })
      : preservePreviousCalls
        ? previousDay?.callRows || []
        : [];

    const consultRows: PublicResidentRow[] = [];
    if (currentBlock && isWeekday(date) && !isHospitalHoliday(date)) {
      const byKey = new Map<ResidentConsultKey, (typeof publishedBlockAssignments)[number]>();

      for (const assignment of publishedBlockAssignments) {
        if (assignment.blockId !== currentBlock.id) continue;
        const resident = residentById.get(assignment.residentId);
        if (!resident?.active) continue;
        const key = getConsultKey(assignment.rotationId, resident.pgy);
        if (key && !byKey.has(key)) byKey.set(key, assignment);
      }

      for (const row of residentConsultRows) {
        const assignment = byKey.get(row.key);
        const resident = assignment
          ? residentById.get(assignment.residentId)
          : undefined;
        consultRows.push({
          service: row.name,
          time: row.time,
          name: assignment?.residentName || "",
          level: resident?.pgy || row.level,
          birthday: isBirthdayOnDate(resident, date),
        });
      }
    }

    const allServices: PublicAllServiceRow[] = [];
    if (currentBlock) {
      const byResident = new Map<
        string,
        (typeof publishedBlockAssignments)[number]
      >();

      for (const assignment of publishedBlockAssignments) {
        if (assignment.blockId !== currentBlock.id) continue;
        const current = byResident.get(assignment.residentId);
        if (!current || current.rotationName.toLowerCase().includes("jeopardy")) {
          byResident.set(assignment.residentId, assignment);
        }
      }

      allServices.push(
        ...Array.from(byResident.values())
          .sort((a, b) => a.residentName.localeCompare(b.residentName))
          .map((assignment) => ({
            service: assignment.rotationName,
            name: assignment.residentName,
            level: residentById.get(assignment.residentId)?.pgy || "Resident",
            activeChief: activeChief?.residentId === assignment.residentId,
            birthday: isBirthdayOnDate(residentById.get(assignment.residentId), date),
          }))
      );
    }

    const admittingRows: PublicAttendingRow[] = getEffectiveAttendingAssignments({
      assignments: attendingAssignments,
      date,
      group: "Core",
    }).map(({ key, assignment }) => {
      const display = attendingDisplayValues(assignment, attendings);
      return {
        service: canonicalAttendingServiceLabel(key, assignment.serviceName),
        consultant: display.consultant,
        birthday: isBirthdayOnDate(
          attendings.find((item) => item.id === display.attendingId),
          date
        ),
        coverage:
          assignment.coverageNote ||
          `${assignment.coverageStartTime}-${assignment.coverageEndTime}`,
      };
    });

    const consultingRows: PublicAttendingRow[] = getEffectiveAttendingAssignments({
      assignments: attendingAssignments,
      date,
      group: "Specialty",
    }).map(({ key, assignment }) => {
      const display = attendingDisplayValues(assignment, attendings);
      return {
        service: canonicalAttendingServiceLabel(key, assignment.serviceName),
        consultant: display.consultant,
        birthday: isBirthdayOnDate(
          attendings.find((item) => item.id === display.attendingId),
          date
        ),
        coverage:
          assignment.coverageNote ||
          `${assignment.coverageStartTime}-${assignment.coverageEndTime}`,
      };
    });

    const holiday = getHospitalHoliday(date);

    days[date] = {
      date,
      callPublished: callPublished || Boolean(preservePreviousCalls),
      callRows,
      consultRows,
      allServices,
      admittingRows,
      consultingRows,
      ...(currentBlock && activeChief
        ? {
            activeChief: {
              blockName: currentBlock.name,
              residentName: activeChief.residentName,
              birthday: isBirthdayOnDate(
                residentById.get(activeChief.residentId),
                date
              ),
            },
          }
        : {}),
      ...(holiday
        ? {
            holiday: {
              name: holiday.name,
              note: "Weekend-style hospital coverage. Resident consult services are off.",
            },
          }
        : {}),
    };
  }

  const output: PublicWhoOnMonth = {
    id: monthId,
    month: monthId,
    updatedAt: new Date().toISOString(),
    days,
  };

  if (
    previousPublicMonth &&
    JSON.stringify(previousPublicMonth.days) === JSON.stringify(output.days)
  ) {
    noteWrite(true);
    setCachedValue(publicCacheKey(monthId), previousPublicMonth, CACHE_TTL.public);
    return previousPublicMonth;
  }

  const { id, ...data } = output;
  noteWrite();
  await setDoc(doc(db, PUBLIC_COLLECTION, id), removeUndefinedDeep(data));
  setCachedValue(publicCacheKey(id), output, CACHE_TTL.public);
  return output;
}

export async function publishPublicWhoOnMonths(
  monthIds: string[],
  options: { clearUnpublishedCalls?: boolean } = {}
) {
  const unique = Array.from(new Set(monthIds)).sort();
  if (!unique.length) return;
  const shared = await loadSharedPublicData();
  for (const monthId of unique) {
    await publishPublicWhoOnMonth(monthId, options, shared);
  }
}

export async function publishPublicWhoOnRange(
  startDate: string,
  endDate: string
) {
  await publishPublicWhoOnMonths(monthIdsInRange(startDate, endDate));
}

export async function publishPublicWhoOnAcademicYear(academicYear: string) {
  const startYear = Number(academicYear.slice(0, 4));
  if (!Number.isFinite(startYear)) return;

  const monthIds = [
    ...Array.from({ length: 6 }, (_, index) =>
      `${startYear}-${String(index + 7).padStart(2, "0")}`
    ),
    ...Array.from({ length: 6 }, (_, index) =>
      `${startYear + 1}-${String(index + 1).padStart(2, "0")}`
    ),
  ];

  await publishPublicWhoOnMonths(monthIds);
}
