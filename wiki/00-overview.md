# NgốcKý

**Status:** live  ·  **Owner:** Kael (cong.bui)  ·  **Audience:** my family + future-me

NgốcKý is a private family record-management hub: one place to track personal/household
tasks, goals, calendar events, expenses, hobbies, and health records — with a Telegram
assistant as an alternate way to log and query things from my phone. It runs as a
self-hosted web app on my VPS at `ngocky.kael.io.vn`.

> "Kaelio" is just my template codename for projects; the actual product is **NgốcKý**.

## At a glance
- **What it does:** family hub for tasks, goals, expenses, calendar, hobbies, and health records, with reminders and a Telegram bot.
- **Who uses it:** me and my family (OWNER / ADMIN / USER roles, per-item sharing).
- **Stack:** React + Vite frontend · Express + Prisma + PostgreSQL API · Docker + Caddy on a VPS · n8n + Telegram for assistant/reminders.

## Hero diagram
```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Iosevka Nerd Font Mono, monospace','lineColor':'#555'}}}%%
flowchart TD
  classDef guard   fill:#FFF4CC,stroke:#E6C200,color:#333;
  classDef action  fill:#CDEFD9,stroke:#4CAF7D,color:#333;
  classDef session fill:#E6DAF7,stroke:#9B72CF,color:#333;
  classDef audit   fill:#FBD5DD,stroke:#E0708A,color:#333;
  classDef reject  fill:#FCE0C8,stroke:#E8954A,color:#333;

  web([Web app]):::session
  tg([Telegram bot]):::session
  n8n[n8n orchestration]:::action
  api[NgốcKý API<br/>Express + Prisma]:::action
  db[(PostgreSQL)]:::action

  web --> api
  tg --> n8n --> api
  api --> db
  n8n -.poll reminders.-> api
  api -.send alerts.-> n8n
```

## Read next
- [Origin / why I built it](01-origin.md)
- [Timeline](02-timeline.md)
- [Architecture](03-architecture.md)
- [Lessons / read this if I restart](lessons.md)
