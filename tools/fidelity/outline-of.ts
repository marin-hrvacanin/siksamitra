/**
 * THE OUTLINE THE AGENT WOULD WRITE FOR ONE OF HIS PDFs — read off the page.
 *
 * His PDF is read as a person's file is (`importFile`), and everything the
 * agent's outline can say is taken from it: the name, the tradition under it,
 * the source lines, each verse's letters and svaras as a witness gives them —
 * `invertVerse`, nothing the rules place, and his virāma tick left for the
 * agent's own line convention to put back — its note above, its notes at the
 * ends of lines, whether it is numbered, its paragraphs and its translation's.
 * So `bot-page.ts` measures the page the bot makes from the best outline it
 * could be given, and what differs is the program's, not the outline's.
 */
import { importFile } from '../../packages/cli/src/import-file.js';
import { invertVerse } from '@siksamitra/engine';
import type { ChantToken, ChantVerse } from '@siksamitra/format';
import type { Outline, OutlineSection, OutlineVerse } from '@siksamitra/agent';

/** A witness's line as a source would have it: its daṇḍas his, no virāma tick. */
const asSource = (l: string): string => l
  .replace(/ˎ\s*/g, ' ').replace(/\|\|/g, '॥').replace(/\|/g, '।')
  .replace(/\s*।/g, ' ।').replace(/\s*॥/g, ' ॥').replace(/॥ (\d+) ॥/, '॥ $1॥')
  .replace(/^ +/, '').replace(/ {2,}/g, ' ').trim();

const isNote = (t: ChantToken): boolean => t.t === 'text' && (t as { note?: true }).note === true;

function verseOf(v: ChantVerse): OutlineVerse {
  /* The notes at the ends of lines, a line each, and the verse without them. */
  const lineNotes: string[] = [''];
  const bare: ChantToken[] = [];
  for (const t of v.tokens) {
    if (t.t === 'br') lineNotes.push('');
    if (isNote(t)) { lineNotes[lineNotes.length - 1] = (t as { s: string }).s.trim(); continue; }
    bare.push(t);
  }
  const lines = invertVerse(bare).accented.map(asSource);
  const translation = v.translation?.en;
  const tLines = translation === undefined ? 0 : translation.split('\n').length;
  return {
    lines,
    ...(translation === undefined ? {} : { translation }),
    ...(v.source === undefined ? {} : { note: v.source }),
    ...(v.tokens.some((t) => t.t === 'num') ? {} : { numbered: false }),
    ...(lineNotes.some((n) => n !== '') ? { lineNotes } : {}),
    paragraphs: v.paragraphs ?? [lines.length],
    ...(tLines === 0 ? {} : { translationParagraphs: v.translation?.paragraphs ?? [tLines] }),
  };
}

/** His PDF, as the outline the agent would write for it. */
export function outlineOfPdf(path: string): Outline {
  const { doc } = importFile(path);
  const [first, ...rest] = doc.sections;
  const sections: OutlineSection[] = [];
  if (first !== undefined) sections.push({ verses: first.verses.map(verseOf) });
  for (const s of rest) {
    sections.push({
      ...(s.title === '' ? {} : { title: s.title }),
      ...(s.source === undefined ? {} : { cite: s.source }),
      verses: s.verses.map(verseOf),
    });
  }
  /* His remark under the heading: a note in body text, before the first verse. */
  const remark = [
    ...(doc.front ?? []).filter((n) => n.comment === 'body').map((n) => n.text.en ?? ''),
    ...(first?.items ?? []).filter((it) => it.t === 'instruction' && it.instruction.comment === 'body')
      .map((it) => (it.t === 'instruction' ? it.instruction.text.en ?? '' : '')),
  ].filter((t) => t !== '').join('\n');
  return {
    title: doc.title,
    ...(first?.title ? { subtitle: first.title } : {}),
    ...(first?.source ? { locus: first.source } : {}),
    ...(remark === '' ? {} : { remark }),
    sections,
  };
}
