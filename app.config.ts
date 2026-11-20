// The one file a fork edits first. Plain data, imported by the API, the worker and the web app (Vite reads it in
// vite.config.ts and turns `modules` into build-time constants, so a module that is off never reaches the bundle).
// Nothing here is secret; secrets are environment variables (.env.example).

export const appConfig = {
  /** Shown in the app, emails and API docs. Partners' whitelabel brands replace it for their Clients. */
  name: "Boilerplate",
  /** A short id used in cookies and queue names: lowercase letters, digits, dashes. */
  slug: "app",

  /**
   * Optional modules. Core modules (identity, organizations, access, features, settings, integrations, messaging)
   * are always on. Turning one off removes its tables from the next migration, its routes from the API and docs,
   * its jobs from the worker, and its pages from the web app.
   */
  modules: {
    /** Plans, Entitlements, metering and Stripe. Off: every Organization has every feature, unlimited. */
    billing: true,
    /** Partners managing Client Organizations, consent and whitelabel brand. */
    partners: true,
    /** Models by name through many vendors, conversations, assistants and the embeddable chat widget. */
    ai: true,
    /** Knowledge bases, documents and hybrid search (pgvector). Assistants answer from them; needs `ai`. */
    knowledge: true,
    /** Runs, schedules, Tasks with Apply and Undo, Autopilot and the Activity log. */
    automation: true,
  },

  /**
   * How people sign in. Email and password is always on. Google turns itself on when GOOGLE_CLIENT_ID and
   * GOOGLE_CLIENT_SECRET are set. Magic links need the app to be able to send email (an email Connection and a
   * sender in Admin → Email).
   */
  auth: {
    magicLink: false,
    /** Whether anyone may sign up. Off: people join only by invitation (or an admin creates them). */
    openSignUp: true,
    /** Ask people to verify their email after signing up (sent when the app can send email). */
    verifyEmail: true,
  },

  /**
   * The feature switches each Organization can turn on and off (Settings → Features), and a Plan can grant.
   * Add your own features here; `needsAny` names the provider capabilities a feature depends on.
   */
  features: [
    { id: "assistant", label: "AI assistant", description: "Chat with the app's assistants.", module: "ai" },
    { id: "knowledge", label: "Knowledge bases", description: "Documents the assistant answers from.", module: "knowledge" },
    { id: "automation", label: "Automation", description: "Scheduled runs, tasks and autopilot.", module: "automation" },
  ],
} as const;

export type AppConfig = typeof appConfig;
export type OptionalModule = keyof AppConfig["modules"];
export type FeatureId = AppConfig["features"][number]["id"];
