/**
 * Build a local design-choice page.
 *
 * The point is a decision, so the page has to be honest: the marked text is
 * rendered by the REAL renderer (`renderSyl`, server-rendered) against the REAL
 * stylesheet (`chant.css`), from a REAL corpus document. A mock-up would let a
 * palette look good on text that does not exist.
 *
 * Every option is shown in both modes, with the chrome around it — toolbar,
 * status bar, a page on its desk — because a palette is chosen for a whole
 * screen and not for a swatch.
 *
 *   npx tsx tools/design/preview.mjs
 *   -> design-preview.html   (open it in a browser)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { openChantDoc } from '../../packages/engine/src/open-doc.ts';
import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';
import { OPTIONS, tokensFor } from './options.mjs';
import { REFERENCE, VARIANTS } from './variants.mjs';

/*
 * `--round2` shows the blends around Śānta instead of the first five. Same
 * generator, same real renderer, same stylesheet — a second page written
 * separately would be free to drift from the first, and then the comparison
 * between rounds would mean nothing.
 */
const ROUND2 = process.argv.includes('--round2');
const SHOWN = ROUND2 ? [...VARIANTS, ...REFERENCE] : OPTIONS;
const OUT_FILE = ROUND2 ? 'design-round2.html' : 'design-preview.html';

// `tsx` compiles TSX with the CLASSIC runtime, which expects a global `React`.
// Setting it before a dynamic import is the least invasive fix: the alternative
// is a second tsconfig whose only purpose is this one script.
globalThis.React = React;
const { renderSyl } = await import('../../packages/render/src/render/marks.tsx');

const DOC = openChantDoc(JSON.parse(readFileSync('corpus/chants/durga-suktam.json', 'utf8')));
const CHANT_CSS = readFileSync('packages/render/src/chant.css', 'utf8');
const GEOMETRY_CSS = readFileSync('packages/render/src/generated/mark-geometry.css', 'utf8');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** One verse, through the real renderer, split into its lines. */
function verseHtml(verse, script) {
  const lines = [[]];
  for (const t of verse.tokens) {
    if (t.t === 'br') lines.push([]);
    else lines[lines.length - 1].push(t);
  }
  const opts = { showMarks: true, fontStack: 'var(--font-body)' };
  return lines.map((line) => {
    const inner = line.map((t, i) => {
      if (t.t === 'syl') return renderToStaticMarkup(renderSyl(t, script, i, opts));
      if (t.t === 'sp') return '<span class="sp"> </span>';
      if (t.t === 'danda') return `<span class="danda">${esc(t.s)}</span>`;
      if (t.t === 'num') return `<span class="num">${esc(t.s)}</span>`;
      if (t.t === 'pause') return `<span class="pause pause--${t.len}"></span>`;
      if (t.t === 'text') return `<span class="plain">${esc(t.s)}</span>`;
      return '';
    }).join('');
    return `<div class="pada">${inner}</div>`;
  }).join('');
}

function documentHtml(script, verseCount) {
  const section = DOC.sections[0];
  const verses = section.verses.slice(0, verseCount);
  return `<h2 class="dp-title">${esc(DOC.title)}</h2>`
    + verses.map((v) => `<div class="verse">`
      + `<span class="verse__n">${esc(v.n ?? '')}</span>`
      + verseHtml(v, script) + `</div>`).join('');
}

const IAST_2 = documentHtml('iast', 2);
const DEVA_1 = documentHtml('deva', 1);

