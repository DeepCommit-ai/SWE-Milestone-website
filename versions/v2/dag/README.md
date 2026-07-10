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
window.MstoneDAG.mount(el, { milestones, dependencies, additional, selectedIds })
// milestones / dependencies / additional : raw CSV strings (additional optional)
// selectedIds : string[] (empty -> show all milestones)
```

The task page fetches its inputs at runtime from `/data/dag/<ws>/`
(`milestones.csv`, `dependencies.csv`, `additional_dependencies.csv`,
`selected_milestone_ids.txt`, plus `srs/<id>/SRS.md` for the detail panel's
"View SRS" modal) — so all data still comes only from `data/`.

## Sync data from SWE-Milestone-data

That data is pulled from the upstream `SWE-Milestone-data` repo by `sync_dag_data.py`
— the ONE place the website reads upstream. Re-run after the upstream changes:

```sh
python versions/v2/dag/sync_dag_data.py
```

(Note: `analysis/data/milestone_info.csv` is a separate cross-repo *analysis*
summary — multi-label categories, graph degrees, human dev/writing time, SRS
word count — NOT the render source, so it is intentionally not synced.)

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
