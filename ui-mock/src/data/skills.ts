// Marko's skills: one per kind of writing. Each skill is a SKILL.md file:
// frontmatter (name, description, background) and a markdown body with the
// instructions and an example, applied on top of the background information it
// lists (the brand profile always; trends, rankings or reviews when needed).
//
// Real build: each skill is an Agent Skill that Claude loads when a request
// matches its description. The brand profile (data/brand.ts) is standing
// context on every request, so all writing sounds the same wherever it's
// published. Built-in skills ship with OpenMarko; some are locked because they
// carry privacy or platform rules (`locked` says why). Public skills come from
// a public index of SKILL.md files (publicSkills below stands in for it);
// adding one copies the file into this Organization, pinned to that version.

export type Background = "voice" | "facts" | "trends" | "rankings" | "reviews" | "results";
export const backgroundLabels: Record<Background, string> = {
  voice: "Brand voice",
  facts: "Business facts",
  trends: "Trending ideas",
  rankings: "Keywords & rankings",
  reviews: "Reviews",
  results: "This month's results",
};

export type SkillSource =
  | { kind: "builtin" }
  | { kind: "custom" }
  | { kind: "public"; author: string; repo: string; version: string };

export type Skill = {
  id: string; // frontmatter `name`, fixed once added
  name: string; // the `# ` heading
  description: string; // when Marko uses it
  background: Background[];
  md: string; // the whole SKILL.md
  source: SkillSource;
  locked?: string; // why it can't be edited
  enabled: boolean;
  uses30d: number;
};

export type ParsedSkill = Pick<Skill, "id" | "name" | "description" | "background" | "md">;

/** Reads a SKILL.md. Returns what's wrong instead when it can't be used. */
export function parseSkillMd(md: string): { skill: ParsedSkill } | { errors: string[] } {
  const m = md.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { errors: ["Start the file with frontmatter between two --- lines (name, description, background)."] };
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  const errors: string[] = [];
  const id = meta.name ?? "";
  if (!id) errors.push("Add a name in the frontmatter, e.g. name: email-newsletter");
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) errors.push("The name can only use lowercase letters, numbers and hyphens.");
  if (!meta.description) errors.push("Add a description: when this skill should be used.");
  const listed = (meta.background ?? "").replace(/^\[|\]$/g, "").split(",").map((b) => b.trim()).filter(Boolean);
  const unknown = listed.filter((b) => !(b in backgroundLabels));
  if (unknown.length) errors.push(`Unknown background: ${unknown.join(", ")}. Use ${Object.keys(backgroundLabels).join(", ")}.`);
  const name = m[2].match(/^#\s+(.+)$/m)?.[1].trim() ?? "";
  if (!name) errors.push("Add a title as a # heading in the body.");
  if (errors.length) return { errors };
  // Every skill writes in the brand voice, listed or not.
  const background = ["voice", ...listed.filter((b) => b !== "voice")] as Background[];
  return { skill: { id, name, description: meta.description, background, md } };
}

const builtIn = (md: string, extra: Partial<Skill> = {}): Skill => {
  const r = parseSkillMd(md);
  if ("errors" in r) throw new Error(r.errors.join(" "));
  return { ...r.skill, source: { kind: "builtin" }, enabled: true, uses30d: 0, ...extra };
};