/** One option in one mode: the whole screen, at a readable size. */
function panel(option, mode) {
  const t = tokensFor(option, mode);
  const vars = Object.entries(t).map(([k, v]) => `--${k}:${v}`).join(';');
  return `
<section class="dp-panel" data-option="${option.id}" data-mode="${mode}" style="${vars}">
  <header class="dp-head">
    <span class="dp-name">${esc(option.name)}</span>
    <span class="dp-tag">${esc(option.tagline)}</span>
    <span class="dp-mode">${mode}</span>
  </header>

  <div class="dp-screen">
    <div class="dp-tb">
      <span class="dp-brand">śikṣāmitra</span>
      <span class="dp-sel">Durgā Sūktam</span>
      <span class="dp-flex"></span>
      <span class="dp-seg"><b>Flow</b><i>Pages</i><i>Web</i></span>
      <span class="dp-grp"><i>−</i><i>100%</i><i>+</i></span>
      <span class="dp-grp"><b>IAST</b><i>देव</i><i>తెలు</i><i>தமி</i></span>
      <span class="dp-grp"><b>Marks</b></span>
    </div>

    <div class="dp-desk">
      <div class="dp-page chant-marks">${IAST_2}</div>
      <div class="dp-page dp-page--half chant-marks">${DEVA_1}</div>
    </div>

    <div class="dp-status">
      <span>durgā sūktam</span><span class="dp-dot">·</span><span>3 sections</span>
      <span class="dp-dot">·</span><span>9 verses</span>
      <span class="dp-flex"></span>
      <span>Flow</span><span class="dp-dot">·</span><span>A4</span><span class="dp-dot">·</span><span>100%</span>
    </div>
  </div>

  <p class="dp-note">${esc(option.note)}</p>
  <div class="dp-swatches">
    ${['accent', 'hold', 'svara', 'change', 'hold-long'].map((k) => `
      <span class="dp-swatch"><i style="background:${option[mode][k]}"></i>${k}</span>`).join('')}
  </div>
</section>`;
}

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>śikṣāmitra — design options</title>
<link rel="stylesheet" href="assets/fonts/fonts.css">
<style>
/* The real mark rules, so what you judge is what you get. */
${GEOMETRY_CSS}
${CHANT_CSS}

/* The preview's own chrome. Neutral on purpose: it must not compete with the
   options it is showing. */
*{box-sizing:border-box}
body{margin:0;background:#0d0d0f;color:#e8e8ec;
  font-family:"Segoe UI Variable","Segoe UI",system-ui,sans-serif;font-size:13px}
