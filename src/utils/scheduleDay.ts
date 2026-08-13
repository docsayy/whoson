const SCHEDULE_TIME_ZONE = "America/New_York";

/**
 * Coverage changes at 7:00 AM local time. Before 7:00 AM, the operational
 * schedule date is still the previous calendar day.
 */
export function currentScheduleDate(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: SCHEDULE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const scheduleDate = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day - (parts.hour < 7 ? 1 : 0)),
  );
  return scheduleDate.toISOString().slice(0, 10);
}
