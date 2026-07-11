# SWE-Milestone Website

Data-driven static site for the **SWE-Milestone** leaderboard — AI coding agents
evaluated on continuous software evolution. Deployed on **Cloudflare Workers**
(auto-built from this repo on every push; see `wrangler.jsonc`).

## Architecture

Data and presentation are separated so you can try different frontend styles
on top of the **same** data.

```
SWE-Milestone-website/
├── index.html          # ★ LIVE SITE — build output of the active version (served at /)
├── wrangler.jsonc      # Cloudflare deploy config (assets.directory: ".")
├── data/               # shared canonical data snapshots
│   ├── milestone_results.csv   # per-milestone results (canonical, synced from analysis)
│   ├── milestone_executions.csv # active per-trial execution order, including non-graded
│   ├── trial_results.csv       # trial-level totals, all agents (canonical, synced from analysis)
│   ├── milestone_info.csv      # per-milestone metadata + canonical grading_status
│   ├── model_registry.json     # canonical model identity metadata
│   └── compute.py              # load_e2e() + compute_records() → records
├── assets/             # shared images / brand assets (served at /assets/)
│   ├── swe-milestone_icon.png
│   ├── banner.png
│   ├── moonshot.png
│   └── logos.json              # per-model logos (base64), inlined at build time
└── versions/           # one folder per frontend style — all share data/
    └── v2/                     # current design
        ├── build.py            # presentation config + inject → writes root pages
        ├── src/                # source HTML for index.html and task.html
        ├── partials/           # shared header, footer, and chrome CSS
        └── dag/                # embedded milestone DAG source
```

### The data ↔ presentation contract

The result/execution CSVs, model registry, and `milestone_info.csv` under `data/` are
**synced verbatim** from the analysis repo via
`analysis/scripts/sync_leaderboard.py`. Analysis is the single source of truth;
the copies are committed here so the static site builds standalone. `compute.py`
filters `trial_type == 'e2e'` and splits native / openhands by `agent_name`.
`milestone_info.csv.grading_status` is the canonical scope classification used
by the task page: `graded`, `non_graded`, or `inactive`. The website never
reads or maintains a separate non-graded list.
`milestone_executions.csv` contains no score fields; it lets Compare render
the true order of executed non-graded milestones while all leaderboard metrics
continue to come exclusively from graded results.

- **`data/compute.py`** owns everything that is the same regardless of look:
  reading the CSVs, aggregating scores, and the identity maps (which
  agent/model is which, display names, org). `compute_records()` returns a
  list of data-only records — score, precision, recall, resolve, cost,
  output tokens, time, turns, rank, official flag.
- **`versions/<v>/build.py`** owns the look: it imports `compute_records()`,
  decorates each record with this version's colors / chart labels, inlines
  its own `template.html` + `style.css` + `app.js` into one self-contained
  page, injects the data + logos, and writes the site-root `index.html`.

So: **change data/models** → edit `data/`; **change styling** → edit
`versions/<v>/`. Each version has its own `build.py`, so a future version is
free to render however it wants (multi-file output, a bundler, …) as long as
it consumes the same records.

## Build

```bash
python versions/v2/build.py     # → writes ./index.html and ./task.html
```

Inspect the shared data snapshot on its own (optional; gitignored):

```bash
python data/compute.py          # → writes data/records.json
```

Requires Python 3 + `pandas`.

## Updating the leaderboard data

The numbers come from the **analysis** repo — the single source of truth. Full
refresh, end to end:

```bash
# 1. analysis: re-extract canonical CSVs from SWE-Milestone-log
cd ../analysis && python refresh_data.py
#    (or just the leaderboard CSVs: python -m analysis.extract.extract_e2e_csv --all --force)

# 2. analysis: sync canonical CSVs into this repo's data/ (pure cp, no transform)
python scripts/sync_leaderboard.py

# 3. website: rebuild index.html with the new data + logos   <-- easy to forget!
cd ../SWE-Milestone-website && python versions/v2/build.py

# 4. review, commit, push -> Cloudflare auto-deploys
git add data/ index.html task.html && git commit -m "leaderboard: refresh data" && git push
```

**Step 3 is mandatory:** syncing `data/` alone does NOT change the live pages —
only `build.py` inlines the records and milestone status into `index.html` and
`task.html`. `records.json` itself is a build artifact and is not deployed.

**Local preview:** `python -m http.server 5005` from this directory serves the
site at http://localhost:5005. It is a no-cache static server, so after
`build.py` you just hard-refresh the browser — no restart needed.

## Switch the live version

`index.html` at the repo root is whatever version you last built. Cloudflare
serves the repo root (`assets.directory: "."`), so the live site is always
the root `index.html`. To make `v2` live:

```bash
python versions/v2/build.py     # regenerates ./index.html from v2
```

Commit the result and push — Cloudflare rebuilds and deploys automatically.

## Add a new version

1. `cp -r versions/v1 versions/v2`
2. Edit `versions/v2/{template.html,style.css,app.js}` (and its presentation
   config in `build.py`) for the new look.
3. `python versions/v2/build.py` and open `index.html` locally to preview.

Data never needs to be touched — v2 reads the same `data/compute.py`.