export const builtInSkills: Skill[] = [
  builtIn(`---
name: social-viral
description: Writing posts for Instagram, TikTok, X, LinkedIn and Facebook that people stop for, save and share.
background: [voice, facts, trends]
---
# Viral social posts

Writes a post per channel, plus a shot list for video.

## Instructions
- Open with a hook of 8 words or fewer. It's the only line most people read.
- One idea per post. Cut anything that isn't that idea.
- Write like a person talking, not a brochure. Short sentences.
- Give something useful (a tip, a straight answer, an inside look) before any ask.
- End with one easy reply prompt, not a hard sell.
- Follow each channel's norms:
  - Instagram: caption + 3–5 specific hashtags; the first line works without "more".
  - TikTok: on-screen hook in the first second, caption under 100 characters, shot list of 5–7 cuts.
  - X: 280 characters, no hashtag pile, a thread only if each post stands alone.
  - LinkedIn: a short story with one lesson for other owners; no hashtags in the body.
  - Facebook: conversational, a little longer, signed by the team.

## Example
**Ask:** Instagram post about the clocks going back

**Answer:**
Change your clocks, change your toothbrush.

Clocks go back this Sunday, Nov 1. A new toothbrush every time the clocks change is an easy way to remember.

Mention this post at your next visit and we'll hand you a new brush.

#daylightsaving #austin #toothbrush
`, { uses30d: 14 }),
  builtIn(`---
name: trend-remix
description: Turning something that's trending into an original post for this business, without copying it.
background: [voice, facts, trends]
---
# Trend remix

Writes the insight, your angle, then a draft through Viral social posts.

## Instructions
- Find why the trend works underneath (curiosity, relief, belonging, a secret) before writing anything.
- Keep the insight and the format; replace everything else with this business's own story, place and people.
- Never reuse someone else's footage, audio you can't license, or their exact words.
- Skip trends tied to tragedy, politics or anything that would need an explanation.
- Score fit honestly: if it doesn't suit the brand voice, say so and pick another.

## Example
**Ask:** Remix the "things I'd never do as a…" trend

**Answer:**
Why it works: it feels like a secret from someone who knows.
Your angle: Dr. Patel, 5 things I'd never do as a dentist, filmed in the South Congress office.
`, { uses30d: 9 }),
  builtIn(`---
name: community-reply
description: Replying to people on Reddit, Quora, Facebook groups, X and Nextdoor who are asking for a dentist, asking a question you can answer, or talking about you.
background: [voice, facts]
---
# Community replies

Writes a reply ready to paste, plus that community's rules.

## Instructions
- Be the most helpful reply in the thread. Answer their actual question first, fully.
- Say who you are in a few words ("Dentist on South Congress here"). Never pretend to be a customer.
- Mention the business once, at the end, and only when it fits what they asked.
- Follow the community's rules: no links unless asked, no promos where they're banned, reply as a person in groups that ban pages.
- No diagnosis over the internet; say when they should be seen today.
- Never reveal anything about a patient, even one who posted about you.
- Match the platform: short on X, neighborly on Nextdoor, long and specific on Quora.

## Example
**Ask:** r/Austin: "Cracked a molar, need a dentist this weekend. Who's actually open?"

**Answer:**
Dentist on South Congress here, so take this with that in mind. If it's sharp but there's no swelling or fever, it can usually wait until Monday…
`, { uses30d: 11, locked: "Keeps replies honest about who's posting and private about patients, so communities don't ban the account." }),
  builtIn(`---
name: gbp-post
description: Writing posts for the Google Business Profile that help local ranking and get calls.
background: [voice, facts, rankings]
---
# Google Business Profile posts

Writes one post with a button (Call, Book, Learn more) and a photo suggestion.

## Instructions
- 150–300 characters. The first 80 show in search, so the point goes first.
- One update or offer per post, tied to a service people search for nearby.
- Mention the neighborhood once, naturally.
- No phone numbers or links in the text (Google often rejects them); use the Call or Book button instead.
- Suggest a real photo of the office or team, never stock.
- Offers need a clear end date.

## Example
**Ask:** Google post about emergency appointments

**Answer:**
Chipped a tooth or sudden pain? We keep same-day emergency slots open every weekday on South Congress. Tap Call and we'll get you seen today.

Button: Call now · Photo: front desk
`, { uses30d: 6 }),
  builtIn(`---
name: blog-article
description: Writing articles for the website that rank on Google and get quoted in AI answers.
background: [voice, facts, rankings]
---
# Website articles

Writes a title, outline, a 1,200–1,600-word draft and FAQ schema, saved to WordPress as a draft.

## Instructions
- Answer the question in the first two sentences. AI answers quote the opening.
- Title and H1 use the exact question people search; include the city once.
- Use the "People also ask" questions as H2s, each answered in under 60 words before going deeper.
- Give real numbers where you can (time, typical cost range) and say what it depends on.
- Link to one service page and one related article.
- End with a short FAQ (marked up as FAQ schema) and one soft call to book.
- No medical promises; say when someone should see a dentist today.

## Example
**Ask:** Article on what counts as a dental emergency

**Answer:**
What counts as a dental emergency? (and what to do tonight)

If you have severe pain, swelling, a knocked-out tooth or bleeding that won't stop, it's an emergency and you should be seen today…
`, { uses30d: 3 }),
  builtIn(`---
name: review-reply
description: Replying to Google and Yelp reviews, good and bad.
background: [voice, facts, reviews]
---
# Review replies

Writes a reply ready to post, flagged for a person to check when the rating is 3★ or lower.

## Instructions
- Thank them by first name and mention one specific thing they said.
- Never confirm they're a patient or mention any treatment they didn't name themselves (privacy).
- 2–4 sentences. No copy-paste replies; vary the opening.
- 3★ or lower: apologize once, don't argue, offer a direct contact to fix it offline, sign with a real name.
- Mention a service or the neighborhood only if it reads naturally.

## Example
**Ask:** Reply to Jenna R., 5★: "Cracked a molar on Sunday and they fit me in first thing Monday."

**Answer:**
Thank you, Jenna! A cracked tooth on a Sunday is no fun, and we're glad Monday morning worked out. See you next time. — The Maple & Main team
`, { uses30d: 21, locked: "Holds the patient-privacy rules for public replies (never confirming someone is a patient), so it can't be changed." }),
  builtIn(`---
name: report-summary
description: Explaining the month's results in plain words for the owner and team.
background: [voice, results, rankings]
---
# Report summaries

Writes a three-line summary, then what changed, why, and what's next.

## Instructions
- Lead with what the owner cares about: calls, bookings, directions.
- Three lines at most before any detail.
- Say why something moved, not only that it moved.
- One clear next step, with who does it.
- No jargon (no "SoLV", "LCP"); explain any number that needs it.

## Example
**Ask:** Summarize October

**Answer:**
184 people called you from Google in October, up 12%. You're now in the map pack for "invisalign austin". Next: reply to the 2★ review from Dan K. this week.
`, { uses30d: 2 }),
];

