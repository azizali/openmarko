# 0031. The chat button in the app uses a widget someone chooses

- Status: Accepted
- Date: 2026-11-09
- Affects: ai, web, chat-widget
- Amends: [0025](0025-one-chat-widget-for-members-and-visitors.md)

## Context

The chat button inside the app was a plain chat with the default model: no instructions and no knowledge. A product owner wants one help bot, built from the product's docs, for every customer. An agency wants one for all its Clients. A fork wants a working assistant before anyone configures anything. The widget someone builds under Widgets (an Assistant, [0025](0025-one-chat-widget-for-members-and-visitors.md)) already has all of that, but it could only answer on websites.

## Decision

- **A setting chooses the widget.** `ai.assistant` holds an assistant id, at the app level and at an Organization. The chat button uses the widget its Organization is offered.
- **The nearest choice wins:** the Organization's own, then its Partner's, then the app's, then the Organization's built-in. A Partner's choice is its Organization's setting, so it reaches its Clients, and a Client can override it with its own.
- **Every Organization has a built-in widget**, made the first time it's needed: named Assistant, no instructions, the app's default model. It is edited like any widget and never deleted, so the chat always has an assistant and works before anyone chooses. A column and a unique index keep it to one per Organization.
- **A widget offered by another Organization** answers with its owner's instructions, knowledge and model. Its owner's Organization is the one metered, on its Plan and with its key. The conversation stays the member's own and private. A member can start a chat only with an assistant their Organization owns or is offered, and a chat whose assistant is no longer offered stops with a message to start a new one.
- **Where it is chosen:** a **Use in the app** button on every widget's page and, for an app admin, **Use for everyone in the app**. Admin → Models shows the app's choice and changes it. All of them write the same setting.
- **The floating button can be dragged** anywhere on the page, and the panel opens beside it. Its place is kept per browser. This applies to the widget on websites too.

## Consequences

- A product owner builds one widget in one Organization, chooses it for everyone, and every later change to its documents, model or instructions reaches all users at once. Nothing is published or copied.
- The owner's Plan limit is the help bot's budget. When it runs out, the bot stops for everyone who uses it.
- A Partner can't stop a Client from choosing its own widget.
- A chat belongs to the assistant it started with, so changing the chosen widget starts a fresh list of past chats in the app. The earlier ones are kept.
- An assistant has no tools yet, only instructions, a model and knowledge ([0014](0014-llms-are-integrations-with-an-app-default.md)). Tools will arrive in the same place.
