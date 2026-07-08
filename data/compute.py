#!/usr/bin/env python3
"""EvoClaw shared data layer.

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


if __name__ == "__main__":
    recs = compute_records()
    RECORDS_JSON.write_text(json.dumps(recs, indent=2))
    print(f"wrote {RECORDS_JSON} ({len(recs)} entries)")
