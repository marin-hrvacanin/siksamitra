/**
 * RE-DERIVE A DOCUMENT — the one command that applies the rules again after a
 * ruling changes (`sm derive --write`).
 *
 * Every verse that carries a source layer is derived again EXACTLY as its own
 * document says it should be: under its own register chain (`profileChain`,
 * the editor's — document, section, verse), from its accented witness when it
 * has one, with the author's hand overrides applied, and keeping the spacing
 * the original sets around its daṇḍas (`keepSpacingOf`). The verb used to
 * derive every verse under ONE register from the command line, with no
 * witness and no overrides — it would have stripped the svaras and the hand
 * marks from any document it wrote, and it never wrote, because it ignored
 * `--write`. A transcribed verse (no source layer) is left alone.
 */
import { derive, resolveProfile } from '@siksamitra/engine';
import type { Profile } from '@siksamitra/engine';
import { profileChain } from '@siksamitra/edit';
import { withVerses } from '@siksamitra/format';
import type { ChantDoc } from '@siksamitra/format';
import { keepSpacingOf } from './verse-diff.js';

export interface Rederived {
  doc: ChantDoc;
  derived: number;
  frozen: number;
  warnings: string[];
}

/** `force`: a register given on the command line, which then wins over the document's. */
export function rederive(doc: ChantDoc, force?: Profile): Rederived {
  let derived = 0;
  let frozen = 0;
  const warnings: string[] = [];
  const sections = doc.sections.map((section) => withVerses(section, section.verses.map((v) => {
    const src = v.src;
    if (src?.lines === undefined || src.lines.length === 0) { frozen += 1; return v; }
    const profile = force ?? resolveProfile(profileChain(v, section, doc.profile));
    const d = derive(
      { lines: [...src.lines], ...(src.accented === undefined ? {} : { accented: [...src.accented] }) },
      profile,
      { verseId: v.id, verseN: v.n ?? null, overrides: doc.overrides ?? [], trace: false },
    );
    derived += 1;
    for (const w of d.warnings) warnings.push(`${v.id}: ${w.message}`);
    return { ...v, tokens: keepSpacingOf(d.tokens, v.tokens) };
  })));
  return { doc: { ...doc, sections }, derived, frozen, warnings };
}
