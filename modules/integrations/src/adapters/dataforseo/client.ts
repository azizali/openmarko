// One client for every DataForSEO API. They all take a POST of a JSON array of tasks with HTTP Basic auth (the
// API login and API password from the DataForSEO dashboard), and answer with the same envelope:
//   { status_code, status_message, cost, tasks: [{ status_code, status_message, cost, result: [...] }] }
// 20000 means OK, at the top and per task. Each response says what it cost, so metering uses the real number.
import { AppError } from "@openmarko/kernel";

export const DFS_BASE = "https://api.dataforseo.com/v3";

export type DfsCredentials = { login: string; password: string };
export type DfsResult<T> = { result: T[]; costMicros: number };

type Envelope<T> = {
  status_code: number;
  status_message: string;
  cost?: number;
  tasks?: { status_code: number; status_message: string; cost?: number; result?: T[] | null }[];
};

export const toMicros = (usd: number | undefined) => Math.round((usd ?? 0) * 1_000_000);

/** Runs one task on one endpoint. Fails on a transport error, an envelope error or a task error. */
export async function dfsPost<T>(
  creds: DfsCredentials,
  path: string,
  task: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<DfsResult<T>> {
  if (!creds.login || !creds.password) throw new AppError(503, "not_configured", "DataForSEO API login and API password are needed.");
  const res = await fetchImpl(`${DFS_BASE}/${path}`, {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(`${creds.login}:${creds.password}`).toString("base64"),
      "content-type": "application/json",
    },
    body: JSON.stringify([task]),
  });
  let json: Envelope<T>;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new AppError(502, "provider_error", `DataForSEO returned ${res.status} with no JSON body.`);
  }
  if (!res.ok || json.status_code !== 20000) {
    throw new AppError(502, "provider_error", `DataForSEO: ${json.status_message ?? res.statusText}`, {
      status: json.status_code ?? res.status,
    });
  }
  const t = json.tasks?.[0];
  if (!t || t.status_code !== 20000) {
    throw new AppError(502, "provider_error", `DataForSEO task: ${t?.status_message ?? "no task in the response"}`, {
      status: t?.status_code,
    });
  }
  return { result: t.result ?? [], costMicros: toMicros(json.cost ?? t.cost) };
}
