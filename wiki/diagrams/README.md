# Diagrams

Visual-only collection (presentation tier) plus `.excalidraw` sources. Hero PNGs live in
[`png/`](png/).

## Standard (every diagram obeys this)
- **Mermaid is the default living diagram** — text in the `.md`, version-controlled, no
  screenshots. Excalidraw PNG only for hero diagrams, dropped in `png/`.
- Shapes (locked): `[process]` · `{decision}` · `[(database)]` · `([start/end])` · `[/input/]`
- Paste this themed header at the top of every flowchart, apply classes via `:::class`:

```
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Iosevka Nerd Font Mono, monospace','lineColor':'#555'}}}%%
flowchart TD
  classDef guard   fill:#FFF4CC,stroke:#E6C200,color:#333;
  classDef action  fill:#CDEFD9,stroke:#4CAF7D,color:#333;
  classDef session fill:#E6DAF7,stroke:#9B72CF,color:#333;
  classDef audit   fill:#FBD5DD,stroke:#E0708A,color:#333;
  classDef reject  fill:#FCE0C8,stroke:#E8954A,color:#333;
```

- 6-class color legend (never invent new colors): guard = permission/validation ·
  action = data write · lookup = fetch · session = confirm/session · audit = audit write ·
  reject = error path.

> Stub — visual-only pages go here. Living examples already exist in
> [00-overview.md](../00-overview.md) and [03-architecture.md](../03-architecture.md).
