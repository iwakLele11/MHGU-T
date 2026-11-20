# MHGU Web Companion & Set Builder

A lightweight, fully client-side companion and set builder for Monster Hunter Generations
Ultimate (MHGU). It runs in the browser from local JSON files using HTML5, Tailwind CSS (CDN),
and Alpine.js v3 (CDN). No Node.js, no bundler, no build step.

This repository is being built in three approval-gated stages. **Stage 1** (schema validation,
data shapes, extraction plan, folder structure, and Alpine state design, plus skeleton files)
is complete. See [`docs/STAGE1-DESIGN.md`](docs/STAGE1-DESIGN.md) for the full design. Stages 2
(JSON loader + Weapon/Armor filter pages) and 3 (Set Builder) follow after sign-off.

## Run (no build step)

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000> in a browser.

The `data/*.json` files are generated once from the MHGU SQLite database via
`scripts/extract.sh` (see the design doc). The browser only ever reads the JSON files.
