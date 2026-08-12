interface Env {
  SOURCE_SCHEDULER_EMAIL: string;
  SOURCE_SCHEDULER_PASSWORD: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  MANUAL_SYNC_TOKEN: string;
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type FirestoreFields = Record<string, { [key: string]: unknown }>;

const SOURCE_BASE_URL = "https://schedule.rsbtest.xyz";
const SOURCE_ORIGIN = new URL(SOURCE_BASE_URL).origin;
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

function pemBytes(pem: string) {
  const normalized = pem.replace(/\\n/g, "\n");
  const body = normalized.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function googleAccessToken(env: Env) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(utf8(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = base64Url(utf8(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: FIRESTORE_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })));
  const input = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(env.FIREBASE_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, utf8(input));
  const assertion = `${input}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !body.access_token) throw new Error(body.error_description || "GOOGLE_TOKEN_FAILED");
  return body.access_token;
}

function cookieHeader(headers: Headers) {
  const extended = headers as Headers & { getSetCookie?: () => string[] };
  const values = extended.getSetCookie?.() || (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function sourceLogin(env: Env) {
  const response = await fetch(`${SOURCE_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      origin: SOURCE_ORIGIN,
      referer: `${SOURCE_ORIGIN}/`,
    },
    body: JSON.stringify({ email: env.SOURCE_SCHEDULER_EMAIL, password: env.SOURCE_SCHEDULER_PASSWORD }),
  });
  if (!response.ok) throw new Error(`SOURCE_LOGIN_${response.status}:${(await response.text()).slice(0, 160)}`);
  const cookie = cookieHeader(response.headers);
  if (!cookie) throw new Error("SOURCE_SESSION_COOKIE_MISSING");
  return cookie;
}

async function sourceJson(path: string, cookie: string): Promise<JsonValue> {
  const response = await fetch(`${SOURCE_BASE_URL}${path}`, {
    headers: { accept: "application/json", cookie, origin: SOURCE_ORIGIN, referer: `${SOURCE_ORIGIN}/` },
  });
  if (!response.ok) throw new Error(`SOURCE_${response.status}:${(await response.text()).slice(0, 180)}`);
  return await response.json() as JsonValue;
}

function dateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function firestoreValue(value: JsonValue): { [key: string]: unknown } {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  return { mapValue: { fields: firestoreFields(value) } };
}

function firestoreFields(value: { [key: string]: JsonValue }): FirestoreFields {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreValue(item)]));
}

function documentName(env: Env, collection: string, id: string) {
  return `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${id}`;
}

async function commitWrites(env: Env, token: string, writes: Array<{ collection: string; id: string; data: { [key: string]: JsonValue } }>) {
  for (let index = 0; index < writes.length; index += 300) {
    const chunk = writes.slice(index, index + 300);
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          writes: chunk.map((write) => ({
            update: { name: documentName(env, write.collection, write.id), fields: firestoreFields(write.data) },
          })),
        }),
      }
    );
    if (!response.ok) throw new Error(`FIRESTORE_${response.status}:${(await response.text()).slice(0, 240)}`);
  }
}

function array(value: JsonValue, key?: string): JsonValue[] {
  if (Array.isArray(value)) return value;
  if (key && value && !Array.isArray(value) && typeof value === "object") {
    const child = value[key];
    return Array.isArray(child) ? child : [];
  }
  return [];
}

async function runSync(env: Env) {
  const startedAt = new Date().toISOString();
  const today = new Date(`${dateValue(new Date())}T00:00:00Z`);
  const start = dateValue(addDays(today, -45));
  const end = dateValue(addDays(today, 400));
  const qs = `start=${start}&end=${end}`;
  const cookie = await sourceLogin(env);
  const paths = {
    blockSchedule: "/api/block-schedule",
    callSchedule: `/api/call-schedule?${qs}`,
    attendingCoverage: `/api/attending-coverage?${qs}`,
    absences: `/api/absences?${qs}`,
    lectures: `/api/lectures?${qs}`,
    inpatientServices: `/api/service-assignments?kind=inpatient&${qs}`,
    clinicServices: `/api/service-assignments?kind=clinic&${qs}`,
  } as const;
  const entries = await Promise.all(Object.entries(paths).map(async ([name, path]) => [name, await sourceJson(path, cookie)] as const));
  const datasets = Object.fromEntries(entries) as Record<string, JsonValue>;
  const writes: Array<{ collection: string; id: string; data: { [key: string]: JsonValue } }> = [];

  const blocks = datasets.blockSchedule as { [key: string]: JsonValue };
  writes.push({ collection: "sourceScheduleCache", id: "blockSchedule", data: { ...blocks, syncedAt: startedAt } });

  for (const day of array(datasets.callSchedule, "days")) {
    const item = day as { [key: string]: JsonValue };
    writes.push({ collection: "sourceCallDays", id: String(item.date), data: { ...item, syncedAt: startedAt } });
  }
  for (const kind of ["inpatientServices", "clinicServices"] as const) {
    for (const day of array(datasets[kind], "days")) {
      const item = day as { [key: string]: JsonValue };
      writes.push({ collection: "sourceServiceDays", id: `${kind === "inpatientServices" ? "inpatient" : "clinic"}_${item.date}`, data: { ...item, kind: kind === "inpatientServices" ? "inpatient" : "clinic", syncedAt: startedAt } });
    }
  }
  for (const [name, collection, dateField] of [["attendingCoverage", "sourceAttendingDays", "start_date"], ["absences", "sourceAbsenceDays", "start_date"], ["lectures", "sourceLectureDays", "date"]] as const) {
    const grouped = new Map<string, JsonValue[]>();
    for (const raw of array(datasets[name])) {
      const item = raw as { [key: string]: JsonValue };
      const date = String(item[dateField] || "");
      if (date) grouped.set(date, [...(grouped.get(date) || []), item]);
    }
    for (let cursor = new Date(`${start}T00:00:00Z`); cursor <= new Date(`${end}T00:00:00Z`); cursor = addDays(cursor, 1)) {
      const date = dateValue(cursor);
      writes.push({ collection, id: date, data: { date, items: grouped.get(date) || [], syncedAt: startedAt } });
    }
  }
  writes.push({
    collection: "sourceSyncStatus",
    id: "current",
    data: { ok: true, source: "Source Scheduler", start, end, startedAt, completedAt: new Date().toISOString(), documentCount: writes.length },
  });
  const token = await googleAccessToken(env);
  await commitWrites(env, token, writes);
  return { ok: true, start, end, documentCount: writes.length, completedAt: new Date().toISOString() };
}

async function recordFailure(env: Env, error: unknown) {
  try {
    const token = await googleAccessToken(env);
    await commitWrites(env, token, [{
      collection: "sourceSyncStatus",
      id: "current",
      data: { ok: false, source: "Source Scheduler", failedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) },
    }]);
  } catch {
    // Preserve the original synchronization error.
  }
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, context: ExecutionContext) {
    context.waitUntil(runSync(env).catch(async (error) => { await recordFailure(env, error); throw error; }));
  },
  async fetch(request: Request, env: Env) {
    if (request.method !== "POST" || request.headers.get("authorization") !== `Bearer ${env.MANUAL_SYNC_TOKEN}`) {
      return new Response("Not found", { status: 404 });
    }
    try {
      return Response.json(await runSync(env));
    } catch (error) {
      await recordFailure(env, error);
      return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  },
};
