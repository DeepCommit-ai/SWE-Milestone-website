
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
  { key: 'Z.ai',        color: 'var(--zai-accent)' },
  { key: 'DeepSeek',    color: '#4D6BFE' },
  { key: 'Qwen',        color: '#615CED' },
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
