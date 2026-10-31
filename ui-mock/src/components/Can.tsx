import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { resources, type Resource } from "../data/access";
import { myRole, useAccess, can } from "../lib/access";

/**
 * Gates a control on one action. Without it the control is disabled with a
 * reason (so people learn what their role can't do), or hidden with `hide`.
 *   <Can I="post" on="reviews"><Button>Post reply</Button></Can>
 */
export function Can({ I, on, hide, children }: { I: string; on: Resource; hide?: boolean; children: ReactNode }) {
  const s = useAccess();
  if (can(on, I, s)) return <>{children}</>;
  if (hide || !isValidElement(children)) return null;
  const label = resources[on].find((a) => a.id === I)?.label.toLowerCase() ?? I;
  const el = children as ReactElement<{ disabled?: boolean; title?: string }>;
  return cloneElement(el, { disabled: true, title: `Your role (${myRole(s).name}) can't ${label}` });
}
