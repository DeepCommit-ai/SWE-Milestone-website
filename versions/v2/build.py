#!/usr/bin/env python3
"""Build the v2 website pages.

Each page under src/ is a self-contained source with placeholders for the
shared site chrome AND the leaderboard data. This script inlines both into
every page and writes the served HTML into versions/v2/ — so the header/footer
and the data are defined ONCE and every page gets the same markup, no per-page
duplication.

Placeholders in each src/ page:
  __CHROME_CSS__  → partials/chrome.css   (sits inside the page <style>)
  __HEADER__      → partials/header.html
  __FOOTER__      → partials/footer.html
  __SITE_DATA__   → window.SITE_DATA = {records, logos}  (leaderboard + Pareto)

Data comes from the shared layer (data/compute.py → data/records.json), which
is data-only (identity + metrics, no presentation). This build step adds the
v2 *presentation* fields per record — brand color, org logo key, short chart
label — exactly where compute.py's docstring says version presentation belongs.
records.json is git-ignored from the deploy (.assetsignore), so it is inlined
here rather than fetched at runtime.

Usage:  python versions/v2/build.py   (regenerates data/records.json first)
"""

import json
import pathlib
import subprocess
import sys

V2 = pathlib.Path(__file__).resolve().parent
ROOT = V2.parent.parent
SRC = V2 / "src"
PARTIALS = V2 / "partials"
DATA = ROOT / "data"
ASSETS = ROOT / "assets"
PAGES = ["index.html", "task.html"]

# ── v2 presentation: brand palettes (light → dark), ported from the dashboard
# theme.ts so the Pareto point colors match the analysis dashboard. Within a
# family the best-scoring model gets the lightest (most visible on dark) shade.
FAMILY_PALETTES = {
    "claude":    ["#F5D5C4", "#E8A08C", "#C96B50", "#8B3A1F"],
    "gpt":       ["#C8E6C8", "#82B882", "#4A7A4A"],
    "gemini":    ["#B8D4EC", "#6A9ECF", "#3A6B9F"],
    "zai":       ["#D4D6DD", "#9FA3B0", "#6E7280", "#484C58"],
    "moonshot":  ["#D8DBE2", "#A8ACB7", "#7B7F8D", "#54576A"],
    "deepseek":  ["#4D6BFE", "#7C90FE", "#3450D4"],
    "qwen":      ["#615CED", "#8B87F2", "#4540C9"],
}
FALLBACK_PALETTE = ["#B392F0", "#7C5BC1", "#7FDBFF", "#3DA5C9", "#FF8B6B", "#C44E52"]

# org (records.json) → logos.json key
ORG_LOGO = {
    "Anthropic": "anthropic", "OpenAI": "openai", "Google": "google",
    "Z.ai": "zai", "Moonshot AI": "moonshot", "MiniMax": "minimax",
    "DeepSeek": "deepseek", "Qwen": "qwen",
}

# Family iteration order for deterministic color allocation.
FAMILY_ORDER = ["claude", "gpt", "gemini", "zai", "moonshot", "deepseek", "qwen"]


def detect_family(model_display: str):
    """Brand family from the model display name (brand-first, like theme.ts)."""
    lo = model_display.lower()
    if "kimi" in lo or "moonshot" in lo:
        return "moonshot"
    if "glm" in lo or "zhipu" in lo:
        return "zai"
    if "deepseek" in lo:
        return "deepseek"
    if "qwen" in lo:
        return "qwen"
    if "claude" in lo or "opus" in lo or "sonnet" in lo:
        return "claude"
    if "gpt" in lo or "codex" in lo:
        return "gpt"
    if "gemini" in lo:
        return "gemini"
    return None


def enrich(records: list) -> list:
    """Add v2 presentation fields (color / logo_key / label / id) in place."""
    for r in records:
        r["_fam"] = detect_family(r["model_display"])

    # Allocate a palette shade per record: group by family, best score → lightest.
    counters = {}
    order = sorted(
        records,
        key=lambda r: (FAMILY_ORDER.index(r["_fam"]) if r["_fam"] in FAMILY_ORDER else 99,
                       -r["score"]),
    )
    for r in order:
        fam = r["_fam"]
        pal = FAMILY_PALETTES.get(fam, FALLBACK_PALETTE)
        idx = counters.get(fam, 0)
        r["color"] = pal[idx % len(pal)]
        counters[fam] = idx + 1

    for r in records:
        r["logo_key"] = ORG_LOGO.get(r["org"])
        label = r["model_display"]
        if label.startswith("Claude "):  # logo already carries the Anthropic brand
            label = label[len("Claude "):]
        r["label"] = label
        r["id"] = f'{r["agent"]}__{r["model"]}'
        del r["_fam"]
    return records


def load_site_data() -> str:
    """Return the `window.SITE_DATA = {...}` script body (records + used logos)."""
    records = enrich(json.loads((DATA / "records.json").read_text()))
    all_logos = json.loads((ASSETS / "logos.json").read_text())
    used = {r["logo_key"] for r in records if r.get("logo_key")}
    logos = {k: v for k, v in all_logos.items() if k in used}
    payload = {"records": records, "logos": logos}
    return "window.SITE_DATA=" + json.dumps(payload, separators=(",", ":")) + ";"


