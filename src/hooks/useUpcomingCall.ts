import { useEffect, useState } from "react";

import { getMonthlySchedules } from "../services/monthScheduleService";
import type { MonthlyScheduleCell } from "../types/monthSchedule";

function monthId(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function useUpcomingCall(residentId?: string) {
  const [nextCall, setNextCall] = useState<MonthlyScheduleCell | null>(null);

  useEffect(() => {
    if (!residentId) {
      setNextCall(null);
      return;
    }

    let active = true;
    const current = new Date();
    const next = new Date(current);
    next.setMonth(next.getMonth() + 1);

    void getMonthlySchedules([monthId(current), monthId(next)])
      .then((schedules) => {
        if (!active) return;
        const today = dateString(current);
        const calls = Object.values(schedules)
          .filter((schedule) => schedule?.status === "published")
          .flatMap((schedule) => Object.values(schedule?.assignments || {}))
          .filter(
            (cell) => cell.residentId === residentId && cell.date >= today
          )
          .sort((a, b) =>
            a.date === b.date
              ? a.startTime.localeCompare(b.startTime)
              : a.date.localeCompare(b.date)
          );
        setNextCall(calls[0] || null);
      })
      .catch((error) => console.warn("Unable to load upcoming call reminder.", error));

    return () => {
      active = false;
    };
  }, [residentId]);

  return nextCall;
}
