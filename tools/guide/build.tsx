/**
 * THE GUIDE — every rule, every mark, every register, drawn by the program.
 *
 * `npm run guide` writes `out/guide/index.html`. Nothing on the page is typed
 * out by hand where the program can produce it: each example is marked by the
 * engine (`rerun`) in the register it belongs to and drawn by the app's own
 * renderer under the app's own page (`data-doc="screen"`), and the Devanāgarī,
 * Telugu and Tamil lines are what the Word writer puts in a document. So the
 * guide cannot say one thing while the programs do another: a rule that
 * changes changes its example.
 *
 * The list of rules is the engine's registry (`RULES`), the registers are the
 * format's notes, and the switches are the conventions registry — adding an
 * entry to any of them adds it here.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ChantProfileKey, TextAndMarks } from '@siksamitra/format';
import { CHANT_PROFILE_KEYS, CHANT_PROFILE_NOTES, toTextAndMarks } from '@siksamitra/format';
import {
  CONVENTIONS, RULES, STAGES, SVARA_PLANS, conventionsPatch, isEnabled, rerun, resolveProfile,
  type ConventionId, type Profile, type ScriptKey,
} from '@siksamitra/engine';
import { appCss } from '../export/css.mjs';
import { WORD_DEVANAGARI } from '@siksamitra/tokens/word';
import { wordLine, wordVariables } from './word-line.js';
import { EXAMPLES, NOTATION, type Example } from './examples.js';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = join(ROOT, 'out/guide');

/* ── marking and drawing ────────────────────────────────────────────────── */

const profileOf = (register: ChantProfileKey, conventions: Partial<Record<ConventionId, boolean>> = {}): Profile =>
  resolveProfile([{ preset: register }, { patch: conventionsPatch(conventions) } as never]);

