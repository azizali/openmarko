// The embeddable chat widget. A website adds:
//   <script src="https://<the app's API domain>/widget/v1.js" data-assistant="<assistant id>" async></script>
// and its visitors get a floating chat button. The API checks the page's origin against the assistant's allowed
// websites. Built by Bun and served by the API; the UI is chat.ts, the same one the app's members use.
import { accentTheme, mountChat, type ChatHandle } from "./chat";
import { visitorBackend } from "./visitor";

type Config = { name: string; greeting: string; accent: string; turnstileSiteKey: string | null };

const script = document.currentScript as HTMLScriptElement | null;
const API = script ? new URL(script.src).origin : location.origin;
const ASSISTANT = script?.dataset.assistant ?? "";

/** A Turnstile token: rendered invisibly outside the shadow DOM, where it works. */
function turnstileToken(siteKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const run = () => {
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;bottom:0;left:0;";
      document.body.appendChild(host);
      (window as unknown as { turnstile: { render: (el: HTMLElement, o: object) => void } }).turnstile.render(host, {
        sitekey: siteKey,
        size: "invisible",
        callback: (token: string) => {
          host.remove();
          resolve(token);
        },
        "error-callback": () => reject(new Error("The visitor check failed.")),
      });
    };
    if ((window as unknown as { turnstile?: unknown }).turnstile) return run();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.addEventListener("load", run);
    s.addEventListener("error", () => reject(new Error("The visitor check didn't load.")));
    document.head.appendChild(s);
  });
}

class AppChat extends HTMLElement {
  private chat: ChatHandle | null = null;

  async connectedCallback() {
    const res = await fetch(`${API}/api/v1/widget/assistants/${ASSISTANT}`).catch(() => null);
    if (!res?.ok || !this.isConnected) return; // not on an allowed website, or the assistant is off: show nothing
    const config = (await res.json()) as Config;
    const siteKey = config.turnstileSiteKey;
    this.chat = mountChat(this, {
      backend: visitorBackend({
        api: API,
        assistant: ASSISTANT,
        visitorCheck: async () => (siteKey ? turnstileToken(siteKey) : undefined),
      }),
      name: config.name,
      greeting: config.greeting,
      maxLength: 2000,
      launcher: true,
      resume: true,
      theme: accentTheme(config.accent),
    });
  }

  disconnectedCallback() {
    this.chat?.destroy();
    this.chat = null;
  }
}

if (ASSISTANT) {
  // Defined once per page; the button is added whenever the script runs and there is none yet.
  if (!customElements.get("app-chat")) customElements.define("app-chat", AppChat);
  if (!document.querySelector("app-chat")) document.body.appendChild(document.createElement("app-chat"));
}
