import { useEffect, useMemo, useState } from "react";

import { getMonthlySchedules } from "../services/monthScheduleService";
import type { MonthlySchedule } from "../types/monthSchedule";

export function getAcademicYearMonths(academicYear: string) {
  const startYear = Number(academicYear.slice(0, 4));
  if (!Number.isFinite(startYear)) return [];

  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(startYear, 6 + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

export function useAcademicYearSchedules(academicYear: string) {
  const monthIds = useMemo(
    () => getAcademicYearMonths(academicYear),
    [academicYear]
  );
  const [schedules, setSchedules] = useState<
    Record<string, MonthlySchedule | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSchedules() {
    try {
      setLoading(true);
      setError("");
      setSchedules(await getMonthlySchedules(monthIds));
    } catch (loadError) {
      console.error(loadError);
      setError("Unable to load academic-year call totals.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSchedules();
  }, [academicYear]);

  return {
    monthIds,
    schedules,
    loading,
    error,
    reloadSchedules: loadSchedules,
  };
}
