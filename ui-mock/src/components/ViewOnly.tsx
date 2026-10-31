import { Eye } from "lucide-react";
import { myRole, useAccess } from "../lib/access";

/** Above a page the role can see but not change. Controls on it are gated one by one with <Can>. */
export function ViewOnly() {
  const role = myRole(useAccess());
  return (
    <div role="note" className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-hover px-3 py-2 text-[13px] text-muted">
      <Eye size={14} className="shrink-0" /> View only. Your role ({role.name}) can see this but not change it.
    </div>
  );
}
