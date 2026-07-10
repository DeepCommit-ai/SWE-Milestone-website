#!/usr/bin/env python3
"""SWE-Milestone shared data layer.

Reads the canonical CSVs + model_registry.json in this directory and computes
the leaderboard records — the *data* half of the old build.py: numbers and
identity only (agent/model/org names, scores, cost, tokens, time, turns, rank).
It carries NO presentation (colors, chart labels): those live per frontend
version under versions/<v>/.

Model metadata (org / display name / thinking / context / logo) comes from
`model_registry.json`, synced verbatim from analysis (single source of truth).
compute.py no longer hard-codes per-model tables; it just iterates the registry,
composes the display name from name+thinking+context, and joins to the CSVs by
(agent, model). Curation of what appears on the public board is the local
EXCLUDE_TRIALS set below.

Usage:
    from compute import compute_records          # returns list[dict]
    python data/compute.py                       # also writes data/records.json
"""

import json
import pathlib

import pandas as pd

DATA_DIR = pathlib.Path(__file__).resolve().parent
# Canonical files synced verbatim from analysis/data (single source of truth,
# shared with the dashboard + monitor).
MILESTONE_CSV = DATA_DIR / "milestone_results.csv"
TRIAL_CSV = DATA_DIR / "trial_results.csv"
REGISTRY_JSON = DATA_DIR / "model_registry.json"
RECORDS_JSON = DATA_DIR / "records.json"

# ── Website-side curation: trial_ids kept OFF the public leaderboard ─────────
# The registry is the full set (all agents/models); this is where the website
# decides what NOT to show. Add a trial_id here to hide it.
EXCLUDE_TRIALS = {
    "_claude-code_fable-5-with-leak_run_002",  # confirmed cheat/leak run
}

# Agent-level display names (agent is a small closed set, not model metadata).
AGENT_DISPLAY = {
    "claude-code": "Claude Code",
    "codex": "Codex CLI",
    "gemini-cli": "Gemini CLI",
    "openhands": "OpenHands",
}


def load_registry() -> list:
    """Load the model registry (synced from analysis/data/model_registry.json)."""
    return json.loads(REGISTRY_JSON.read_text())


def _display_name(entry: dict) -> str:
    """Compose model display name = name + thinking + context."""
    s = entry["name"]
    if entry.get("thinking"):
        s += f" {entry['thinking']}"
    if entry.get("context"):
        s += f" {entry['context']}"
    return s


def load_e2e() -> pd.DataFrame:
    """Load per-milestone e2e results from canonical milestone_results.csv.

    Keep only e2e rows; is_resolved is derived from eval_status (the canonical
    column is left blank for e2e rows).
    """
    df = pd.read_csv(MILESTONE_CSV)
    df = df[df["trial_type"] == "e2e"].copy()
    df["is_resolved"] = df["eval_status"] == "passed"
    return df


