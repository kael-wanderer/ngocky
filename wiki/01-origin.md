# Origin — why NgốcKý exists

## The pain point
Family life generates a constant stream of small records that lived nowhere coherent:
chores and their due dates, recurring goals (gym, reading), money in and out, kids'
school/activity schedules, appliance warranties and maintenance, hobby purchases
(mechanical keyboards), and health records. They were scattered across notes apps,
spreadsheets, chat messages, and memory — so things slipped: a warranty lapsed, a
recurring payment was forgotten, a check-up wasn't booked.

The recurring frustration: **there was no single source of truth, and no reliable
reminder before a deadline** — only the panic *after* something was already overdue.

## Who asked
This is a personal/family tool. I (Kael) am both the requester and the builder. The
real "users" are me and my family members, who needed the day-to-day surfaces — a
shared calendar, the kids' task tracker (Ca Keo), expenses, and health records — to be
simple enough to use without training.

## The pressure
- I work alone, from idea to deploy to support — so the tool had to be **simple and
  maintainable by one person**, not an over-engineered platform.
- I wanted to **log and query from my phone without opening the web app**, which is why
  the Telegram assistant exists.
- Reminders had to be **trustworthy** — fire once, before the deadline, no spam — or the
  whole point (never missing things again) collapses.

## Goals
1. **One hub, many record types** — tasks, goals, calendar, expenses, hobbies, health —
   each module owning its own domain, with controlled cross-module automation.
2. **Pre-deadline reminders** that are reliable and don't repeat-spam.
3. **A chat front-end (Telegram)** for quick capture and queries, with the API staying
   the source of truth (the LLM only extracts intent, it never writes directly to the DB).
4. **Family-friendly sharing** — per-item and per-board sharing with clear ownership,
   so shared things are visible but not accidentally editable by everyone.
5. **Self-hosted and cheap to run** — a single VPS, Docker, automated deploys.

## Explicit non-goals
- Not a multi-tenant SaaS — it's a private family instance.
- Telegram/n8n are channels and transport, **not** the source of truth.
- No post-deadline nagging baked into item reminders — overdue handling is a separate
  Reports & Notifications concern.

## Read next
- [Timeline](02-timeline.md) — how it has evolved.
- [Architecture](03-architecture.md) — how it's built.
