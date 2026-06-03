# Design docs

Per-feature design docs (the implementer/reviewer tier): inputs, validation, flow, and
how behavior evolved between versions. Two-level — one consolidated doc per area, with
per-feature deep docs linked from it. Avoid one-disconnected-doc-per-thing sprawl.

Diagrams here are **HLD** (logical flow: trigger → guard → branch → outcome; omit
plumbing). The node-by-node LLD view stays in source, not redrawn as Mermaid.

> Stub — to be filled. Authoritative source for now is `docs/DESIGN.md`.

## Planned consolidated areas
- **Planning** — Goals, standalone Tasks, Projects (Kanban). _(planned)_
- **Money** — Expenses, Funds, scheduled-payment automation. _(planned)_
- **Records** — Assets/Maintenance, Learning, Ideas, Healthbook (topic → log pattern). _(planned)_
- **Scheduling** — Calendar, Housework recurrence, reminders & notifications. _(planned)_
- **Family** — Ca Keo (kids tracker), sharing model. _(planned)_
- **Assistant** — Telegram + n8n intent flow, identity linking. _(planned)_
- **Platform** — auth/session, navigation & feature flags, settings, theming. _(planned)_
