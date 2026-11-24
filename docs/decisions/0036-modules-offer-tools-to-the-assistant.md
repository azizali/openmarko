# 0036. Modules offer tools to the assistant; changes it makes are Tasks

- Status: Proposed
- Date: 2026-11-23
- Affects: kernel, server, ai, automation, seo, web, chat-widget

## Context

A member's chat answers from the model and, with an Assistant, from its knowledge bases. It can't look anything up in
the Organization's data ("why am I behind on *dentist near me*?") or do anything ("track it"). The SEO module holds the
answers and already changes things safely: suggestions are applied as automation Tasks (ADR 0005), with Apply, Undo,
Activity and Autopilot per Action.

Three things had to be settled: where tools are declared so optional modules stay optional, how a tool is kept to what
the member may do, and how a change made from chat stays as safe as one made from a page.

Two frameworks were considered and not taken:

- **Mastra** (agents, workflows, memory, evals on top of the AI SDK). Conversations, metering, Plans and permissions
  live in `ai`; long work runs as automation Runs on pg-boss; changes go through Tasks. Mastra would bring a second
  store for memory, a second workflow engine and a second idea of who may do what. Its tools take a zod schema and an
  `execute`, as ours do, so moving to it later is a change inside `modules/ai`, not in the modules that offer tools.
- **TanStack Start** for the web app. The web app sits behind sign-in, so it gains little from server rendering, and
  its server functions would be a second way to reach the API, which the app reaches over HTTP only (Eden, typed from
  `@app/server`). The site is static. Neither changes how tools work.

The AI SDK, which the chat already streams with, calls tools in a loop (`stopWhen`), checks their input against a
schema, and pauses for a person's approval.

## Decision

- **A module offers tools from `setup()`**, beside its routes and jobs: `tools: AssistantTool[]` (`packages/kernel/src/tools.ts`).
  A tool has a `name` (`<module id>.<verb_noun>`), a `description` the model reads, an `input` zod schema, the
  permission it `requires` (`resource`, `action`), an `effect`, and `run(ctx, caller, input, call)`.
- **The composition root checks them at boot**: named after the module offering it, none twice, each needing a
  permission an enabled module declares. They're gathered into `ctx.tools`, read with `toolsOf(ctx)`. No module imports
  `ai`; with `ai` off nothing calls them, and with a module off its tools are gone.
- **Two effects.** `read` answers from data the caller may see and returns a small summary, not a page's payload.
  `propose` changes nothing itself: it calls `proposeTask` with `createdByType: "assistant"` and returns the Task. The
  Organization's Autopilot for that Action decides whether it applies at once or waits for Apply, and Undo and Activity
  work as for any other Task. There is no third effect that writes directly.
- **The member's Role decides what's offered.** `toolsFor(ctx, caller, call)` in `modules/ai` gives the model only the
  tools whose permission the caller holds; the model can't call a tool it wasn't given. A tool reads through the
  module's services with `caller.orgId`, so what the client says about the page it's on is a hint, never trusted.
- **Only members' chat has tools.** Visitors on a website's widget aren't members and get none.
- **A refusal the app explains goes back to the model.** A tool's AppError (not found, Plan limit, `needs_connection`)
  is the tool's result, so the answer can say why; anything else fails the turn.
- **Names the model sees** replace the dot with two underscores (`seo__keyword_detail`): providers allow only letters,
  digits, `_` and `-`.
- **In a member's turn** (`runTurn` with the caller), the model gets those tools, at most `TOOL_STEPS` (5) model calls,
  and a line in its instructions: a proposal isn't a change, so say whether it was applied. The web app sends the page
  the member is on with each message. The answer is saved as UI message parts: each step's text, and each tool call
  with what it returned, so the next turn's history and the chat's history both keep them. An answer without tools is
  one text part, as before.
- **The chat shows tools** as a line each ("✓ recent activity") and a proposed Task as a card with **Apply** (the
  member's backend applies it through the Tasks route; Undo stays in Activity). Visitors' chats have no tools, so they
  show none.
- **A member's chat knows what the app does.** A module's manifest may carry an `assistantBrief`: what it does for
  members and which page shows what, by on-screen labels, never the app's name. A member's turn is told, after the
  widget's own instructions: the Organization's name, the enabled modules' briefs, to answer from the app (a tool, or
  the page that shows it) and never send the member to another product, then the tool rules and the page they're on.
  A widget's own instructions still come first; without any, the built-in widget is a plain assistant plus this.
- **Answers are Markdown, shown formatted.** The widget parses an answer (`packages/chat-widget/src/markdown.ts`) and
  builds it with DOM calls, never innerHTML, so a model's text can't become markup on someone's website; links open
  only http(s) and mailto. A person's message stays plain text.
- **The stub model calls tools too:** a message `/tool <model name> {json}` calls that tool when the turn offers it,
  and the next step reports what it returned, so tools are tried and tested without a model key.
- The boilerplate ships two examples in automation: `automation.recent_activity` (read) and
  `automation.rename_organization` (propose, the example Task kind).

## Consequences

- A feature adds what the assistant can do in its own folder, tested like a service. The assistant can never do more
  than the member could do on a page, nor anything Autopilot would hold back.
- A Task card (its title, "Proposed" or "Applied", Apply) is the way the chat shows a change: the same Task the
  Automation page lists.
- Every tool step is model tokens, metered as `llm.tokens` like any turn; a step limit keeps one question from running long.
- SEO offers read tools (`modules/seo/src/tools.ts`): its Locations, the overview, Google Maps rankings and one Maps
  keyword's board, Google search rankings, AI answers, competitors per channel, and open suggestions.
- Next: SEO tools that propose (track a keyword or question, apply a suggestion) and read the Action plan and Site
  audit, once Rankings / Actions (ADR 0037) is merged.
