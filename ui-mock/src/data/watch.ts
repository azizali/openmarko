// Watched profiles: other people's profiles the Organization keeps an eye on,
// competitors and accounts it admires, and their posts that did unusually well.
// Handles and posts are made up for the mock.
//
// Real build: public profile and post data from each Platform (Instagram and
// Facebook via Meta's business discovery, TikTok and YouTube public video data,
// X user timelines). A post "stands out" when it beats that profile's own median
// views or engagement by 2× or more; Claude writes why it worked.

import type { SocialPlatform, Trend } from "./social";

export type WatchKind = "Competitor" | "Inspiration";
export type WatchedProfile = { id: string; platform: SocialPlatform; handle: string; name: string; kind: WatchKind; followers: number };

export const seedWatched: WatchedProfile[] = [
  { id: "w1", platform: "instagram", handle: "@brightsmileatx", name: "Bright Smile Austin", kind: "Competitor", followers: 5400 },
  { id: "w2", platform: "tiktok", handle: "@congressavedental", name: "Congress Ave Dental", kind: "Competitor", followers: 2100 },
  { id: "w3", platform: "tiktok", handle: "@thetoothtruth", name: "A dentist who explains things well", kind: "Inspiration", followers: 410000 },
  { id: "w4", platform: "instagram", handle: "@eastsidebakehouse", name: "A local bakery with great posts", kind: "Inspiration", followers: 18200 },
];

/** Suggested during onboarding: the competitors' own profiles, found on their websites. */
export const suggestedWatch = seedWatched.filter((w) => w.kind === "Competitor");

export type StandoutPost = {
  id: string;
  profileId: string;
  caption: string;
  format: string;
  posted: string;
  views: number;
  multiple: number; // × the profile's usual views
  why: string;
  angle: string; // the same idea, for this business
};

export const standoutPosts: StandoutPost[] = [
  { id: "sp_w1", profileId: "w3", caption: "Rating every toothbrush I get asked about, 1 to 10", format: "TikTok · 41s", posted: "2 days ago", views: 2_300_000, multiple: 6.1, why: "A ranking gives people a reason to watch to the end, and everyone wants to know where their own brush lands.", angle: "Dr. Patel rates the 5 toothbrushes patients bring in most, 1 to 10." },
  { id: "sp_w2", profileId: "w1", caption: "Our team's Halloween costumes, but make it teeth", format: "Reel · 15s", posted: "4 days ago", views: 21_000, multiple: 3.4, why: "Faces of the team plus a seasonal hook. It got 5× their usual comments, mostly people tagging friends.", angle: "A team photo with a little dental twist for Thanksgiving week." },
  { id: "sp_w3", profileId: "w4", caption: "What $5 gets you here vs. downtown", format: "Carousel · 6 slides", posted: "1 week ago", views: 64_000, multiple: 4.8, why: "Plain prices compared side by side. Locals share it because it settles an argument.", angle: "What a cleaning costs here without insurance, and what's included, vs. the Austin average." },
  { id: "sp_w4", profileId: "w2", caption: "POV: you finally book the appointment you've been avoiding", format: "TikTok · 12s", posted: "5 days ago", views: 9_800, multiple: 2.6, why: "It names a feeling most people have about the dentist, and makes it funny instead of scary.", angle: "POV: you've put off your cleaning for 2 years and nobody here judges you." },
];

/** A standout post as the post drawer's brief: keep why it worked, write it for this business. */
export function postAsTrend(p: StandoutPost, profile: WatchedProfile): Trend {
  return {
    id: p.id, kind: "Format", title: p.caption, source: `${profile.handle} · ${profile.kind === "Competitor" ? "competitor" : "inspiration"}`, velocity: `${p.multiple}× their usual views`, fit: 80,
    seen: p.caption, insight: p.why, angle: p.angle, bestFor: [profile.platform], from: [],
    remix: { hook: p.angle.split(/(?<=[.?!,])\s/)[0].replace(/[,.]$/, "."), playfulHook: p.angle, body: p.angle, expertLine: "", cta: "Tell us yours in the comments.", hashtags: ["#austin", "#dentist"], format: p.format },
  };
}

/** Where a watched profile lives on its Platform. */
export const profileUrl = (w: WatchedProfile) => {
  const h = w.handle.replace("@", "");
  return { instagram: `https://www.instagram.com/${h}/`, tiktok: `https://www.tiktok.com/@${h}`, x: `https://x.com/${h}`, facebook: `https://www.facebook.com/${h}`, linkedin: `https://www.linkedin.com/in/${h}`, google: "https://www.google.com/maps" }[w.platform];
};
