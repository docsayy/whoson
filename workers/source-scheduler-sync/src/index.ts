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
  for (let index = 0; index < writes.length; index += 450) {
    const chunk = writes.slice(index, index + 450);
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

function mergeChunks(name: string, chunks: JsonValue[]): JsonValue {
  if (name === "callSchedule" || name === "inpatientServices" || name === "clinicServices") {
    const days = chunks.flatMap((chunk) => array(chunk, "days"));
    const first = (chunks[0] && !Array.isArray(chunks[0]) && typeof chunks[0] === "object")
      ? chunks[0] as { [key: string]: JsonValue }
      : {};
    return { ...first, days };
  }
  return chunks.flatMap((chunk) => array(chunk));
}

async function fetchRangedDatasets(cookie: string, start: string, end: string) {
  const collected: Record<string, JsonValue[]> = {
    callSchedule: [],
    attendingCoverage: [],
    absences: [],
    lectures: [],
    inpatientServices: [],
    clinicServices: [],
  };
  const finalDate = new Date(`${end}T00:00:00Z`);
  const groups = [
    {
      chunkDays: 120,
      paths: (qs: string) => ({
        callSchedule: `/api/call-schedule?${qs}`,
        attendingCoverage: `/api/attending-coverage?${qs}`,
        absences: `/api/absences?${qs}`,
        lectures: `/api/lectures?${qs}`,
      }),
    },
    {
      chunkDays: 31,
      paths: (qs: string) => ({
        inpatientServices: `/api/service-assignments?kind=inpatient&${qs}`,
        clinicServices: `/api/service-assignments?kind=clinic&${qs}`,
      }),
    },
  ];
  for (const group of groups) {
    for (let cursor = new Date(`${start}T00:00:00Z`); cursor <= finalDate; cursor = addDays(cursor, group.chunkDays)) {
      const chunkStart = dateValue(cursor);
      const chunkEnd = dateValue(new Date(Math.min(addDays(cursor, group.chunkDays - 1).getTime(), finalDate.getTime())));
      const qs = `start=${chunkStart}&end=${chunkEnd}`;
      const entries = await Promise.all(Object.entries(group.paths(qs)).map(async ([name, path]) => {
        try {
          return [name, await sourceJson(path, cookie)] as const;
        } catch (error) {
          throw new Error(`${name}:${error instanceof Error ? error.message : String(error)}`);
        }
      }));
      for (const [name, data] of entries) collected[name].push(data);
    }
  }
  return Object.fromEntries(Object.entries(collected).map(([name, chunks]) => [name, mergeChunks(name, chunks)]));
}

async function runSync(env: Env) {
  const startedAt = new Date().toISOString();
  const today = new Date(`${dateValue(new Date())}T00:00:00Z`);
  const start = dateValue(addDays(today, -30));
  const end = dateValue(addDays(today, 330));
  const cookie = await sourceLogin(env);
  const blockSchedule = await sourceJson("/api/block-schedule", cookie);
  const datasets = {
    blockSchedule,
    ...await fetchRangedDatasets(cookie, start, end),
  } as Record<string, JsonValue>;
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

const allowedManagerRoles = new Set([
  "admin",
  "chief resident",
  "program coordinator",
]);

function corsHeaders(request: Request) {
  return {
    "access-control-allow-origin": request.headers.get("origin") || "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    vary: "Origin",
  };
}

async function firebaseManagerUid(request: Request, env: Env) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Firebase ")) return null;
  const idToken = authorization.slice("Firebase ".length);
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  let tokenInfo: { aud?: string; iss?: string; sub?: string; user_id?: string };
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    tokenInfo = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")));
  } catch {
    return null;
  }
  if (
    tokenInfo.aud !== env.FIREBASE_PROJECT_ID ||
    tokenInfo.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`
  ) return null;
  const uid = tokenInfo.user_id || tokenInfo.sub;
  if (!uid) return null;
  // Firestore validates the Firebase ID-token signature and applies the app's
  // security rules before returning the signed-in user's own profile.
  const profileResponse = await fetch(
    `https://firestore.googleapis.com/v1/${documentName(env, "users", uid)}`,
    { headers: { authorization: `Bearer ${idToken}` } },
  );
  if (!profileResponse.ok) return null;
  const profile = await profileResponse.json() as {
    fields?: Record<string, { stringValue?: string; booleanValue?: boolean }>;
  };
  const role = (profile.fields?.role?.stringValue || "").trim().toLowerCase();
  const active = profile.fields?.active?.booleanValue !== false;
  const approved = profile.fields?.approved?.booleanValue !== false;
  return active && approved && allowedManagerRoles.has(role) ? uid : null;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, context: ExecutionContext) {
    context.waitUntil(runSync(env).catch(async (error) => { await recordFailure(env, error); throw error; }));
  },
  async fetch(request: Request, env: Env) {
    const cors = corsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return new Response("Not found", { status: 404, headers: cors });
    const tokenAuthorized = request.headers.get("authorization") === `Bearer ${env.MANUAL_SYNC_TOKEN}`;
    const managerAuthorized = tokenAuthorized ? false : Boolean(await firebaseManagerUid(request, env));
    if (!tokenAuthorized && !managerAuthorized)
      return Response.json({ ok: false, error: "Not authorized." }, { status: 403, headers: cors });
    try {
      return Response.json(await runSync(env), { headers: cors });
    } catch (error) {
      await recordFailure(env, error);
      return Response.json(
        { ok: false, error: error instanceof Error ? error.message : String(error) },
        { status: 500, headers: cors },
      );
    }
  },
};
