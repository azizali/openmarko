# OpenMarko

OpenMarko is where a local business does all its marketing: search (local, AI and general), reviews, social posts and community replies. These are the words for what it manages and how the pieces relate.

## Structure

**Project**:
One application built on mkitup, the backend platform, such as OpenMarko. It decides which modules answer and holds its own sign-in, payment and email settings. Users are never shared between Projects. Platform-level; an Organization's Members never see it. Its servers call the platform with secret keys that Operators issue.
_Avoid_: app, application, tenant

**Operator**:
A person who manages Projects in the mkitup console: their keys, modules, sign-in, Connections, limits and users. Not a Member of any Organization because of it. Platform-level; a Project's users never see Operators.
_Avoid_: admin, developer, superuser

**Organization**:
The business or brand OpenMarko markets, and the top of everything else. Most have one Location, one Website and one Account per Platform; any of those can be many.
_Avoid_: business, workspace, company, tenant

**Member**:
A person with access to an Organization, with a role in it. One person can be a Member of many Organizations, and of a Partner.
_Avoid_: user, seat

**Partner**:
An agency, consultant or reseller that manages Organizations for others and puts its own brand on the app for them. The only level above Organization within a Project. Each Organization belongs to at most one Partner and can transfer out, keeping its data.
_Avoid_: agency (in code and data), reseller, workspace, parent org

**Role**:
What a Member may do in an Organization: a level (None, View, Edit, Publish or Full) for everything, per module and per feature, or a hand-picked list of actions. Owner, Admin, Editor and Viewer are built in; each Organization can add its own. A Member has one Role, with no per-person exceptions.
_Avoid_: permission set, access level, profile

**Action**:
One thing a Role can allow on a feature or area, such as posting review replies or sending a campaign. Each sits at a level, so setting a level grants every Action up to it.
_Avoid_: permission, scope, capability

**Client**:
What a Partner's Members call an Organization they manage for someone else. It is an Organization, not a separate thing.
_Avoid_: customer, sub-account

**Whitelabel**:
A Partner's name, logo, colour, domain and email sender in place of ours, on everything its Clients see. Set once per Partner, never per Organization. With it on, nothing says OpenMarko or Marko; the assistant is called "AI Assistant" unless the Partner renames it.
_Avoid_: white-label, branding, custom branding, reseller mode

**Plan**:
What an Organization or Partner pays for. Each Plan sets its own Entitlements; nothing in the app depends on a Plan's name. A Partner's Plan covers its Clients.
_Avoid_: tier, package, subscription (the subscription is the paying arrangement; the Plan is what it buys)

**Entitlement**:
One thing a Plan allows, as a number: a feature (on or off) or a limit (how many Locations, keywords, grid points). Separate from feature switches, which are the Organization's choice, and from Roles.
_Avoid_: quota, allowance, feature flag

**Location**:
A physical place customers visit, with its own address, hours, keywords and map rankings.
_Avoid_: branch, store, site, listing

**Google Business Profile**:
The listing for one Location on Google Search and Maps. Each Location has at most one. Always written in full in the app and docs. It is reached through a Google account connected as an Integration, which need not be the Google account a Member signs in with.
_Avoid_: Google profile, GBP (in what people read; fine in code), GMB, listing, Google page

**Website**:
A site the Organization owns, known by its domain. Independent of Locations: an Organization can have Websites and no Locations. Audits work on the whole domain, never one page.
_Avoid_: site, domain, property

**Platform**:
A service where people post and talk, such as Instagram, Facebook, X, TikTok, LinkedIn, Reddit, Quora, Nextdoor or Google. The Organization posts on some through its Accounts and joins Conversations on others.
_Avoid_: network, channel, social

**Account**:
The Organization's own profile on one Platform, the thing it posts from (an Instagram profile, a Facebook Page). It speaks for the whole Organization unless it's tagged to one Location. Connecting one is an Integration.
_Avoid_: channel, handle, page, social account

**Integration**:
An outside service connected to the Partner, the Organization, a Location or a Website so the app can read data, make changes or send on its behalf: Amazon SES, Twilio, Instantly, Meta Ads, Search Console, an Instagram Account. Each one provides Capabilities. All of them are managed in one place, Settings → Integrations. In code, the catalog entry is a `Provider` and one connected instance is a `Connection`.
_Avoid_: tool, app, plugin, connection (in what people read)

**Capability**:
Something the app needs done that an Integration can provide, such as sending email, publishing ads or replying to reviews. Features depend on Capabilities, never on one Integration. Each says how many it takes: one per Organization (the email sender), one per Location (the Google Business Profile), or any number (ad accounts).
_Avoid_: feature, permission, scope, ability

**Scope**:
What a screen is about right now: the whole Organization, one Location, one Website or one Account.
_Avoid_: view, filter, context

## Voice and writing

**Brand voice**:
How the Organization sounds. Shared by every Location and Account.
_Avoid_: tone, style guide

**Business facts**:
What the Organization lets Marko say about it: services, hours, offers and the rules it always follows.
_Avoid_: profile, about

**Skill**:
Instructions Marko follows for one kind of writing, such as review replies or viral posts, on top of the Brand voice.
_Avoid_: template, prompt

## Social

**Post**:
Something the Organization publishes to one or more Accounts, with a version for each.
_Avoid_: content, update

**Conversation**:
A post by someone else, on a Platform the Organization doesn't control, that it should reply to.
_Avoid_: opportunity, thread, lead

**Watched profile**:
Someone else's profile on a Platform that the Organization keeps an eye on, either a competitor or someone it admires. Their standout posts become ideas to remix.
_Avoid_: spy list, following, competitor account

**Trend**:
A format or topic catching on elsewhere that the Organization could make its own.
_Avoid_: viral idea, remix

**Swipe file**:
The Organization's library of formats and ideas worth reusing, saved from Trends or written by its Members.
_Avoid_: templates, library, saved ideas
