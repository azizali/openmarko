import { Link } from "react-router";
import { AtSign, Globe, Store } from "lucide-react";
import { Button, Card } from "./ui";
import { shortLocation, websites } from "../data/org";
import { setAccount, setGoogleProfile, setWebsite } from "../lib/setup";
import { accounts } from "../data/social";

type Kind = "googleProfile" | "website" | "account";

const copy: Record<Kind, { icon: typeof Store; title: (place: string) => string; unlocks: string[]; settings: string; action: string }> = {
  googleProfile: {
    icon: Store,
    title: (p) => `Connect ${p ? `${p}'s` : "your"} Google profile`,
    unlocks: ["Reviews, with replies written in your voice", "Calls, directions and website clicks from Google", "Google posts and profile fixes"],
    settings: "/settings/locations",
    action: "Connect Google profile",
  },
  website: {
    icon: Globe,
    title: (p) => `Add ${p ? `${p}'s` : "your"} website`,
    unlocks: ["Site health and fixes", "Articles that rank and get quoted by AI answers", "Backlinks and link ideas"],
    settings: "/settings/websites",
    action: "Add website",
  },
  account: {
    icon: AtSign,
    title: () => "Connect a social account",
    unlocks: ["Schedule and post to Instagram, Facebook, TikTok, X and your Google profile", "See followers, views and reactions in one place"],
    settings: "/settings/accounts",
    action: "Connect an account",
  },
};

/**
 * Shown instead of a page's tools when the thing it reads isn't set up yet.
 * Everything else in the app keeps working without it.
 */
export function Needs({ kind, locationId, note }: { kind: Kind; locationId?: string; note?: string }) {
  const c = copy[kind];
  const place = locationId ? shortLocation(locationId) : "";
  const connect = () => {
    if (kind === "googleProfile" && locationId) setGoogleProfile(locationId, true);
    if (kind === "website") { const w = websites.find((x) => !locationId || x.locationIds.includes(locationId)); if (w) setWebsite(w.id, true); }
    if (kind === "account") setAccount(accounts.find((a) => a.platform === "instagram")!.id, true);
  };
  return (
    <Card className="flex flex-col items-start gap-4 sm:flex-row">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><c.icon size={20} /></span>
      <div className="min-w-0 flex-1">
        <h2 className="m-0 text-[16px] font-medium">{c.title(place)}</h2>
        <p className="mt-1 mb-0 text-[13.5px] text-muted">{note ?? "This page needs it. Everything else works without it."} Once it's connected you get:</p>
        <ul className="mt-2 mb-0 list-disc space-y-0.5 pl-5 text-[13.5px]">{c.unlocks.map((u) => <li key={u}>{u}</li>)}</ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={connect}>{c.action}</Button>
          <Link to={c.settings}><Button variant="ghost">Open settings</Button></Link>
        </div>
      </div>
    </Card>
  );
}