def compute_records():
    """Compute the data-only leaderboard records by iterating the registry.

    Each record carries identity + metrics only. Presentation fields (colors,
    chart labels) are added by each website version's build.py.
    """
    e2e = load_e2e()
    e2e["is_resolved"] = (e2e["eval_status"] == "passed").astype(float)

    # Trial-level metrics from canonical trial_results.csv (all agents); split
    # native vs openhands by agent_name.
    trial_all = pd.read_csv(TRIAL_CSV)
    trial_all = trial_all[trial_all["trial_type"] == "e2e"]
    trial_df = trial_all[trial_all["agent_name"] != "openhands"].copy()
    oh_df = trial_all[trial_all["agent_name"] == "openhands"].copy()

    trial_tokens, trial_cost, trial_turns = {}, {}, {}
    for model in trial_df["model"].unique():
        sub = trial_df[trial_df["model"] == model]
        trial_tokens[model] = sub["total_output_tokens"].mean() / 1000
        trial_cost[model] = sub["total_cost_usd"].mean()
        trial_turns[model] = sub["total_turns"].mean()

    records = []
    for entry in load_registry():
        if entry["trial_id"] in EXCLUDE_TRIALS:
            continue
        agent, model = entry["agent"], entry["model"]
        rec = {
            "agent": agent,
            "agent_display": AGENT_DISPLAY.get(agent, agent),
            "model": model,
            "model_display": _display_name(entry),
            "org": entry["org"],
        }

        if agent == "openhands":
            sub = oh_df[oh_df["model"] == model]
            if len(sub) == 0:
                continue
            reliable = sub[sub["total_output_tokens"] > 0]
            tok_sub = reliable if len(reliable) < len(sub) else sub
            rec.update({
                "score": round(sub["mean_score_reliable"].mean() * 100, 2),
                "precision": round(sub["mean_score_precision"].mean() * 100, 2),
                "recall": round(sub["mean_score_recall"].mean() * 100, 2),
                "resolve": round(sub["resolve_rate"].mean() * 100, 2),
                "cost": round(tok_sub["total_cost_usd"].mean(), 2),
                "out_tok_k": round(tok_sub["total_output_tokens"].mean() / 1000),
                "time_h": round(sub["total_duration_ms"].mean() / 3_600_000, 2),
                "turns": round(tok_sub["total_turns"].mean()),
            })
        else:
            sub = e2e[(e2e["agent_name"] == agent) & (e2e["model"] == model)]
            if len(sub) == 0:
                continue
            ws_score = sub.groupby("workspace")["score_reliable"].mean()
            ws_prec = sub.groupby("workspace")["score_precision"].mean()
            ws_rec = sub.groupby("workspace")["score_recall"].mean()
            ws_res = sub.groupby("workspace")["is_resolved"].mean()
            # Trial-level totals from summary (matches the dashboard); per-
            # milestone sums under-count ungraded prep/teardown work.
            ws_dur = trial_df[trial_df["model"] == model].set_index("workspace")["total_duration_ms"] / 3_600_000
            ws_turns = trial_df[trial_df["model"] == model].set_index("workspace")["total_turns"]
            ws_cost = trial_df[trial_df["model"] == model].set_index("workspace")["total_cost_usd"]
            rec.update({
                "score": round(ws_score.mean() * 100, 2),
                "precision": round(ws_prec.mean() * 100, 2),
                "recall": round(ws_rec.mean() * 100, 2),
                "resolve": round(ws_res.mean() * 100, 2),
                "cost": round(ws_cost.mean(), 2) or round(trial_cost.get(model, 0), 2),
                "out_tok_k": round(trial_tokens.get(model, 0)),
                "time_h": round(ws_dur.mean(), 2),
                "turns": round(ws_turns.mean()) or round(trial_turns.get(model, 0)),
            })

        records.append(rec)

    # Mark official entries: non-openhands are always official; openhands is
    # official only if that model has no native agent entry.
    native_models = {r["model"] for r in records if r["agent"] != "openhands"}
    for r in records:
        r["is_official"] = not (r["agent"] == "openhands" and r["model"] in native_models)

    records.sort(key=lambda r: r["score"], reverse=True)
    for i, r in enumerate(records):
        r["rank"] = i + 1

    return records


