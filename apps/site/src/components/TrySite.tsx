// The one action on the marketing site: type your website, press Try it free. It opens sign-up in the app with the
// address in `?site=`. Used by the home hero and the closing band on every page.
import { useId, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { APP_URL, trySite } from "../data/site";
import { cn } from "./ui";

/** "https://www.Example.com/" → "www.example.com"; empty when it can't be a web address. */
export function cleanSite(raw: string): string {
  const v = raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  return /^[^\s/]+\.[a-z]{2,}(\/\S*)?$/.test(v) ? v : "";
}

/** The website field and its button. `band` styles it for the dark closing band. */
export function TrySite({ band = false, className }: { band?: boolean; className?: string }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const site = cleanSite(value);
    if (!value.trim()) return setError("Type your website, like joesplumbing.com.");
    if (!site) return setError("That doesn't look like a web address. Try something like joesplumbing.com.");
    window.location.href = `${APP_URL}/sign-up?site=${encodeURIComponent(site)}`;
  };
  return (
    <div className={cn("flex w-full max-w-[520px] flex-col gap-2", className)}>
      <form
        onSubmit={submit}
        noValidate
        className={cn(
          "flex items-center gap-1.5 rounded-full border p-1.5 pl-[22px] backdrop-blur transition-[border-color,box-shadow] duration-200",
          band
            ? "border-white/15 bg-white/[0.06] focus-within:border-[#fe7bcd] focus-within:shadow-[0_0_0_4px_rgb(254_123_205/0.18)]"
            : "border-line bg-surface shadow-[0_1px_2px_rgb(9_9_11/0.05),0_8px_30px_rgb(219_39_119/0.07)] focus-within:border-accent focus-within:shadow-[0_0_0_4px_var(--accent-soft)]",
        )}
      >
        <label htmlFor={id} className="sr-only">
          Your business website
        </label>
        <input
          id={id}
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="yourbusiness.com"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "min-w-0 flex-1 bg-transparent py-[11px] text-[16px] outline-none",
            band ? "text-white placeholder:text-white/50" : "placeholder:text-muted",
          )}
        />
        <button
          type="submit"
          className={cn(
            "shrink-0 rounded-full px-4 py-3.5 text-[14px] leading-none font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] sm:px-5 sm:text-[15px]",
            band ? "bg-[#fe7bcd] text-[#170812] hover:bg-white" : "bg-ink text-on-ink hover:bg-accent hover:text-white",
          )}
        >
          {trySite.button}
        </button>
      </form>
      {/* The message sits beside the action it answers. */}
      <p
        id={`${id}-error`}
        role="status"
        className={cn("text-center text-[14px] empty:hidden", band ? "text-[#fe7bcd]" : "text-accent-ink")}
      >
        {error}
      </p>
    </div>
  );
}

/** The short lines under the button that answer "how long" and "what if I want out". Neutral ticks. */
export function TryPoints({ band = false, alt = false, className }: { band?: boolean; alt?: boolean; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-[14px]", band ? "text-white/60" : "text-muted", className)}>
      {trySite.points.map((p) => (
        <li key={p} className="inline-flex items-center gap-1.5">
          <Check size={15} className={band ? "text-white/40" : "text-subtle"} />
          {p}
        </li>
      ))}
      {/* A way in for owners without a site: setup finds the business by its name on Google Maps instead. */}
      {alt && (
        <li>
          No website?{" "}
          <a href={`${APP_URL}/sign-up`} className="text-fg underline underline-offset-[3px] hover:text-accent-ink">
            Start with your business name
          </a>
        </li>
      )}
    </ul>
  );
}
