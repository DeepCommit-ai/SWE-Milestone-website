#!/usr/bin/env python3
"""Build EvoClaw leaderboard page.

Reads analysis CSVs and generates visualization/leaderboard/index.html.
Usage: python visualization/leaderboard/build.py
"""

import json
import shutil
import sys
import pathlib

import pandas as pd

VIZ_DIR = pathlib.Path(__file__).resolve().parent
DATA_DIR = VIZ_DIR / "data"
E2E_TRIAL_CSV = DATA_DIR / "e2e_trial.csv"
OPENHANDS_TRIAL_CSV = DATA_DIR / "openhands_e2e_trial.csv"

# ── Agent-model display names (for e2e.csv → leaderboard mapping) ──────────
AGENT_MODEL_DISPLAY = {
    ("claude-code", "claude-sonnet-4-5-20250929"): "CC Sonnet 4.5",
    ("claude-code", "claude-sonnet-4-6"): "CC Sonnet 4.6",
    ("claude-code", "claude-opus-4-5-20251101"): "CC Opus 4.5",
    ("claude-code", "claude-opus-4-6"): "CC Opus 4.6",
    ("claude-code", "claude-opus-4-7"): "CC Opus 4.7 xhigh",
    ("claude-code", "claude-opus-4-7[1m]"): "CC Opus 4.7 xhigh 1M",
    ("claude-code", "claude-opus-4-8"): "CC Opus 4.8 max 1M",
    ("claude-code", "glm-5"): "CC GLM-5",
    ("claude-code", "glm-5.1"): "CC GLM-5.1",
    ("claude-code", "glm-5.2"): "CC GLM-5.2",
    ("claude-code", "glm-5.2-1m"): "CC GLM-5.2 1M",
    ("claude-code", "kimi-k2.6"): "CC Kimi K2.6",
    ("claude-code", "deepseek-v4-pro"): "CC DeepSeek V4 Pro",
    ("claude-code", "qwen3.6-27b"): "CC Qwen3.6 27B",
    ("codex", "gpt-5.2-codex"): "Codex GPT-5.2C",
    ("codex", "gpt-5.2"): "Codex GPT-5.2",
    ("codex", "gpt-5.3-codex"): "Codex GPT-5.3C",
    ("codex", "gpt-5.4"): "Codex GPT-5.4",
    ("codex", "gpt-5.5"): "Codex GPT-5.5",
    ("gemini-cli", "gemini-3-flash"): "Gemini Flash",
    ("gemini-cli", "gemini-3-flash-preview"): "Gemini Flash",
    ("gemini-cli", "gemini-3-pro"): "Gemini Pro",
    ("gemini-cli", "gemini-3-pro-preview"): "Gemini Pro",
    ("gemini-cli", "gemini-3.1-pro"): "Gemini 3.1 Pro",
    ("gemini-cli", "gemini-3.5-flash"): "Gemini 3.5 Flash",
}

AGENT_MODEL_ORDER = [
    "CC Sonnet 4.5", "CC Opus 4.5", "CC Sonnet 4.6", "CC Opus 4.6",
    "CC Opus 4.7 xhigh", "CC Opus 4.7 xhigh 1M",
    "CC Opus 4.8 max 1M",
    "CC GLM-5", "CC GLM-5.1", "CC GLM-5.2", "CC GLM-5.2 1M",
    "CC Kimi K2.6", "CC DeepSeek V4 Pro", "CC Qwen3.6 27B",
    "Codex GPT-5.2C", "Codex GPT-5.2", "Codex GPT-5.3C", "Codex GPT-5.4",
    "Codex GPT-5.5",
    "Gemini Pro", "Gemini 3.1 Pro", "Gemini Flash", "Gemini 3.5 Flash",
]


def load_e2e() -> pd.DataFrame:
    """Load per-milestone e2e results from e2e.csv."""
    df = pd.read_csv(DATA_DIR / "e2e.csv")
    if "is_resolved" in df.columns:
        df["is_resolved"] = df["is_resolved"].astype(bool)
    elif "eval_status" in df.columns:
        df["is_resolved"] = df["eval_status"] == "passed"
    df["agent_model"] = df.apply(
        lambda r: AGENT_MODEL_DISPLAY.get(
            (r["agent_name"], r["model"]),
            f"{r['agent_name']}_{r['model']}",
        ),
        axis=1,
    )
    return df

# ── Model name normalization ────────────────────────────────────────────────
MODEL_ALIASES = {
    "gemini-3-pro-preview": "gemini-3-pro",
    "gemini-3-flash-preview": "gemini-3-flash",
}

# ── Agent groups (same order as paper table) ────────────────────────────────
AGENT_GROUPS = [
    ("claude-code", [
        "claude-sonnet-4-5-20250929", "claude-opus-4-5-20251101",
        "claude-sonnet-4-6", "claude-opus-4-6",
        "claude-opus-4-7", "claude-opus-4-7[1m]",
        "claude-opus-4-8",
        "glm-5", "glm-5.1", "glm-5.2", "glm-5.2-1m",
        "kimi-k2.6", "deepseek-v4-pro", "qwen3.6-27b",
    ]),
    ("codex", ["gpt-5.2-codex", "gpt-5.2", "gpt-5.3-codex", "gpt-5.4", "gpt-5.5"]),
    ("gemini-cli", ["gemini-3-pro", "gemini-3.1-pro", "gemini-3-flash", "gemini-3.5-flash"]),
]
OPENHANDS_MODELS = [
    "minimax-m2.5", "kimi-k2.5", "gemini-3-flash",
    "gpt-5.3-codex", "claude-opus-4-6", "glm-5", "kimi-k2.6",
]

# ── Display names ───────────────────────────────────────────────────────────
MODEL_DISPLAY = {
    "claude-sonnet-4-5-20250929": "Claude Sonnet 4.5",
    "claude-opus-4-5-20251101": "Claude Opus 4.5",
    "claude-sonnet-4-6": "Claude Sonnet 4.6",
    "claude-opus-4-6": "Claude Opus 4.6",
    "claude-opus-4-7": "Claude Opus 4.7 xhigh",
    "claude-opus-4-7[1m]": "Claude Opus 4.7 xhigh 1M",
    "claude-opus-4-8": "Claude Opus 4.8 max 1M",
    "glm-5": "GLM-5",
    "glm-5.1": "GLM-5.1",
    "glm-5.2": "GLM-5.2",
    "glm-5.2-1m": "GLM-5.2 1M",
    "deepseek-v4-pro": "DeepSeek V4 Pro",
    "qwen3.6-27b": "Qwen3.6 27B",
    "gpt-5.2-codex": "GPT 5.2 Codex xhigh",
    "gpt-5.2": "GPT 5.2 xhigh",
    "gpt-5.3-codex": "GPT 5.3 Codex xhigh",
    "gpt-5.4": "GPT 5.4 xhigh",
    "gpt-5.5": "GPT 5.5 xhigh",
    "gemini-3-pro": "Gemini 3 Pro",
    "gemini-3.1-pro": "Gemini 3.1 Pro",
    "gemini-3-flash": "Gemini 3 Flash",
    "gemini-3.5-flash": "Gemini 3.5 Flash",
    "kimi-k2.5": "Kimi K2.5",
    "kimi-k2.6": "Kimi K2.6",
    "minimax-m2.5": "MiniMax M2.5",
}
AGENT_DISPLAY = {
    "claude-code": "Claude Code",
    "codex": "Codex CLI",
    "gemini-cli": "Gemini CLI",
    "openhands": "OpenHands",
}
MODEL_ORG = {
    "claude-sonnet-4-5-20250929": "Anthropic",
    "claude-opus-4-5-20251101": "Anthropic",
    "claude-sonnet-4-6": "Anthropic",
    "claude-opus-4-6": "Anthropic",
    "claude-opus-4-7": "Anthropic",
    "claude-opus-4-7[1m]": "Anthropic",
    "claude-opus-4-8": "Anthropic",
    "glm-5": "Z.ai",
    "glm-5.1": "Z.ai",
    "glm-5.2": "Z.ai",
    "glm-5.2-1m": "Z.ai",
    "deepseek-v4-pro": "DeepSeek",
    "qwen3.6-27b": "Qwen",
    "gpt-5.2-codex": "OpenAI",
    "gpt-5.2": "OpenAI",
    "gpt-5.3-codex": "OpenAI",
    "gpt-5.4": "OpenAI",
    "gpt-5.5": "OpenAI",
    "gemini-3-pro": "Google",
    "gemini-3.1-pro": "Google",
    "gemini-3-flash": "Google",
    "gemini-3.5-flash": "Google",
    "kimi-k2.5": "Moonshot AI",
    "kimi-k2.6": "Moonshot AI",
    "minimax-m2.5": "MiniMax",
}

# ── Chart labels ────────────────────────────────────────────────────────────
CHART_LABELS = {
    ("claude-code", "claude-sonnet-4-5-20250929"): "Claude Sonnet 4.5",
    ("claude-code", "claude-opus-4-5-20251101"): "Claude Opus 4.5",
    ("claude-code", "claude-sonnet-4-6"): "Claude Sonnet 4.6",
    ("claude-code", "claude-opus-4-6"): "Claude Opus 4.6",
    ("claude-code", "claude-opus-4-7"): "Claude Opus 4.7 xhigh",
    ("claude-code", "claude-opus-4-7[1m]"): "Claude Opus 4.7 xhigh 1M",
    ("claude-code", "claude-opus-4-8"): "Claude Opus 4.8 max 1M",
    ("claude-code", "glm-5"): "GLM-5",
    ("claude-code", "glm-5.1"): "GLM-5.1",
    ("claude-code", "glm-5.2"): "GLM-5.2",
    ("claude-code", "glm-5.2-1m"): "GLM-5.2 1M",
    ("claude-code", "kimi-k2.6"): "Kimi K2.6",
    ("claude-code", "deepseek-v4-pro"): "DeepSeek V4 Pro",
    ("claude-code", "qwen3.6-27b"): "Qwen3.6 27B",
    ("codex", "gpt-5.2-codex"): "GPT-5.2-Codex xhigh",
    ("codex", "gpt-5.2"): "GPT-5.2 xhigh",
    ("codex", "gpt-5.3-codex"): "GPT-5.3-Codex xhigh",
    ("codex", "gpt-5.4"): "GPT-5.4 xhigh",
    ("codex", "gpt-5.5"): "GPT-5.5 xhigh",
    ("gemini-cli", "gemini-3-pro"): "Gemini 3 Pro",
    ("gemini-cli", "gemini-3.1-pro"): "Gemini 3.1 Pro",
    ("gemini-cli", "gemini-3-flash"): "Gemini 3 Flash",
    ("gemini-cli", "gemini-3.5-flash"): "Gemini 3.5 Flash",
    ("openhands", "minimax-m2.5"): "MiniMax M2.5",
    ("openhands", "kimi-k2.5"): "Kimi K2.5",
    ("openhands", "gemini-3-flash"): "Gemini 3 Flash",
    ("openhands", "gpt-5.3-codex"): "GPT-5.3-Codex xhigh",
    ("openhands", "claude-opus-4-6"): "Claude Opus 4.6",
    ("openhands", "glm-5"): "GLM-5",
    ("openhands", "kimi-k2.6"): "Kimi K2.6",
}