def compute_per_repo_records():
    """Per-workspace leaderboards: {workspace: [record, ...]}.

    Same shape as compute_records() but scoped to one repo — every model's
    score on that single task, from the per-(workspace, agent, model) rows of
    trial_results.csv. Identity comes from the registry (excluding curated
    trials); openhands is unofficial when a native run of the same model exists
    in that repo.
    """
    id_map = {}
    for entry in load_registry():
        if entry["trial_id"] in EXCLUDE_TRIALS:
            continue
        id_map[(entry["agent"], entry["model"])] = {
            "agent": entry["agent"],
            "agent_display": AGENT_DISPLAY.get(entry["agent"], entry["agent"]),
            "model": entry["model"],
            "model_display": _display_name(entry),
            "org": entry["org"],
        }

    trial = pd.read_csv(TRIAL_CSV)
    trial = trial[trial["trial_type"] == "e2e"]

    per = {}
    for ws in sorted(trial["workspace"].unique()):
        sub = trial[trial["workspace"] == ws]
        recs = []
        for (agent, model), g in sub.groupby(["agent_name", "model"]):
            idn = id_map.get((agent, model))
            if idn is None:  # curated-out (e.g. leak run) or unknown model
                continue
            def _r2(v):
                return 0.0 if pd.isna(v) else round(float(v), 2)

            def _r0(v):
                return 0 if pd.isna(v) else round(float(v))

            rec = dict(idn)
            rec.update({
                "score": _r2(g["mean_score_reliable"].mean() * 100),
                "precision": _r2(g["mean_score_precision"].mean() * 100),
                "recall": _r2(g["mean_score_recall"].mean() * 100),
                "resolve": _r2(g["resolve_rate"].mean() * 100),
                "cost": _r2(g["total_cost_usd"].mean()),
                "out_tok_k": _r0(g["total_output_tokens"].mean() / 1000),
                "time_h": _r2(g["total_duration_ms"].mean() / 3_600_000),
                "turns": _r0(g["total_turns"].mean()),
            })
            recs.append(rec)

        native = {r["model"] for r in recs if r["agent"] != "openhands"}
        for r in recs:
            r["is_official"] = not (r["agent"] == "openhands" and r["model"] in native)
        recs.sort(key=lambda r: r["score"], reverse=True)
        for i, r in enumerate(recs):
            r["rank"] = i + 1
        per[ws] = recs
    return per


_STATUS = {"passed": "resolved", "failed": "failed", "error": "compile", "not_run": "not-run"}


def _ms_sort_key(mid: str):
    """Natural sort for milestone ids like M001, M001.1, M003.2 → (1, 1), (1, 0)…"""
    body = mid.lstrip("Mm")
    parts = body.split(".")
    try:
        return tuple(int(p) for p in parts)
    except ValueError:
        return (9999,)


def compute_per_repo_milestones():
    """Per-trial, per-milestone breakdown for the Compare-trials view.

    Returns ({workspace: {(agent, model): {milestone_id: {order, status,
    score, prec, rec}}}}, {workspace: [milestone_id, ... canonical order]}).
    milestone_order in the CSV is each run's own execution order, so the two
    Order columns can legitimately differ per trial.
    """
    e2e = load_e2e()
    by_ws, order_ws = {}, {}
    for ws, wsdf in e2e.groupby("workspace"):
        trials = {}
        for (agent, model), g in wsdf.groupby(["agent_name", "model"]):
            bid = {}
            for _, r in g.iterrows():
                st = _STATUS.get(r["eval_status"], "not-run")
                entry = {"order": int(r["milestone_order"]), "status": st}
                if r["eval_status"] != "not_run" and pd.notna(r["score_reliable"]):
                    entry["score"] = round(float(r["score_reliable"]) * 100)
                    entry["prec"] = round(float(r["score_precision"]) * 100)
                    entry["rec"] = round(float(r["score_recall"]) * 100)
                bid[r["milestone_id"]] = entry
            trials[(agent, model)] = bid
        by_ws[ws] = trials
        order_ws[ws] = sorted(wsdf["milestone_id"].unique(), key=_ms_sort_key)
    return by_ws, order_ws


# ── Analysis section: Score-vs-Complexity + Full P/R per Model, for the top-N
# leaderboard models (same set + colors as the leaderboard, leak already
# excluded). Everything is aggregated to tiny tables here so the site inlines
# only the summary, never the raw per-milestone rows.
MS_INFO_CSV = DATA_DIR / "milestone_info.csv"


def _truthy(v) -> bool:
    return str(v).strip().lower() in ("true", "1", "1.0")


def _bin_layer(v):
    if pd.isna(v):
        return None
    v = int(round(float(v)))
    return "0 (root)" if v == 0 else "1" if v == 1 else "2-3" if v <= 3 else "4+"


def _bin_order(v):
    if pd.isna(v):
        return None
    v = int(v)
    return "1-3" if v < 4 else "4-6" if v < 7 else "7-9" if v < 10 else "10-14" if v < 15 else "15+"


def _bin_loc(v):
    if pd.isna(v):
        return None
    v = float(v)
    return "<150" if v < 150 else "150-300" if v < 300 else "300-500" if v < 500 else "500+"


