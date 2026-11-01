// Errors the API turns into HTTP responses. Modules throw these; they never build responses themselves.
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(404, "not_found", `${what} not found`);
export const forbidden = (message = "You don't have permission to do that.") => new AppError(403, "forbidden", message);
export const unauthorized = (message = "Sign in first.") => new AppError(401, "unauthorized", message);
export const conflict = (message: string, details?: Record<string, unknown>) => new AppError(409, "conflict", message, details);
export const invalid = (message: string, details?: Record<string, unknown>) => new AppError(422, "invalid", message, details);
/** Something must be connected first (Connect in the UI, ADR 0006). */
export const needs = (capability: string) =>
  new AppError(409, "needs_connection", `Connect a provider for ${capability} first.`, { needs: capability });
/** The Plan doesn't include it (ADR 0012). */
export const planLimit = (key: string) => new AppError(402, "plan_limit", `Your plan doesn't allow this (${key}).`, { entitlement: key });

/** Parses a JSON object from a request body. Malformed input is a 400, never a 500. */
export function parseJsonObject(raw: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new AppError(400, "bad_request", "The body isn't valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError(400, "bad_request", "The body must be a JSON object.");
  return value as Record<string, unknown>;
}