# ── Per-entry text position overrides (to avoid overlap) ───────────────────
# Default is 'middle right'.
CHART_TEXT_POS = {
    ("claude-code", "claude-sonnet-4-5-20250929"): "middle left",
    ("claude-code", "kimi-k2.6"): "middle left",
    ("claude-code", "glm-5"): "bottom center",
    ("codex", "gpt-5.2"): "middle left",
    ("codex", "gpt-5.3-codex"): "middle left",
    ("gemini-cli", "gemini-3-flash"): "middle left",
    ("openhands", "minimax-m2.5"): "middle left",
    ("openhands", "kimi-k2.5"): "middle left",
    ("openhands", "claude-opus-4-6"): "bottom center",
}

# ── Per-entry colors (brightened for dark bg) ───────────────────────────────
ENTRY_COLORS = {
    ("claude-code", "claude-sonnet-4-5-20250929"): "#D07A5E",
    ("claude-code", "claude-opus-4-5-20251101"): "#D07A5E",
    ("claude-code", "claude-sonnet-4-6"): "#D07A5E",
    ("claude-code", "claude-opus-4-6"): "#D07A5E",
    ("claude-code", "claude-opus-4-7"): "#D07A5E",
    ("claude-code", "claude-opus-4-7[1m]"): "#D07A5E",
    ("claude-code", "claude-opus-4-8"): "#D07A5E",
    # GLM / Z.ai: use the light-mode color as the default; the scatter
    # renderer overrides to a lighter gray when dark theme is active so the
    # centre dot stays visible on the dark canvas. Same fallback for both
    # GLM variants — the dot resolver in JS pulls the themed --zai-accent.
    ("claude-code", "glm-5"):   "#4A4D5C",
    ("claude-code", "glm-5.1"): "#4A4D5C",
    ("claude-code", "glm-5.2"): "#4A4D5C",
    ("claude-code", "glm-5.2-1m"): "#4A4D5C",
    # CC Kimi K2.6 — themed silver via --moonshot-accent (same as OH Kimi).
    ("claude-code", "kimi-k2.6"): "#5C5F6B",
    ("claude-code", "deepseek-v4-pro"): "#4D6BFE",
    ("claude-code", "qwen3.6-27b"): "#615CED",
    ("codex", "gpt-5.2-codex"): "#90C890",
    ("codex", "gpt-5.2"): "#90C890",
    ("codex", "gpt-5.3-codex"): "#90C890",
    ("codex", "gpt-5.4"): "#90C890",
    ("codex", "gpt-5.5"): "#90C890",
    ("gemini-cli", "gemini-3-pro"): "#7AAED8",
    ("gemini-cli", "gemini-3.1-pro"): "#7AAED8",
    ("gemini-cli", "gemini-3-flash"): "#7AAED8",
    ("gemini-cli", "gemini-3.5-flash"): "#7AAED8",
    ("openhands", "minimax-m2.5"): "#E06070",
    # Moonshot/Kimi: themed silver — JS dot resolver pulls --moonshot-accent
    # at render time, so the centre dot tracks light/dark theme. The static
    # value here is the light-mode fallback for non-JS contexts.
    ("openhands", "kimi-k2.5"): "#5C5F6B",
    ("openhands", "gemini-3-flash"): "#7AAED8",
    ("openhands", "gpt-5.3-codex"): "#90C890",
    ("openhands", "claude-opus-4-6"): "#D07A5E",
    ("openhands", "glm-5"): "#4A4D5C",
    ("openhands", "kimi-k2.6"): "#5C5F6B",
}

ORG_COLORS = {
    "Anthropic": "#D97757",
    "OpenAI": "#10A37F",
    "Google": "#4285F4",
    # Moonshot AI: cool moonlight silver — flips tone with theme alongside
    # Z.ai, so the table org badge stays legible in both light and dark.
    "Moonshot AI": "var(--moonshot-accent)",
    "MiniMax": "#F03A5D",
    # Z.ai flips tone with theme so GLM reads as dark-brand on light canvas
    # and light-brand on dark canvas. CSS var resolves at render time.
    "Z.ai": "var(--zai-accent)",
    "DeepSeek": "#4D6BFE",
    "Qwen": "#615CED",
}
AGENT_COLORS = {
    "claude-code": {"bg": "rgba(217,119,87,0.15)", "fg": "#D97757"},
    "codex": {"bg": "rgba(16,163,127,0.15)", "fg": "#10A37F"},
    "gemini-cli": {"bg": "rgba(66,133,244,0.15)", "fg": "#4285F4"},
    "openhands": {"bg": "rgba(232,186,58,0.18)", "fg": "#e0b040"},
}


def compute_records():
    """Compute leaderboard data from CSVs."""
    e2e = load_e2e()
    e2e["is_resolved"] = (e2e["eval_status"] == "passed").astype(float)

    # Trial-level output tokens
    trial_df = pd.read_csv(E2E_TRIAL_CSV)
    trial_df["model"] = trial_df["model"].replace(MODEL_ALIASES)
    trial_tokens = {}
    trial_duration = {}
    trial_cost = {}
    trial_turns = {}
    for model in trial_df["model"].unique():
        sub = trial_df[trial_df["model"] == model]
        trial_tokens[model] = sub["total_output_tokens"].mean() / 1000
        trial_duration[model] = sub["total_duration_ms"].mean() / 3_600_000
        trial_cost[model] = sub["total_cost_usd"].mean()
        trial_turns[model] = sub["total_turns"].mean()

    records = []

    # Non-OpenHands agents
    for am in AGENT_MODEL_ORDER:
        sub = e2e[e2e["agent_model"] == am]
        if len(sub) == 0:
            continue
        agent = sub["agent_name"].iloc[0]
        model = sub["model"].iloc[0]

        ws_score = sub.groupby("workspace")["score_reliable"].mean()
        ws_prec = sub.groupby("workspace")["score_precision"].mean()
        ws_rec = sub.groupby("workspace")["score_recall"].mean()
        ws_res = sub.groupby("workspace")["is_resolved"].mean()
        # Trial-level totals from agent_stats.summary (matches the dashboard).
        # Per-milestone sums under-count for trials with ungraded prep /
        # teardown work, so summary is the truer trial total. Same applies to
        # cost (m_cost_usd sum was missing setup turns billed against the
        # trial but outside any graded milestone — codex gpt-5.5 dubbo:
        # milestone sum $65.70 vs summary $111.96).
        ws_dur = trial_df[trial_df["model"] == model].set_index("workspace")["total_duration_ms"] / 3_600_000
        ws_turns = trial_df[trial_df["model"] == model].set_index("workspace")["total_turns"]
        ws_cost = trial_df[trial_df["model"] == model].set_index("workspace")["total_cost_usd"]

        records.append({
            "agent": agent,
            "agent_display": AGENT_DISPLAY.get(agent, agent),
            "model": model,
            "model_display": MODEL_DISPLAY.get(model, model),
            "org": MODEL_ORG.get(model, ""),
            "org_color": ORG_COLORS.get(MODEL_ORG.get(model, ""), "#888"),
            "agent_bg": AGENT_COLORS.get(agent, {}).get("bg", ""),
            "agent_fg": AGENT_COLORS.get(agent, {}).get("fg", ""),
            "color": ENTRY_COLORS.get((agent, model), "#888"),
            "chart_label": CHART_LABELS.get((agent, model), model),
            "chart_textpos": CHART_TEXT_POS.get((agent, model), "middle right"),
            "score": round(ws_score.mean() * 100, 2),
            "precision": round(ws_prec.mean() * 100, 2),
            "recall": round(ws_rec.mean() * 100, 2),
            "resolve": round(ws_res.mean() * 100, 2),
            "cost": round(ws_cost.mean(), 2) or round(trial_cost.get(model, 0), 2),
            "out_tok_k": round(trial_tokens.get(model, 0)),
            "time_h": round(ws_dur.mean(), 2),
            "turns": round(ws_turns.mean()) or round(trial_turns.get(model, 0)),
        })

    # OpenHands agents
    oh_df = pd.read_csv(OPENHANDS_TRIAL_CSV)
    for model in OPENHANDS_MODELS:
        sub = oh_df[oh_df["model"] == model]
        if len(sub) == 0:
            continue
        reliable = sub[sub["total_output_tokens"] > 0]
        tok_sub = reliable if len(reliable) < len(sub) else sub

        records.append({
            "agent": "openhands",
            "agent_display": "OpenHands",
            "model": model,
            "model_display": MODEL_DISPLAY.get(model, model),
            "org": MODEL_ORG.get(model, ""),
            "org_color": ORG_COLORS.get(MODEL_ORG.get(model, ""), "#888"),
            "agent_bg": AGENT_COLORS["openhands"]["bg"],
            "agent_fg": AGENT_COLORS["openhands"]["fg"],
            "color": ENTRY_COLORS.get(("openhands", model), "#888"),
            "chart_label": CHART_LABELS.get(("openhands", model), model),
            "chart_textpos": CHART_TEXT_POS.get(("openhands", model), "middle right"),
            "score": round(sub["mean_score_reliable"].mean() * 100, 2),
            "precision": round(sub["mean_score_precision"].mean() * 100, 2),
            "recall": round(sub["mean_score_recall"].mean() * 100, 2),
            "resolve": round(sub["resolve_rate"].mean() * 100, 2),
            "cost": round(tok_sub["total_cost_usd"].mean(), 2),
            "out_tok_k": round(tok_sub["total_output_tokens"].mean() / 1000),
            "time_h": round(sub["total_duration_ms"].mean() / 3_600_000, 2),
            "turns": round(tok_sub["total_turns"].mean()),
        })

    # Mark official entries: non-openhands are always official;
    # openhands is official only if that model has no native agent entry.
    native_models = {r["model"] for r in records if r["agent"] != "openhands"}
    for r in records:
        if r["agent"] == "openhands" and r["model"] in native_models:
            r["is_official"] = False
        else:
            r["is_official"] = True

    records.sort(key=lambda r: r["score"], reverse=True)
    for i, r in enumerate(records):
        r["rank"] = i + 1

    return records


