# Glossary

The words the code, the docs and the screens use. Each Project built on the boilerplate adds its own below these.

**App**:
The product this repository is: one deploy, one database. In the Admin area, "the app's own" means something that belongs to the app rather than to an Organization: its email provider, its default model key.
_Avoid_: platform, project, tenant

**Admin**:
A person with the `admin` role on their user: they see the Admin area (users, Organizations, the app's connections and settings). Made by `ADMIN_EMAILS` or by another admin. Independent of any Organization Role.
_Avoid_: operator, superuser

**Organization**:
The space a customer works in: its people, Roles, settings, connections and data. A person can belong to several.
_Avoid_: workspace, company, tenant, account

**Member**:
A person with access to an Organization, with a Role in it.
_Avoid_: user (for a member), seat

**Role**:
What a Member may do in an Organization: a level (None, View, Edit, Publish or Full) for everything, per group and per resource, or a hand-picked list of actions. Owner, Admin, Editor and Viewer are built in; each Organization can add its own. One Role per Member, no exceptions.
_Avoid_: permission set, access level

**Action**:
One thing a Role can allow on a resource, such as `member.update` or `ai.chat`. Each sits at a level, so setting a level grants every Action up to it.
_Avoid_: permission, scope

**Module**:
One folder under `modules/`, owning its tables, routes, jobs and events, declared in a manifest. Core modules are always on; optional ones are switches in `app.config.ts`.

**Feature**:
A switch an Organization turns on or off in Settings → Features, declared in `app.config.ts`. A feature is on when its module is enabled, the Plan allows it and the Organization has it on.
_Avoid_: flag, toggle (in what people read)

**Plan**:
What an Organization or Partner pays for. Each Plan sets its own Entitlements and meters; nothing in the app depends on a Plan's name. A default Plan applies to any Organization without one.
_Avoid_: tier, package, subscription (the subscription is the paying arrangement)

**Entitlement**:
One thing a Plan allows, as a number: a feature (on or off), a limit (how many), an Action taken away, or `partner`.
_Avoid_: quota, allowance

**Meter**:
A unit of metered use a Plan sells (`llm.tokens`, `email.sent`): how many are included per month and what happens past that (block, charge, or only with the Organization's own key).

**Integration**:
An outside service connected so the app can act on someone's behalf: an email provider, a model vendor, Slack. In code, the catalog entry is a `Provider` and one connected instance is a `Connection`.
_Avoid_: plugin, tool

**Capability**:
Something the app needs done that an Integration can provide (`email.send`, `llm.complete`). Features depend on Capabilities, never on one Provider.

**Connection**:
One connected Provider, with its encrypted credentials. An Organization's own, or the app's (used by every Organization without its own).

**Assistant**:
A model, instructions and the knowledge bases it answers from, owned by an Organization. Its chat widget can answer on websites it allows.
_Avoid_: bot, agent

**Chat widget**:
The floating chat button and its panel, with past chats and a new chat. The panel floats, docks to the side of the page, or goes wide over most of the screen. Members have one in the app, answering as the widget their Organization is offered (the **in-app widget**); a website embeds an Assistant's with one script tag, for its anonymous visitors. The button can be dragged anywhere on the page. The app's Widgets page is where an Organization makes them: on screen a widget and its Assistant are one thing.
_Avoid_: chatbot, copilot, bubble

**In-app widget**:
The widget the chat button inside the app answers as. The nearest choice wins: the Organization's own, its Partner's (reaching its Clients), the app's (reaching everyone), then the Organization's **built-in widget**, a starter with no instructions and the default model that every Organization has and none can delete. A widget chosen from another Organization answers with its owner's knowledge and model, and its owner is metered.

**Knowledge base**:
An Organization's documents, chunked and embedded, searched by meaning and by words.

**Task**:
A change the app or a person proposes, applied with one click and undone with another. Autopilot applies it on its own when the Organization allows that Action.

**Run**:
One execution of a job for an Organization, shown with its cost.

**Activity**:
The log of who did what, written in the same transaction as the change.

**Partner**:
A business that creates and manages Client Organizations and shows its own brand to them. An Organization on a Plan with `partner`. Optional module.
_Avoid_: agency, reseller

**Client**:
What a Partner calls an Organization it manages. It is an Organization, not a separate thing.

**Whitelabel**:
A Partner's name, logo, colour and assistant name in place of ours, on everything its Clients and its own people see.

## SEO

**Location**:
A business an Organization tracks in SEO: a place customers visit, with at most one Google Business Profile. An Organization can have several. A draft until it's launched.
_Avoid_: business (in code), store, branch

**Website**:
A domain one or more Locations use. Google search positions are read for it.

**Check**:
One look at where a Location shows: Google Maps (a grid of searches around it), Google search, or AI answers. A cycle of checks runs on the Location's schedule and is one Run.
_Avoid_: scan (except for one keyword's map grid), audit

**Grid**:
The spots around a Location that Google Maps is searched from, 5, 7 or 9 a side. "Top 3 in 31 of 49 spots" counts them.

**Competitor**:
A business or site that shows up for a Location's keywords or questions. Found, not typed in; a Member can add one by hand or hide one. Different per channel (Maps, Google search, AI answers) and per keyword.

**Question**:
What a Location asks the AI assistants, the way a customer would ask it.
_Avoid_: prompt (in what people read)

**Suggestion**:
Something to do next for a Location, made from what the checks found, saying what it was based on. Applying one is a Task, so it can be undone.
_Avoid_: recommendation, insight, action item
