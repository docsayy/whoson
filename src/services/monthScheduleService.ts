import { doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../config/firebase";
import type { MonthlySchedule } from "../types/monthSchedule";
import {
  CACHE_TTL,
  getCachedValue,
  noteWrite,
  readThroughCache,
  setCachedValue,
} from "./dataCache";

function monthlyContentEqual(a: MonthlySchedule, b: MonthlySchedule) {
  return (
    a.academicYear === b.academicYear &&
    a.month === b.month &&
    a.status === b.status &&
    JSON.stringify(a.assignments) === JSON.stringify(b.assignments)
  );
}

function cacheKey(monthId: string) {
  return `monthly-schedule:${monthId}`;
}


export function peekMonthlySchedule(monthId: string): MonthlySchedule | null | undefined {
  return getCachedValue<MonthlySchedule | null>(cacheKey(monthId));
}

export async function getMonthlySchedule(
  monthId: string,
  force = false
): Promise<MonthlySchedule | null> {
  return readThroughCache(
    cacheKey(monthId),
    async () => {
      const ref = doc(db, "scheduleMonths", monthId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      return {
        id: snap.id,
        ...(snap.data() as Omit<MonthlySchedule, "id">),
      };
    },
    CACHE_TTL.schedule,
    force
  );
}

export async function getMonthlySchedules(
  monthIds: string[],
  force = false
) {
  const unique = Array.from(new Set(monthIds));
  const schedules = await Promise.all(
    unique.map((monthId) => getMonthlySchedule(monthId, force))
  );

  return unique.reduce<Record<string, MonthlySchedule | null>>(
    (result, monthId, index) => {
      result[monthId] = schedules[index];
      return result;
    },
    {}
  );
}

export async function saveMonthlySchedule(
  schedule: MonthlySchedule
): Promise<boolean> {
  const existing = getCachedValue<MonthlySchedule | null>(cacheKey(schedule.id));
  if (existing && monthlyContentEqual(existing, schedule)) {
    noteWrite(true);
    return false;
  }

  noteWrite();
  const { id, ...data } = schedule;
  await setDoc(doc(db, "scheduleMonths", id), data);
  setCachedValue(cacheKey(id), schedule, CACHE_TTL.schedule);
  return true;
}

export async function saveMonthlySchedules(schedules: MonthlySchedule[]) {
  const changed = schedules.filter((schedule) => {
    const current = getCachedValue<MonthlySchedule | null>(cacheKey(schedule.id));
    if (current && monthlyContentEqual(current, schedule)) {
      noteWrite(true);
      return false;
    }
    return true;
  });

  for (let index = 0; index < changed.length; index += 400) {
    const batch = writeBatch(db);
    const chunk = changed.slice(index, index + 400);
    for (const schedule of chunk) {
      noteWrite();
      const { id, ...data } = schedule;
      batch.set(doc(db, "scheduleMonths", id), data);
    }
    await batch.commit();
  }

  for (const schedule of changed) {
    setCachedValue(cacheKey(schedule.id), schedule, CACHE_TTL.schedule);
  }

  return changed.length;
}