/** A line marked by the rules of a register — the same call Auto-mark makes. */
function marked(text: string, register: ChantProfileKey, conventions: Partial<Record<ConventionId, boolean>> = {}): TextAndMarks {
  const profile = profileOf(register, conventions);
  return rerun({ text, marks: [] }, { stages: STAGES, mode: 'keep-hand', profile, previous: profile, from: 0, to: text.length });
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A line drawn exactly as Word sets it — see `word-line.ts`. */
const drawn = (tm: TextAndMarks, script: ScriptKey = 'iast'): string => wordLine(tm, script);

/** The same line, as typed and as marked. */
function pair(ex: Example): string {
  const tm = marked(ex.text, ex.register, ex.conventions);
  return `<div class="g-pair">
    <div class="g-pair__side"><span class="g-eyebrow">typed</span>${drawn({ text: ex.text, marks: [] })}</div>
    <div class="g-pair__arrow" aria-hidden>→</div>
    <div class="g-pair__side"><span class="g-eyebrow">marked · ${esc(CHANT_PROFILE_NOTES[ex.register].name)}</span>${drawn(tm)}</div>
  </div>${ex.note === undefined ? '' : `<p class="g-note">${esc(ex.note)}</p>`}`;
}

/* ── the sections ───────────────────────────────────────────────────────── */

const STAGE_TITLE: Record<string, string> = {
  Normalize: 'Normalising', Aids: 'Reading aids', Svarabhakti: 'Svarabhakti', Pauses: 'Pauses',
  Holdings: 'Holdings', Anusvara: 'The anusvāra', Visarga: 'The visarga',
  RecensionSvara: 'Svaras of a recension', Svara: 'Svaras',
};

const registersOn = (ruleId: string): string[] => CHANT_PROFILE_KEYS
  .filter((k) => { const r = RULES.find((x) => x.id === ruleId)!; return isEnabled(r, resolveProfile([{ preset: k }])); })
  .map((k) => CHANT_PROFILE_NOTES[k].name);

/** His own marked files, read as `sm import` reads them, for the lines only his hand can mark. */
async function hisLine(file: string, verse: number): Promise<TextAndMarks | null> {
  const dir = join(ROOT, 'Library/reference');
  const { readdirSync, readFileSync } = await import('node:fs');
  const name = readdirSync(dir).find((f) => f.toLowerCase().startsWith(file) && f.endsWith('.docx'));
  if (name === undefined) return null;
  const { openDocumentFile } = await import('@siksamitra/interop');
  const { doc } = await openDocumentFile(new Uint8Array(readFileSync(join(dir, name))), name);
  const v = doc.sections.flatMap((s) => s.verses)[verse];
  return v === undefined ? null : toTextAndMarks(v);
}

async function notation(): Promise<string> {
  const cards: string[] = [];
  for (const n of NOTATION) {
    const tm = n.his !== undefined ? await hisLine(n.his.file, n.his.verse) : marked(n.text!, n.register!);
    cards.push(`<article class="g-card" id="mark-${n.id}">
    <header class="g-card__head"><h3>${esc(n.name)}</h3><span class="g-chip" style="--chip:${n.swatch}">${esc(n.word)}</span></header>
    <p>${esc(n.what)}</p>
    ${tm === null ? '<p class="g-note">His file is not on this machine.</p>' : drawn(tm)}
    ${n.register === undefined ? '<p class="g-note">As he marked it, read out of his file.</p>' : `<p class="g-note">Marked by the rules of ${esc(CHANT_PROFILE_NOTES[n.register].name)} — every mark they give it.</p>`}
  </article>`);
  }
  return cards.join('\n');
}

function rules(): string {
  const stages = [...new Set(RULES.map((r) => r.stage))];
  return stages.map((stage) => `<section class="g-stage" id="stage-${stage}">
    <h3 class="g-h3">${esc(STAGE_TITLE[stage] ?? stage)}</h3>
    ${RULES.filter((r) => r.stage === stage).map((r) => {
      const on = registersOn(r.id);
      const ex = EXAMPLES[r.id];
      return `<article class="g-card" id="rule-${r.id}">
        <header class="g-card__head"><h4>${esc(r.title)}</h4><code class="g-id">${esc(r.id)}</code></header>
        <p class="g-meta">${on.length === 0 ? 'Off in every register unless switched on.' : `On in: ${on.map(esc).join(' · ')}`}<span class="g-spec">${esc(r.spec)}</span></p>
        ${ex === undefined ? '' : pair(ex)}
      </article>`;
    }).join('\n')}
  </section>`).join('\n');
}

function svaras(): string {
  const plan = SVARA_PLANS.anustubh;
  const positions = plan.positions.map((p) => `<td class="g-pos g-pos--${p.mark}">${p.pos}</td>`).join('');
  return `<p>A Vedic text keeps the svaras its accented source has: they are read, never invented — a Vedic line typed
  without them is marked without them. A purāṇic or smārta verse has none to read, and its metre supplies them: a line that
  scans as an anuṣṭubh half-verse of 16 syllables takes the śloka pattern, verified against his marked Lalitā Sahasranāma
  (35 of 35 half-verses). A line that does not scan is left unmarked, all or nothing. The switch is
  “Svaras on a purāṇic śloka, by its metre”, on by default.</p>
  <table class="g-plan"><caption>${esc(plan.label)} — the syllable each svara falls on</caption>
    <tr><th>syllable</th>${positions}</tr>
    <tr><th>svara</th>${plan.positions.map((p) => `<td>${p.mark === 'svarita' ? 'svarita' : p.mark === 'anudatta' ? 'anudātta' : 'dīrgha'}</td>`).join('')}</tr></table>
  ${pair({ text: 'yā devī sarvabhūteṣu śaktirūpeṇa saṁsthitā', register: 'smarta' })}
  ${pair({ text: 'sarvamaṅgalamāṅgalye śive sarvārthasādhike', register: 'smarta' })}`;
}

function registers(): string {
  const line = 'tvaṁ svāhā tvaṁ svadhā tvaṁ hi vaṣaṭkāraḥ svarātmikā';
  return CHANT_PROFILE_KEYS.map((k) => `<article class="g-card" id="reg-${k}">
    <header class="g-card__head"><h3>${esc(CHANT_PROFILE_NOTES[k].name)}</h3></header>
    <p class="g-meta">${esc(CHANT_PROFILE_NOTES[k].where)}</p>
    <p>${esc(CHANT_PROFILE_NOTES[k].what)}</p>
    ${drawn(marked(line, k))}
  </article>`).join('\n');
}

function conventions(): string {
  return CONVENTIONS.map((c) => {
    const ex = EXAMPLES[`convention:${c.id}`];
    const text = ex?.text ?? c.example.typed;
    const register = ex?.register ?? 'taittiriya';
    return `<article class="g-card" id="conv-${c.id}">
      <header class="g-card__head"><h3>${esc(c.label)}</h3></header>
      <p>${esc(c.note)}</p>
      <div class="g-pair g-pair--two">
        <div class="g-pair__side"><span class="g-eyebrow">switched on</span>${drawn(marked(text, register, { [c.id]: true }))}</div>
        <div class="g-pair__side"><span class="g-eyebrow">switched off</span>${drawn(marked(text, register, { [c.id]: false }))}</div>
      </div>
    </article>`;
  }).join('\n');
}

function scripts(): string {
  const tm = marked('yā devī sarvabhūteṣu śaktirūpeṇa saṁsthitā', 'smarta');
  const rows: [ScriptKey, string][] = [['iast', 'IAST'], ['deva', 'Devanāgarī'], ['tel', 'Telugu'], ['tam', 'Tamil']];
  return `<p>One marked line, in each script, as the Word writer sets it — the Indic scripts in his Devanāgarī convention: a holding is the small green mark BEFORE its akṣara, the svaras follow it,
  a reading aid is small and blue, and words are two spaces apart. Nothing is lost — writing the line back in IAST gives
  exactly what was there.</p>
  ${rows.map(([s, name]) => `<div class="g-script"><span class="g-eyebrow">${name}</span>${drawn(tm, s)}</div>`).join('\n')}`;
}

/* ── the page ───────────────────────────────────────────────────────────── */

const SECTIONS: [string, string, () => string | Promise<string>][] = [
  ['notation', 'The marks', notation],
  ['rules', 'The rules', rules],
  ['svaras', 'Svaras', svaras],
  ['registers', 'Registers', registers],
  ['conventions', 'Switches', conventions],
  ['scripts', 'Scripts', scripts],
];

const nav = SECTIONS.map(([id, title]) => {
  const sub = id === 'rules'
    ? `<ol>${[...new Set(RULES.map((r) => r.stage))].map((s) => `<li><a href="#stage-${s}">${esc(STAGE_TITLE[s] ?? s)}</a></li>`).join('')}</ol>`
    : '';
  return `<li><a href="#${id}">${esc(title)}</a>${sub}</li>`;
}).join('');

const css = appCss().replace(/url\((['"]?)\.\/([^'")]+\.woff2)\1\)/g, "url('../../assets/fonts/$2')");
const page = `<!doctype html>
<html lang="en" data-chrome="palladio" data-mode="light">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>śikṣāmitra — the rules</title>
<style>${css}
${wordVariables()}</style>
<link rel="stylesheet" href="guide.css">
</head>
<body class="g" style="--g-mark-face: '${WORD_DEVANAGARI.hold.face}'">
<aside class="g-nav"><div class="g-brand">śikṣāmitra<span>the marking rules</span></div><nav><ol>${nav}</ol></nav>
<button class="g-mode" type="button" onclick="const r=document.documentElement;r.dataset.mode=r.dataset.mode==='dark'?'light':'dark'">Light / dark</button></aside>
<main class="g-main">
<header class="g-hero"><h1>How śikṣāmitra marks a text</h1>
<p>Every example on this page was marked by the program itself, in the register it names, and is set exactly as the
add-in writes it into a Word document, in his styles — so what you read here is what Auto-mark does.</p></header>
${(await Promise.all(SECTIONS.map(async ([id, title, body]) => `<section class="g-section" id="${id}"><h2 class="g-h2">${esc(title)}</h2>${await body()}</section>`))).join('\n')}
</main>
</body></html>`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), page);
writeFileSync(join(OUT, 'guide.css'), (await import('node:fs')).readFileSync(join(import.meta.dirname, 'guide.css'), 'utf8'));
console.log(`guide written: ${join(OUT, 'index.html')}`);
