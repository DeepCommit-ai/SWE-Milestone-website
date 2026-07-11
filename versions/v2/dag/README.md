# Milestone DAG — embeddable bundle

A dark-themed, self-contained [React Flow](https://reactflow.dev) visualizer of a
repo's milestone dependency graph, embedded in the v2 task page
(`versions/v2/src/task.html`, `#dagMount`).

Ported from `analysis/visualization/new_mstone_dag` (the light-themed AI-Studio
app) — this dir keeps the graph logic (`utils/csvParser.ts`, `utils/layout.ts`)
and the node/edge components, but:

- **Dark mode** — node cards use the site box black (`#1a1f26`) with gray-white
  borders; category badges, edges, zoom controls and background are all dark
  (`components/theme.tsx`, `components/*.tsx`, `getEdgeVisual` in `csvParser.ts`,
  `embed.css`).
- **Only one control** — a `Structure` ↔ `Unlock` (topology) view toggle.
  Selected-milestone filtering and additional (extra) dependency edges are
  **always on**, with no toggle buttons.
- **Zoom** — React Flow's built-in controls + wheel-zoom + drag-pan.

`embed.tsx` exposes the global mount API used by the task page:

```js
window.MstoneDAG.mount(el, {
  milestones, dependencies, additional, selectedIds, nonGradedIds
})
// milestones / dependencies / additional : raw CSV strings (additional optional)
// selectedIds : string[] (analysis-derived active IDs; empty -> show all)
// nonGradedIds : string[] (active nodes rendered persistently dimmed + labelled)
```

The task page fetches graph topology at runtime from `/data/dag/<ws>/`
(`milestones.csv`, `dependencies.csv`, `additional_dependencies.csv`,
plus `srs/<id>/SRS.md` for the detail panel's
"View SRS" modal). It gets canonical `graded` / `non_graded` / `inactive`
status from `window.TASK_DATA`, generated from the synced
`data/milestone_info.csv`. Both active IDs (`status != inactive`) and
non-graded IDs are projections of that contract. The DAG bundle only renders
them; the task page never reads or re-derives raw scope files.

## Sync data from SWE-Milestone-data

Topology and SRS data are pulled from the upstream `SWE-Milestone-data` repo by
`sync_dag_data.py`. Re-run after those inputs change:

```sh
python versions/v2/dag/sync_dag_data.py
```

Benchmark scope is owned by `analysis`: its normal refresh writes
`analysis/data/milestone_info.csv`, and `analysis/scripts/sync_leaderboard.py`
copies that contract into website `data/`. Do not add a second website-side
non-graded list; it would create two sources of truth.

## Rebuild the bundle

Only needed when the component or theme changes (the built bundle is committed).

```sh
cd versions/v2/dag
npm install                                        # first time only
node_modules/.bin/vite build --config vite.embed.config.ts
```

Outputs the self-contained IIFE bundle (React + react-flow + dagre + components
+ CSS, no CDN) to the site's served assets:

- `assets/mstone-dag.js`
- `assets/mstone-dag.css`

`node_modules/` here is build-only and git-ignored; the committed bundle is what
ships.
