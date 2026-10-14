# Agent guide

Flashlight is a personal learning tool for the Toronto housing market and surrounding macro environment. Read this file first, then [docs/ROADMAP.md](docs/ROADMAP.md) for current status and next steps.

## Read order

1. [docs/ROADMAP.md](docs/ROADMAP.md): what is done, what is next, open questions
2. [docs/PROJECT.md](docs/PROJECT.md): goals, scope, decisions already made
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): stack, layout, conventions
4. [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md): verified series IDs and access notes
5. [docs/CAUSAL_MAP.md](docs/CAUSAL_MAP.md): causal map design

## Ground rules

- Do not re-litigate decisions recorded in docs/PROJECT.md. If one needs to change, say why and update the doc.
- Update docs/ROADMAP.md at the end of each working session: mark milestones, add new open items, record what was verified and when.
- Do not mark a data source or series as verified unless it was actually fetched. Record the verification date.
- Never commit third-party data, API keys or the DuckDB file. See .gitignore.
- Scope for now is Toronto housing. China is out of scope for the housing tool (it belongs to a separate macro dashboard, a later topic pack).
- Causal map edges are claims. Each needs a rationale and a confidence tag. Do not add unreviewed generated edges as "established".

## Style

- No em dashes in any written content (docs, comments, commit messages). Use a period, comma, colon or "and".
- Regular hyphens are fine, including ranges.
- Commit messages must not mention AI assistance or tooling.
- Keep code and comments in the surrounding style. Prefer small, typed, tested modules.
