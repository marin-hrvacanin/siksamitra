#!/usr/bin/env node
/**
 * THE 1:1 GATE — what the browser draws, against what his file says.
 *
 * The unit tests check that the token table matches the `.docx`. That is not
 * the same claim as "the page is 1:1", and the difference was not academic:
 * every one of those tests passed while the document theme moved nothing at
 * all, because the mantra line's size and leading were written in a
 * stylesheet. Measured in a browser, the tokens said 16 pt on 24 pt and the
 * page drew 19.44 pt on 37.9 pt, with no hanging indent and no translations.
 *
 * So this gate reads COMPUTED STYLE off the rendered document and compares it
 * with `WORD_PARAGRAPHS`, in points, for the Veda Union theme — and with each
 * theme's own type scale for every other theme. It also checks the things a
 * size cannot express: that a translation is drawn at all, that a verse number
 * is not printed twice, and that the hierarchy renders as a hierarchy.
 *
 *   npm run dev
 *   CHROME=<path> node tools/doc-fidelity.mjs
 */
import puppeteer from 'puppeteer-core';
import { browserPath } from './_browser.mjs';
import { APP_URL, openApp } from './_ui.mjs';

const URL = APP_URL;

const browser = await puppeteer.launch({
  executablePath: browserPath(), headless: 'shell', args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 950 });
await openApp(page, URL, { selector: '.pada' });

/**
 * Measure one document element, in POINTS.
 *
 * Points because that is the unit his file is written in, and converting once
 * here means the expectations below are the numbers a person can read out of
 * Word's own dialogs.
 */
/*
 * THE LIST OF THEMES IS PASSED IN, not imported inside the page.
 *
 * This used to `import('/@fs/D:/Projects/siksamitra/...')` — an absolute path
 * to this machine, through the dev server's own file-serving route. It
 * therefore worked here and nowhere else: on CI it failed against a BUILT app,
 * which has no such route and no such drive. The names are ordinary data and
 * Node can read them from the same module the app does.
 */
const { DOCUMENT_IDS, DEFAULT_DOCUMENT } = await import('../packages/tokens/generated/tokens.ts');

const measured = await page.evaluate(async ({ ids, fallback }) => {
  const canvas = document.querySelector('.canvas');
  const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const pt = (px) => Math.round((Number.parseFloat(px) / root) * 12 * 1000) / 1000;

  /*
   * The RENDERED leading, even when it is the font's own.
   *
   * `line-height: normal` computes to the string "normal", so there is no
   * number to read — and "normal" is exactly what Word's `lineRule="auto"`
   * means, so it cannot just be rejected. The two line boxes of a wrapped
   * paragraph give the real figure: the distance between them IS the leading,
   * which is the same quantity measured off his PDF (12.6 pt on 11 pt Times).
   */
  const leadingPx = (el, cs) => {
    const declared = Number.parseFloat(cs.lineHeight);
    if (!Number.isNaN(declared)) return { px: declared, auto: false };
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.height > 0);
    const px = rects.length >= 2
      ? rects[1].top - rects[0].top
      : el.getBoundingClientRect().height;
    return { px, auto: true };
  };

  const of = (sel) => {
    const el = document.querySelector(sel);
    if (el === null) return null;
    const cs = getComputedStyle(el);
    const size = pt(cs.fontSize);
    const lead = leadingPx(el, cs);
    return {
      size,
      lead: Math.round((pt(lead.px) / size) * 1000) / 1000,
      autoLead: lead.auto,
      family: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
      italic: cs.fontStyle === 'italic',
      bold: Number(cs.fontWeight) >= 600,
      color: cs.color,
      indent: pt(cs.marginLeft),
      right: pt(cs.marginRight),
      after: pt(cs.marginBottom),
      firstLine: pt(cs.textIndent),
      shown: cs.display !== 'none' && cs.visibility !== 'hidden',
    };
  };

  const out = {};
  for (const id of ids) {
    canvas.setAttribute('data-doc', id);
    // A reflow, so the container query and the clamp have resolved.
    void document.body.offsetHeight;
    out[id] = {
      first: of('.flow__column .pada[data-line="0"]'),
      cont: of('.flow__column .verse .pada[data-line="1"]'),
      heading: of('.flow__column .section__title'),
      translation: of('.flow__column .doc__translation'),
      number: of('.flow__column .verse__n'),
      counts: {
        verses: document.querySelectorAll('.flow__column .verse').length,
        translations: document.querySelectorAll('.flow__column .doc__translation').length,
        headings: document.querySelectorAll('.flow__column .section__title').length,
        numbersDrawn: [...document.querySelectorAll('.flow__column .verse__n')]
          .filter((e) => getComputedStyle(e).display !== 'none').length,
      },
    };
  }
  canvas.setAttribute('data-doc', fallback);
  return out;
}, { ids: DOCUMENT_IDS, fallback: DEFAULT_DOCUMENT });

