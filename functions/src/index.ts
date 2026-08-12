import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { DateTime } from "luxon";

initializeApp();
const db = getFirestore();
const ZONE = "America/New_York";

const FALLBACK_2026_HOLIDAYS = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-01-19", name: "Martin Luther King Jr. Day" },
  { date: "2026-02-16", name: "Presidents Day" },
  { date: "2026-05-25", name: "Memorial Day" },
  { date: "2026-06-19", name: "Juneteenth" },
  { date: "2026-07-03", name: "Independence Day (Observed)" },
  { date: "2026-09-07", name: "Labor Day" },
  { date: "2026-11-26", name: "Thanksgiving Day" },
  { date: "2026-12-25", name: "Christmas Day" },
];

type Subscription = {
  uid: string;
  token: string;
  enabled: boolean;
  scope?: "personal" | "program";
  includeBlocks?: boolean;
  includeCalls?: boolean;
  includeActiveChief?: boolean;
  includeHolidays?: boolean;
  includeAttendingAssignments?: boolean;
};

type UserProfile = {
  displayName?: string;
  role?: string;
  residentId?: string;
  attendingId?: string;
  active?: boolean;
  approved?: boolean;
};

type CalendarEvent = {
  uid: string;
  summary: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  startDateTime?: string;
  endDateTime?: string;
  lastModified?: string;
  categories?: string[];
};

function escapeIcs(value: unknown) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldLine(line: string) {
  const max = 72;
  if (line.length <= max) return line;
  const parts: string[] = [];
  let remaining = line;
  while (remaining.length > max) {
    parts.push(remaining.slice(0, max));
    remaining = ` ${remaining.slice(max)}`;
  }
  parts.push(remaining);
  return parts.join("\r\n");
}

function dateOnly(value: string) {
  return value.replace(/-/g, "");
}

function nextDate(value: string) {
  return DateTime.fromISO(value, { zone: ZONE }).plus({ days: 1 }).toISODate() || value;
}

function utcDateTime(date: string, time: string) {
  return DateTime.fromISO(`${date}T${time}`, { zone: ZONE })
    .toUTC()
    .toFormat("yyyyMMdd'T'HHmmss'Z'");
}

function isoToUtcStamp(value?: string) {
  if (!value) return undefined;
  const parsed = DateTime.fromISO(value, { setZone: true });
  if (!parsed.isValid) return undefined;
  return parsed.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
}

function eventLines(event: CalendarEvent, nowStamp: string) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeIcs(event.uid)}`,
    `DTSTAMP:${nowStamp}`,
    `SUMMARY:${escapeIcs(event.summary)}`,
  ];

  if (event.startDate) {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(event.startDate)}`);
    if (event.endDate) lines.push(`DTEND;VALUE=DATE:${dateOnly(event.endDate)}`);
  } else if (event.startDateTime) {
    lines.push(`DTSTART:${event.startDateTime}`);
    if (event.endDateTime) lines.push(`DTEND:${event.endDateTime}`);
  }

  if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  if (event.lastModified) lines.push(`LAST-MODIFIED:${event.lastModified}`);
  if (event.categories?.length) {
    lines.push(`CATEGORIES:${event.categories.map(escapeIcs).join(",")}`);
  }
  lines.push("STATUS:CONFIRMED", "TRANSP:OPAQUE", "END:VEVENT");
  return lines;
}

function latestPublishedAssignments(records: Array<Record<string, unknown>>) {
  const versions = new Map<string, number>();
  for (const record of records) {
    if (record.status !== "published") continue;
    const academicYear = String(record.academicYear || "unknown");
    const version = Number(record.version || 1);
    versions.set(academicYear, Math.max(versions.get(academicYear) || 0, version));
  }

  return records.filter((record) => {
    if (record.status !== "published") return false;
    const academicYear = String(record.academicYear || "unknown");
    return Number(record.version || 1) === versions.get(academicYear);
  });
}