def _bin_srs(v):
    if pd.isna(v):
        return None
    v = float(v)
    return "<1k" if v < 1000 else "1k-1.3k" if v < 1300 else "1.3k-1.8k" if v < 1800 else "1.8k+"


def _bin_indeg(v):
    if pd.isna(v):
        return None
    v = int(round(float(v)))
    return "0" if v == 0 else "1" if v == 1 else "2" if v == 2 else "3+"


def _cat(r):
    if _truthy(r.get("cat_bugfix")):
        return "Bugfix"
    if _truthy(r.get("cat_feature")) or _truthy(r.get("cat_enhance")):
        return "Feature"
    if _truthy(r.get("cat_refactor")):
        return "Refactor"
    return None


# (key, label, canonical bin order, per-row binner)
_DIMS = [
    ("order", "Milestone Order", ["1-3", "4-6", "7-9", "10-14", "15+"], lambda r: _bin_order(r.get("milestone_order"))),
    ("layer", "DAG Layer", ["0 (root)", "1", "2-3", "4+"], lambda r: _bin_layer(r.get("layer"))),
    ("loc", "Source LOC", ["<150", "150-300", "300-500", "500+"], lambda r: _bin_loc(r.get("src_loc"))),
    ("srs", "SRS Words", ["<1k", "1k-1.3k", "1.3k-1.8k", "1.8k+"], lambda r: _bin_srs(r.get("srs_word_count"))),
    ("category", "Category", ["Bugfix", "Feature", "Refactor"], _cat),
    ("indeg", "In-Degree", ["0", "1", "2", "3+"], lambda r: _bin_indeg(r.get("in_degree"))),
]


