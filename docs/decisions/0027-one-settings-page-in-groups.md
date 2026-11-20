# 27. One Settings page in groups

- Status: Accepted
- Date: 2026-11-08
- Affects: web

## Context

Team, Clients, Whitelabel and Admin were pages of their own in the sidebar, and Settings held the rest. Nothing told a person whether a setting applied to the Organization, to every Client of a Partner, only to themselves, or to the whole app.

## Decision

- Everything that isn't day-to-day work is a section of Settings, at `/settings/<section>`, under one rail.
- The rail has four groups: the open Organization (shared by everyone on it), its Partner side (only when the open Organization is a Partner), You (follows the person to every Organization), and App admin (only for app admins, and the same whichever Organization is open).
- The old `/team`, `/clients`, `/whitelabel` and `/admin` addresses redirect.
- A Partner's own people are the Team of its Organization, so there is no separate Partner team section.

## Consequences

- A fork adds a setting by adding one entry to a group, and the group says who it affects.
- App admin sections sit beside the Organization's own, so each group's title and hint have to make clear which one is open. Connections (the app's) and Integrations (the Organization's) are the pair to watch.
- The rail is long for an app admin: 17 links on an ordinary Organization, 19 on a Partner.
- The sidebar stays short and only holds work.
- Team is one click further away than it was.
- A section with actions beside its heading draws its own heading; the others get theirs from Settings.