# ── Benchmark tasks (one repo × release range each). All task metadata lives in
# data/repos.json — identity + release range + milestone/dep counts + diff
# stats — so the build reads only from data/. (Stars aren't in the data.)
def load_repos() -> list:
    return json.loads((DATA / "repos.json").read_text())


_GH_MARK = ('<svg class="gh-mark" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">'
            '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>')
_MS_ICON = ('<svg width="10" height="10" viewBox="0 0 12 12" fill="none">'
            '<rect x="1" y="1" width="10" height="10" stroke="currentColor" stroke-width="1.6"/>'
            '<rect x="4" y="4" width="4" height="4" fill="currentColor"/></svg>')
_STAR_ICON = ('<svg class="oct" width="13" height="13" viewBox="0 0 16 16">'
              '<path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>')


def _diffstat(add: int, dele: int) -> str:
    """5-square add/del ratio bar (green = additions share, red = deletions)."""
    total = add + dele or 1
    g = max(1, min(4, round(add / total * 5)))
    return '<span class="diffstat">' + '<i class="g"></i>' * g + '<i class="r"></i>' * (5 - g) + "</span>"


def render_task_cards(repos: list) -> str:
    """Build the Tasks-section card grid from real per-repo metadata."""
    out = []
    for r in repos:
        out.append(f'''    <a class="task-card" href="task.html?task={r["ws"]}">
      <div class="tc-top">
        <span class="t-repo">{_GH_MARK}<span class="org">{r["org"]}/</span>{r["repo"]}</span>
        <span class="right">
          <span class="star" data-star="{r["org"]}/{r["repo"]}">{_STAR_ICON}<b>&middot;&middot;&middot;</b></span>
          <span class="t-lang"><i class="lang-{r["lc"]}"></i>{r["lang"]}</span>
        </span>
      </div>
      <div class="rr">
        <span class="tc-range">{r["start"]}<span class="to">→</span>{r["end"]}</span>
        <span class="chip"><b>{r["releases"]}</b> {"release" if r["releases"] == 1 else "releases"}</span>
        <span class="chip"><b>{r["commits"]:,}</b> commits</span>
      </div>
      <p class="tc-stats"><b>{r["loc"]}</b> LoC&nbsp;&nbsp;·&nbsp;&nbsp;<b>{r["files"]:,}</b> files</p>
      <p class="tc-summary">{r["summary"]}</p>
      <div class="tc-foot">
        <span class="tc-diff"><span class="add">+{r["add"]:,}</span><span class="del">&minus;{r["del"]:,}</span>{_diffstat(r["add"], r["del"])}</span>
        <span class="ms-badge">{_MS_ICON}{r["ms"]} Milestones</span>
      </div>
    </a>''')
    return "\n".join(out)


def load_task_data() -> str:
    """`window.TASK_DATA = {tasks: {ws: {meta, records}}, logos}` for task.html.

    Per-repo leaderboards come from compute.compute_per_repo_records() (reads
    only data/); meta comes from data/repos.json; logos from assets/logos.json.
    """
    sys.path.insert(0, str(DATA))
    import compute  # data/compute.py — reads only from data/
    per = compute.compute_per_repo_records()
    milestones, order_ws = compute.compute_per_repo_milestones()
    repos_by_ws = {r["ws"]: r for r in load_repos()}
    all_logos = json.loads((ASSETS / "logos.json").read_text())

    used, tasks = set(), {}
    for ws, recs in per.items():
        enrich(recs)  # add color / logo_key / label / id
        used.update(r["logo_key"] for r in recs if r.get("logo_key"))
        mz = milestones.get(ws, {})
        for r in recs:  # attach each run's per-milestone breakdown for Compare
            r["byId"] = mz.get((r["agent"], r["model"]), {})
        tasks[ws] = {
            "meta": repos_by_ws.get(ws, {"ws": ws, "repo": ws}),
            "records": recs,
            "milestoneOrder": order_ws.get(ws, []),
        }
    logos = {k: v for k, v in all_logos.items() if k in used}
    payload = {"tasks": tasks, "logos": logos}
    return "window.TASK_DATA=" + json.dumps(payload, separators=(",", ":")) + ";"


def main():
    # Refresh records.json from the shared data layer so the site never ships
    # stale numbers. (compute.py writes data/records.json on __main__.)
    subprocess.run([sys.executable, str(DATA / "compute.py")], check=True)

    chrome_css = (PARTIALS / "chrome.css").read_text().rstrip("\n")
    header = (PARTIALS / "header.html").read_text().strip()
    footer = (PARTIALS / "footer.html").read_text().strip()
    site_data = load_site_data()
    task_cards = render_task_cards(load_repos())
    task_data = load_task_data()

    for page in PAGES:
        html = (SRC / page).read_text()
        html = html.replace("__CHROME_CSS__", chrome_css)
        html = html.replace("__HEADER__", header)
        html = html.replace("__FOOTER__", footer)
        html = html.replace("__SITE_DATA__", site_data)
        html = html.replace("__TASK_CARDS__", task_cards)
        html = html.replace("__TASK_DATA__", task_data)
        (V2 / page).write_text(html)
        print(f"  built versions/v2/{page}")


if __name__ == "__main__":
    main()
