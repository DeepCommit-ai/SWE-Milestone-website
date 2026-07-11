#!/usr/bin/env python3
"""Sync per-repo Milestone DAG data from SWE-Milestone-data into the website's data/dag/.

The website only ever reads from data/, so this is the ONE place that pulls from
the upstream data repo. For each `SWE-Milestone-data/<org>_<repo>_<start>_<end>/` dir it
copies the topology and SRS inputs into `data/dag/<ws>/` (ws = the repo name).
It also retains the upstream selected-ID source for auditability, although the
task page derives active scope from analysis's canonical milestone contract:

  milestones.csv                 — node definitions (DAG render source)
  dependencies.csv               — edges
  additional_dependencies.csv    — extra edges (optional; some repos lack it)
  selected_milestone_ids.txt     — upstream scope input retained for traceability
  srs/<milestone_id>/SRS.md       — full Software Requirements Spec per milestone
                                    (the detail panel's "View SRS" modal)

CANONICAL TITLES: the per-repo milestones.csv ships an early, terse title
(e.g. "Critical Bug Fixes"). The canonical, fuller title used by the analysis
dashboard/overview lives in analysis/data/sources/milestone_titles.csv (which
also feeds milestone_info.csv). After copying, we overwrite each milestones.csv
`title` column with the canonical title (matched by workspace + milestone_id),
so the site's node/panel titles read the same as the dashboard. All 89 rendered
(selected) milestones have a canonical title, so nothing rendered is left behind;
rows without one keep their original title. A copy of milestone_titles.csv is
also written to data/dag/ for traceability.

GRADING STATUS: this topology sync intentionally does not copy or derive a
non-graded list. Analysis aggregates the canonical graded/non_graded/inactive
classification into data/milestone_info.csv; sync_leaderboard.py publishes it
to the website, and build.py injects it into the task-page render payload.

Re-run after the upstream data changes:  python versions/v2/dag/sync_dag_data.py
"""
import csv
import os
import pathlib
import shutil
import sys

HERE = pathlib.Path(__file__).resolve()
WEBSITE = HERE.parents[3]                                          # .../SWE-Milestone-website
ED = pathlib.Path(os.environ.get(
    "SWE_MILESTONE_DATA_ROOT", WEBSITE.parent / "SWE-Milestone-data"
)).expanduser()
DAG = WEBSITE / "data" / "dag"
TITLES_SRC = WEBSITE.parent / "analysis" / "data" / "sources" / "milestone_titles.csv"

FILES = [
    "milestones.csv",
    "dependencies.csv",
    "additional_dependencies.csv",
    "selected_milestone_ids.txt",
]


def load_canonical_titles() -> dict:
    """(workspace, milestone_id) -> canonical title, from milestone_titles.csv."""
    if not TITLES_SRC.exists():
        return {}
    with open(TITLES_SRC, newline="") as f:
        return {(r["workspace"], r["milestone_id"]): r["title"] for r in csv.DictReader(f)}


def apply_canonical_titles(ws: str, path: pathlib.Path, canon: dict) -> int:
    """Overwrite the title column with the canonical title where one exists."""
    with open(path, newline="") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        return 0
    cols = list(rows[0].keys())
    applied = 0
    for r in rows:
        t = canon.get((ws, r["id"]))
        if t and t != r.get("title"):
            r["title"] = t
            applied += 1
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    return applied


def main() -> None:
    if not ED.exists():
        sys.exit(f"SWE-Milestone-data not found at {ED}")
    canon = load_canonical_titles()
    if canon:
        DAG.mkdir(parents=True, exist_ok=True)
        shutil.copy2(TITLES_SRC, DAG / "milestone_titles.csv")
    else:
        print(f"  warning: canonical titles not found at {TITLES_SRC} — titles left as-is")

    total_srs = total_titles = 0
    for src in sorted(p for p in ED.glob("*") if p.is_dir()):
        if not (src / "milestones.csv").exists():
            continue
        ws = src.name.split("_")[1]        # <org>_<repo>_<start>_<end> → repo == ws
        dst = DAG / ws
        dst.mkdir(parents=True, exist_ok=True)
        n_files = 0
        for f in FILES:
            if (src / f).exists():
                shutil.copy2(src / f, dst / f)
                n_files += 1
        n_titles = apply_canonical_titles(ws, dst / "milestones.csv", canon) if canon else 0
        total_titles += n_titles
        n_srs = 0
        if (src / "srs").exists():
            if (dst / "srs").exists():
                shutil.rmtree(dst / "srs")
            shutil.copytree(src / "srs", dst / "srs")
            n_srs = len(list((dst / "srs").glob("*/SRS.md")))
            total_srs += n_srs
        print(f"  {ws}: {n_files} data files + {n_srs} SRS + {n_titles} canonical titles")
    print(f"done → {DAG}  ({total_srs} SRS, {total_titles} titles overwritten with canonical)")


if __name__ == "__main__":
    main()