/* The expectations, from the same table the exporter and the theme read. */
const { WORD_PARAGRAPHS } = await import('../packages/tokens/src/word.ts');
const { DOCUMENT_THEMES, typeScaleOf } = await import('../packages/tokens/src/document-themes.ts');
const style = (role) => WORD_PARAGRAPHS.find((m) => m.role === role);

const problems = [];
const near = (what, got, want, tol = 0.05) => {
  if (got === null || got === undefined) problems.push(`${what}: not rendered`);
  else if (Math.abs(got - want) > tol) problems.push(`${what}: ${got} ≠ ${want}`);
};
const is = (what, got, want) => {
  if (got !== want) problems.push(`${what}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
};

/* ── the Veda Union Word document, in points ─────────────────────────────── */
const w = measured.word;
if (w === undefined) problems.push('no `word` document theme');
else {
  const line = style('verse-line');
  near('word verse size', w.first?.size, line.size);
  near('word verse leading', w.first?.lead, line.leading / line.size, 0.01);
  is('word verse face', w.first?.family, 'Arimo');
  is('word verse bold', w.first?.bold, false);
  /* The hanging indent: first line OUT at the margin, continuations IN. */
  near('word verse first-line indent', w.first?.indent, line.indent - line.hanging);
  near('word verse continuation indent', w.cont?.indent, line.indent);
  near('word verse right indent', w.first?.right, line.right);

  /* A section's title renders as his STEP heading — Heading4. See
     `ROLE_OF_ELEMENT`: our levels sit one below his book's. */
  const h = style('step');
  near('word heading size', w.heading?.size, h.size);
  near('word heading indent', w.heading?.indent, h.indent);
  near('word heading after', w.heading?.after, h.after);
  is('word heading face', w.heading?.family, 'Carlito');
  is('word heading bold', w.heading?.bold, false);
  is('word heading colour', w.heading?.color, 'rgb(127, 127, 127)');

  const tr = style('translation');
  near('word translation size', w.translation?.size, tr.size);
  /* `w:lineRule="auto"` — the FONT's leading, so `normal` is the assertion,
     and the number it produces is checked against his PDF below. */
  is('word translation auto leading', w.translation?.autoLead, tr.leading === null);
  if (w.translation !== null && (w.translation.lead < 1.1 || w.translation.lead > 1.2)) {
    problems.push(
      `word translation leading ${w.translation.lead} outside Times' own 1.10–1.20 `
      + '(his PDF sets 11pt on 12.6pt = 1.145)',
    );
  }
  near('word translation indent', w.translation?.indent, tr.indent);
  near('word translation first line', w.translation?.firstLine, -tr.hanging);
  near('word translation right', w.translation?.right, tr.right);
  near('word translation after', w.translation?.after, tr.after);
  is('word translation face', w.translation?.family, 'Tinos');
  is('word translation italic', w.translation?.italic, true);
  is('word translation colour', w.translation?.color, 'rgb(128, 128, 128)');

  /* His document prints the verse number in the line. One number, not two. */
  is('word gutter verse numbers', w.counts.numbersDrawn, 0);
}

