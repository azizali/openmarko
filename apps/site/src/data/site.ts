// Site-wide content: the home page's copy and FAQ. Plans and the blog are still the boilerplate's placeholders.
import { appConfig } from "../../../../app.config";

export const APP_NAME = appConfig.name;
/** Where "Sign in" and every call to action go. */
export const APP_URL = import.meta.env.VITE_APP_URL ?? "http://localhost:5173";
export const CONTACT_EMAIL = "hello@example.com";

/** The hero's words. A short subtitle on purpose: one line under the headline, not a paragraph. */
export const hero = {
  badge: "Local SEO for Google Maps, search and AI answers",
  title: "See where you rank on Google Maps,",
  accent: "street by street.",
  sub: "Your rank from up to 81 spots around your door, on Google search and in AI answers, plus this week's fixes.",
  primary: "Check my rankings",
  secondary: "See the app",
  points: [
    "Google Maps, Google search and 3 AI assistants",
    "Every change shown first, with an Undo",
    "Connects to your Google Business Profile",
  ],
};

/**
 * Who uses it, for the strip under the hero and the numbers above the quotes. `sample: true` marks stand-ins, shown on
 * the dev server only; production leaves both out until this is real. Replace with your own figures and customers
 * (named only with their permission), then set `sample` to false.
 */
export const proof = {
  sample: true,
  businesses: 1240,
  line: "from one-chair barbers to clinics with thirty locations",
  names: [
    "Bouldin Bikes",
    "Eastside Plumbing Co.",
    "Lady Bird Yoga",
    "Tarrytown Vet",
    "Mueller Family Dental",
    "SoCo Coffee Roasters",
    "Hyde Park Physio",
    "Zilker Roofing",
    "Clarksville Barbers",
    "Cherrywood Florist",
  ],
  stats: [
    { value: 38400, label: "Google Maps spots checked last week" },
    { value: 2950, label: "fixes applied, every one with an Undo" },
    { value: 412, label: "businesses named by ChatGPT for the first time" },
  ],
};

/**
 * What owners say, on the home page. `sample: true` marks the layout's stand-ins: the dev server shows them with a
 * Sample tag and a production build never does. Replace them with real quotes, each with the owner's permission.
 */
export type Testimonial = { quote: string; name: string; role: string; business: string; result?: string; sample?: boolean };
export const testimonials: Testimonial[] = [
  {
    quote: "Our agency said we were number one. The grid showed we vanished four blocks north. We fixed our categories that week.",
    name: "Sample owner",
    role: "Owner",
    business: "a dental practice",
    result: "Top 3 in 21 of 49 spots, up from 9",
    sample: true,
  },
  {
    quote: "I didn't know ChatGPT was sending people to the shop across the street. Now I check what it says every Monday.",
    name: "Sample manager",
    role: "Manager",
    business: "a bike shop",
    result: "Named by ChatGPT for 4 of 6 questions",
    sample: true,
  },
  {
    quote: "We look after twelve clinics. Each one gets its own map, and I approve the fixes for all of them in ten minutes.",
    name: "Sample partner",
    role: "Founder",
    business: "a local marketing studio",
    sample: true,
  },
];

export const features = [
  {
    title: "Sign-in that just works",
    body: "Email and password, Google, magic links and invitations through Better Auth. Verified emails, password resets, sessions.",
  },
  {
    title: "Organizations and roles",
    body: "Every customer gets a space with its own people. Built-in roles, custom roles, and permissions checked on every request.",
  },
  {
    title: "Plans as data",
    body: "Define plans, entitlements and metered usage. Stripe checkout and webhooks when you're ready to charge.",
  },
  {
    title: "AI, your way",
    body: "Any model vendor through one interface. Assistants that answer from your customers' documents, and a chat widget for their websites.",
  },
  {
    title: "Integrations, not vendor lock-in",
    body: "Features depend on capabilities, never on a provider. Swap email or model vendors without touching a feature.",
  },
  {
    title: "Automation that asks first",
    body: "Scheduled runs, tasks with Apply and Undo, and an autopilot your customers control per action.",
  },
];

export const steps = [
  { title: "Fork and name it", body: "One config file: your app's name, the modules you want, the features your customers switch." },
  { title: "Add your keys", body: "Postgres, a mail provider, a model vendor. Each service turns itself on when its keys appear." },
  { title: "Build what's yours", body: "Add a module for your product's logic. Everything around it is already there." },
];

export type Plan = {
  id: string;
  name: string;
  price: number | null;
  cadence: string;
  for: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    cadence: "",
    for: "Try everything with monthly limits.",
    features: ["1 organization, 3 people", "Every feature on", "200k model tokens a month", "Community support"],
    cta: "Start free",
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    cadence: "/mo",
    for: "A team that ships.",
    features: ["Unlimited people", "2M model tokens a month, then pay as you go", "Priority email support", "Custom roles"],
    cta: "Start a 14-day trial",
    featured: true,
  },
  {
    id: "partner",
    name: "Partner",
    price: 199,
    cadence: "/mo",
    for: "Partners managing client organizations.",
    features: ["Everything in Pro", "Client organizations under your brand", "Shared usage across clients"],
    cta: "Talk to us",
  },
];

export const faqs = [
  {
    q: "What is a ranking grid?",
    a: "Google Maps ranks businesses by where the person searching stands. We search your keywords from a grid of spots around your door (5 × 5 up to 9 × 9, reaching up to 10 miles) and show your position at each one.",
  },
  {
    q: "Do I need to give you access to my Google profile?",
    a: "No. Rankings, keywords, AI answers and competitors work from public results. Connect your Google Business Profile only if you want to apply profile changes and posts from OpenMarko.",
  },
  {
    q: "Will you change anything without asking?",
    a: "No. Every suggestion waits for you to apply it, and every applied change can be undone. Autopilot is off until you turn it on, one kind of change at a time.",
  },
  {
    q: "Which AI assistants do you check?",
    a: "ChatGPT, Perplexity and Google's AI Overviews. For each question you track, you see whether you're named, where, what was said and which sites were cited.",
  },
  {
    q: "How often are rankings checked?",
    a: "Daily, weekly or monthly, as your plan allows. Check now runs a page's checks at once when you want fresh numbers.",
  },
  {
    q: "I run an agency. Can I use it for my clients?",
    a: "Yes. Partners manage each client as its own organization, under their own brand, with several locations per client.",
  },
];

export const posts = [
  {
    slug: "hello-world",
    title: "Why we built the boilerplate",
    date: "2026-11-08",
    excerpt: "Every product needs sign-in, teams, billing and email before it does anything interesting. We wanted to write those once.",
    body: [
      "Every product we start needs the same things before it does anything interesting: sign-in, a way for a customer to invite their team, roles, a plan to pay for, emails that arrive, and lately an assistant that knows the customer's documents.",
      "This boilerplate is that list, built once and built to be forked. One config file names the app and chooses the modules; one environment file holds the keys. The rest is yours.",
      "Replace this post with your own. The blog is a shell: a list of posts in one file, rendered as pages.",
    ],
  },
];
