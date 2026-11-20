import type { ReactNode } from "react";
import { cn } from "./ui";

/**
 * A plain data table: a header row, rows of cells, and a line for when there's nothing. On a phone each row stacks into
 * label and value, the first cell as its heading, so the last columns (usually the actions) aren't off-screen.
 */
export function Table({ head, rows, empty, className }: { head: ReactNode[]; rows: ReactNode[][]; empty?: string; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-line bg-surface shadow-card", className)}>
      {/* The roles keep it a table for screen readers once the phone layout makes these display: block. */}
      <table role="table" className="w-full text-left text-[13.5px] max-sm:block">
        <thead role="rowgroup" className="max-sm:sr-only">
          <tr role="row" className="border-b border-line text-[12px] text-muted">
            {head.map((h, i) => (
              <th key={i} role="columnheader" className="px-4 py-2.5 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup" className="divide-y divide-line max-sm:block">
          {rows.map((r, i) => (
            <tr key={i} role="row" className="hover:bg-hover/60 max-sm:block max-sm:space-y-1.5 max-sm:px-4 max-sm:py-3">
              {r.map((c, j) => (
                <td
                  key={j}
                  role="cell"
                  data-label={j > 0 && typeof head[j] === "string" ? head[j] : undefined}
                  className={cn(
                    "px-4 py-2.5 align-middle max-sm:flex max-sm:min-h-6 max-sm:items-center max-sm:gap-4 max-sm:p-0",
                    j > 0 &&
                      "max-sm:justify-between max-sm:before:shrink-0 max-sm:before:text-[12.5px] max-sm:before:text-muted max-sm:before:content-[attr(data-label)]",
                    // Nothing to show: no bare label on a phone.
                    "max-sm:[&:has(>div:empty)]:hidden max-sm:[&:has(>div>:only-child:empty)]:hidden",
                  )}
                >
                  <div className={cn("min-w-0", j > 0 && "max-sm:ml-auto max-sm:text-right")}>{c}</div>
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr role="row" className="max-sm:block">
              <td role="cell" colSpan={head.length} className="px-4 py-8 text-center text-[13px] text-muted max-sm:block">
                {empty ?? "Nothing here yet."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** A row of label and value, for a details list. */
export function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line py-2.5 text-[13.5px] last:border-0">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}
