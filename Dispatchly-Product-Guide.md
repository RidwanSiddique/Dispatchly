# Dispatchly — The Complete Product Guide

*A plain-English walkthrough of what Dispatchly does, who uses it, and how every piece fits together — written for anyone, no tech background required.*

---

## Table of Contents

1. [What Dispatchly Is (in one paragraph)](#1-what-dispatchly-is)
2. [The Problem It Solves](#2-the-problem-it-solves)
3. [Who Uses Dispatchly — The Seven Roles](#3-who-uses-dispatchly)
4. [The Big Picture — How Everything Connects](#4-the-big-picture)
5. [Feature-by-Feature Deep Dive](#5-feature-by-feature)
6. [Real-World Scenarios (Told As Stories)](#6-real-world-scenarios)
7. [What Makes Dispatchly Different](#7-what-makes-dispatchly-different)
8. [Getting Started — What Happens Day One](#8-getting-started)

---

## 1. What Dispatchly Is

**Dispatchly is a smart help desk for your company.**

Think of it as the "mission control" that sits between the people who need help (employees, customers) and the people who fix things (your IT team, HR team, support team). When someone has a problem — their laptop won't turn on, they need a new software account, the WiFi is down — they tell Dispatchly. Dispatchly figures out who should handle it, tracks how long it's taking, warns everyone before deadlines are missed, and remembers the solution so nobody has to solve the same problem twice.

It's built on the same professional playbook that big companies use (called "ITIL"), but wrapped in a friendly interface that anybody can pick up in an afternoon.

---

## 2. The Problem It Solves

If your organization currently handles support requests with a mix of emails, Slack pings, sticky notes, "hey can you look at this" hallway conversations, and a shared spreadsheet — Dispatchly replaces all of that.

Here's what usually goes wrong without a system like this:

- **Tickets get lost.** Someone emails "printer broken" and it disappears into a busy inbox.
- **Nobody knows who's on it.** Two techs work on the same problem while three others sit idle.
- **Urgent things wait behind trivial things.** A CEO's laptop and a routine password reset get the same attention.
- **Deadlines get missed silently.** You only find out something is late when the person complaining calls you.
- **The same problem is solved from scratch every time.** No memory. No learning.
- **Managers have no idea what's happening** until end-of-month, when the damage is already done.

Dispatchly fixes every one of these, all in one place.

---

## 3. Who Uses Dispatchly

Dispatchly has **seven types of users**. Each one sees a different view of the system, tailored to what they actually need to do. Nobody wades through screens they don't use.

### The Requesters — the people who *need* help

**Client** — an outside customer, or in some setups, a regular employee. They see a clean, simple portal: "I have a problem." They can browse a catalog of services (like ordering from a menu — "I need Microsoft Office," "I need a new laptop"), submit a ticket, and track its progress. They cannot see other people's tickets. Their world is small and simple by design.

**HR** — the same requester experience as a client, but flagged as an internal HR person. Useful when HR needs help with people-operations software, onboarding new hires, or handling employee-related IT requests.

### The Fixers — the people who *do* the work

**Agent (Tier 1)** — the front-line responder. Think of them as the friendly voice on the help desk. They see every incoming ticket, triage it (decide how urgent it is, what category it falls under), fix the easy ones themselves, and pass the hard ones to specialists. Agents can also turn a resolved ticket into a knowledge-base article so the next agent can solve the same problem faster.

**Technician (Tier 2)** — deeper technical expertise. When a Tier 1 agent escalates a ticket, it lands with a technician who specializes in that category (Network, Hardware, Software, etc.). Technicians resolve tickets but don't do the initial escalation themselves — they receive escalations.

**Specialist** — subject-matter experts. Think of a clinical-systems specialist in a hospital, or a security specialist at a bank. They handle niche escalations and — importantly — they curate the knowledge base, keeping it accurate and useful.

### The Overseers — the people who *run* the operation

**Manager** — sees the full picture. Manages their team, approves service requests that need sign-off (like ordering an expensive piece of software), reviews performance metrics, sets on-call schedules, and forces status changes on team members if needed ("Bob, you're on break, but this is a P1 emergency").

**Admin** — the top of the tree. Full access to everything. Manages users, adjusts business hours, defines SLAs (service level agreements — the deadlines), configures the service catalog, and can override any permission.

### A quick mental model

Imagine a hospital:
- **Clients** are patients arriving at the front desk.
- **Agents** are the intake nurses — they figure out what's wrong and either handle it or send you to a specialist.
- **Technicians** are the doctors doing the actual treatment.
- **Specialists** are the surgeons or subject experts brought in for complex cases.
- **Managers** are the department heads.
- **Admins** are the hospital administrators running the whole institution.
- **HR** is a specific type of "patient" the hospital treats a little differently.

---

## 4. The Big Picture

Here's the whole platform in one flow, told as a story.

Someone (a client) has a problem. They open Dispatchly and either fill out a form, pick something from the service catalog, or just send an email to the help-desk address. Dispatchly captures it and creates a **ticket** — a durable record of that request.

The ticket is automatically tagged with a **priority** (P1 = emergency, P4 = whenever), a **category** (Network, Hardware, Software, etc.), and a **deadline** based on that priority (P1 = 1 hour, P4 = 3 business days). The system then finds the best available person to handle it — someone who is on shift right now, has the right skills, isn't already drowning in tickets, and works in the right department. That person gets notified — both a little bell in their Dispatchly view, and an email in their inbox.

While the ticket is being worked on, an invisible **timer** is running in the background. Every five minutes, Dispatchly quietly checks: are we running out of time? At 75% of the deadline, it whispers a warning to managers ("this one is at risk"). If the deadline actually passes, it shouts ("breached!"), automatically escalates the ticket up the chain, and notifies everyone involved.

The person handling the ticket can add public comments (the requester sees them) or internal notes (only staff see them), log time spent, request approval from a manager if needed, link the ticket to a bigger recurring problem, or pull in colleagues via change management.

When it's fixed, the resolver marks it resolved and writes down what they did. If the fix seems reusable, they click a button that turns it into a **knowledge base article** — a searchable how-to that anyone can consult next time.

Meanwhile, the manager dashboard is quietly aggregating all of this: how many tickets are open, how many are on-track vs at-risk vs breached, average resolution time, breakdowns by priority and category, who's crushing it and who's overloaded.

That's it. That's the whole loop. Everything else in the platform exists to make this loop faster, smarter, or more visible.

---

## 5. Feature-by-Feature

Every feature explained in plain language, in the order you'd naturally encounter them.

### 5.1 Login & Personalized Home

The first thing anyone sees is a login page. Enter your email and password, and Dispatchly gives you a secure session cookie that lasts 24 hours. Behind the scenes, it also records your **role** so the next screen is tailored to you.

- A **client** logs in and lands on a simple portal showing their own tickets.
- An **agent** lands on the dashboard, showing everything happening across the operation.
- A **manager** sees the dashboard plus team-wide health indicators.

**How it connects:** Login determines which sidebar links appear, which pages you can visit, and which buttons show up on the pages you can visit. It's the single decision that shapes your whole experience.

### 5.2 The Dashboard

The dashboard is the "cockpit view." For staff (agents, technicians, specialists, managers, admins), it shows:

- **SLA Health** — a traffic-light view of every open ticket. Green = comfortable, yellow = cutting it close, red = missed.
- **Open Ticket Breakdown** — by priority (how many P1s, P2s, etc.), by status (New, In Progress, Escalated), by category (Network, Hardware, etc.).
- **Average Resolution Time** — how quickly are things being closed?
- **Recent Activity** — what's happened in the last hour.

For requesters, the dashboard just shows their own tickets and a "submit a new one" button.

**How it connects:** The dashboard doesn't do work — it reads work happening everywhere else. Every ticket created, escalated, resolved, or breached updates the numbers here in near-real-time.

### 5.3 Ticket Intake (Three Ways In)

There are **three ways** a ticket can enter the system, and Dispatchly treats them all the same once they're in.

**a) The web portal** — someone opens Dispatchly and clicks "New Ticket." A form appears asking them what happened, how urgent it is, what department they're in. Simple.

**b) The service catalog** — instead of a blank form, they pick from a curated menu. "Request a new laptop." "Request VPN access." "Reset my password." Each menu item can have its own custom form fields (e.g., "Which laptop model do you want?"), its own default priority, and can require manager approval before work starts.

**c) Email** — they just send an email to the help-desk address. Dispatchly checks that mailbox every 2 minutes, and any unread messages are automatically turned into tickets, with the sender treated as the requester. Dispatchly is smart enough to notice if the same email arrives twice (via a hidden message ID) so you never get duplicate tickets.

**How it connects:** All three paths create a row in the `tickets` table with a `source` field marked `portal`, `catalog`, or `email`. From that moment on, everything downstream — assignment, SLA tracking, notifications — works identically regardless of how the ticket was born.

### 5.4 Automatic Priority & SLA (Service Level Agreement)

Every ticket gets a **priority** from P1 to P4:

- **P1 — Critical.** Something major is broken (email is down for the whole company). Deadline: **1 hour**.
- **P2 — High.** Significant impact (a whole team can't work). Deadline: **4 hours**.
- **P3 — Medium.** Normal issue (one person's screen is flickering). Deadline: **1 business day (8 hours)**.
- **P4 — Low.** Nice-to-have (please install this optional plugin). Deadline: **3 business days**.

An admin can also define **richer SLA rules** — for example: "Tier 1 must respond within 30 minutes for P1s and P2s" (an OLA — internal team agreement), or "The hardware vendor must deliver a replacement within 4 hours" (a UC — vendor contract). Every ticket can have multiple SLA clocks running at once, each tracked separately.

**Business hours** matter too. If it's 3 AM on Saturday, low-priority SLA clocks pause — no fair penalizing the team for after-hours idleness. High-priority clocks (P1, P2) run 24/7 because emergencies don't care about business hours.

**How it connects:** The SLA clock is the heartbeat of the whole system. It's what triggers warnings, escalations, notifications, and manager alerts. Without SLAs, tickets would just sit; with them, they *have* to move.

### 5.5 Smart Auto-Assignment (Skills-Based Routing)

When a ticket lands, Dispatchly doesn't just pick a random tech. It scores every possible candidate on:

1. **Are they available right now?** Someone who is "available" wins over someone who is "on duty," who wins over someone "on call," who wins over someone marked "busy."
2. **Do they have the right skills?** If the ticket is about firewalls and needs level-4 proficiency, Dispatchly looks for someone who has "Firewall & Security" at level 4 or higher.
3. **How busy are they?** Someone with 2 open tickets wins over someone with 15.
4. **Are they in the right department?** All else being equal, someone in the same department as the requester is preferred.

The best candidate wins the assignment and gets notified instantly.

**How it connects:** This uses data from three places at once — the **on-call schedule** (who's actually on duty), the **skills catalog** (what people are good at), and the **live ticket queue** (who's overloaded). It's why maintaining accurate schedules and skill profiles pays off — the smarter that data, the smarter the routing.

### 5.6 The Ticket View

Once you open a ticket, you see:

- **The header** — title, priority, status, category, who submitted it, who it's assigned to.
- **The description** — what the requester originally wrote.
- **A live SLA bar** — a visual countdown showing how much of the deadline is left.
- **The comment thread** — chronological updates from anyone involved. Comments can be marked **internal** (only staff see them, useful for "I think this user is exaggerating") or **public** (the requester sees them too).
- **Escalation history** — a record of every time this ticket was passed up the chain.
- **Time entries** — how long each person worked on it.
- **Attached knowledge base articles** — if the ticket got turned into KB, or the resolver referenced an existing article.
- **Linked problems / changes** — if this ticket is part of a bigger investigation.
- **Approvals** — if the service catalog item required manager sign-off, that appears here.

**How it connects:** The ticket page is the **hub** where every other feature shows up in context. Everything Dispatchly can do to help resolve an issue is one click away from here.

### 5.7 Escalation

Sometimes a Tier 1 agent looks at a ticket and thinks: "I don't have the expertise for this." They click **Escalate**. Dispatchly asks: "Why?" and "Which team?" (with a smart default based on the category — Network → Network Infrastructure Team, Hardware → Desktop Support, etc.). The status flips to "Escalated," the receiving team is notified, and the ticket is now their responsibility.

**Auto-escalation** also happens without human input: if the SLA is breached, Dispatchly automatically escalates the ticket, so managers are guaranteed to see it even if the original agent went silent.

**How it connects:** Escalation is how work moves up the tiers. Combined with the SLA monitor, it means nothing ever quietly rots — either a human moves it, or the system does.

### 5.8 Comments, Time Tracking & Approvals

While a ticket is in flight:

- **Comments** let everyone communicate on the record. Instead of scattered emails and DMs, all context lives with the ticket.
- **Time tracking** lets each person log how many minutes they spent. Managers can later see how much effort a request actually consumed — useful for capacity planning and billing.
- **Approvals** are for service requests that need a green light. If someone requests a $2,000 software license, the system pauses the ticket at "Pending Approval" and pings the designated approver (usually a manager). Once they approve or reject, the ticket resumes.

**How it connects:** These are the "in-flight" mechanics. They don't determine what a ticket is — they capture what happens *to* it while it's alive.

### 5.9 Resolution & the Knowledge Base

When someone fixes a ticket, they write **resolution notes** — what the actual problem was and what solved it — and change the status to "Resolved." The requester is notified. If they confirm, or if 3 days pass with no complaint, the ticket auto-closes.

Here's the magic: any resolved ticket can be **converted to a knowledge base article** with one click. Dispatchly copies the symptoms and the resolution steps into a searchable, tag-able article. Next time a similar ticket comes in, the agent searches the KB, finds the article, and either points the requester to it (self-service!) or copies the fix into the new ticket.

**How it connects:** This is Dispatchly's memory. Every ticket resolved makes the next similar ticket faster. Over months, this compounds — new hires get up to speed by reading the KB, and easy tickets get solved without a human touch because clients find the answers themselves.

### 5.10 Problem Management

A "problem" is a **root cause** that produces many tickets. Example: the office WiFi router has a firmware bug that causes intermittent outages. Every time it acts up, users file separate tickets. Individually, they look like a hundred small annoyances — collectively, they're one problem.

Dispatchly lets you create a **Problem record**, link all related tickets to it, track root cause investigation, note a workaround (so tickets can be resolved faster in the meantime), and record the eventual permanent fix. States progress from Open → In Investigation → Known Error → Resolved → Closed.

**How it connects:** Problems are how you move from "always fighting fires" to "actually fixing what's on fire." Managers can look at the Problems page and see recurring pain points instead of drowning in ticket noise.

### 5.11 Change Management

Big planned changes (upgrading the payroll system, migrating the mail server, applying a security patch across all servers) go through **Change Management**. This is a heavier workflow because these changes can break things at scale.

Each change has:

- **Type** — Standard (pre-approved routine), Normal (needs review), or Emergency (fast-tracked).
- **Risk level** — Low to Critical.
- **Implementation plan** and **rollback plan** — what you'll do, and how you'll undo it if it fails.
- **Maintenance window** — when the work will happen.
- **Approvals** from a Change Advisory Board (CAB — typically admins and managers).
- **Linked tickets** — any incidents this change is meant to fix or might affect.

The workflow is: Draft → Submitted → Approved (or Rejected) → In Progress → Completed. At each stage, everyone involved is notified.

**How it connects:** Change management protects you from your own good intentions. It ensures the right people sign off, everyone knows when to expect disruption, and there's a paper trail if something goes wrong.

### 5.12 On-Call Scheduling

Someone has to be reachable at 2 AM when a P1 hits. The **On-Call page** lets managers assign specific people to specific time windows ("Alice is on-call this Saturday 6 PM to Sunday 6 AM"). Their status automatically flips to "on_call" during their window and back to "off_duty" when it ends.

Skills-based routing sees this and prefers on-call people during off-hours emergencies. Nobody gets paged at midnight when they're not on the rotation.

**How it connects:** Feeds directly into the auto-assignment engine and the SLA monitor. Without on-call data, off-hours P1s would go to whoever happens to be "available" — probably nobody.

### 5.13 Skills & Proficiency Tracking

Every person on the team has a **skills profile**: what they're good at, and how good (a 1-to-5 proficiency rating). Managers can verify skills ("yes, I've watched Bob configure firewalls, he's a solid 4"). The skills catalog is pre-loaded with common IT skills (Windows administration, Cloud/AWS, Active Directory, Customer Service, etc.) but can be extended.

Tickets can specify **required skills** — a firewall issue might require "Firewall & Security" at level 3. The routing engine matches on this.

**How it connects:** Skills bridge the gap between "who is technically available" and "who can actually solve this." As your team grows, this becomes the difference between a scaling operation and a bottleneck.

### 5.14 Agent Status & Work Schedules

Every agent has a **current status** — one of ten values from `available` (ready for work), `on_duty` (at their desk), `busy` (deep in a ticket), `break`, `lunch`, `meeting`, `training`, `on_call`, `off_duty`, or `offline`. Statuses are shown with color badges so at-a-glance you can see who's around.

Managers can set **work schedules** for their reports — "Sarah works 9-5 Mon-Fri Eastern time, Raj works 3 PM–11 PM Pacific for evening coverage." A background service checks every minute and auto-transitions statuses at shift boundaries: 9 AM comes, off-duty flips to on-duty; 5 PM comes, on-duty flips to off-duty.

Managers can also force a status change on their team (useful for "you're actually in a meeting, stop showing available"), and every change is logged with who did it and why.

**How it connects:** This is the foundation for accurate routing, fair workload distribution, and honest workforce reporting. It also means agents don't have to remember to click "I'm on break" every day — the schedule handles it.

### 5.15 Organizational Hierarchy (Departments & Teams)

Dispatchly models the real shape of your organization:

- **Departments** (IT, HR, Customer Success, Finance, Operations…) can have a head and can nest (a sub-department under IT called "Cloud Infrastructure").
- **Teams** live inside departments (IT has Hardware Support, Network Engineering, Software Support, Security, Cloud & DevOps).
- **Team members** belong to teams, with optional "team lead" designation.
- **Users** have a department, a team, and a manager (their direct report line).

**How it connects:** This structure powers permission scoping ("managers can see their reports' tickets"), routing preferences ("prefer same-department assignment"), and organizational reporting.

### 5.16 Notifications

Anytime something meaningful happens, Dispatchly notifies the relevant people in **two channels at once**: a little bell icon in their Dispatchly view (in-app) and an email to their inbox (if SMTP is configured).

Notifications fire for:

- New ticket assigned to you.
- Your ticket's SLA is at risk / breached.
- Your ticket was auto-escalated.
- An approval is waiting for you.
- Your approval was resolved (approved or rejected).
- A new ticket was created via email.
- Status changes made to you by a manager.

You can mark individual notifications as read, or mark them all read at once. Read/unread state is remembered.

**How it connects:** Notifications are the glue. They turn a background system into something people actually respond to. Every important event in every other feature produces one.

### 5.17 Fine-Grained Permissions (RBAC)

Roles give you a sensible default (agents can escalate, technicians can resolve, clients can only see their own tickets, etc.), but sometimes you need exceptions:

- "Give Ravi the ability to manage the KB even though he's just an agent."
- "Take away Bob's escalation ability while he's being retrained."
- "Grant temporary admin access to the consultant for the next 30 days."

Admins can add **per-user permission overrides** — either grants (this user can do this extra thing) or explicit denials (this user cannot do this normally-allowed thing). Overrides can expire, and every override records who granted it and why.

**How it connects:** This is the safety valve. Roles cover 95% of cases; RBAC overrides cover the last 5% without needing to invent a new role every time.

### 5.18 Admin: User Management

Admins can create users, change roles, deactivate people who've left, assign departments/teams/managers, and see the full user list. They can also configure business hours (when your SLA clocks pause) and the service catalog.

**How it connects:** This is the setup and maintenance surface. Most of what admins do here is done once during onboarding and rarely touched again.

---

## 6. Real-World Scenarios

The best way to understand Dispatchly is to walk through what happens in specific situations.

### Scenario A — "My laptop won't turn on" (a P3 incident, self-service)

**8:47 AM.** Alice, an accountant, opens Dispatchly. She clicks "New Ticket," picks category "Hardware," writes "My laptop won't power on." Priority defaults to P3, deadline: 8 business hours.

**8:47 AM (same second).** Dispatchly's routing engine looks around: who's available in the IT department right now with "Hardware Repair" skills? Bob (available, level 4, only 3 open tickets) is the winner. Ticket is assigned to Bob. Bob's little bell lights up. An email lands in his inbox.

**8:52 AM.** Bob opens the ticket, replies with a comment: "Hi Alice — can you try holding the power button for 30 seconds and let me know?"

**9:04 AM.** Alice replies via the same ticket: "Nope, still nothing."

**9:12 AM.** Bob heads over to Alice's desk, discovers a fried power adapter, swaps it out. He marks the ticket resolved and writes: *"Failed power adapter — replaced with spare from stockroom."*

**9:12 AM.** Alice gets a notification: "Your ticket is resolved."

**9:13 AM.** Bob clicks "Convert to KB Article." Dispatchly turns his fix into a searchable article titled "Laptop won't turn on — failed power adapter." He tags it "hardware, power, adapter." The article is now findable by every future agent and every future Alice.

**Time to resolution: 25 minutes. SLA: on track. Institutional knowledge: increased by one article.**

### Scenario B — "The whole office can't email" (a P1, escalation, auto-alerting)

**2:14 PM.** Someone submits: "Nobody in the building can send email."

**2:14 PM.** Ticket auto-flagged P1 (a possible major outage), category "Network." Deadline: **1 hour**. Assigned to Priya (on-duty, level 5 in Network). Priya is notified. Managers are silently CC'd on the notification because it's a P1.

**2:29 PM.** Priya investigates — the mail relay server is unreachable. She realizes this is out of her depth and clicks **Escalate → Network Infrastructure Team**. The status flips to Escalated. Reason logged. Network team notified.

**2:47 PM.** SLA monitor's 5-minute check: this ticket is now at 55% of its deadline elapsed with no resolution. Below the "at risk" threshold, so it stays quiet.

**3:02 PM.** Next check: 80% elapsed. **At-risk alert fires.** All managers get an in-app notification and email: "Ticket #4531 is at risk of breaching."

**3:14 PM.** A network engineer restarts the mail relay. Ticket resolved with notes on what happened.

**3:14 PM.** Everyone who was watching is notified: resolved. The SLA record shows the ticket met its deadline with 3 minutes to spare.

**What Dispatchly did automatically:** flagged the priority correctly, picked the right first-responder, escalated to the right team when the human did, warned managers before things got ugly, and told everyone the moment it was fixed.

### Scenario C — "I need a new laptop for the intern starting Monday" (service request with approval)

**Thursday, 10 AM.** Jamal picks "Request a new laptop" from the service catalog. He fills in: model preference, delivery date, cost center. Because the catalog item is marked "requires_approval," the ticket status is set to **Pending Approval** and Jamal's manager gets a notification.

**Thursday, 11 AM.** The manager opens the request, reviews it, clicks Approve. Ticket status flips to In Progress. Jamal is notified. IT procurement (also notified) starts the order.

**Friday, 4 PM.** The laptop arrives, is imaged, and delivered. Ticket resolved.

**What Dispatchly did:** enforced the approval gate (Jamal couldn't just order a laptop unilaterally), created a paper trail for finance, and kept everyone in the loop without a single email being written.

### Scenario D — "The printers keep going offline" (from noise to a problem)

Across two weeks, agents notice: 12 separate tickets about printers randomly disconnecting from the network. Each ticket is resolved individually by rebooting the printer, but they keep coming back.

A senior agent creates a **Problem** record: "Recurring printer disconnection." She links all 12 tickets to it and assigns herself. Investigation reveals it's a driver conflict introduced by a recent Windows update.

She marks the problem "Known Error" and documents a workaround: "Roll back to driver version X.Y until the vendor releases a fix." Now, when new tickets come in about the same issue, agents can point to the KB article that references the workaround and close them in 2 minutes instead of 20.

Two weeks later, the vendor releases a proper fix. She marks the problem "Resolved," documents the permanent solution, and the case closes.

**What Dispatchly did:** helped her see the pattern instead of drowning in 12 unrelated tickets, provided a workaround mechanism to reduce ongoing noise, and tracked the root-cause fix separately from the individual incidents.

### Scenario E — "We're migrating email to a new server this weekend" (change management)

**Two weeks before.** The IT director drafts a **Change Request** in Dispatchly: "Migrate corporate email from on-prem to cloud." Type: Normal. Risk: High. She fills in the implementation plan (migration steps), the rollback plan (how to revert if it fails), and schedules a maintenance window: Saturday 10 PM to Sunday 4 AM.

She submits it for approval. The Change Advisory Board (three managers and an admin) each get a notification. They review the plan, ask questions in comments, and each vote Approve.

**Saturday, 10 PM.** Status flips to In Progress. The IT team executes the plan. Any incident tickets that come in during the window can be linked to this change.

**Sunday, 3:30 AM.** Migration complete. The change is marked Completed.

**Monday morning.** Users have a slightly different email experience but were warned in advance. Any bumps are captured as incident tickets linked to the change record — so any pattern of post-migration issues is visible in one place.

**What Dispatchly did:** enforced sign-off before the change, coordinated the window, and provided a durable record for post-mortem analysis.

---

## 7. What Makes Dispatchly Different

Here's what to say when a prospect asks "why not just use email / spreadsheets / a generic tool?"

**It's opinionated, not generic.** Dispatchly is built specifically for IT-style service operations. It doesn't try to be a generic project tracker with help-desk bolted on. Every screen answers a real question a real support team asks.

**It follows the industry playbook (ITIL).** Priority tiers, incident vs. service-request separation, problem management, change management, SLAs/OLAs/UCs — these aren't invented terms. They're what mature IT organizations use, and they map onto how your company probably already thinks (or should think).

**Everything is connected.** A ticket knows about its SLA, which knows about business hours, which knows about the requester's department, which knows about the on-call rotation, which knows about skills, which drives routing. Nothing is a silo.

**The system does the boring watching.** No human has to sit there refreshing a screen wondering if an SLA is about to breach. The system watches, warns, escalates, and notifies. Humans focus on solving problems.

**It learns.** Every resolved ticket can become knowledge. Every recurring headache can become a problem record. Every planned change is documented. Six months in, your team is faster because the system remembers.

**It scales with your org.** Start with 3 people in "IT"; grow to 200 across five departments with sub-teams, skill tiers, and on-call rotations. The same product handles both without a rewrite.

**Requesters get a simple, professional experience.** No jargon, no clutter. They submit, they see updates, they're notified when it's done. That's it. Meanwhile, staff get the deep tooling they need.

---

## 8. Getting Started

Here's what happens in the first week of a Dispatchly rollout, in plain English:

**Day 1 — Admin setup.** An admin creates the account, adds the initial users, configures business hours (when do your SLA clocks pause?), and sets up the service catalog (what can people request?).

**Day 2 — Team structure.** Admin lays out departments and teams to match your real org chart, assigns each user to a team and a manager, sets people's roles (agent / technician / specialist / etc.).

**Day 3 — Skills & schedules.** Managers fill in each team member's skills profile and set their work schedule. Now the routing engine can start being smart.

**Day 4 — Pilot with a small group.** Route a handful of test tickets through. Watch the flow. Make adjustments.

**Day 5 — Go live.** Announce to the wider org that support requests now go through Dispatchly. Send an email to everyone explaining the portal URL and how to submit a ticket. Optionally point the help-desk email address at Dispatchly so email-based requests also flow in.

**Week 2+ — The compound wins begin.** Agents start converting resolved tickets to KB articles. Managers start noticing patterns and creating Problem records. Change requests move through the CAB. Reports show real numbers. New hires get onboarded by reading the KB.

**Month 3.** Your team's resolution time is down, your requesters are happier (because they're informed), your managers are ahead of problems instead of behind them, and nobody is emailing "hey did you get to that thing" anymore.

---

## In Summary

Dispatchly turns support chaos into a clear, watchful, self-improving operation. It handles the boring parts (tracking, timing, routing, notifying, remembering) so your people can focus on the interesting parts (actually helping). It grows with you, follows the industry standard, and gives every person in the loop — from the first-time requester to the top-level admin — exactly the view they need.

If you're tired of tickets slipping through cracks, of not knowing what's happening, of solving the same problem for the fifth time, or of finding out about a missed deadline from the person who missed it — that's what Dispatchly fixes.
