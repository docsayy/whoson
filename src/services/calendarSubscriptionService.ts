import { doc, getDoc, setDoc } from "firebase/firestore";

import { db } from "../config/firebase";

export type CalendarFeedScope = "personal" | "program";

export interface CalendarSubscriptionSettings {
  uid: string;
  token: string;
  enabled: boolean;
  scope: CalendarFeedScope;
  residentId?: string;
  attendingId?: string;
  role: string;
  displayName: string;
  includeBlocks: boolean;
  includeCalls: boolean;
  includeActiveChief: boolean;
  includeHolidays: boolean;
  includeAttendingAssignments: boolean;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function getCalendarSubscription(uid: string) {
  const snapshot = await getDoc(doc(db, "calendarSubscriptions", uid));
  if (!snapshot.exists()) return null;
  return snapshot.data() as CalendarSubscriptionSettings;
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;
}

export async function saveCalendarSubscription(
  settings: CalendarSubscriptionSettings
) {
  await setDoc(
    doc(db, "calendarSubscriptions", settings.uid),
    removeUndefined(settings as unknown as Record<string, unknown>),
    { merge: true }
  );
}

export async function createCalendarSubscription(params: {
  uid: string;
  role: string;
  displayName: string;
  residentId?: string;
  attendingId?: string;
  scope?: CalendarFeedScope;
}) {
  const now = new Date().toISOString();
  const settings: CalendarSubscriptionSettings = {
    uid: params.uid,
    token: randomToken(),
    enabled: true,
    scope: params.scope || "personal",
    residentId: params.residentId,
    attendingId: params.attendingId,
    role: params.role,
    displayName: params.displayName,
    includeBlocks: true,
    includeCalls: true,
    includeActiveChief: true,
    includeHolidays: false,
    includeAttendingAssignments: true,
    createdAt: now,
    updatedAt: now,
  };
  await saveCalendarSubscription(settings);
  return settings;
}

export async function regenerateCalendarSubscription(
  current: CalendarSubscriptionSettings
) {
  const next = {
    ...current,
    token: randomToken(),
    enabled: true,
    updatedAt: new Date().toISOString(),
  };
  await saveCalendarSubscription(next);
  return next;
}

export async function disableCalendarSubscription(
  current: CalendarSubscriptionSettings
) {
  const next = {
    ...current,
    enabled: false,
    updatedAt: new Date().toISOString(),
  };
  await saveCalendarSubscription(next);
  return next;
}

export function calendarFeedUrl(token: string) {
  return `${window.location.origin}/calendar/${encodeURIComponent(token)}.ics`;
}

export function calendarWebcalUrl(token: string) {
  return calendarFeedUrl(token).replace(/^https?:\/\//, "webcal://");
}