async function buildEvents(
  subscription: Subscription,
  profile: UserProfile
): Promise<CalendarEvent[]> {
  const isProgram = subscription.scope === "program";
  const events: CalendarEvent[] = [];

  const blocksSnapshot = await db.collection("academicBlocks").get();
  const blocks: Array<Record<string, unknown> & { id: string }> = blocksSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const blockById = new Map(blocks.map((block) => [String(block.id), block]));

  if (subscription.includeBlocks !== false) {
    const blockQuery = isProgram
      ? db.collection("blockAssignments")
      : db.collection("blockAssignments").where("residentId", "==", profile.residentId || "__none__");
    const snapshot = await blockQuery.get();
    const records = latestPublishedAssignments(
      snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    );

    for (const assignment of records) {
      const block = blockById.get(String(assignment.blockId || ""));
      if (!block) continue;
      const residentSuffix = isProgram ? ` — ${String(assignment.residentName || "Resident")}` : "";
      events.push({
        uid: `block-${String(assignment.id)}@whosonfhmc`,
        summary: `${String(assignment.rotationName || "Block Rotation")}${residentSuffix}`,
        description: [
          `Academic block ${String(assignment.blockNumber || "")}`,
          isProgram ? `Resident: ${String(assignment.residentName || "")}` : "",
          assignment.override ? `Coverage override: ${String(assignment.overrideReason || "Yes")}` : "",
          String(assignment.notes || ""),
        ]
          .filter(Boolean)
          .join("\n"),
        startDate: String(block.startDate || ""),
        endDate: nextDate(String(block.endDate || "")),
        lastModified: isoToUtcStamp(String(assignment.updatedAt || "")),
        categories: ["Block Rotation"],
      });
    }
  }

  if (subscription.includeCalls !== false) {
    const monthsSnapshot = await db.collection("scheduleMonths").get();
    for (const monthDoc of monthsSnapshot.docs) {
      const month = monthDoc.data();
      if (month.status !== "published") continue;
      const assignments = (month.assignments || {}) as Record<string, Record<string, unknown>>;

      for (const [key, cell] of Object.entries(assignments)) {
        if (!isProgram && cell.residentId !== profile.residentId) continue;
        const date = String(cell.date || key.slice(0, 10));
        const startTime = String(cell.startTime || "");
        const endTime = String(cell.endTime || "");
        if (!date || !startTime) continue;

        const residentSuffix = isProgram ? ` — ${String(cell.residentName || "Resident")}` : "";
        let endDateTime: string | undefined;
        if (endTime && !endTime.toLowerCase().includes("dismiss")) {
          const start = DateTime.fromISO(`${date}T${startTime}`, { zone: ZONE });
          let end = DateTime.fromISO(`${date}T${endTime}`, { zone: ZONE });
          if (end <= start) end = end.plus({ days: 1 });
          endDateTime = end.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
        }

        const shortDuty = String(cell.serviceName || "").toLowerCase().includes("short duty");
        events.push({
          uid: `call-${monthDoc.id}-${key}@whosonfhmc`,
          summary: `${String(cell.serviceName || "Call")}${residentSuffix}`,
          description: [
            isProgram ? `Resident: ${String(cell.residentName || "")}` : "",
            shortDuty
              ? "Report at the listed time. Complete patient evaluation, consults, notes, and lab follow-up; leave when dismissed by the covering senior."
              : "Published resident call assignment.",
            String(cell.notes || ""),
          ]
            .filter(Boolean)
            .join("\n"),
          startDateTime: utcDateTime(date, startTime),
          endDateTime,
          lastModified: isoToUtcStamp(String(month.updatedAt || "")),
          categories: shortDuty ? ["Short Duty"] : ["Call"],
        });
      }
    }
  }

  if (subscription.includeActiveChief !== false) {
    for (const block of blocks) {
      const chief = block.activeChiefPublished as
        | { residentId?: string; residentName?: string; updatedAt?: string }
        | undefined;
      if (!chief?.residentId) continue;
      if (!isProgram && chief.residentId !== profile.residentId) continue;
      events.push({
        uid: `active-chief-${String(block.id)}-${chief.residentId}@whosonfhmc`,
        summary: isProgram
          ? `Active Chief — ${chief.residentName || "Chief Resident"}`
          : "Active Chief",
        description: "Block-level chief responsibility. This does not replace the resident's normal rotation.",
        startDate: String(block.startDate || ""),
        endDate: nextDate(String(block.endDate || "")),
        lastModified: isoToUtcStamp(chief.updatedAt),
        categories: ["Active Chief"],
      });
    }
  }

  if (subscription.includeAttendingAssignments !== false) {
    const attendingSnapshot = await db.collection("attendingScheduleAssignments").get();
    for (const doc of attendingSnapshot.docs) {
      const assignment = doc.data();
      if (assignment.archived) continue;
      if (!isProgram && assignment.attendingId !== profile.attendingId) continue;
      if (!isProgram && !profile.attendingId) continue;
      const attendingSuffix = isProgram
        ? ` — ${String(assignment.attendingName || "Attending")}`
        : "";
      events.push({
        uid: `attending-${doc.id}@whosonfhmc`,
        summary: `${String(assignment.serviceName || "Attending Coverage")}${attendingSuffix}`,
        description: [
          isProgram ? `Attending: ${String(assignment.attendingName || "")}` : "",
          String(assignment.coverageNote || ""),
          String(assignment.notes || ""),
        ]
          .filter(Boolean)
          .join("\n"),
        startDate: String(assignment.startDate || ""),
        endDate: nextDate(String(assignment.endDate || "")),
        lastModified: isoToUtcStamp(String(assignment.updatedAt || "")),
        categories: ["Attending Coverage"],
      });
    }
  }

  if (subscription.includeHolidays) {
    const holidaySnapshot = await db.collection("hospitalHolidays").get();
    const holidays = holidaySnapshot.empty
      ? FALLBACK_2026_HOLIDAYS
      : holidaySnapshot.docs
          .map((doc) => doc.data() as { date?: string; name?: string; active?: boolean })
          .filter((holiday) => holiday.active !== false && holiday.date && holiday.name)
          .map((holiday) => ({ date: holiday.date as string, name: holiday.name as string }));

    for (const holiday of holidays) {
      events.push({
        uid: `holiday-${holiday.date}@whosonfhmc`,
        summary: `Hospital Holiday — ${holiday.name}`,
        description: "Hospital-observed holiday. Weekend-style coverage rules apply.",
        startDate: holiday.date,
        endDate: nextDate(holiday.date),
        categories: ["Hospital Holiday"],
      });
    }
  }

  return Array.from(new Map(events.map((event) => [event.uid, event])).values()).sort(
    (a, b) =>
      String(a.startDate || a.startDateTime).localeCompare(
        String(b.startDate || b.startDateTime)
      )
  );
}

