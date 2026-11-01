// Checks every route and job runs through. Pure: no database, no HTTP.
import { forbidden, type Caller } from "@openmarko/kernel";
import { allows, type Resource } from "./access";

export type { Caller };

/** Throws 403 unless the caller may do `action` on `resource`. */
export function requireAllowed(caller: Pick<Caller, "role" | "permission">, resource: Resource, action: string): void {
  if (!allows(caller.permission, resource, action)) {
    throw forbidden(`Your role (${caller.role}) can't ${action} ${resource}.`);
  }
}
