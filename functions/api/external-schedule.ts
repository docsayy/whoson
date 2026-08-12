interface Env {
  RSB_SCHEDULE_EMAIL: string;
  RSB_SCHEDULE_PASSWORD: string;
  FIREBASE_PROJECT_ID: string;
}

type PagesContext = {
  request: Request;
  env: Env;
};

type FirebaseTokenPayload = {
  aud?: string;
  iss?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  email?: string;
};

const RSB_BASE_URL = "https://schedule.rsbtest.xyz";
const RSB_ORIGIN = new URL(RSB_BASE_URL).origin;
const GOOGLE_JWK_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJsonSegment<T>(segment: string): T {
  const bytes = base64UrlToBytes(segment);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

async function verifyFirebaseIdToken(request: Request, projectId: string) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    throw new Error("UNAUTHENTICATED");
  }

  const token = auth.slice(7).trim();
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("UNAUTHENTICATED");

  const header = decodeJsonSegment<{ alg?: string; kid?: string }>(parts[0]);
  const payload = decodeJsonSegment<FirebaseTokenPayload>(parts[1]);

  if (header.alg !== "RS256" || !header.kid) throw new Error("UNAUTHENTICATED");

  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  const now = Math.floor(Date.now() / 1000);

  if (
    payload.aud !== projectId ||
    payload.iss !== expectedIssuer ||
    !payload.sub ||
    typeof payload.exp !== "number" ||
    payload.exp <= now ||
    (typeof payload.iat === "number" && payload.iat > now + 60)
  ) {
    throw new Error("UNAUTHENTICATED");
  }

  const jwkResponse = await fetch(GOOGLE_JWK_URL, {
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  if (!jwkResponse.ok) throw new Error("AUTH_KEY_FETCH_FAILED");

  const jwks = (await jwkResponse.json()) as {
    keys?: Array<JsonWebKey & { kid?: string; alg?: string }>;
  };
  const jwk = jwks.keys?.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("UNAUTHENTICATED");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );

  if (!valid) throw new Error("UNAUTHENTICATED");
  return payload;
}

function cookieHeader(headers: Headers) {
  const cloudflareHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = cloudflareHeaders.getSetCookie?.() || [];
  const fallback = headers.get("set-cookie");
  const values = setCookies.length ? setCookies : fallback ? [fallback] : [];
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function loginToRsb(env: Env) {
  if (!env.RSB_SCHEDULE_EMAIL || !env.RSB_SCHEDULE_PASSWORD) {
    throw new Error("RSB_SECRETS_MISSING");
  }

  const response = await fetch(`${RSB_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      origin: RSB_ORIGIN,
      referer: `${RSB_ORIGIN}/`,
    },
    body: JSON.stringify({
      email: env.RSB_SCHEDULE_EMAIL,
      password: env.RSB_SCHEDULE_PASSWORD,
    }),
    redirect: "manual",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RSB_LOGIN_${response.status}:${text.slice(0, 160)}`);
  }

  const cookie = cookieHeader(response.headers);
  if (!cookie) throw new Error("RSB_SESSION_COOKIE_MISSING");
  return cookie;
}

async function rsbJson(path: string, cookie: string) {
  const response = await fetch(`${RSB_BASE_URL}${path}`, {
    headers: {
      accept: "application/json",
      cookie,
      origin: RSB_ORIGIN,
      referer: `${RSB_ORIGIN}/`,
    },
  });

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(
      `RSB_${response.status}:${typeof body === "string" ? body.slice(0, 180) : JSON.stringify(body).slice(0, 180)}`
    );
  }
  return body;
}

function validDate(value: string | null) {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildPaths(start: string, end: string) {
  const qs = `start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  return {
    cohorts: "/api/cohorts",
    blockSchedule: "/api/block-schedule",
    callSchedule: `/api/call-schedule?${qs}`,
    attendingCoverage: `/api/attending-coverage?${qs}`,
    absences: `/api/absences?${qs}`,
    inpatientServices: `/api/service-assignments?kind=inpatient&${qs}`,
    clinicServices: `/api/service-assignments?kind=clinic&${qs}`,
  } as const;
}

function countPayload(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== "object") return value == null ? 0 : 1;

  const objectValue = value as Record<string, unknown>;
  for (const key of [
    "assignments",
    "blocks",
    "residents",
    "coverage",
    "items",
    "data",
    "absences",
    "services",
    "days",
    "roles",
  ]) {
    if (Array.isArray(objectValue[key])) return objectValue[key].length;
  }
  return Object.keys(objectValue).length;
}

export const onRequest = async (context: PagesContext) => {
  try {
    const { request, env } = context;
    const projectId = env.FIREBASE_PROJECT_ID || "whosonfhmc";
    const user = await verifyFirebaseIdToken(request, projectId);

    const url = new URL(request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    if (!validDate(start) || !validDate(end) || (start as string) > (end as string)) {
      return json({ ok: false, error: "Valid start/end dates are required." }, 400);
    }

    const cookie = await loginToRsb(env);
    const paths = buildPaths(start as string, end as string);
    const dataset = url.searchParams.get("dataset");

    if (dataset && dataset !== "all") {
      if (!(dataset in paths)) {
        return json({ ok: false, error: `Unknown dataset: ${dataset}` }, 400);
      }
      const name = dataset as keyof typeof paths;
      const data = await rsbJson(paths[name], cookie);
      return json({
        ok: true,
        source: RSB_BASE_URL,
        user: { uid: user.sub, email: user.email || null },
        start,
        end,
        dataset: name,
        data,
      });
    }

    const results = await Promise.all(
      Object.entries(paths).map(async ([name, path]) => {
        try {
          const data = await rsbJson(path, cookie);
          return { name, ok: true as const, data };
        } catch (error) {
          return {
            name,
            ok: false as const,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );

    const datasets: Record<string, unknown> = {};
    const summary: Record<string, { ok: boolean; count?: number; error?: string }> = {};

    for (const result of results) {
      if (result.ok) {
        datasets[result.name] = result.data;
        summary[result.name] = { ok: true, count: countPayload(result.data) };
      } else {
        summary[result.name] = { ok: false, error: result.error };
      }
    }

    return json({
      ok: true,
      source: RSB_BASE_URL,
      user: { uid: user.sub, email: user.email || null },
      start,
      end,
      summary,
      datasets,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "UNAUTHENTICATED" ? 401 : 500;
    return json({ ok: false, error: message }, status);
  }
};
