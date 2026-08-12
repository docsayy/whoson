import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import type { MonthlySchedule } from "../types/monthSchedule";

export async function getMonthlySchedule(
  monthId: string
): Promise<MonthlySchedule | null> {
  const ref = doc(db, "scheduleMonths", monthId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...(snap.data() as Omit<MonthlySchedule, "id">),
  };
}

export async function getMonthlySchedules(monthIds: string[]) {
  const unique = Array.from(new Set(monthIds));
  const schedules = await Promise.all(unique.map(getMonthlySchedule));

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
): Promise<void> {
  const { id, ...data } = schedule;
  await setDoc(doc(db, "scheduleMonths", id), data);
}

export async function saveMonthlySchedules(schedules: MonthlySchedule[]) {
  await Promise.all(schedules.map(saveMonthlySchedule));
}