def main():
    print("Computing leaderboard data...")
    records = compute_records()
    data_json = json.dumps(records)

    # Load logos
    logos_path = VIZ_DIR / "logos.json"
    if logos_path.exists():
        logos = json.load(open(logos_path))
        print(f"  loaded {len(logos)} logos")
    else:
        logos = {}
        print("  [warn] logos.json not found")
    logos_json = json.dumps(logos)

    # Copy CSVs
    out_data = VIZ_DIR / "data"
    out_data.mkdir(exist_ok=True)
    for csv_name in ["e2e.csv", "e2e_trial.csv", "openhands_e2e_trial.csv"]:
        src = DATA_DIR / csv_name
        dst = out_data / csv_name
        if src.exists() and src.resolve() != dst.resolve():
            shutil.copy2(src, dst)

    # Generate HTML
    html = HTML_TEMPLATE.replace('"__LEADERBOARD_DATA__"', data_json)
    html = html.replace('"__LOGOS__"', logos_json)
    out_path = VIZ_DIR / "index.html"
    out_path.write_text(html)
    print(f"  wrote {out_path} ({len(records)} entries)")


# ═══════════════════════════════════════════════════════════════════════════
# HTML Template
# ═══════════════════════════════════════════════════════════════════════════
HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EvoClaw Leaderboard</title>
<link rel="icon" type="image/png" href="evoclaw_icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.plot.ly/plotly-2.32.0.min.js"></script>
<script>(function(){var t=localStorage.getItem('evoclaw-theme');if(t!=='dark'){document.documentElement.setAttribute('data-theme','light');document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('.theme-btn').forEach(function(b){b.classList.toggle('active',b.dataset.themeVal==='light')})})}})()</script>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{
  /* Dark theme variables live at the root so [data-theme="light"] only has
   * to override what changes. Default is still written here, but the
   * boot script applies data-theme="light" on first load unless the user
   * previously picked dark — so the visible default is LIGHT mode. */
  --bg-0:#08080d;--bg-1:#0e0e16;--bg-2:#14141f;--bg-3:#1c1c2b;
  --border:#262640;--text-1:#e2e8f0;--text-2:#94a3b8;--text-3:#64748b;
  --accent:#6366f1;--accent-light:#818cf8;
  /* Z.ai brand tint — dark-gray in light mode, near-white in dark mode.
   * Used by the NEW callout, the scatter-chart centre dot, the scatter
   * pill background, and the table org badge so every Z.ai surface
   * flips tone together. `--zai-tag-text` is the text colour painted
   * INSIDE the NEW tag (whose background is `--zai-accent`); it's the
   * contrast colour of the accent so text stays legible in both modes. */
  --zai-accent:#CFD2D9;
  --zai-tag-text:#1a1d2e;
  /* Moonshot AI brand tint — cool moonlight silver. Same theme-flip
   * mechanism as --zai-accent: the centre dot, pill background, and
   * org badge all read this var so Kimi entries track tone with the
   * canvas. Light-mode value is the dark side (charcoal) so it stays
   * visible on a white background; dark-mode value is moonlit silver.
   * --moonshot-tag-text mirrors --zai-tag-text: contrast colour for
   * text painted INSIDE the NEW tag (which uses --moonshot-accent as
   * background). */
  --moonshot-accent:#C8CBD3;
  --moonshot-tag-text:#1a1d2e;
}
[data-theme="light"]{
  --bg-0:#f7f8fc;--bg-1:#ffffff;--bg-2:#eef0f8;--bg-3:#e2e5f0;
  --border:#cfd4e2;--text-1:#1a1d2e;--text-2:#4a5068;--text-3:#7c839a;
  --accent:#5b5cf6;--accent-light:#4f46e5;
  --zai-accent:#4A4D5C;
  --zai-tag-text:#ffffff;
  --moonshot-accent:#5C5F6B;
  --moonshot-tag-text:#ffffff;
}
body,.panel,.nav-btn,.table-wrap{transition:background-color .3s ease,border-color .3s ease}
html{scroll-behavior:smooth}
body{background:var(--bg-0);color:var(--text-1);font-family:'Inter',system-ui,-apple-system,sans-serif;line-height:1.6;min-height:100vh}
.container{max-width:1580px;margin:0 auto;padding:2.5rem 1.5rem}

