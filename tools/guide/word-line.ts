/**
 * A MARKED LINE, AS WORD SETS IT — the runs the add-in's writer puts in a
 * document (`paragraphRuns`), each drawn in its style: his `Translit` line in
 * Arial 16 pt, a holding his green border, a svara his dark red Palladio, a
 * substitution his blue, a pause one bar coloured by its length. Every value
 * is a Word token (`@siksamitra/tokens/word`), so the guide shows what a Word
 * document shows, and what Word hides — the record a cluster cannot show — is
 * not drawn here either.
 */
import type { TextAndMarks } from '@siksamitra/format';
import type { ScriptKey } from '@siksamitra/engine';
import { roleOf } from '@siksamitra/interop';
import { WORD_DEVANAGARI, WORD_MARKS, WORD_PARAGRAPHS } from '@siksamitra/tokens/word';
import { paragraphRuns } from '../../apps/word-addin/src/model/paragraph.js';

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The Word tokens, as the CSS variables `guide.css` draws with. */
export function wordVariables(): string {
  const line = WORD_PARAGRAPHS.find((p) => p.style === 'Translit')!;
  const D = WORD_DEVANAGARI;
  const hex = (c: string): string => `#${c}`;
  return `:root {
  --w-verse-size: ${line.size}pt; --w-verse-lead: ${line.leading ?? line.size * 1.5}pt;
  --w-hold: ${hex(WORD_MARKS.holdShort.color)}; --w-hold-short: ${WORD_MARKS.holdShort.weight}pt; --w-hold-long: ${WORD_MARKS.holdLong.weight}pt;
  --w-svara: ${hex(WORD_MARKS.svara.color)}; --w-svara-size: ${WORD_MARKS.svara.size}pt;
  --w-change: ${hex(WORD_MARKS.change.color)}; --w-pause: ${hex(WORD_MARKS.pause.color)};
  --w-dirgha: ${hex(WORD_MARKS.dirgha.color)}; --w-comment: ${hex(WORD_MARKS.comment.color)};
  --w-deva-face: '${D.paragraph.face}'; --w-deva-size: ${D.paragraph.size / 2}pt;
  --w-mark: ${hex(D.hold.color)}; --w-mark-face: '${D.hold.face}'; --w-mark-size: ${D.hold.size / 2}pt; --w-mark-raise: ${D.hold.raise / 2}pt;
  --w-aid: ${hex(D.aid.color)}; --w-aid-size: ${D.aid.size / 2}pt; --w-aid-raise: ${D.aid.raise / 2}pt;
}`;
}

/** The class a run is drawn with: its style's role, and the one-bar pause. */
function classOf(text: string, rStyle: string | null, superscript: boolean): string {
  const role = roleOf(rStyle);
  /* The short pause is one bar in the substitution blue, upright — the role
     alone would draw it as a changed letter in italics. */
  if (/^\s*\|\s*$/.test(text) && (role === 'change' || role === 'pause')) return role === 'pause' ? 'w-pause-long' : 'w-pause-short';
  return [`w-${role ?? 'plain'}`, superscript ? 'w-sup' : ''].filter((c) => c !== '').join(' ');
}

export function wordLine(tm: TextAndMarks, script: ScriptKey = 'iast'): string {
  const runs = paragraphRuns(tm, script)[0] ?? [];
  const body = runs.filter((r) => r.hidden !== true)
    .map((r) => `<span class="${classOf(r.text, r.rStyle, r.superscript)}">${esc(r.text)}</span>`).join('');
  return `<div class="w-doc"><p class="w-line w-line--${script}">${body}</p></div>`;
}
