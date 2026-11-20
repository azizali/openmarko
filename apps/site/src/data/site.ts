// Site-wide content. Placeholder copy: replace every line with your product's before launch.
import { appConfig } from "../../../../app.config";

export const APP_NAME = appConfig.name;
/** Where "Sign in" and every call to action go. */
export const APP_URL = import.meta.env.VITE_APP_URL ?? "http://localhost:5173";
export const CONTACT_EMAIL = "hello@example.com";

export const hero = {
  title: "Your product,",
  accent: "ready in a day,",
  muted: "not a quarter.",
  sub: "Sign-in, organizations and roles, billing, email, AI and integrations come built in. You write the part that is yours.",
  primary: "Start free",
  secondary: "See pricing",
};

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
    q: "Can I turn modules off?",
    a: "Yes. Each optional module (billing, partners, AI, knowledge, automation) is a switch in one config file. Off, it never reaches the build.",
  },
  { q: "Which database does it use?", a: "Postgres. Locally in Docker; in production a managed provider such as Neon." },
  { q: "Where does it run?", a: "The API and worker on any VPS with Docker, deployed with Kamal. The web app and this site on Vercel." },
  { q: "Is my data mine?", a: "Yes. One database per app, yours to export or move at any time." },
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
