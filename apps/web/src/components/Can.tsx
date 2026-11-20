import { cloneElement, type ReactElement } from "react";
import { useSession } from "../lib/session";

/**
 * Guards a control by permission. Someone whose Role doesn't allow the action sees it disabled, with the reason on
 * hover, so they know it exists. `hide` removes it instead, for actions that would only be noise.
 */
export function Can({
  I,
  on,
  hide,
  children,
}: {
  I: string;
  on: string;
  hide?: boolean;
  children: ReactElement<{ disabled?: boolean; title?: string }>;
}) {
  const { can, caller } = useSession();
  if (can(on, I)) return children;
  if (hide) return null;
  return cloneElement(children, { disabled: true, title: `Your role (${caller?.role ?? "none"}) can't do this` });
}