.dp-wrap{max-width:1500px;margin:0 auto;padding:28px}
h1{font-size:20px;font-weight:600;margin:0 0 4px}
.dp-lead{color:#9a9aa4;margin:0 0 22px;max-width:70ch;line-height:1.6}
.dp-lead b{color:#e8e8ec;font-weight:600}
.dp-bar{position:sticky;top:0;z-index:5;display:flex;gap:6px;flex-wrap:wrap;
  padding:10px 0 14px;background:#0d0d0f;border-bottom:1px solid #22222a;margin-bottom:20px}
.dp-bar button{font:inherit;color:#c9c9d2;background:#17171c;border:1px solid #2a2a33;
  border-radius:5px;padding:5px 11px;cursor:pointer}
.dp-bar button:hover{background:#1f1f26;color:#fff}
.dp-bar button.on{background:#e8a33d;border-color:#e8a33d;color:#1a1a1f;font-weight:600}
.dp-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media (max-width:1100px){.dp-grid{grid-template-columns:1fr}}

.dp-panel{border:1px solid #23232b;border-radius:9px;overflow:hidden;background:#131317}
.dp-panel[hidden]{display:none}
.dp-head{display:flex;align-items:baseline;gap:9px;padding:9px 13px;border-bottom:1px solid #23232b}
.dp-name{font-weight:600}
.dp-tag{color:#8a8a95;font-size:12px}
.dp-mode{margin-left:auto;font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:#7a7a86}

/* The mocked screen, driven entirely by the option's tokens. */
.dp-screen{font-family:var(--font-ui);background:var(--color-vellum-dim);color:var(--color-ink)}
.dp-tb{display:flex;align-items:center;gap:7px;padding:0 10px;height:var(--o-tb);
  background:var(--color-vellum);border-bottom:1px solid var(--color-rule);
  font-size:var(--o-ui-size)}
.dp-brand{font-family:var(--font-display);font-size:14px;color:var(--color-violet)}
.dp-sel{border:1px solid var(--color-rule);border-radius:var(--o-radius);padding:2px 7px;
  background:var(--color-vellum-dim);color:var(--color-ink)}
.dp-flex{flex:1}
.dp-seg{display:inline-flex;border:1px solid var(--color-rule);border-radius:var(--o-radius);overflow:hidden}
.dp-seg b,.dp-seg i{font-style:normal;padding:3px 8px;color:var(--color-ink-soft)}
.dp-seg b{background:var(--color-violet);color:var(--accent-on);font-weight:600}
.dp-grp{display:inline-flex;gap:1px;padding-left:8px;margin-left:3px;border-left:1px solid var(--color-rule)}
.dp-grp b,.dp-grp i{font-style:normal;padding:3px 7px;border-radius:var(--o-radius);color:var(--color-ink-soft)}
.dp-grp b{background:var(--color-vellum-warm);color:var(--color-violet);font-weight:600}

.dp-desk{background:var(--desk);padding:var(--o-desk-pad);display:flex;gap:var(--o-desk-pad);
  align-items:flex-start;height:400px;overflow:hidden}
.dp-page{flex:1 1 0;background:var(--doc-bg);color:var(--doc-ink);padding:var(--o-pad);
  height:100%;overflow:hidden;
  /* Fade the cut rather than clipping through a glyph: a hard edge across the
     middle of a line reads as a rendering bug and distracts from the palette,
     which is the only thing being judged here. */
  -webkit-mask-image:linear-gradient(to bottom,#000 84%,transparent 100%);
  mask-image:linear-gradient(to bottom,#000 84%,transparent 100%);
  border-radius:var(--o-radius);box-shadow:var(--o-shadow);min-width:0;
  font-family:var(--font-body);font-size:var(--o-doc-size);line-height:var(--o-leading)}
.dp-page--half{flex:0 0 34%}
.dp-title{font-family:var(--font-display);font-size:calc(var(--o-doc-size) * 1.18);margin:0 0 var(--o-gap);
  color:var(--color-violet);font-weight:600}
.dp-page .verse{margin:0 0 var(--o-gap);display:block}
.dp-page .verse__n{font-family:var(--font-ui);font-size:10px;color:var(--color-ink-mute);
  display:block;margin-bottom:2px}

.dp-status{display:flex;align-items:center;gap:5px;height:23px;padding:0 10px;
  background:var(--color-vellum);border-top:1px solid var(--color-rule);
  color:var(--color-ink-mute);font-size:var(--o-ui-size)}
.dp-dot{color:var(--color-ink-mute);opacity:.6}

.dp-note{margin:0;padding:11px 13px;color:#9a9aa4;line-height:1.6;border-top:1px solid #23232b}
.dp-swatches{display:flex;gap:13px;flex-wrap:wrap;padding:0 13px 12px;font-size:11px;color:#8a8a95}
.dp-swatch{display:inline-flex;align-items:center;gap:5px}
.dp-swatch i{width:13px;height:13px;border-radius:3px;border:1px solid rgba(255,255,255,.16)}
</style>
</head>
<body>
<div class="dp-wrap">
  <h1>śikṣāmitra — ${ROUND2 ? 'round two: blends around Śānta' : 'its own look'}</h1>
  <p class="dp-lead">
    ${SHOWN.length} designs, each in light and dark — differing in typeface,
    density, radius and palette, not only in hue. The marked text is rendered by the
    <b>real renderer</b> against the <b>real stylesheet</b>, from a real corpus
    document — so the holding boxes, svara strokes and the anusvāra change you
    see are exactly what the editor draws. Judge the marks as much as the
    chrome: a palette that loses a svara is not a candidate.
  </p>

  <div class="dp-bar">
    <button data-filter="all" class="on">All</button>
    ${SHOWN.map((o) => `<button data-filter="${o.id}">${esc(o.name)}</button>`).join('')}
    <span style="width:14px"></span>
    <button data-mode="all" class="on">Both modes</button>
    <button data-mode="light">Light only</button>
    <button data-mode="dark">Dark only</button>
  </div>

  <div class="dp-grid">
    ${SHOWN.flatMap((o) => ['light', 'dark'].map((m) => panel(o, m))).join('')}
  </div>
</div>

<script>
  const panels = [...document.querySelectorAll('.dp-panel')];
  let filter = 'all', mode = 'all';
  const apply = () => {
    for (const p of panels) {
      const okOption = filter === 'all' || p.dataset.option === filter;
      const okMode = mode === 'all' || p.dataset.mode === mode;
      p.hidden = !(okOption && okMode);
    }
  };
  for (const b of document.querySelectorAll('[data-filter]')) {
    b.addEventListener('click', () => {
      filter = b.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((x) => x.classList.toggle('on', x === b));
      apply();
    });
  }
  for (const b of document.querySelectorAll('[data-mode]')) {
    b.addEventListener('click', () => {
      mode = b.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
      apply();
    });
  }
</script>
</body>
</html>`;

writeFileSync('design-preview.html', page);
console.log(`\n  design-preview.html — ${OPTIONS.length} options x 2 modes`);
for (const o of OPTIONS) console.log(`    ${o.id.padEnd(10)} ${o.name} — ${o.tagline}`);
console.log('');