export const calendarFeed = onRequest(
  {
    region: "us-east1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: false,
  },
  async (request, response) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.status(405).send("Method not allowed");
        return;
      }

      const match = request.path.match(/\/calendar\/([a-f0-9]{64})\.ics$/i);
      const token = match?.[1];
      if (!token) {
        response.status(404).send("Calendar feed not found");
        return;
      }

      const subscriptionSnapshot = await db
        .collection("calendarSubscriptions")
        .where("token", "==", token)
        .limit(1)
        .get();
      if (subscriptionSnapshot.empty) {
        response.status(404).send("Calendar feed not found");
        return;
      }

      const subscriptionDoc = subscriptionSnapshot.docs[0];
      const subscription = subscriptionDoc.data() as Subscription;
      if (!subscription.enabled) {
        response.status(410).send("Calendar feed disabled");
        return;
      }

      const userSnapshot = await db.collection("users").doc(subscription.uid).get();
      if (!userSnapshot.exists) {
        response.status(404).send("Calendar owner not found");
        return;
      }
      const profile = userSnapshot.data() as UserProfile;
      if (profile.active === false || profile.approved === false) {
        response.status(403).send("Calendar owner is inactive");
        return;
      }

      const builderRoles = new Set(["admin", "chief resident", "program coordinator"]);
      if (
        subscription.scope === "program" &&
        !builderRoles.has(String(profile.role || "").toLowerCase())
      ) {
        response.status(403).send("Program feed permission denied");
        return;
      }

      const events = await buildEvents(subscription, profile);
      const nowStamp = DateTime.utc().toFormat("yyyyMMdd'T'HHmmss'Z'");
      const calendarName =
        subscription.scope === "program"
          ? "WhosOn Published Program Schedule"
          : `WhosOn — ${profile.displayName || "My Schedule"}`;
      const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//WhosOn FHMC//Scheduling Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        `X-WR-CALNAME:${escapeIcs(calendarName)}`,
        `X-WR-TIMEZONE:${ZONE}`,
        ...events.flatMap((event) => eventLines(event, nowStamp)),
        "END:VCALENDAR",
      ];
      const body = lines.map(foldLine).join("\r\n") + "\r\n";

      await subscriptionDoc.ref.set(
        { lastAccessedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );

      response.set("Content-Type", "text/calendar; charset=utf-8");
      response.set("Cache-Control", "private, max-age=300, must-revalidate");
      if (request.query.download === "1") {
        response.set(
          "Content-Disposition",
          'attachment; filename="whoson-calendar.ics"'
        );
      }
      if (request.method === "HEAD") response.status(200).end();
      else response.status(200).send(body);
    } catch (error) {
      console.error("Calendar feed error", error);
      response.status(500).send("Unable to generate calendar feed");
    }
  }
);

// ---------------------------------------------------------------------------
// External RSB schedule bridge
// ---------------------------------------------------------------------------
import { getAuth } from "firebase-admin/auth";
import { defineSecret } from "firebase-functions/params";

const RSB_EMAIL = defineSecret("RSB_SCHEDULE_EMAIL");
const RSB_PASSWORD = defineSecret("RSB_SCHEDULE_PASSWORD");
const RSB_BASE_URL = "https://schedule.rsbtest.xyz";