/* ── Header ────────────────────────────────────────────────── */
.hero{text-align:left;padding:1.5rem 0 2.5rem}
.hero-title{font-size:2rem;font-weight:800;letter-spacing:-0.02em;margin-bottom:1.25rem}
.hero-title .title-icon{width:1.15em;height:1.15em;vertical-align:-0.22em;margin-right:.45em;border-radius:6px;transform:translateY(-5px)}
.hero-title .brand{
  background:linear-gradient(135deg,#6366f1 0%,#a78bfa 50%,#c4b5fd 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero-title .sep{color:var(--text-3);font-weight:400;margin:0 .15em}
.hero-title .desc{color:var(--text-2);font-weight:400;font-size:.85em}
.hero-desc{color:var(--text-3);font-size:.9rem;margin:0 0 1.25rem;line-height:1.7}
/* Per-banner accent set via inline --accent so each NEW row can use the
 * achieving model's family color (Anthropic orange for Claude wins,
 * Z.ai blue for GLM, OpenAI green for GPT, etc.). */
.news-banner{display:flex;align-items:center;gap:.6rem;padding:.55rem .9rem;border-radius:8px;border:1px solid color-mix(in srgb, var(--accent, #10A37F) 28%, transparent);background:color-mix(in srgb, var(--accent, #10A37F) 8%, transparent);font-size:.85rem;color:var(--text-2);line-height:1.5}
.news-stack{display:grid;grid-template-columns:1fr 1fr;gap:.4rem .6rem;margin-bottom:1.25rem}
@media (max-width:720px){.news-stack{grid-template-columns:1fr}}
.news-tag{flex-shrink:0;padding:.1rem .45rem;border-radius:4px;background:var(--accent, #10A37F);color:var(--tag-text, #fff);font-size:.65rem;font-weight:700;letter-spacing:.04em}
/* Z.ai banner pulls both its accent AND the contrast-safe tag text
 * from the themed CSS variables defined on :root / [data-theme="light"],
 * so the NEW tag stays readable whether the accent is near-white
 * (dark mode) or dark-gray (light mode). */
.news-banner--zai{--accent:var(--zai-accent);--tag-text:var(--zai-tag-text)}
.news-banner--moonshot{--accent:var(--moonshot-accent);--tag-text:var(--moonshot-tag-text)}
.news-text strong{color:var(--text-1)}
.nav-btns{display:flex;gap:.6rem;justify-content:flex-start;flex-wrap:wrap}
.nav-btn{display:inline-flex;align-items:center;gap:.45rem;
  padding:.55rem 1.2rem;border-radius:8px;font-size:.875rem;font-weight:500;
  text-decoration:none;color:var(--text-2);background:var(--bg-2);
  border:1px solid var(--border);transition:all .2s ease;cursor:pointer}
.nav-btn:hover{color:var(--text-1);border-color:var(--accent);background:var(--bg-3)}
.nav-btn.active{color:#fff;background:var(--accent);border-color:var(--accent)}
.nav-btn svg{width:16px;height:16px;flex-shrink:0}
.nav-btn .icon-light{display:none}
[data-theme="light"] .nav-btn .icon-dark{display:none}
[data-theme="light"] .nav-btn .icon-light{display:inline}

/* ── Panels ────────────────────────────────────────────────── */
.panel{background:var(--bg-1);border:1px solid var(--border);border-radius:14px;padding:1.5rem;margin-bottom:1.75rem}
.panel-title{font-size:1.15rem;font-weight:600;margin-bottom:1rem;color:var(--text-1)}
#chart{width:100%;height:500px;border-radius:8px;background:var(--bg-2)}

/* ── Table ─────────────────────────────────────────────────── */
.table-wrap{overflow-x:auto;border-radius:8px;border:1px solid var(--border)}
table{width:100%;border-collapse:collapse;font-size:.875rem}
thead{position:sticky;top:0;z-index:2}
th{background:var(--bg-3);color:var(--text-2);font-weight:600;padding:.7rem .9rem;
  text-align:left;white-space:nowrap;cursor:pointer;user-select:none;
  border-bottom:2px solid var(--border);transition:color .15s}
th:hover{color:var(--text-1)}
th.sort-asc::after{content:' \2191';color:var(--accent)}
th.sort-desc::after{content:' \2193';color:var(--accent)}
th.num-col{text-align:right}
td{padding:.55rem .9rem;border-bottom:1px solid rgba(38,38,64,.5);white-space:nowrap;transition:background .15s}
tr:hover td{background:rgba(99,102,241,.04)}
.num{text-align:right;font-variant-numeric:tabular-nums}

/* rank */
.rank-cell{text-align:center;font-weight:700;width:48px;font-size:.95rem}
.rank-medal{font-size:1.1rem}

/* org logo */
.org-logo{width:22px;min-width:22px;height:22px;margin-right:8px;vertical-align:middle;flex-shrink:0;border-radius:4px;object-fit:contain;object-position:center}
.org-badge{display:inline-flex;align-items:center;justify-content:center;
  width:22px;height:22px;border-radius:5px;font-size:10px;font-weight:700;
  color:#fff;margin-right:8px;vertical-align:middle;flex-shrink:0}
.model-cell{align-items:center;font-weight:500}
/* agent icon in table */
.agent-cell{display:inline-flex;align-items:center;gap:8px;vertical-align:middle}
.agent-icon{width:22px;height:22px;object-fit:contain;flex-shrink:0;border-radius:4px}

/* agent badge */
.agent-badge{display:inline-block;padding:2px 10px;border-radius:6px;font-size:.78rem;font-weight:500}

/* score bar */
.score-cell{position:relative;text-align:right;font-variant-numeric:tabular-nums}
.score-bar{position:absolute;right:0;top:4px;bottom:4px;border-radius:4px;opacity:.18;z-index:0}
.score-val{position:relative;z-index:1;font-weight:600}
.best-val{color:var(--accent-light);font-weight:700}
.second-val{color:color-mix(in srgb, var(--accent-light) 80%, transparent);font-weight:600}
.worst-val{color:#c44e52;font-weight:600}
.score-val:not(.best-val):not(.second-val):not(.worst-val){color:color-mix(in srgb, var(--text-1) 80%, transparent)}
[data-theme="light"] .worst-val{color:#a8324a}
.leaderboard-header{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1rem}
.leaderboard-legend{display:flex;align-items:center;gap:1rem;font-size:.78rem;color:var(--text-3)}
.legend-item{display:inline-flex;align-items:center;gap:.3rem;white-space:nowrap}
.legend-swatch{font-size:.85rem;line-height:1}

/* top-3 row accents */
tr.top-1 td{background:rgba(251,191,36,.04)}
tr.top-2 td{background:rgba(192,192,210,.025)}
tr.top-3 td{background:rgba(205,127,50,.025)}

/* ── Footer ────────────────────────────────────────────────── */
footer{text-align:center;padding:2rem 0 1rem;color:var(--text-3);font-size:.8rem}
footer a{color:var(--text-2);text-decoration:none}
footer a:hover{color:var(--accent)}

/* ── Tooltip ──────────────────────────────────────────────── */
.tip-popup{position:fixed;background:var(--bg-3);color:var(--text-1);border:1px solid var(--border);border-radius:8px;
  padding:6px 14px;font-size:.82rem;font-weight:500;white-space:nowrap;
  pointer-events:none;z-index:9999;opacity:0;transition:opacity .15s;
  box-shadow:0 4px 16px rgba(0,0,0,.15)}
.tip-popup.show{opacity:1}

/* ── Toggle ───────────────────────────────────────────────── */
.toggle-label{display:inline-flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.85rem;color:var(--text-2)}
.toggle-label input{width:16px;height:16px;accent-color:var(--accent);cursor:pointer}
.toggle-text{user-select:none}

/* ── Plotly overrides ──────────────────────────────────────── */
.js-plotly-plot .plotly .modebar{background:transparent !important}
.js-plotly-plot .plotly .modebar-btn path{fill:var(--text-3) !important}
.js-plotly-plot .plotly .modebar-btn:hover path{fill:var(--accent) !important}

/* ── Theme toggle ─────────────────────────────────────────── */
.theme-toggle{position:fixed;top:1.25rem;right:1.5rem;z-index:100;
  display:flex;border-radius:10px;padding:2px;
  background:var(--bg-3);border:1px solid var(--border);
  box-shadow:0 2px 8px rgba(0,0,0,.1);
  transition:background-color .3s,border-color .3s}
.theme-btn{width:30px;height:26px;border:none;background:transparent;
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  color:var(--text-3);transition:background-color .2s,color .2s,box-shadow .2s;
  border-radius:7px;padding:0}
.theme-btn svg{width:14px;height:14px}
.theme-btn:hover{color:var(--text-1)}
.theme-btn.active{background:var(--bg-1);color:var(--accent);box-shadow:0 1px 3px rgba(0,0,0,.12)}
[data-theme="light"] tr.top-1 td{background:rgba(251,191,36,.08)}
[data-theme="light"] tr.top-2 td{background:rgba(160,160,180,.06)}
[data-theme="light"] tr.top-3 td{background:rgba(205,127,50,.06)}
[data-theme="light"] .score-bar{opacity:.25}
[data-theme="light"] tr:hover td{background:rgba(79,70,229,.06)}

@media(max-width:768px){
  .hero-title{font-size:1.4rem}
  .container{padding:1.5rem 1rem}
  #chart{height:360px}
  .theme-toggle{top:1rem;right:1rem}
}
</style>
</head>
<body>
<div class="theme-toggle">
  <button class="theme-btn" data-theme-val="dark" onclick="setTheme('dark')" aria-label="Dark mode">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.9 8.6a6 6 0 01-6.5-6.5A6 6 0 108.6 13.9a6 6 0 005.3-5.3z"/></svg>
  </button>
  <button class="theme-btn active" data-theme-val="light" onclick="setTheme('light')" aria-label="Light mode">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg>
  </button>
</div>
<div class="container">

<!-- ═══ Header ═══ -->
<header class="hero">
  <h1 class="hero-title">
    <img class="title-icon" src="evoclaw_icon.png" alt=""><span class="brand">EvoClaw</span><span class="sep">:</span><span class="desc">Evaluating AI Agents on Continuous Software Evolution</span>
  </h1>
  <p class="hero-desc">Long-running agents build customized software (a &ldquo;Claw&rdquo;) to interact with their environments. For practical use in complex, real-world tasks, these agents must fully and autonomously evolve this software in response to a continuous stream of end-user requirements. EvoClaw evaluates how well frontier LLM agents handle this continuous development, benchmarking them against real-world evolution itineraries from open-source repositories.</p>
  <nav class="nav-btns">
    <a class="nav-btn active" href="#leaderboard">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2h8v5a4 4 0 01-8 0V2z"/><path d="M4 4H2.5a1 1 0 00-1 1v.5A2.5 2.5 0 004 8"/><path d="M12 4h1.5a1 1 0 011 1v.5A2.5 2.5 0 0112 8"/><path d="M6 11v2h4v-2"/><path d="M5 13h6"/></svg>
      Leaderboard</a>
    <a class="nav-btn" href="https://arxiv.org/pdf/2603.13428" target="_blank">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z"/><path d="M9 1v4h4"/><path d="M5 8h6M5 11h4"/></svg>
      Paper</a>
    <a class="nav-btn" href="https://huggingface.co/datasets/hyd2apse/EvoClaw-data" target="_blank">
      <svg class="icon-light" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd"><path d="M16.781 3.277c2.997 1.704 4.844 4.851 4.844 8.258 0 .995-.155 1.955-.443 2.857a1.332 1.332 0 011.125.4 1.41 1.41 0 01.2 1.723c.204.165.352.385.428.632l.017.062c.06.222.12.69-.2 1.166.244.37.279.836.093 1.236-.255.57-.893 1.018-2.128 1.5l-.202.078-.131.048c-.478.173-.89.295-1.061.345l-.086.024c-.89.243-1.808.375-2.732.394-1.32 0-2.3-.36-2.923-1.067a9.852 9.852 0 01-3.18.018C9.778 21.647 8.802 22 7.494 22a11.249 11.249 0 01-2.541-.343l-.221-.06-.273-.08a16.574 16.574 0 01-1.175-.405c-1.237-.483-1.875-.93-2.13-1.501-.186-.4-.151-.867.093-1.236a1.42 1.42 0 01-.2-1.166c.069-.273.226-.516.447-.694a1.41 1.41 0 01.2-1.722c.233-.248.557-.391.917-.407l.078-.001a9.385 9.385 0 01-.44-2.85c0-3.407 1.847-6.554 4.844-8.258a9.822 9.822 0 019.687 0zM4.188 14.758c.125.687 2.357 2.35 2.14 2.707-.19.315-.796-.239-.948-.386l-.041-.04-.168-.147c-.561-.479-2.304-1.9-2.74-1.432-.43.46.119.859 1.055 1.42l.784.467.136.083c1.045.643 1.12.84.95 1.113-.188.295-3.07-2.1-3.34-1.083-.27 1.011 2.942 1.304 2.744 2.006-.2.7-2.265-1.324-2.685-.537-.425.79 2.913 1.718 2.94 1.725l.16.04.175.042c1.227.284 3.565.65 4.435-.604.673-.973.64-1.709-.248-2.61l-.057-.057c-.945-.928-1.495-2.288-1.495-2.288l-.017-.058-.025-.072c-.082-.22-.284-.639-.63-.584-.46.073-.798 1.21.12 1.933l.05.038c.977.721-.195 1.21-.573.534l-.058-.104-.143-.25c-.463-.799-1.282-2.111-1.739-2.397-.532-.332-.907-.148-.782.541zm14.842-.541c-.533.335-1.563 2.074-1.94 2.751a.613.613 0 01-.687.302.436.436 0 01-.176-.098.303.303 0 01-.049-.06l-.014-.028-.008-.02-.007-.019-.003-.013-.003-.017a.289.289 0 01-.004-.048c0-.12.071-.266.25-.427.026-.024.054-.047.084-.07l.047-.036c.022-.016.043-.032.063-.049.883-.71.573-1.81.131-1.917l-.031-.006-.056-.004a.368.368 0 00-.062.006l-.028.005-.042.014-.039.017-.028.015-.028.019-.036.027-.023.02c-.173.158-.273.428-.31.542l-.016.054s-.53 1.309-1.439 2.234l-.054.054c-.365.358-.596.69-.702 1.018-.143.437-.066.868.21 1.353.055.097.117.195.187.296.882 1.275 3.282.876 4.494.59l.286-.07.25-.074c.276-.084.736-.233 1.2-.42l.188-.077.065-.028.064-.028.124-.056.081-.038c.529-.252.964-.543.994-.827l.001-.036a.299.299 0 00-.037-.139c-.094-.176-.271-.212-.491-.168l-.045.01c-.044.01-.09.024-.136.04l-.097.035-.054.022c-.559.23-1.238.705-1.607.745h.006a.452.452 0 01-.05.003h-.024l-.024-.003-.023-.005c-.068-.016-.116-.06-.14-.142a.22.22 0 01-.005-.1c.062-.345.958-.595 1.713-.91l.066-.028c.528-.224.97-.483.985-.832v-.04a.47.47 0 00-.016-.098c-.048-.18-.175-.251-.36-.251-.785 0-2.55 1.36-2.92 1.36-.025 0-.048-.007-.058-.024a.6.6 0 01-.046-.088c-.1-.238.068-.462 1.06-1.066l.209-.126c.538-.32 1.01-.588 1.341-.831.29-.212.475-.406.503-.6l.003-.028c.008-.113-.038-.227-.147-.344a.266.266 0 00-.07-.054l-.034-.015-.013-.005a.403.403 0 00-.13-.02c-.162 0-.369.07-.595.18-.637.313-1.431.952-1.826 1.285l-.249.215-.033.033c-.08.078-.288.27-.493.386l-.071.037-.041.019a.535.535 0 01-.122.036h.005a.346.346 0 01-.031.003l.01-.001-.013.001c-.079.005-.145-.021-.19-.095a.113.113 0 01-.014-.065c.027-.465 2.034-1.991 2.152-2.642l.009-.048c.1-.65-.271-.817-.791-.493zM11.938 2.984c-4.798 0-8.688 3.829-8.688 8.55 0 .692.083 1.364.24 2.008l.008-.009c.252-.298.612-.46 1.017-.46.355.008.699.117.993.312.22.14.465.384.715.694.261-.372.69-.598 1.15-.605.852 0 1.367.728 1.562 1.383l.047.105.06.127c.192.396.595 1.139 1.143 1.68 1.06 1.04 1.324 2.115.8 3.266a8.865 8.865 0 002.024-.014c-.505-1.12-.26-2.17.74-3.186l.066-.066c.695-.684 1.157-1.69 1.252-1.912.195-.655.708-1.383 1.56-1.383.46.007.889.233 1.15.605.25-.31.495-.553.718-.694a1.87 1.87 0 01.99-.312c.357 0 .682.126.925.36.14-.61.215-1.245.215-1.898 0-4.722-3.89-8.55-8.687-8.55zm1.857 8.926l.439-.212c.553-.264.89-.383.89.152 0 1.093-.771 3.208-3.155 3.262h-.184c-2.325-.052-3.116-2.06-3.156-3.175l-.001-.087c0-1.107 1.452.586 3.25.586.716 0 1.379-.272 1.917-.526zm4.017-3.143c.45 0 .813.358.813.8 0 .441-.364.8-.813.8a.806.806 0 01-.812-.8c0-.442.364-.8.812-.8zm-11.624 0c.448 0 .812.358.812.8 0 .441-.364.8-.812.8a.806.806 0 01-.813-.8c0-.442.364-.8.813-.8zm7.79-.841c.32-.384.846-.54 1.33-.394.483.146.83.564.878 1.06.048.495-.212.97-.659 1.203-.322.168-.447-.477-.767-.585l.002-.003c-.287-.098-.772.362-.925.079a1.215 1.215 0 01.14-1.36zm-4.323 0c.322.384.377.92.14 1.36-.152.283-.64-.177-.925-.079l.003.003c-.108.036-.194.134-.273.24l-.118.165c-.11.15-.22.262-.377.18a1.226 1.226 0 01-.658-1.204c.048-.495.395-.913.878-1.059a1.262 1.262 0 011.33.394z"/></svg>
      <svg class="icon-dark" viewBox="0 0 1500 1500" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M1348.72 1168.37C1360.03 1142.67 1361.13 1113.74 1351.94 1087.55C1361.08 1064.58 1362.52 1038.87 1356.33 1014.97C1353.1 1002.63 1347.95 991.175 1341.12 980.965C1342.52 976.029 1343.6 970.929 1344.36 965.659C1349.44 930.378 1337.38 896.408 1313.59 870.403C1302.83 858.64 1289.91 849.894 1275.97 844.105C1284.44 805.888 1288.9 766.185 1288.9 725.475C1288.9 425.12 1046.33 181.36 746.772 181.36C447.213 181.36 204.644 425.12 204.644 725.475C204.644 767.136 209.317 807.743 218.176 846.781C206.46 852.482 195.618 860.354 186.431 870.403C162.65 896.406 150.585 930.384 155.658 965.659C156.415 970.926 157.505 976.031 158.904 980.965C152.074 991.175 146.922 1002.63 143.692 1014.97C137.445 1038.82 138.958 1064.63 148.078 1087.54C138.888 1113.74 139.992 1142.68 151.301 1168.37C171.605 1214.49 218.813 1243.21 283.614 1269C355.654 1297.68 435.229 1318.64 516.715 1318.64C582.532 1318.64 639.737 1302.62 681.509 1265.68C702.919 1268.26 724.699 1269.59 746.772 1269.59C770.797 1269.59 794.475 1268.02 817.706 1264.97C859.527 1302.39 917.048 1318.64 983.305 1318.64C1065.11 1318.64 1144.1 1297.79 1216.41 1269C1281.21 1243.21 1328.42 1214.49 1348.72 1168.37ZM1201.48 1231.5C1265.52 1206.01 1298.5 1182.26 1311.77 1152.11C1321.11 1130.89 1319.46 1106.41 1307.02 1086.84C1323.52 1061.54 1320.36 1036.98 1317.28 1025.19C1313.34 1010.15 1305.2 997.644 1294.14 988.661C1299.38 979.912 1302.89 970.461 1304.41 959.918C1307.59 937.779 1300.28 915.653 1283.81 897.648C1278.56 891.903 1272.36 887.26 1265.59 883.763C1253.45 877.49 1239.44 874.904 1225.67 876.26C1229.83 862.94 1233.45 849.38 1236.51 835.609C1244.38 800.161 1248.53 763.306 1248.53 725.476C1248.53 447.262 1023.89 221.726 746.772 221.726C469.656 221.726 245.01 447.262 245.01 725.476C245.01 763.44 249.193 800.424 257.122 835.988C260.135 849.506 263.69 862.818 267.762 875.901C254.074 875.791 240.392 879.604 228.93 886.961C224.276 889.948 219.988 893.519 216.214 897.648C199.743 915.653 192.427 937.779 195.613 959.918C197.128 970.461 200.637 979.912 205.881 988.661C194.823 997.644 186.678 1010.15 182.742 1025.19C179.66 1036.98 176.501 1061.54 192.997 1086.84C180.564 1106.41 178.908 1130.89 188.245 1152.11C201.517 1182.26 234.498 1206.01 298.542 1231.5C367.636 1259 441.978 1278.27 516.715 1278.27C584.432 1278.27 634.963 1259.67 667.239 1222.93C693.142 1227.07 719.707 1229.23 746.772 1229.23C775.811 1229.23 804.275 1226.75 831.964 1221.99C864.201 1259.36 915.014 1278.28 983.305 1278.28C1058.36 1278.28 1132.11 1259.11 1201.48 1231.5Z"/><path d="M635.221 1179.69C670.856 1127.23 668.331 1087.85 619.437 1038.79C570.542 989.739 542.081 917.979 542.081 917.979C542.081 917.979 531.45 876.301 507.236 880.136C483.022 883.971 465.244 946.254 515.964 984.357C566.684 1022.45 505.864 1048.33 486.35 1012.55C466.836 976.778 413.552 884.803 385.92 867.214C358.3 849.625 338.851 859.479 345.365 895.736C351.878 931.993 467.393 1019.87 456.154 1038.89C444.914 1057.9 405.304 1016.55 405.304 1016.55C405.304 1016.55 281.359 903.302 254.374 932.812C227.389 962.322 274.846 987.048 342.477 1028.15C410.121 1069.25 415.365 1080.1 405.77 1095.65C396.162 1111.2 246.864 984.825 232.84 1038.4C218.83 1091.97 385.208 1107.52 374.939 1144.5C364.671 1181.5 257.741 1074.5 235.87 1116.19C213.987 1157.89 386.762 1206.89 388.16 1207.25C443.969 1221.79 585.705 1252.59 635.221 1179.69Z"/><path d="M864.806 1179.69C829.171 1127.23 831.696 1087.85 880.591 1038.79C929.485 989.739 957.946 917.979 957.946 917.979C957.946 917.979 968.577 876.301 992.791 880.136C1017.01 883.971 1034.78 946.254 984.064 984.357C933.344 1022.45 994.164 1048.33 1013.68 1012.55C1033.19 976.778 1086.47 884.803 1114.11 867.214C1141.73 849.625 1161.18 859.479 1154.66 895.736C1148.15 931.993 1032.63 1019.87 1043.87 1038.89C1055.11 1057.9 1094.72 1016.55 1094.72 1016.55C1094.72 1016.55 1218.67 903.302 1245.65 932.812C1272.64 962.322 1225.18 987.048 1157.55 1028.15C1089.91 1069.25 1084.66 1080.1 1094.26 1095.65C1103.87 1111.2 1253.16 984.825 1267.19 1038.4C1281.2 1091.97 1114.82 1107.52 1125.09 1144.5C1135.36 1181.5 1242.29 1074.5 1264.16 1116.19C1286.04 1157.89 1113.27 1206.89 1111.87 1207.25C1056.06 1221.79 914.322 1252.59 864.806 1179.69Z"/><path d="M675.913 853.201C679.674 855.39 683.766 857.524 688.891 860.001C705.59 868.074 725.878 873.106 750.564 873.106C777.366 873.106 799.015 867.175 816.53 857.819C821.193 855.328 825.305 852.779 828.701 850.52C818.286 841.142 806.116 833.688 792.747 828.717C791.172 828.131 789.58 827.58 787.973 827.064C782.46 825.295 776.761 834.148 770.915 843.232C765.317 851.929 759.582 860.838 753.744 860.838C748.268 860.838 742.882 851.802 737.615 842.964C732.157 833.804 726.824 824.857 721.649 826.403C704.266 831.599 688.648 840.906 675.913 853.201Z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M849.695 285.599C816.641 277.833 782.184 273.727 746.772 273.727C684.644 273.727 625.458 286.368 571.624 309.227C448.998 361.299 354.15 466.394 315.593 595.883C303.37 636.933 296.805 680.435 296.805 725.476C296.805 761.974 301.116 797.461 309.255 831.452C309.366 831.317 309.477 831.183 309.587 831.05C322.652 815.372 341.389 806.727 362.353 806.727C379.135 806.727 396.395 812.304 413.669 823.302C425.128 830.608 437.792 843.556 450.832 859.832C462.913 843.01 479.824 831.83 499.169 828.775C502.872 828.19 506.628 827.891 510.344 827.891H510.357C554.525 827.891 581.096 866.358 591.144 900.964C596.129 912.651 620.058 965.899 656.056 1002.01C710.873 1057.01 724.595 1113.75 697.461 1174.54C713.655 1176.32 730.108 1177.23 746.772 1177.23C747.445 1177.23 748.117 1177.22 748.789 1177.22L749.307 1177.22L750.29 1177.21C767.865 1177.08 785.2 1175.93 802.241 1173.83C775.534 1113.31 789.363 1056.8 843.964 1002.01C879.962 965.899 903.891 912.651 908.876 900.964C918.924 866.358 945.495 827.891 989.663 827.891H989.676C993.392 827.891 997.147 828.19 1000.85 828.775C1020.2 831.83 1037.11 843.01 1049.19 859.832C1062.23 843.556 1074.89 830.608 1086.35 823.302C1103.62 812.304 1120.89 806.727 1137.67 806.727C1156.17 806.727 1172.94 813.46 1185.6 825.819C1192.89 793.547 1196.74 759.963 1196.74 725.476C1196.74 709.883 1195.95 694.474 1194.42 679.288C1174.88 486.115 1034.11 328.922 849.695 285.599ZM652.93 884.744C603.394 843.337 581.677 781.979 581.677 742.068C581.677 711.101 602.797 721.605 636.467 738.35C666.402 753.238 706.256 773.059 750.01 773.059C793.763 773.059 833.618 753.238 863.553 738.35C897.223 721.605 918.343 711.101 918.343 742.068C918.343 780.4 900.71 842.529 852.745 880.809C827.567 900.728 794.093 914.485 750.509 914.485C709.56 914.485 677.534 902.691 652.93 884.744ZM919.726 619.809C914.761 612.591 909.541 605.002 902.523 602.514C896.04 600.216 887.549 603.626 879.395 606.901C868.994 611.078 859.142 615.035 854.701 606.649C837.914 574.953 849.899 535.595 881.471 518.742C913.042 501.889 952.244 513.922 969.031 545.618C985.818 577.315 973.833 616.672 942.261 633.525C932.68 638.64 926.437 629.564 919.726 619.809ZM597.494 602.514C590.477 605.002 585.256 612.591 580.291 619.809C573.581 629.564 567.337 638.64 557.756 633.525C526.185 616.672 514.2 577.315 530.986 545.618C547.773 513.922 586.975 501.889 618.547 518.742C650.118 535.595 662.103 574.953 645.317 606.649C640.876 615.035 631.023 611.078 620.623 606.901C612.468 603.626 603.977 600.216 597.494 602.514ZM1093.15 621.477C1093.15 644.811 1074.31 663.727 1051.07 663.727C1027.83 663.727 1008.98 644.811 1008.98 621.477C1008.98 598.143 1027.83 579.227 1051.07 579.227C1074.31 579.227 1093.15 598.143 1093.15 621.477ZM448.95 663.727C472.192 663.727 491.033 644.811 491.033 621.477C491.033 598.143 472.192 579.227 448.95 579.227C425.708 579.227 406.866 598.143 406.866 621.477C406.866 644.811 425.708 663.727 448.95 663.727Z"/></svg>
      Data</a>
    <a class="nav-btn" href="https://github.com/Hydrapse/EvoClaw" target="_blank">
      <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      Code</a>
    <a class="nav-btn" href="https://openhands.dev/blog/evoclaw-benchmark" target="_blank">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h10a2 2 0 012 2v8a1 1 0 01-1 1H4a3 3 0 01-3-3V3z"/><path d="M13 7h1a1 1 0 011 1v4a3 3 0 01-3 3h0"/><path d="M4 7h5M4 10h3"/></svg>
      Blog</a>
  </nav>
</header>

<!-- ═══ Chart ═══ -->
<section class="panel" id="overview">
  <div class="news-banner" style="--accent:#6366f1;margin-bottom:1rem">
    <span class="news-tag">NOTE</span>
    <span class="news-text">Unless otherwise noted in the model name, agents run at the model's <strong>highest available thinking / reasoning-effort level</strong>.</span>
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
    <h2 class="panel-title" style="margin-bottom:0">Overall Cost / Performance on EvoClaw</h2>
    <label class="toggle-label">
      <input type="checkbox" id="officialToggle">
      <span class="toggle-text">Official agent only</span>
    </label>
  </div>
  <div id="chart"></div>
</section>

<!-- ═══ Leaderboard ═══ -->
<section class="panel" id="leaderboard">
  <div class="leaderboard-header">
    <h2 class="panel-title" style="margin-bottom:0">Leaderboard</h2>
    <div class="leaderboard-legend" aria-label="Per-column highlight legend">
      <span class="legend-item"><span class="legend-swatch best-val">●</span>Best</span>
      <span class="legend-item"><span class="legend-swatch second-val">●</span>2nd</span>
      <span class="legend-item"><span class="legend-swatch worst-val">●</span>Worst</span>
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th data-key="rank">#</th>
          <th data-key="model_display" data-type="str">Model</th>
          <th data-key="agent_display" data-type="str">Agent</th>
          <th data-key="score" class="num-col has-tip sort-desc" data-tip="F1 of Precision and Recall. Balances fixing required tests and avoiding regressions.">Score (%)</th>
          <th data-key="precision" class="num-col has-tip" data-tip="Ratio of bugs fixed without breaking existing tests. Higher means cleaner changes.">Precision (%)</th>
          <th data-key="recall" class="num-col has-tip" data-tip="Ratio of required test cases successfully fixed. Higher means the agent addresses more of the required changes.">Recall (%)</th>
          <th data-key="resolve" class="num-col has-tip" data-tip="% of milestones fully resolved, where all required tests pass with no regressions.">Resolve (%)</th>
          <th data-key="cost" class="num-col has-tip" data-tip="Average API cost per evolution range ($)">Cost ($)</th>
          <th data-key="out_tok_k" class="num-col has-tip" data-tip="Average output tokens per evolution range, incl. reasoning/thinking (K)">Out Tok. (K)</th>
          <th data-key="time_h" class="num-col has-tip" data-tip="Average wall-clock time per evolution range (hours)">Time (h)</th>
          <th data-key="turns" class="num-col has-tip" data-tip="Average agent turns per evolution range">Turns</th>
        </tr>
      </thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>
</section>

<footer><p>EvoClaw Benchmark &middot; 2026</p></footer>
</div>

<script>
const DATA = "__LEADERBOARD_DATA__";
const LOGOS = "__LOGOS__";

// org key mapping
const ORG_KEY = { 'Anthropic':'anthropic','OpenAI':'openai','Google':'google','Moonshot AI':'moonshot','MiniMax':'minimax','Z.ai':'zai','DeepSeek':'deepseek','Qwen':'qwen' };
const AGENT_KEY = { 'claude-code':'claude-code','codex':'codex','gemini-cli':'gemini-cli','openhands':'openhands' };

function isLight() { return document.documentElement.getAttribute('data-theme') === 'light'; }
function themeColors() {
  return isLight() ? {
    paper:'#ffffff', plot:'#ffffff', grid:'#e2e5f0', text:'#1a1d2e',
    text2:'#4a5068', hover_bg:'#e2e5f0', hover_border:'#cfd4e2',
  } : {
    paper:'#0e0e16', plot:'#14141f', grid:'#1c1c2b', text:'#e2e8f0',
    text2:'#c8d0dc', hover_bg:'#1c1c2b', hover_border:'#262640',
  };
}
function setTheme(mode) {
  if (mode === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('evoclaw-theme', mode);
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.themeVal === mode);
  });
  renderChart(); renderTable();
}

function logoKey(key) {
  if (isLight() && key === 'moonshot' && LOGOS['moonshot_light']) return 'moonshot_light';
  return key;
}

// ═══════════════════════════════════════════════════════════
// Shared state
// ═══════════════════════════════════════════════════════════
const orgs = [
  { key: 'Anthropic',   color: '#D97757' },
  { key: 'OpenAI',      color: '#10A37F' },
  { key: 'Google',      color: '#4285F4' },
  { key: 'Moonshot AI', color: 'var(--moonshot-accent)' },
  { key: 'MiniMax',     color: '#F03A5D' },
  { key: 'Z.ai',        color: '#4A90E2' },
];

function getFiltered() {
  const official = document.getElementById('officialToggle').checked;
  return official ? DATA.filter(d => d.is_official) : DATA;
}

// ═══════════════════════════════════════════════════════════
// Chart
// ═══════════════════════════════════════════════════════════
function renderChart() {
  const tc = themeColors();
  const fdata = getFiltered();

  const allX = fdata.map(d => d.cost), allY = fdata.map(d => d.score);
  const xMin = Math.min(...allX), xMax = Math.max(...allX);
  const yMin = Math.min(...allY), yMax = Math.max(...allY);
  const xPad = (xMax - xMin) * 0.15, xPadR = (xMax - xMin) * 0.25, yPad = (yMax - yMin) * 0.15;
  // PILL_SCALE shrinks every capsule (pill + org/agent icons + vertical gap)
  // uniformly. Bump up/down to tune overall density of the scatter chart.
  const PILL_SCALE = 0.8;
  const iconX = (xMax - xMin + 2*xPad) * 0.025 * 0.9 * PILL_SCALE;
  const iconY = (yMax - yMin + 2*yPad) * 0.055 * 0.9 * PILL_SCALE;

  const traces = orgs.map(org => {
    const pts = fdata.filter(d => d.org === org.key);
    if (!pts.length) return null;
    return {
      x: pts.map(p => p.cost),
      y: pts.map(p => p.score),
      text: pts.map(() => ''),
      customdata: pts.map(p => [
        p.model_display, p.agent_display, p.precision, p.recall,
        p.resolve, p.out_tok_k, p.time_h, p.turns
      ]),
      mode: 'markers+text',
      type: 'scatter',
      name: org.key,
      marker: { size: 25, color: 'rgba(0,0,0,0)' },
      textposition: pts.map(p => p.chart_textpos || 'middle right'),
      textfont: { size: 13, color: tc.text2, family: 'Inter, sans-serif' },
      hovertemplate:
        '<b>%{customdata[0]}</b> (<b>%{customdata[1]}</b>)<br>' +
        'Score: %{y:.1f}%<br>' +
        'Cost: $%{x:.2f}<br>' +
        'Precision: %{customdata[2]:.1f}%<br>' +
        'Recall: %{customdata[3]:.1f}%<br>' +
        'Resolve: %{customdata[4]:.1f}%<br>' +
        'Output Tok: %{customdata[5]}K<br>' +
        'Time: %{customdata[6]:.1f}h<br>' +
        'Turns: %{customdata[7]}<extra></extra>',
      showlegend: false,
    };
  }).filter(Boolean);

  // Pareto frontier line — computed dynamically from fdata rather than
  // hardcoded. At each cost level from cheapest up, keep the entry if its
  // score improves the running best. Within one model (e.g. both CC + OH
  // versions of opus-4-6) we first pick the entry with the higher score.
  const byModelBest = new Map();
  for (const d of fdata) {
    const prev = byModelBest.get(d.model);
    if (!prev || d.score > prev.score) byModelBest.set(d.model, d);
  }
  const frontierPts = [];
  {
    const sorted = [...byModelBest.values()].sort((a, b) => a.cost - b.cost);
    let bestScore = -Infinity;
    for (const p of sorted) {
      if (p.score > bestScore) {
        frontierPts.push(p);
        bestScore = p.score;
      }
    }
  }
  if (frontierPts.length > 1) {
    traces.push({
      x: frontierPts.map(p => p.cost),
      y: frontierPts.map(p => p.score),
      mode: 'lines',
      type: 'scatter',
      line: { color: 'rgba(129,82,236,0.6)', width: 2.5, dash: 'dot' },
      hoverinfo: 'skip',
      showlegend: false,
    });
  }

  const frontierSet = new Set(frontierPts.map(p => p.agent + '|' + p.model));
  const isFrontier = d => frontierSet.has(d.agent + '|' + d.model);

  // Three-tier visual hierarchy on the chart:
  //   on   — Pareto-optimal, fully highlighted (purple, bold)
  //   near — within NEAR_GAP_PP of the frontier at the same cost; rendered
  //          at full opacity but in the entry's own brand colour, no purple
  //   off  — dominated by more than NEAR_GAP_PP; faded so the eye skips them
  // 3.6pp catches the obvious "competitive but not optimal" cluster
  // (GPT-5.5, Opus 4.7 1M, GPT-5.4, GLM-5.1, Opus 4.6 CC, GLM-5);
  // anything beyond is clearly dominated.
  const NEAR_GAP_PP = 3.6;
  function frontierScoreAt(cost) {
    if (frontierPts.length === 0) return 0;
    if (cost <= frontierPts[0].cost) return frontierPts[0].score;
    for (let i = 1; i < frontierPts.length; i++) {
      if (cost <= frontierPts[i].cost) {
        const a = frontierPts[i-1], b = frontierPts[i];
        const t = (cost - a.cost) / (b.cost - a.cost);
        return a.score + t * (b.score - a.score);
      }
    }
    return frontierPts[frontierPts.length-1].score;
  }
  const tierOf = d => {
    if (isFrontier(d)) return 'on';
    return (frontierScoreAt(d.cost) - d.score) < NEAR_GAP_PP ? 'near' : 'off';
  };
  // Per-tier visual params. dot size/opacity is direct; pillAlphaMult
  // multiplies the pill's existing rgba alpha; iconOpacity drives the
  // org/agent icon images; labelAlpha scales the annotation text colour.
  const TIER = {
    on:   { dotSize: 6, dotOpacity: 1.0,  pillAlphaMult: 1.0, iconOpacity: 1.0,  labelAlpha: 1.0  },
    near: { dotSize: 5, dotOpacity: 1.0,  pillAlphaMult: 1.0, iconOpacity: 1.0,  labelAlpha: 1.0  },
    off:  { dotSize: 4, dotOpacity: 0.45, pillAlphaMult: 0.5, iconOpacity: 0.45, labelAlpha: 0.55 },
  };

  // Read live themed accent vars once per render so brand-themed centre
  // dots track light/dark canvas. Each org with a CSS-var-backed accent
  // (Z.ai, Moonshot AI) gets its own lookup; anything else falls back to
  // the static ENTRY_COLORS value via d.color.
  const zaiAccent = getComputedStyle(document.documentElement)
    .getPropertyValue('--zai-accent').trim();
  const moonshotAccent = getComputedStyle(document.documentElement)
    .getPropertyValue('--moonshot-accent').trim();
  const dotColor = d => {
    if (d.org === 'Z.ai' && zaiAccent) return zaiAccent;
    if (d.org === 'Moonshot AI' && moonshotAccent) return moonshotAccent;
    return d.color;
  };

  // Center dots — purple for frontier, brand colour otherwise; per-tier
  // size & opacity arrays so dominated points fade into the background.
  traces.push({
    x: fdata.map(d => d.cost),
    y: fdata.map(d => d.score),
    mode: 'markers',
    type: 'scatter',
    marker: {
      size:    fdata.map(d => TIER[tierOf(d)].dotSize),
      color:   fdata.map(d => isFrontier(d) ? '#a78bfa' : dotColor(d)),
      opacity: fdata.map(d => TIER[tierOf(d)].dotOpacity),
    },
    hoverinfo: 'skip',
    showlegend: false,
  });

  const vGap = iconY * 1.1;
  const agentIconY = iconY;
  // Agent colors for pill backgrounds
  const AGENT_PILL = {
    'claude-code': 'rgba(217,119,87,0.18)',
    'codex': 'rgba(16,163,127,0.18)',
    'gemini-cli': 'rgba(66,133,244,0.18)',
    'openhands': 'rgba(232,186,58,0.18)',
  };

  function hexToRgba(hex, a) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  // Multiply the alpha channel of an "rgba(r,g,b,a)" string by `mult`.
  // Used to fade off-frontier pill backgrounds without rebuilding the
  // colour from scratch.
  function fadeRgba(rgba, mult) {
    return rgba.replace(/[\d.]+\)$/, m => (parseFloat(m) * mult).toFixed(3) + ')');
  }

  // Build pill SVG as data URI
  function pillSvg(color) {
    const strokeColor = color.replace(/[\d.]+\)$/, function(m) { return Math.min(parseFloat(m)*1.8, 0.5).toFixed(2) + ')'; });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80"><rect x="2" y="2" width="36" height="76" rx="18" fill="' + color + '" stroke="' + strokeColor + '" stroke-width="1.5"/></svg>';
    return 'data:image/svg+xml;base64,' + btoa(svg);
  }

  const pillW = iconX * 1.6;
  const pillH = iconY * 2.4 + vGap * 0.8;
  const images = [];
  fdata.forEach(d => {
    const orgK = ORG_KEY[d.org];
    const agentK = AGENT_KEY[d.agent];
    const tier = TIER[tierOf(d)];
    let pillColor;
    if (d.org === 'Z.ai') {
      // Pill tint mirrors the themed --zai-accent: dark-tint on light canvas,
      // light-tint on dark canvas. Keeps GLM's capsule in the same tonal
      // family as its centre dot, NEW callout, and table badge.
      pillColor = isLight()
        ? 'rgba(74,77,92,0.14)'        // dark-gray accent @ 14% on light bg
        : 'rgba(207,210,217,0.22)';    // near-white accent @ 22% on dark bg
    } else if (d.org === 'Moonshot AI') {
      // Mirror the --moonshot-accent flip so Kimi pills track theme alongside
      // GLM. Charcoal-tint on light, silver-tint on dark.
      pillColor = isLight()
        ? 'rgba(92,95,107,0.14)'       // moonshot accent (light) @ 14%
        : 'rgba(200,203,211,0.22)';    // moonshot accent (dark) @ 22%
    } else if (d.agent === 'openhands') {
      pillColor = hexToRgba(d.org_color, 0.25);
    } else {
      pillColor = AGENT_PILL[d.agent] || 'rgba(128,128,128,0.15)';
    }
    // Off-frontier pills get further dimmed so dominated entries recede.
    if (tier.pillAlphaMult !== 1.0) pillColor = fadeRgba(pillColor, tier.pillAlphaMult);

    // Pill background (below icons)
    images.push({
      source: pillSvg(pillColor),
      xref: 'x', yref: 'y',
      x: d.cost, y: d.score,
      sizex: pillW, sizey: pillH,
      xanchor: 'center', yanchor: 'middle',
      layer: 'below',
    });

    // Model org icon (top)
    const orgLK = logoKey(orgK);
    if (orgLK && LOGOS[orgLK]) {
      images.push({
        source: LOGOS[orgLK],
        xref: 'x', yref: 'y',
        x: d.cost, y: d.score + vGap * 0.7,
        sizex: iconX, sizey: iconY,
        xanchor: 'center', yanchor: 'middle',
        opacity: tier.iconOpacity,
        layer: 'above',
      });
    }
    // Agent icon (bottom) — scale down CLI agents
    if (agentK && LOGOS[agentK]) {
      const agentScale = (d.agent === 'openhands') ? 1.0 : 0.9;
      images.push({
        source: LOGOS[agentK],
        xref: 'x', yref: 'y',
        x: d.cost, y: d.score - vGap * 0.7,
        sizex: iconX * agentScale, sizey: agentIconY * agentScale,
        xanchor: 'center', yanchor: 'middle',
        opacity: tier.iconOpacity,
        layer: 'above',
      });
    }
  });

  // Map plotly textposition strings → annotation placement. Each entry
  // gives (xanchor, yanchor, xshift, yshift) so a label clears the pill in
  // the requested direction. Values are tuned for the pill+icon stack size:
  // top/bottom shifts need ~32px to clear the pill height; left/right shifts
  // need ~18px to clear the pill width.
  const POS_MAP = {
    'middle right':  ['left',   'middle',  18,   0],
    'middle left':   ['right',  'middle', -18,   0],
    'top center':    ['center', 'bottom',   0,  26],
    'top right':     ['left',   'bottom',  14,  22],
    'top left':      ['right',  'bottom', -14,  22],
    'bottom center': ['center', 'top',      0, -26],
    'bottom right':  ['left',   'top',     14, -22],
    'bottom left':   ['right',  'top',    -14, -22],
    'middle center': ['center', 'middle',   0,   0],
  };
  const officialOnly = document.getElementById('officialToggle').checked;
  const annotations = fdata.map(d => {
    let pos = d.chart_textpos || 'middle right';
    // CC GLM-5 sits below its pill in the full view to dodge the dense
    // adjacent CC cluster; once OH entries are filtered out the room
    // re-opens, so push the label to middle-right where it reads
    // naturally.
    if (officialOnly && d.agent === 'claude-code' && d.model === 'glm-5') {
      pos = 'middle right';
    }
    const [xanchor, yanchor, xshift, yshift] = POS_MAP[pos] || POS_MAP['middle right'];
    const onFrontier = frontierSet.has(d.agent + '|' + d.model);
    const tierKey = tierOf(d);
    const tier = TIER[tierKey];
    // Bold the model name on the frontier (full <b>=700), and use a
    // medium weight (500) on the near tier so it pops without competing
    // with the frontier's heavier label weight.
    const label = onFrontier
      ? '<b>' + d.chart_label + '</b><br>(' + d.agent_display + ')'
      : tierKey === 'near'
      ? '<span style="font-weight:500">' + d.chart_label + '</span><br>(' + d.agent_display + ')'
      : d.chart_label + '<br>(' + d.agent_display + ')';
    // Align text inside the annotation block: anchor right → right-align, etc.
    const align = xanchor === 'right' ? 'right' : xanchor === 'center' ? 'center' : 'left';
    // Off-frontier labels fade via rgba alpha so they recede with the pill.
    const baseColor = onFrontier ? (isLight() ? '#6d28d9' : '#c4b5fd') : tc.text2;
    const labelColor = tier.labelAlpha === 1.0
      ? baseColor
      : hexToRgba(baseColor, tier.labelAlpha);
    return {
      x: d.cost, y: d.score, xref: 'x', yref: 'y',
      text: label,
      showarrow: false,
      xanchor, yanchor, align,
      xshift, yshift,
      font: { size: onFrontier ? 14 : 13, color: labelColor, family: 'Inter, sans-serif' },
    };
  });

  const layout = {
    paper_bgcolor: tc.paper,
    plot_bgcolor: tc.plot,
    font: { color: tc.text, family: 'Inter, system-ui, sans-serif', size: 12 },
    xaxis: {
      title: { text: 'Average Cost Per Evolution Range (USD)', font: { size: 13 } },
      gridcolor: tc.grid, zerolinecolor: tc.grid,
      tickprefix: '$', tickfont: { size: 11 },
      range: [xMin - xPad, xMax + xPadR],
    },
    yaxis: {
      title: { text: 'Average Score', font: { size: 13 } },
      gridcolor: tc.grid, zerolinecolor: tc.grid,
      ticksuffix: '%', tickfont: { size: 11 },
      range: [yMin - yPad, yMax + yPad],
    },
    images: images,
    annotations: annotations.concat([{
      text: '<a href="https://evo-claw.com/" style="color:#999">https://evo-claw.com</a>',
      xref: 'paper', yref: 'paper', x: 1, y: 0,
      xanchor: 'right', yanchor: 'bottom',
      xshift: 0, yshift: -54,
      showarrow: false,
      font: { size: 15, color: '#999' },
    }]),
    showlegend: false,
    margin: { t: 16, r: 32, b: 56, l: 56 },
    hovermode: 'closest',
    hoverlabel: {
      bgcolor: tc.hover_bg, bordercolor: tc.hover_border,
      font: { family: 'Inter, sans-serif', size: 12, color: tc.text },
    },
  };

  Plotly.newPlot('chart', traces, layout, {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
  });

  const chartEl = document.getElementById('chart');
  const initXRange = xMax + xPadR - (xMin - xPad);
  const initYRange = yMax + yPad - (yMin - yPad);
  const BASE_XSHIFT = 18;
  let scaling = false;

  chartEl.on('plotly_relayout', function(ev) {
    if (scaling) return;
    const xl = chartEl.layout.xaxis.range;
    const yl = chartEl.layout.yaxis.range;
    if (!xl || !yl) return;
    const curXRange = xl[1] - xl[0];
    const curYRange = yl[1] - yl[0];
    const scale = Math.sqrt((initXRange / curXRange) * (initYRange / curYRange));
    const newShift = Math.round(BASE_XSHIFT * scale);

    const update = {};
    annotations.forEach((a, i) => {
      update['annotations[' + i + '].xshift'] = a.xanchor === 'right' ? -newShift : newShift;
    });
    scaling = true;
    Plotly.relayout(chartEl, update).then(() => { scaling = false; });
  });
}

// ═══════════════════════════════════════════════════════════
// Leaderboard Table
// ═══════════════════════════════════════════════════════════
const HIGHER = new Set(['score','precision','recall','resolve']);
const LOWER  = new Set(['cost','out_tok_k','time_h','turns']);

// Per-column rank stats — pre-computed once per render so each cell's
// classification is O(1). HIGHER metrics rank descending (max = best);
// LOWER metrics rank ascending (min = best). Ties collapse via Set so
// "second" is the second-distinct-value, not the second-row.
function computeColStats(fdata) {
  const stats = {};
  const KEYS = [...HIGHER, ...LOWER];
  for (const k of KEYS) {
    const uniq = [...new Set(fdata.map(d => d[k]))]
      .sort((a, b) => HIGHER.has(k) ? b - a : a - b);
    stats[k] = {
      best:   uniq[0],
      second: uniq.length > 1 ? uniq[1] : null,
      worst:  uniq[uniq.length - 1],
    };
  }
  return stats;
}
function valCls(val, key, stats) {
  const s = stats[key];
  if (s == null) return '';
  if (Math.abs(val - s.best) < 0.005) return ' best-val';
  if (s.second != null && Math.abs(val - s.second) < 0.005) return ' second-val';
  if (Math.abs(val - s.worst) < 0.005) return ' worst-val';
  return '';
}
// Backwards-compatible isBest for the score-bar barW computation that
// only cares about the leader.
function isBest(val, key, fdata) {
  if (HIGHER.has(key)) return Math.abs(val - Math.max(...fdata.map(d => d[key]))) < 0.005;
  if (LOWER.has(key))  return Math.abs(val - Math.min(...fdata.map(d => d[key]))) < 0.005;
  return false;
}
function fmtNum(v, d) { return v.toFixed(d); }

function orgIcon(d) {
  const lk = logoKey(ORG_KEY[d.org]);
  if (lk && LOGOS[lk]) {
    return '<img class="org-logo" src="' + LOGOS[lk] + '" alt="' + d.org + '">';
  }
  return '<span class="org-badge" style="background:' + d.org_color + '">' + d.org.charAt(0) + '</span>';
}
function agentIcon(d) {
  const ak = AGENT_KEY[d.agent];
  if (ak && LOGOS[ak]) {
    const extraStyle = (ak === 'openhands') ? ' style="width:25px;height:25px;margin-left:-1.5px"' : '';
    return '<img class="agent-icon"' + extraStyle + ' src="' + LOGOS[ak] + '" alt="' + d.agent + '">';
  }
  return '';
}

let curKey = 'score', curAsc = false, curClicks = 1;
function defaultAsc(key) {
  if (HIGHER.has(key)) return false;
  if (key === 'rank' || key === 'model_display' || key === 'agent_display') return true;
  return true;
}

function renderTable() {
  const fdata = getFiltered();
  const light = isLight();
  // Re-rank filtered data
  const ranked = [...fdata].sort((a, b) => b.score - a.score);
  ranked.forEach((d, i) => d._rank = i + 1);

  const maxScore = Math.max(...fdata.map(d => d.score));
  const colStats = computeColStats(fdata);
  function numCell(v, k, dec) {
    return '<td class="num' + valCls(v, k, colStats) + '">' + fmtNum(v, dec) + '</td>';
  }

  const sorted = [...ranked].sort((a, b) => {
    const sk = curKey === 'rank' ? '_rank' : curKey;
    const va = a[sk], vb = b[sk];
    if (typeof va === 'string') return curAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return curAsc ? va - vb : vb - va;
  });

  const tbody = document.getElementById('tbody');
  tbody.innerHTML = sorted.map(d => {
    const r = d._rank;
    let medal = r;
    if (r === 1) medal = '<span class="rank-medal">\uD83E\uDD47</span>';
    else if (r === 2) medal = '<span class="rank-medal">\uD83E\uDD48</span>';
    else if (r === 3) medal = '<span class="rank-medal">\uD83E\uDD49</span>';
    const topCls = r <= 3 ? ' top-' + r : '';
    const barW = (d.score / maxScore * 100).toFixed(1);
    const _abg = (light && d.agent === 'openhands') ? 'rgba(139,117,0,0.15)' : d.agent_bg;
    const _afg = (light && d.agent === 'openhands') ? '#8B7500' : d.agent_fg;
    return '<tr class="' + topCls + '">' +
      '<td class="rank-cell">' + medal + '</td>' +
      '<td class="model-cell">' + orgIcon(d) + d.model_display + '</td>' +
      '<td style="vertical-align:middle"><span class="agent-cell" style="' + (d.agent === 'openhands' ? 'gap:6.5px' : '') + '">' + agentIcon(d) + '<span class="agent-badge" style="background:' + _abg + ';color:' + _afg + '">' + d.agent_display + '</span></span></td>' +
      '<td class="score-cell"><div class="score-bar" style="width:' + barW + '%;background:' + d.agent_fg + '"></div><span class="score-val' + valCls(d.score,'score',colStats) + '">' + fmtNum(d.score, 2) + '</span></td>' +
      numCell(d.precision, 'precision', 2) +
      numCell(d.recall, 'recall', 2) +
      numCell(d.resolve, 'resolve', 2) +
      numCell(d.cost, 'cost', 2) +
      '<td class="num' + valCls(d.out_tok_k,'out_tok_k',colStats) + '">' + d.out_tok_k.toLocaleString() + '</td>' +
      numCell(d.time_h, 'time_h', 2) +
      '<td class="num' + valCls(d.turns,'turns',colStats) + '">' + d.turns.toLocaleString() + '</td>' +
    '</tr>';
  }).join('');
}

// Initial render
renderChart();
renderTable();

// Toggle handler
document.getElementById('officialToggle').addEventListener('change', () => {
  renderChart();
  renderTable();
});

// Sort handler: click 1 = default order, click 2 = reverse, click 3 = reset to rank
document.querySelectorAll('th[data-key]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.key;
    if (key === curKey) {
      curClicks++;
      if (curClicks >= 3) {
        // Reset to default
        curKey = 'score'; curAsc = false; curClicks = 1;
        document.querySelectorAll('th[data-key]').forEach(h => h.classList.remove('sort-asc','sort-desc'));
        document.querySelector('th[data-key="score"]').classList.add('sort-desc');
        renderTable();
        return;
      }
      curAsc = !curAsc;
    } else {
      curKey = key; curAsc = defaultAsc(key); curClicks = 1;
    }
    document.querySelectorAll('th[data-key]').forEach(h => h.classList.remove('sort-asc','sort-desc'));
    th.classList.add(curAsc ? 'sort-asc' : 'sort-desc');
    renderTable();
  });
});

// Tooltip for [data-tip] elements
(function() {
  const tip = document.createElement('div');
  tip.className = 'tip-popup';
  document.body.appendChild(tip);
  document.querySelectorAll('[data-tip]').forEach(el => {
    el.addEventListener('mouseenter', e => {
      const rect = el.getBoundingClientRect();
      tip.textContent = el.dataset.tip;
      tip.style.left = (rect.left + rect.width/2) + 'px';
      tip.style.top = (rect.top - 8) + 'px';
      tip.style.transform = 'translateX(-50%) translateY(-100%)';
      tip.classList.add('show');
    });
    el.addEventListener('mouseleave', () => tip.classList.remove('show'));
  });
})();
</script>
</body>
</html>
"""

if __name__ == "__main__":
    main()