def compute_analysis_data(top_n: int = 12):
    """Aggregated tables for the Analysis section (top-N leaderboard models).

    Returns {models, dims, pr}:
      models: [{id, agent, model, label, score}]  — leaderboard order, top N
      dims:   [{key, label, bins, data:{model_id: {bin: mean_score}}}]  — per
              complexity dimension, mean Score% per (model, bin)
      pr:     {model_id: {recall:[10], precision:[10]}}  — accumulated P/R across
              milestone-execution progress (10 bins, macro-averaged over repos)
    """
    all_rows = [r for r in compute_records() if r["agent"] != "openhands"]
    top = all_rows[:top_n]
    # Chart order: group by model org (orgs ranked by their best score, desc),
    # models within an org by score ascending — e.g. Sonnet 4.6 → Opus 4.6 →
    # Opus 4.7 → Opus 4.8. openhands is excluded by default.
    org_best = {}
    for r in top:
        org_best[r["org"]] = max(org_best.get(r["org"], 0.0), r["score"])
    top.sort(key=lambda r: (-org_best[r["org"]], r["org"], r["score"]))
    e2e = load_e2e()
    info = pd.read_csv(MS_INFO_CSV)
    keep = ["workspace", "milestone_id", "layer", "in_degree", "src_loc", "srs_word_count",
            "cat_feature", "cat_enhance", "cat_bugfix", "cat_refactor"]
    info = info[[c for c in keep if c in info.columns]]
    df = e2e.merge(info, on=["workspace", "milestone_id"], how="inner")

    mid_of = {(r["agent"], r["model"]): f'{r["agent"]}__{r["model"]}' for r in all_rows}
    models = [{"id": mid_of[(r["agent"], r["model"])], "agent": r["agent"], "model": r["model"],
               "org": r["org"], "label": r["model_display"], "score": r["score"]} for r in top]

    # Score vs Complexity: mean of each metric per (model, bin), per dimension.
    metric_cols = {"score": "score_reliable", "precision": "score_precision",
                   "recall": "score_recall", "resolve": "is_resolved"}
    dims_out = []
    for key, label, order, binner in _DIMS:
        col = df.copy()
        col["_bin"] = col.apply(binner, axis=1)
        col = col[col["_bin"].notna() & col["score_reliable"].notna()]
        data = {}
        for (agent, model), g in col.groupby(["agent_name", "model"]):
            mid = mid_of.get((agent, model))
            if not mid:
                continue
            per_bin = {}
            for b, gb in g.groupby("_bin"):
                if b in order:
                    per_bin[b] = {mk: round(float(gb[c].mean()) * 100, 1) for mk, c in metric_cols.items()}
            data[mid] = per_bin
        dims_out.append({"key": key, "label": label, "bins": order, "data": data})

    # Full P/R per Model: accumulated Recall/Precision across execution progress.
    # Computed for every model (not just the top-N bar set) so the P/R picker can
    # toggle any of them on/off.
    NB = 10
    pr = {}
    for r in all_rows:
        mid = mid_of[(r["agent"], r["model"])]
        sub = e2e[(e2e["agent_name"] == r["agent"]) & (e2e["model"] == r["model"])].copy()
        sub = sub[sub["score_reliable"].notna()]
        if len(sub) == 0:
            continue
        maxo = sub.groupby(["workspace", "trial_name"])["milestone_order"].transform("max").clip(lower=1)
        sub["_b"] = ((sub["milestone_order"] / maxo) * NB - 1e-9).clip(lower=0, upper=NB - 1).astype(int)
        binR, binP = [0.0] * NB, [0.0] * NB
        for b in range(NB):
            rows = sub[sub["_b"] == b]
            if len(rows) == 0:
                continue
            binR[b] = float(rows.groupby("workspace")["score_recall"].mean().mean())
            binP[b] = float(rows.groupby("workspace")["score_precision"].mean().mean())
        cr = cp = 0.0
        accR, accP = [], []
        for b in range(NB):
            cr += binR[b]
            cp += binP[b]
            accR.append(round(cr / NB * 100, 1))
            accP.append(round(cp / NB * 100, 1))
        pr[mid] = {"recall": accR, "precision": accP}

    # P/R picker list: every model with P/R data, score ascending. `models`
    # (top-N, org-grouped) still drives the Score-vs-Complexity bars/legend.
    pr_rows = sorted(all_rows, key=lambda r: r["score"])
    pr_models = [{"id": mid_of[(r["agent"], r["model"])], "agent": r["agent"], "model": r["model"],
                  "org": r["org"], "label": r["model_display"], "score": r["score"]}
                 for r in pr_rows if mid_of[(r["agent"], r["model"])] in pr]

    # Default P/R selection grouped by org: the two best-scoring orgs each fill a
    # full row (their top 4), remaining slots filled by each next org's best — so
    # row 1 = Anthropic, row 2 = OpenAI, row 3 = other companies in score order.
    valid = {m["id"] for m in pr_models}
    org_best_all = {}
    for r in all_rows:
        if mid_of[(r["agent"], r["model"])] in valid:
            org_best_all[r["org"]] = max(org_best_all.get(r["org"], 0.0), r["score"])
    primary = [o for o in ("Anthropic", "OpenAI") if o in org_best_all]
    others = sorted([o for o in org_best_all if o not in primary], key=lambda o: -org_best_all[o])
    org_order = primary + others
    by_org = {}
    for r in sorted(all_rows, key=lambda r: -r["score"]):
        mid = mid_of[(r["agent"], r["model"])]
        if mid in valid:
            by_org.setdefault(r["org"], []).append(mid)
    pr_default = []
    for oi, org in enumerate(org_order):
        take = by_org[org][:4] if oi < 2 else by_org[org][:1]
        for mid in take:
            if len(pr_default) < 12:
                pr_default.append(mid)
        if len(pr_default) >= 12:
            break

    return {
        "models": models, "dims": dims_out, "pr": pr, "pr_models": pr_models,
        "pr_default": pr_default, "org_order": org_order,
        "metrics": [{"key": "score", "label": "Score"}, {"key": "resolve", "label": "Resolve Rate"},
                    {"key": "precision", "label": "Precision"}, {"key": "recall", "label": "Recall"}],
    }


if __name__ == "__main__":
    recs = compute_records()
    RECORDS_JSON.write_text(json.dumps(recs, indent=2))
    print(f"wrote {RECORDS_JSON} ({len(recs)} entries)")
