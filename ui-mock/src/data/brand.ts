// The brand profile: who the business is and how it sounds. It belongs to the
// business (shared by every location) and is background information for every
// piece of writing: posts, review replies, articles, emails and reports.
//
// Real build: Claude reads the business's last ~50 posts, its review replies
// and website copy and drafts this profile; the owner edits it. It's sent as
// standing context with every Marko request, and each writing skill
// (data/skills.ts) is applied on top of it.

import { business, locations } from "./mock";

export const brandFacts = {
  name: business.name,
  category: "Family and cosmetic dentist",
  locations: locations.map((l) => l.name.replace(`${business.name.split(" ")[0]} & Main — `, "")),
  phone: business.phone,
  website: business.website,
  hours: "Mon–Fri 7:30–5:30 · Sat 8–1",
  services: ["Cleanings & checkups", "Same-day emergencies", "Invisalign", "Whitening", "Implants", "Kids' dentistry"],
  differentiators: ["Same-day emergency slots every weekday", "Prices shared before any treatment", "Saturday hours"],
  audience: "Busy Austin families and professionals within 3 miles of South Congress and Mueller",
  offers: ["Free Invisalign consult through November", "New patient exam + cleaning, $129 without insurance"],
  rules: ["Never confirm that someone is a patient when replying publicly (privacy)", "No before/after photos without written consent", "No promises of results or “painless” claims"],
};

export const voice = {
  learnedFrom: ["38 Instagram posts", "212 review replies", "mapleandmaindental.com"],
  summary: "Warm and plain-spoken, like a neighbor who happens to be a dentist. Explains one thing clearly, skips the jargon, and never makes people feel bad about their teeth.",
  traits: [
    { id: "warm", left: "Clinical", right: "Warm", value: 78 },
    { id: "playful", left: "Serious", right: "Playful", value: 55 },
    { id: "expert", left: "Casual", right: "Expert", value: 62 },
    { id: "short", left: "Detailed", right: "Short", value: 70 },
  ],
  use: ["neighbors", "same-day", "no judgment", "South Congress", "we'll walk you through it"],
  avoid: ["painless", "best in Austin", "dental anxiety sufferers", "limited time"],
  signOff: "— Dr. Patel & the Maple & Main team",
  examples: {
    like: "Chipped a tooth over the weekend? Call us Monday morning. We keep same-day slots open for exactly this.",
    unlike: "Experience world-class, painless cosmetic dentistry at Austin's #1 rated clinic. Book now — limited time!",
  },
};

/** Everywhere the brand profile is used. */
export const usedBy = ["Review replies", "Google profile posts", "Social posts", "Website articles", "Emails & reports", "Marko's answers"];

/** Mock "say it in my voice": swaps the words the voice avoids and adds the sign-off. */
export function inVoice(text: string) {
  let out = text.trim();
  const swaps: [RegExp, string][] = [
    [/\bexperience\b/gi, "Try"], [/\bpainless\b/gi, "gentle"], [/\bthe best in austin\b/gi, "your neighborhood"], [/\blimited time offer\b/gi, "offer this month"],
    [/\blimited time\b/gi, "this month"], [/\butilize\b/gi, "use"], [/\bschedule an appointment\b/gi, "Book a visit"], [/!+/g, "."],
  ];
  swaps.forEach(([re, to]) => { out = out.replace(re, to); });
  return out ? `${out}\n\n${voice.signOff}` : "";
}
