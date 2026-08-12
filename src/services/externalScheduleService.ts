import { auth } from "../config/firebase";

export type ExternalSyncItem = {
  ok: boolean;
  count?: number;
  error?: string;
};

export type ExternalSyncSummary = Record<string, ExternalSyncItem>;

export type ExternalScheduleResponse<T = unknown> = {
  ok: boolean;
  source?: string;
  start?: string;
  end?: string;
  fetchedAt?: string;
  dataset?: string;
  data?: T;
  datasets?: Record<string, unknown>;
  summary?: ExternalSyncSummary;
  error?: string;
};

async function externalRequest<T = unknown>(
  start: string,
  end: string,
  dataset = "all"
): Promise<ExternalScheduleResponse<T>> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in first.");

  const token = await user.getIdToken();
  const params = new URLSearchParams({ start, end, dataset });

  const response = await fetch(`/api/external-schedule?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const body = (await response.json().catch(() => ({}))) as ExternalScheduleResponse<T>;
  if (!response.ok || !body.ok) {
    throw new Error(body.error || `External schedule request failed (${response.status}).`);
  }
  return body;
}

export function getExternalScheduleBundle(start: string, end: string) {
  return externalRequest(start, end, "all");
}

export function getExternalDataset<T = unknown>(
  dataset: string,
  start: string,
  end: string
) {
  return externalRequest<T>(start, end, dataset);
}
