import { useEffect, useState } from "react";
import {
  getMonthlySchedule,
  peekMonthlySchedule,
  saveMonthlySchedule,
} from "../services/monthScheduleService";
import { shouldRefreshThisSession } from "../services/dataCache";
import type {
  MonthlySchedule,
  MonthlyScheduleCell,
} from "../types/monthSchedule";

function getAcademicYearForMonth(monthId: string) {
  const year = Number(monthId.slice(0, 4));
  const month = Number(monthId.slice(5, 7));
  return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function createEmptyMonthlySchedule(monthId: string): MonthlySchedule {
  const now = new Date().toISOString();
  return {
    id: monthId,
    academicYear: getAcademicYearForMonth(monthId),
    month: monthId,
    status: "draft",
    assignments: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function useMonthlySchedule(monthId: string) {
  const cached = peekMonthlySchedule(monthId);
  const [schedule, setSchedule] = useState<MonthlySchedule | null>(
    cached === undefined ? null : cached || createEmptyMonthlySchedule(monthId)
  );
  const [loading, setLoading] = useState(cached === undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadSchedule(force = false, quiet = false) {
    try {
      if (!quiet) setLoading(true);
      setError("");
      const existing = await getMonthlySchedule(monthId, force);
      setSchedule(existing || createEmptyMonthlySchedule(monthId));
    } catch (err) {
      console.error(err);
      if (!schedule) setError("Unable to load monthly schedule.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function saveSchedule(nextSchedule: MonthlySchedule) {
    try {
      setSaving(true);
      setError("");
      const updated: MonthlySchedule = {
        ...nextSchedule,
        updatedAt: new Date().toISOString(),
      };
      await saveMonthlySchedule(updated);
      setSchedule(updated);
    } catch (err) {
      console.error(err);
      setError("Unable to save monthly schedule.");
    } finally {
      setSaving(false);
    }
  }

  async function updateCell(cell: MonthlyScheduleCell) {
    if (!schedule) return;
    const key = `${cell.date}_${cell.serviceId}`;
    await saveSchedule({
      ...schedule,
      assignments: { ...schedule.assignments, [key]: cell },
    });
  }

  async function removeCell(date: string, serviceId: string) {
    if (!schedule) return;
    const key = `${date}_${serviceId}`;
    const nextAssignments = { ...schedule.assignments };
    delete nextAssignments[key];
    await saveSchedule({ ...schedule, assignments: nextAssignments });
  }

  useEffect(() => {
    const currentCached = peekMonthlySchedule(monthId);
    if (currentCached !== undefined) {
      setSchedule(currentCached || createEmptyMonthlySchedule(monthId));
      setLoading(false);
    } else {
      setSchedule(null);
      setLoading(true);
    }
    const force = shouldRefreshThisSession(`monthly-schedule:${monthId}`);
    void loadSchedule(force, currentCached !== undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthId]);

  return {
    schedule,
    loading,
    saving,
    error,
    reloadSchedule: () => loadSchedule(true),
    saveSchedule,
    updateCell,
    removeCell,
  };
}