function setExternalCors(res: any) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}
async function requireExternalManager(req: any) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) throw new Error("UNAUTHENTICATED");
  const decoded = await getAuth().verifyIdToken(header.slice(7));
  const profile = (await db.collection("users").doc(decoded.uid).get()).data() || {};
  const role = String(profile.role || "").trim().toLowerCase();
  if (!["admin", "chief resident", "program coordinator"].includes(role)) throw new Error("FORBIDDEN");
  return { uid: decoded.uid, email: decoded.email || "", role };
}
function externalCookieHeader(headers: Headers) {
  const values = typeof (headers as any).getSetCookie === "function"
    ? (headers as any).getSetCookie()
    : [headers.get("set-cookie")].filter(Boolean);
  return values.map((value: string) => value.split(";", 1)[0]).join("; ");
}
async function externalJson(path: string, cookie: string) {
  const response = await fetch(`${RSB_BASE_URL}${path}`, { headers: { Accept: "application/json", Cookie: cookie } });
  const text = await response.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`RSB ${path} returned ${response.status}: ${typeof body === "string" ? body.slice(0,180) : JSON.stringify(body).slice(0,180)}`);
  return body;
}
async function loginExternalSchedule() {
  const response = await fetch(`${RSB_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: RSB_EMAIL.value(), password: RSB_PASSWORD.value() }),
    redirect: "manual",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`External schedule login failed (${response.status}). ${text.slice(0,160)}`);
  const cookie = externalCookieHeader(response.headers);
  if (!cookie) throw new Error("External schedule login succeeded but no session cookie was returned.");
  return cookie;
}
function externalCount(value: any): number {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== "object") return value == null ? 0 : 1;
  for (const key of ["assignments","blocks","residents","coverage","items","data","absences","services"]) {
    if (Array.isArray(value[key])) return value[key].length;
  }
  return Object.keys(value).length;
}
export const externalScheduleSync = onRequest(
  { secrets: [RSB_EMAIL, RSB_PASSWORD], timeoutSeconds: 60, memory: "512MiB" },
  async (req, res) => {
    setExternalCors(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    try {
      const actor = await requireExternalManager(req);
      if (req.method === "GET") {
        const status = await db.collection("externalScheduleSync").doc("status").get();
        res.json({ ok: true, status: status.exists ? status.data() : null }); return;
      }
      if (req.method !== "POST") { res.status(405).json({ ok:false,error:"Method not allowed" }); return; }
      const today = DateTime.now().setZone(ZONE).toISODate()!;
      const start = String(req.body?.start || DateTime.fromISO(today).startOf("month").toISODate());
      const end = String(req.body?.end || DateTime.fromISO(today).endOf("month").toISODate());
      const syncId = new Date().toISOString().replace(/[:.]/g, "-");
      const cookie = await loginExternalSchedule();
      const paths: Record<string,string> = {
        cohorts:"/api/cohorts",
        blockSchedule:"/api/block-schedule",
        callSchedule:`/api/call-schedule?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        attendingCoverage:`/api/attending-coverage?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        absences:`/api/absences?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        residentServices:`/api/service-assignments?kind=resident&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        attendingServices:`/api/service-assignments?kind=attending&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      };
      const results = await Promise.all(Object.entries(paths).map(async ([name,path]) => {
        try { return {name,path,ok:true,data:await externalJson(path,cookie)}; }
        catch(error) { return {name,path,ok:false,error:error instanceof Error?error.message:String(error)}; }
      }));
      const batch=db.batch(); const run=db.collection("externalScheduleSyncRuns").doc(syncId); const summary:Record<string,unknown>={};
      for (const result of results) {
        summary[result.name]=result.ok?{ok:true,count:externalCount((result as any).data)}:{ok:false,error:(result as any).error};
        const payload=result.ok?(result as any).data:{error:(result as any).error}; const serialized=JSON.stringify(payload);
        batch.set(run.collection("datasets").doc(result.name), serialized.length<850000
          ? {ok:result.ok,path:result.path,data:payload}
          : {ok:result.ok,path:result.path,omitted:true,bytes:serialized.length,preview:serialized.slice(0,10000)});
      }
      batch.set(run,{syncId,start,end,actor,summary,createdAt:FieldValue.serverTimestamp(),source:RSB_BASE_URL});
      batch.set(db.collection("externalScheduleSync").doc("status"),{lastSyncId:syncId,start,end,actor,summary,updatedAt:FieldValue.serverTimestamp(),source:RSB_BASE_URL});
      await batch.commit(); res.json({ok:true,syncId,start,end,summary});
    } catch(error) {
      const message=error instanceof Error?error.message:String(error);
      res.status(message==="UNAUTHENTICATED"?401:message==="FORBIDDEN"?403:500).json({ok:false,error:message});
    }
  }
);
