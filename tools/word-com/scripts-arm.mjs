/**
 * THE LIVE GATE'S SCRIPTS ARM — does a real Word keep a Devanāgarī, Telugu or
 * Tamil line exactly, invisible markers and all?
 *
 * A line in an Indic script says what its clusters cannot show in characters
 * that show nothing (`mark-selectors.ts` in the engine): Variation Selectors
 * Supplement and TAG characters. Everything else proves they survive OUR
 * reader and writer; only Word can say whether Word keeps them — or drops,
 * normalises or splits them, which would silently lose the marks they carry.
 *
 * So verses of the corpus that NEED markers (and a few that need none, as the
 * control) are written in each script by the add-in's own writer, put into a
 * real Word in one package per script, and Word's own OOXML is read back and
 * decoded by the add-in's own reader. The expectation is the IAST writer's
 * reading of the same verse — never the script output being checked.
 */
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { toTextAndMarks } from '@siksamitra/format';
import { SAID, mergeRuns, readParagraphs } from '@siksamitra/interop';
import { documentPartOf, flatPackage } from '../../apps/word-addin/src/model/opc.js';
import { decodeRuns, isVerseParagraph, paragraphRuns, paragraphsXml } from '../../apps/word-addin/src/model/paragraph.js';
import { styleSheetFor } from '../../apps/word-addin/src/model/sheet.js';
import { corpusVerses } from '../../tests/helpers/corpus.js';

export const SCRIPTS = ['deva', 'tel', 'tam'];
const WITH_MARKERS = 10;
const WITHOUT = 2;

const canon = (tm) => JSON.stringify([tm.text, tm.marks.map(({ by: _b, ...m }) => JSON.stringify(m)).sort()]);
/** Hidden runs of ours in a package: what a cluster could not show. */
const said = (paragraphs) => paragraphs.flatMap((p) => p.runs)
  .filter((r) => r.hidden === true && r.text.startsWith(SAID)).length;

/** One package per script, and what each of its lines must read back as. */
export function scriptPayloads(dir) {
  const verses = corpusVerses().map(({ verse }) => toTextAndMarks(verse)).filter((tm) => !tm.text.includes('\n'));
  const out = {};
  for (const script of SCRIPTS) {
    const chosen = [];
    let plain = 0;
    for (const tm of verses) {
      const body = paragraphsXml(tm, script);
      const markers = said(readParagraphs(`<w:body>${body}</w:body>`));
      if (markers > 0 && chosen.filter((c) => c.markers > 0).length < WITH_MARKERS) chosen.push({ tm, body, markers });
      else if (markers === 0 && plain < WITHOUT) { chosen.push({ tm, body, markers }); plain += 1; }
      if (chosen.length >= WITH_MARKERS + WITHOUT) break;
    }
    const joined = chosen.map((c) => c.body).join('');
    const file = `live-script-${script}-in.xml`;
    writeFileSync(join(dir, file), flatPackage(joined, styleSheetFor(joined)), 'utf8');
    out[script] = {
      file,
      markers: chosen.reduce((n, c) => n + c.markers, 0),
      expect: chosen.map((c) => canon(decodeRuns(paragraphRuns(c.tm, 'iast')[0] ?? []))),
      texts: chosen.map((c) => c.tm.text),
    };
  }
  return out;
}

/** The checks, on what Word handed back; `read` reads a file Word wrote. */
export function checkScripts(payloads, live, read, check) {
  for (const script of SCRIPTS) {
    const want = payloads[script];
    const got = live.scripts?.[script];
    if (got === undefined) { check(`${script}: Word read the lines back`, null, 'an answer'); continue; }
    const paragraphs = readParagraphs(documentPartOf(read(got.body))).filter(isVerseParagraph);
    const back = paragraphs.map((p) => canon(decodeRuns(mergeRuns(p.runs), script)));
    check(`${script}: every line came back as a line`, back.length, want.expect.length);
    const wrong = want.expect.map((e, i) => (back[i] === e ? null : want.texts[i]?.slice(0, 40))).filter((x) => x !== null);
    check(`${script}: every line reads back exactly — text and every mark`, wrong, []);
    check(`${script}: Word kept every hidden run of what a cluster cannot show`, said(paragraphs), want.markers);
    check(`${script}: and there were some to keep — the control`, want.markers > 0, true);
    /* WHAT WORD SAYS THE TEXT IS — with the hidden runs in it or not — is the
       question the add-in’s caret depends on (`locate` asks it per line).
       Recorded, not asserted: either answer is handled. */
    const shown = paragraphs.map((p) => p.runs.filter((r) => r.hidden !== true).map((r) => r.text).join('')).join('');
    const told = [...(got.text ?? '')].filter((ch) => ch.charCodeAt(0) > 31).length;
    console.log(`  --   ${script}: Word’s text of the lines is ${told} characters, ${shown.length} of them shown — `
      + (told === shown.length ? 'it leaves the hidden runs out' : 'it counts the hidden runs'));
  }
}
