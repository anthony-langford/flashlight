# Agent guide

Flashlight is a personal learning tool for the Toronto housing market and surrounding macro environment.

**The README is the living source of truth for status, next steps and open questions. Read it first.**

## Read order

1. [README.md](README.md): status, buyer profile, next steps, open questions
2. [docs/PROJECT.md](docs/PROJECT.md): goals, scope, decisions log
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): stack, layout, conventions
4. [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md): verified series IDs and access notes
5. [docs/CAUSAL_MAP.md](docs/CAUSAL_MAP.md): causal map design

## Ground rules

- Keep README.md current. Update Status, Next steps, Open questions and the Session log in the same commit as the work. Commit regularly, after each working unit.
- Do not re-litigate decisions recorded in docs/PROJECT.md. If one needs to change, say why and update the doc.
- Do not mark a data source or series as verified unless it was actually fetched. Record the verification date.
- Never commit third-party data, API keys or the DuckDB file. Before each commit, check that the staged diff does not contain the FRED key. Recorded HTTP fixtures must have `api_key` scrubbed.
- Scope for now is Toronto housing. China is out of scope for the housing tool (a later macro dashboard).
- Causal map edges are claims. Each needs a rationale and a confidence tag. Do not add unreviewed generated edges as "established".
- Do not state mortgage or tax rules from memory. Verify against an official source first (docs/MORTGAGE_RULES.md). Page-reading tools summarise, so for any number the code depends on, download the raw HTML and search its text for the exact figure (curl, or headless Chrome `--dump-dom` for canada.ca). Record the check and its date.

## Review loop (after every step)

The owner asked for this on 2026-10-14. After each working unit, before committing:

1. Run everything: `uv run ruff check .`, `uv run pytest -q`, and for front-end changes `cd app && npm test && npm run build`.
2. Critically re-read your own diff as a skeptical reviewer. Look for: bugs and edge cases, unverified claims (especially numbers, rules and URLs written from memory), secrets or data leaking into git or logs, untrusted text inserted as HTML, stale or misleading labels, and anything a user could misread.
3. For UI changes, render it (headless Chrome screenshots, light and dark) and look at the result. Tests passing is not enough.
4. Fix what you find. If you cannot fix it now, add it to the README Open items.
5. Note what the review found in the commit message or the README session log, then commit and push.
6. At milestone boundaries, also call the advisor tool for an independent review.

## Style

- No em dashes in any written content (docs, comments, commit messages). Use a period, comma, colon or "and".
- Regular hyphens are fine, including ranges.
- Commit messages must not mention AI assistance or tooling, and must not carry a co-author trailer for it.
- Keep code and comments in the surrounding style. Prefer small, typed, tested modules.
