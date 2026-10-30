// Marko's skills: one per kind of writing. A skill is instructions plus an
// example, applied on top of the background information it lists (the brand
// profile always; trends, rankings or reviews when the skill needs them).
//
// Real build: each skill is an Agent Skill (a SKILL.md with these instructions
// and examples) that Claude loads when a request matches its description. The
// brand profile (data/brand.ts) is standing context on every request, so all
// writing sounds the same wherever it's published.

export type Background = "voice" | "facts" | "trends" | "rankings" | "reviews" | "results";
export const backgroundLabels: Record<Background, string> = {
  voice: "Brand voice",
  facts: "Business facts",
  trends: "Trending ideas",
  rankings: "Keywords & rankings",
  reviews: "Reviews",
  results: "This month's results",
};

export type Skill = {
  id: string;
  name: string;
  description: string; // when Marko uses it
  outputs: string;
  background: Background[];
  instructions: string;
  example: { ask: string; answer: string };
  builtIn: boolean;
  enabled: boolean;
  uses30d: number;
};

export const builtInSkills: Skill[] = [
  {
    id: "social-viral", name: "Viral social posts", builtIn: true, enabled: true, uses30d: 14,
    description: "Writing posts for Instagram, TikTok, X, LinkedIn and Facebook that people stop for, save and share.",
    outputs: "A post per channel, plus a shot list for video",
    background: ["voice", "facts", "trends"],
    instructions: `- Open with a hook of 8 words or fewer. It's the only line most people read.
- One idea per post. Cut anything that isn't that idea.
- Write like a person talking, not a brochure. Short sentences.
- Give something useful (a tip, a straight answer, an inside look) before any ask.
- End with one easy reply prompt, not a hard sell.
- Follow each channel's norms:
  - Instagram: caption + 3–5 specific hashtags; the first line works without "more".
  - TikTok: on-screen hook in the first second, caption under 100 characters, shot list of 5–7 cuts.
  - X: 280 characters, no hashtag pile, a thread only if each post stands alone.
  - LinkedIn: a short story with one lesson for other owners; no hashtags in the body.
  - Facebook: conversational, a little longer, signed by the team.`,
    example: {
      ask: "Instagram post about the clocks going back",
      answer: "Change your clocks, change your toothbrush.\n\nClocks go back this Sunday, Nov 1. A new toothbrush every time the clocks change is an easy way to remember.\n\nMention this post at your next visit and we'll hand you a new brush.\n\n#daylightsaving #austin #toothbrush",
    },
  },
  {
    id: "trend-remix", name: "Trend remix", builtIn: true, enabled: true, uses30d: 9,
    description: "Turning something that's trending into an original post for this business, without copying it.",
    outputs: "The insight, your angle, then a draft through Viral social posts",
    background: ["voice", "facts", "trends"],
    instructions: `- Find why the trend works underneath (curiosity, relief, belonging, a secret) before writing anything.
- Keep the insight and the format; replace everything else with this business's own story, place and people.
- Never reuse someone else's footage, audio you can't license, or their exact words.
- Skip trends tied to tragedy, politics or anything that would need an explanation.
- Score fit honestly: if it doesn't suit the brand voice, say so and pick another.`,
    example: {
      ask: "Remix the “things I'd never do as a…” trend",
      answer: "Why it works: it feels like a secret from someone who knows.\nYour angle: Dr. Patel, 5 things I'd never do as a dentist, filmed in the South Congress office.",
    },
  },
  {
    id: "gbp-post", name: "Google profile posts", builtIn: true, enabled: true, uses30d: 6,
    description: "Writing posts for the Google Business Profile that help local ranking and get calls.",
    outputs: "One post with a button (Call, Book, Learn more) and a photo suggestion",
    background: ["voice", "facts", "rankings"],
    instructions: `- 150–300 characters. The first 80 show in search, so the point goes first.
- One update or offer per post, tied to a service people search for nearby.
- Mention the neighborhood once, naturally.
- No phone numbers or links in the text (Google often rejects them); use the Call or Book button instead.
- Suggest a real photo of the office or team, never stock.
- Offers need a clear end date.`,
    example: {
      ask: "Google post about emergency appointments",
      answer: "Chipped a tooth or sudden pain? We keep same-day emergency slots open every weekday on South Congress. Tap Call and we'll get you seen today.\n\nButton: Call now · Photo: front desk",
    },
  },
  {
    id: "blog-article", name: "Website articles", builtIn: true, enabled: true, uses30d: 3,
    description: "Writing articles for the website that rank on Google and get quoted in AI answers.",
    outputs: "Title, outline, a 1,200–1,600-word draft and FAQ schema, saved to WordPress as a draft",
    background: ["voice", "facts", "rankings"],
    instructions: `- Answer the question in the first two sentences. AI answers quote the opening.
- Title and H1 use the exact question people search; include the city once.
- Use the "People also ask" questions as H2s, each answered in under 60 words before going deeper.
- Give real numbers where you can (time, typical cost range) and say what it depends on.
- Link to one service page and one related article.
- End with a short FAQ (marked up as FAQ schema) and one soft call to book.
- No medical promises; say when someone should see a dentist today.`,
    example: {
      ask: "Article on what counts as a dental emergency",
      answer: "What counts as a dental emergency? (and what to do tonight)\n\nIf you have severe pain, swelling, a knocked-out tooth or bleeding that won't stop, it's an emergency and you should be seen today…",
    },
  },
  {
    id: "review-reply", name: "Review replies", builtIn: true, enabled: true, uses30d: 21,
    description: "Replying to Google and Yelp reviews, good and bad.",
    outputs: "A reply ready to post, flagged for a person to check when the rating is 3★ or lower",
    background: ["voice", "facts", "reviews"],
    instructions: `- Thank them by first name and mention one specific thing they said.
- Never confirm they're a patient or mention any treatment they didn't name themselves (privacy).
- 2–4 sentences. No copy-paste replies; vary the opening.
- 3★ or lower: apologize once, don't argue, offer a direct contact to fix it offline, sign with a real name.
- Mention a service or the neighborhood only if it reads naturally.`,
    example: {
      ask: "Reply to Jenna R., 5★: “Cracked a molar on Sunday and they fit me in first thing Monday.”",
      answer: "Thank you, Jenna! A cracked tooth on a Sunday is no fun, and we're glad Monday morning worked out. See you next time. — The Maple & Main team",
    },
  },
  {
    id: "report-summary", name: "Report summaries", builtIn: true, enabled: true, uses30d: 2,
    description: "Explaining the month's results in plain words for the owner and team.",
    outputs: "A three-line summary, then what changed, why, and what's next",
    background: ["voice", "results", "rankings"],
    instructions: `- Lead with what the owner cares about: calls, bookings, directions.
- Three lines at most before any detail.
- Say why something moved, not only that it moved.
- One clear next step, with who does it.
- No jargon (no "SoLV", "LCP"); explain any number that needs it.`,
    example: {
      ask: "Summarize October",
      answer: "184 people called you from Google in October, up 12%. You're now in the map pack for “invisalign austin”. Next: reply to the 2★ review from Dan K. this week.",
    },
  },
];
