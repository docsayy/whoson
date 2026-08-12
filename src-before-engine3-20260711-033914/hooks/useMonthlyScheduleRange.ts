import { useEffect, useMemo, useState } from "react";
import {
  getMonthlySchedules,
  saveMonthlySchedule,
  saveMonthlySchedules,
} from "../services/monthScheduleService";
import type {
  MonthlySchedule,
  MonthlyScheduleCell,
} from "../types/monthSchedule";

function academicYearForMonth(monthId: string) {
  const year = Number(monthId.slice(0, 4));
  const month = Number(monthId.slice(5, 7));
  return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function emptySchedule(monthId: string): MonthlySchedule {
  const now = new Date().toISOString();
  return {
    id: monthId,
    academicYear: academicYearForMonth(monthId),
    month: monthId,
    status: "draft",
    assignments: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function useMonthlyScheduleRange(monthIds: string[]) {
  const stableMonthIds = useMemo(
    () => Array.from(new Set(monthIds)).sort(),
    [monthIds.join("|")]
  );

  const [schedules, setSchedules] = useState<Record<string, MonthlySchedule>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadSchedules() {
    try {
      setLoading(true);
      setError("");
      const loaded = await getMonthlySchedules(stableMonthIds);
      const next: Record<string, MonthlySchedule> = {};

      for (const monthId of stableMonthIds) {
        next[monthId] = loaded[monthId] || emptySchedule(monthId);
      }

      setSchedules(next);
    } catch (err) {
      console.error(err);
      setError("Unable to load the call schedule range.");
    } finally {
      setLoading(false);
    }
  }

  async function saveOne(schedule: MonthlySchedule) {
    const updated = {
      ...schedule,
      updatedAt: new Date().toISOString(),
    };

    await saveMonthlySchedule(updated);
    setSchedules((current) => ({ ...current, [updated.id]: updated }));
  }

  async function updateCell(cell: MonthlyScheduleCell) {
    const monthId = cell.date.slice(0, 7);
    const schedule = schedules[monthId] || emptySchedule(monthId);
    const key = `${cell.date}_${cell.serviceId}`;

    try {
      setSaving(true);
      setError("");
      await saveOne({
        ...schedule,
        assignments: {
          ...schedule.assignments,
          [key]: cell,
        },
      });
    } catch (err) {
      console.error(err);
      setError("Unable to save the call assignment.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCell(date: string, serviceId: string) {
    const monthId = date.slice(0, 7);
    const schedule = schedules[monthId] || emptySchedule(monthId);
    const assignments = { ...schedule.assignments };
    delete assignments[`${date}_${serviceId}`];

    try {
      setSaving(true);
      setError("");
      await saveOne({ ...schedule, assignments });
    } catch (err) {
      console.error(err);
      setError("Unable to remove the call assignment.");
    } finally {
      setSaving(false);
    }
  }

  async function setRangeStatus(status: MonthlySchedule["status"]) {
    try {
      setSaving(true);
      setError("");
      const now = new Date().toISOString();
      const next = stableMonthIds.map((monthId) => ({
        ...(schedules[monthId] || emptySchedule(monthId)),
        status,
        updatedAt: now,
      }));

      await saveMonthlySchedules(next);
      setSchedules(Object.fromEntries(next.map((item) => [item.id, item])));
    } catch (err) {
      console.error(err);
      setError("Unable to update the publish status.");
    } finally {
      setSaving(false);
    }
  }

  async function importCells(
    cells: MonthlyScheduleCell[],
    replaceDifferent: boolean
  ) {
    try {
      setSaving(true);
      setError("");
      const nextSchedules: Record<string, MonthlySchedule> = { ...schedules };

      for (const cell of cells) {
        const monthId = cell.date.slice(0, 7);
        const schedule = nextSchedules[monthId] || emptySchedule(monthId);
        const key = `${cell.date}_${cell.serviceId}`;
        const existing = schedule.assignments[key];

        if (existing && existing.residentId !== cell.residentId && !replaceDifferent) {
          continue;
        }

        nextSchedules[monthId] = {
          ...schedule,
          status: "draft",
          assignments: {
            ...schedule.assignments,
            [key]: cell,
          },
          updatedAt: new Date().toISOString(),
        };
      }

      const changed = Object.values(nextSchedules).filter((schedule) =>
        cells.some((cell) => cell.date.slice(0, 7) === schedule.id)
      );

      await saveMonthlySchedules(changed);
      setSchedules(nextSchedules);
    } catch (err) {
      console.error(err);
      setError("Unable to import call assignments.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadSchedules();
  }, [stableMonthIds.join("|")]);

  const assignments = useMemo(
    () =>
      Object.values(schedules).reduce<Record<string, MonthlyScheduleCell>>(
        (result, schedule) => ({ ...result, ...schedule.assignments }),
        {}
      ),
    [schedules]
  );

  const allPublished =
    stableMonthIds.length > 0 &&
    stableMonthIds.every((monthId) => schedules[monthId]?.status === "published");

  return {
    schedules,
    assignments,
    loading,
    saving,
    error,
    allPublished,
    reloadSchedules: loadSchedules,
    updateCell,
    removeCell,
    setRangeStatus,
    importCells,
  };
}
