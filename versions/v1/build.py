#!/usr/bin/env python3
"""Build the SWE-Milestone leaderboard — website version v1.

Pulls the shared data records from data/compute.py, decorates them with THIS
version's presentation (colors, chart labels, label positions), inlines this
version's source files (template.html + style.css + app.js) into a single
self-contained page, injects the data + logos, and writes the site root
index.html (the one Cloudflare serves).

Each website version owns its own build.py; the only thing shared across
versions is the data contract from data/compute.py. So a future version is
free to render however it likes (multi-file output, a bundler, …) as long as
it consumes the same records.

Usage:  python versions/v1/build.py
"""

import json
import pathlib
import sys

V1_DIR = pathlib.Path(__file__).resolve().parent
ROOT = V1_DIR.parents[1]                      # versions/v1 → versions → repo root
ASSETS_DIR = ROOT / "assets"
OUT_PATH = ROOT / "index.html"

sys.path.insert(0, str(ROOT / "data"))
import compute  # noqa: E402  (shared data layer)

# ═══════════════════════════════════════════════════════════════════════════
# Presentation config — this version's look. Change styling here; data is
# untouched (it comes from data/compute.py).
# ═══════════════════════════════════════════════════════════════════════════

# ── Chart-label overrides ───────────────────────────────────────────────────
# chart_label defaults to the record's model_display (from the registry); only
# entries whose chart label differs from it are listed here — GPT uses hyphens
# on the chart. New models pick up their model_display automatically.
CHART_LABEL_OVERRIDES = {
    ("codex", "gpt-5.2-codex"): "GPT-5.2-Codex xhigh",
    ("codex", "gpt-5.2"): "GPT-5.2 xhigh",
    ("codex", "gpt-5.3-codex"): "GPT-5.3-Codex xhigh",
    ("codex", "gpt-5.4"): "GPT-5.4 xhigh",
    ("codex", "gpt-5.5"): "GPT-5.5 xhigh",
    ("openhands", "gpt-5.3-codex"): "GPT-5.3-Codex xhigh",
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

# ── Chart point colors (org-level; brightened for dark bg) ──────────────────
# One color per org — the scatter/table centre-dot color. GLM(Z.ai) and
# Kimi(Moonshot) carry light-mode fallbacks here; the JS dot resolver swaps to
# the themed --zai-accent / --moonshot-accent at render time. New models of an
# existing org get the org color automatically.
ENTRY_ORG_COLORS = {
    "Anthropic": "#D07A5E",
    "Z.ai": "#4A4D5C",
    "Moonshot AI": "#5C5F6B",
    "DeepSeek": "#4D6BFE",
    "Qwen": "#615CED",
    "OpenAI": "#90C890",
    "Google": "#7AAED8",
    "MiniMax": "#E06070",
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


def decorate(rec: dict) -> dict:
    """Merge a data-only record with this version's presentation fields,
    reproducing the exact field order the frontend JS expects."""
    agent, model, org = rec["agent"], rec["model"], rec["org"]
    return {
        "agent": agent,
        "agent_display": rec["agent_display"],
        "model": model,
        "model_display": rec["model_display"],
        "org": org,
        "org_color": ORG_COLORS.get(org, "#888"),
        "agent_bg": AGENT_COLORS.get(agent, {}).get("bg", ""),
        "agent_fg": AGENT_COLORS.get(agent, {}).get("fg", ""),
        "color": ENTRY_ORG_COLORS.get(org, "#888"),
        "chart_label": CHART_LABEL_OVERRIDES.get((agent, model), rec["model_display"]),
        "chart_textpos": CHART_TEXT_POS.get((agent, model), "middle right"),
        "score": rec["score"],
        "precision": rec["precision"],
        "recall": rec["recall"],
        "resolve": rec["resolve"],
        "cost": rec["cost"],
        "out_tok_k": rec["out_tok_k"],
        "time_h": rec["time_h"],
        "turns": rec["turns"],
        "is_official": rec["is_official"],
        "rank": rec["rank"],
    }


def main():
    print("Computing leaderboard data (data/compute.py)...")
    records = [decorate(r) for r in compute.compute_records()]
    data_json = json.dumps(records)

    # Load logos (shared brand assets)
    logos_path = ASSETS_DIR / "logos.json"
    if logos_path.exists():
        logos = json.load(open(logos_path))
        print(f"  loaded {len(logos)} logos")
    else:
        logos = {}
        print("  [warn] assets/logos.json not found")
    logos_json = json.dumps(logos)

    # Inline this version's source files into one self-contained page
    template = (V1_DIR / "template.html").read_text()
    css = (V1_DIR / "style.css").read_text()
    app_js = (V1_DIR / "app.js").read_text()

    html = template.replace("__STYLE__", css)
    html = html.replace("__APP_JS__", app_js)
    html = html.replace('"__LEADERBOARD_DATA__"', data_json)
    html = html.replace('"__LOGOS__"', logos_json)

    OUT_PATH.write_text(html)
    print(f"  wrote {OUT_PATH} ({len(records)} entries)")


if __name__ == "__main__":
    main()