export type PublicSkill = {
  author: string;
  repo: string;
  version: string;
  verified: boolean; // publisher checked by OpenMarko
  installs: number;
  md: string;
};

const pub = (author: string, repo: string, version: string, installs: number, verified: boolean, md: string): PublicSkill => ({ author, repo, version, installs, verified, md });

export const publicSkills: PublicSkill[] = [
  pub("openmarko", "openmarko/skills", "1.4.0", 18240, true, `---
name: email-newsletter
description: Writing the monthly email to customers that gets opened and clicked.
background: [voice, facts, results]
---
# Email newsletters

Writes a subject line, preview text and a short email with one button.

## Instructions
- Subject under 45 characters; say what's inside, no clickbait.
- Preview text finishes the subject's thought.
- One main story, then two short items at most.
- One button, one ask. Put it above the fold.
- Sign with a real person's name.
`),
  pub("openmarko", "openmarko/skills", "1.1.2", 9310, true, `---
name: sms-promo
description: Writing short text-message offers that respect quiet hours and opt-out rules.
background: [voice, facts]
---
# Text message offers

Writes one SMS under 160 characters.

## Instructions
- Business name first so people know who's texting.
- One offer with an end date.
- End with "Reply STOP to opt out".
- No link shorteners that hide the domain.
`),
  pub("localwrites", "localwrites/agent-skills", "0.9.0", 4120, false, `---
name: case-study
description: Turning a happy customer's story into a short before-and-after case study.
background: [voice, facts, reviews]
---
# Before & after case studies

Writes a 300-word story with a headline, the problem, what was done and the result.

## Instructions
- Only use details the customer agreed to share.
- Open with the result, then go back to the problem.
- Quote the customer once, word for word.
- End with who else this would help.
`),
  pub("openmarko", "openmarko/skills", "2.0.1", 12880, true, `---
name: instagram-carousel
description: Planning Instagram carousels that teach one thing across 5–8 slides.
background: [voice, facts, trends]
---
# Instagram carousels

Writes slide-by-slide text and a caption.

## Instructions
- Slide 1 is the hook; it has to work as a standalone post.
- One point per slide, 20 words or fewer.
- Last slide: save this, or one easy question.
`),
  pub("hirelocal", "hirelocal/skills", "1.0.0", 2210, false, `---
name: hiring-post
description: Writing job posts for LinkedIn, Indeed and the website that the right people apply to.
background: [voice, facts]
---
# Hiring posts

Writes a job post with pay, hours and how to apply.

## Instructions
- Pay range and schedule in the first three lines.
- Say what a normal day looks like.
- Three must-haves at most; everything else is a nice-to-have.
- No "rockstar", "ninja" or "family".
`),
  pub("adcraft", "adcraft/skills", "3.2.0", 7650, true, `---
name: google-ads-copy
description: Writing Google search ad headlines and descriptions within character limits.
background: [voice, facts, rankings]
---
# Google search ads

Writes 15 headlines (30 characters) and 4 descriptions (90 characters).

## Instructions
- Put the keyword in at least 3 headlines.
- Include the neighborhood or city in 2 headlines.
- One headline with a number (price, years, rating).
- Descriptions end with a call to act.
`),
  pub("shortform", "shortform/skills", "0.4.3", 3380, false, `---
name: youtube-shorts
description: Scripting 30–45 second YouTube Shorts that answer one question.
background: [voice, facts, trends]
---
# YouTube Shorts scripts

Writes a spoken script, on-screen text and a shot list.

## Instructions
- Answer the question in the first 3 seconds, then show why.
- 90 words or fewer spoken.
- On-screen text repeats the key line for people watching muted.
`),
];
