import { useEffect, useState } from "react";
import {
  getMonthlySchedule,
  saveMonthlySchedule,
} from "../services/monthScheduleService";
import type {
  MonthlySchedule,
  MonthlyScheduleCell,
} from "../types/monthSchedule";

function getAcademicYearForMonth(monthId: string) {
  const year = Number(monthId.slice(0, 4));
  const month = Number(monthId.slice(5, 7));

  if (month >= 7) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
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
  const [schedule, setSchedule] = useState<MonthlySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadSchedule() {
    try {
      setLoading(true);
      setError("");

      const existing = await getMonthlySchedule(monthId);

      if (existing) {
        setSchedule(existing);
      } else {
        setSchedule(createEmptyMonthlySchedule(monthId));
      }
    } catch (err) {
      console.error(err);
      setError("Unable to load monthly schedule.");
    } finally {
      setLoading(false);
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
      assignments: {
        ...schedule.assignments,
        [key]: cell,
      },
    });
  }

  async function removeCell(date: string, serviceId: string) {
    if (!schedule) return;

    const key = `${date}_${serviceId}`;
    const nextAssignments = { ...schedule.assignments };
    delete nextAssignments[key];

    await saveSchedule({
      ...schedule,
      assignments: nextAssignments,
    });
  }

  useEffect(() => {
    loadSchedule();
  }, [monthId]);

  return {
    schedule,
    loading,
    saving,
    error,
    reloadSchedule: loadSchedule,
    saveSchedule,
    updateCell,
    removeCell,
  };
}