/* ── every theme: the page renders what the theme declares ───────────────── */
for (const theme of DOCUMENT_THEMES) {
  const seen = measured[theme.id];
  const scale = typeScaleOf(theme);
  if (seen === undefined) { problems.push(`${theme.id}: not measured`); continue; }
  const rem = (r) => r * 12;
  /* A fluid role is a range, so the assertion is the range. */
  const verse = scale.verse;
  if (verse.floor === null) near(`${theme.id} verse size`, seen.first?.size, rem(verse.size));
  else if (seen.first === null) problems.push(`${theme.id} verse: not rendered`);
  else if (seen.first.size > rem(verse.size) + 0.05
        || seen.first.size < rem(verse.floor) - 0.05) {
    problems.push(
      `${theme.id} verse size ${seen.first.size} outside `
      + `[${rem(verse.floor)}, ${rem(verse.size)}]`,
    );
  }
  if (verse.leading === 'normal') is(`${theme.id} verse leading is the font's`, seen.first?.autoLead, true);
  else near(`${theme.id} verse leading`, seen.first?.lead, verse.leading, 0.01);
  if (scale.translation.leading === 'normal') {
    is(`${theme.id} translation leading is the font's`, seen.translation?.autoLead, true);
  } else {
    near(`${theme.id} translation leading`, seen.translation?.lead, scale.translation.leading, 0.01);
  }
  near(`${theme.id} heading size`, seen.heading?.size, rem(scale.step.size));
  near(`${theme.id} translation size`, seen.translation?.size, rem(scale.translation.size));
  is(`${theme.id} translation italic`, seen.translation?.italic, scale.translation.italic);

  /* The document draws everything it holds, under every theme. */
  is(`${theme.id} translations drawn`, seen.counts.translations, seen.counts.verses);
  if (seen.counts.headings < 1) problems.push(`${theme.id}: no section headings`);
  const wantNumbers = theme.numbers === 'gutter' ? seen.counts.verses : 0;
  /* Durgā Sūktam's ninth verse has no number of its own; the gutter shows a
     number for every verse that has one, and none where the document prints
     its own. */
  if (theme.numbers === 'inline' && seen.counts.numbersDrawn !== 0) {
    problems.push(`${theme.id}: ${seen.counts.numbersDrawn} gutter numbers over an inline-numbered document`);
  } else if (theme.numbers === 'gutter' && seen.counts.numbersDrawn === 0) {
    problems.push(`${theme.id}: gutter numbering, but no number drawn`);
  }
  void wantNumbers;

  /* The hierarchy is a hierarchy: a heading outranks the text under it. */
  if (seen.heading !== null && seen.translation !== null
      && seen.heading.size <= seen.translation.size) {
    problems.push(`${theme.id}: heading ${seen.heading.size}pt not above translation ${seen.translation.size}pt`);
  }
}

await browser.close();

const themes = Object.keys(measured).length;
if (problems.length > 0) {
  console.error(`\n  DOCUMENT FIDELITY — ${problems.length} problem(s) across ${themes} themes\n`);
  for (const p of problems) console.error(`    ${p}`);
  console.error('');
  process.exit(1);
}
console.log(`\n  DOCUMENT FIDELITY ok — ${themes} themes measured in a browser`);
console.log('    the Veda Union theme matches his .docx to the point:');
console.log(`      mantra ${measured.word.first.size}pt on ${measured.word.first.lead} `
  + `(${(measured.word.first.size * measured.word.first.lead).toFixed(0)}pt), `
  + `hanging ${measured.word.cont.indent}pt`);
console.log(`      heading ${measured.word.heading.size}pt ${measured.word.heading.color} `
  + `at ${measured.word.heading.indent}pt`);
console.log(`      translation ${measured.word.translation.size}pt italic on `
  + `${(measured.word.translation.size * measured.word.translation.lead).toFixed(2)}pt`
  + ` (his PDF: 11 on 12.6)`);
