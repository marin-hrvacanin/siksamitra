/**
 * Keeping the three layers of a verse in step: source, marks, tokens.
 *
 * A verse holds the same text three times over — the source lines the author
 * types, the hand-placed marks addressed into them, and the derived tokens the
 * renderer draws. An edit that updates one and not the others is exactly the
 * class of defect that made v1 untraceable, so the reconciliation is one
 * module with one order of operations:
 *
 *   1. change the source,
 *   2. rebase the marks onto it — reporting every one that could not follow,
 *   3. re-derive only the verses whose source actually changed.
 *
 * The order is not negotiable. Re-deriving before rebasing derives against
 * stale mark addresses, and rebasing after deriving means the tokens were
 * built from marks that had already moved.
 */
import { withVerses } from '@siksamitra/format';
import type { ChantDoc, ChantOverride, ChantSection, ChantVerse } from '@siksamitra/format';
import type { VerseSource } from './caret.js';
import { alignArrays, contiguousDiff } from './diff.js';
import { rebase, rebaseLines } from './rebase.js';
import { deriveVerse, type VerseReport } from './derive-verse.js';

export type LostMark = { override: ChantOverride; why: string };

/**
 * A stand-in source for an attested verse.
 *
 * An attested verse has no source and must not be re-derived, but it still has
 * to occupy space in the flat text — or the caret would skip over it and a
 * selection across it would silently exclude it, which is worse than either
 * allowing or forbidding the edit. So it contributes its RECITED text, and the
 * surface refuses edits that reach it, by name.
 */
export function linesFromTokens(verse: ChantVerse): string[] {
  const lines: string[] = [''];
  const put = (s: string): void => { lines[lines.length - 1] += s; };
  for (const t of verse.tokens) {
    if (t.t === 'br') lines.push('');
    else if (t.t === 'syl') put(t.iast);
    else if (t.t === 'text') put(t.placeholder === true ? '' : t.s);
    else if (t.t === 'sp') put(' ');
    else if (t.t === 'danda') put(t.s);
  }
  return lines;
}

export const sourcesOf = (section: ChantSection): VerseSource[] =>
  section.verses.map((v) => ({ id: v.id, lines: v.src?.lines ?? linesFromTokens(v) }));

/** Which verses a text change touched, by comparing sources. */
export function changedVerses(
  before: readonly VerseSource[],
  after: readonly VerseSource[],
): Set<string> {
  const out = new Set<string>();
  const was = new Map(before.map((v) => [v.id, v.lines.join('\n')]));
  for (const v of after) {
    if (was.get(v.id) !== v.lines.join('\n')) out.add(v.id);
  }
  return out;
}

/** Drop every override addressed to a verse or line that no longer exists. */
function forget(
  overrides: readonly ChantOverride[],
  matches: (ov: ChantOverride) => boolean,
  why: string,
  lost: LostMark[],
): ChantOverride[] {
  const kept: ChantOverride[] = [];
  for (const ov of overrides) {
    if (matches(ov)) lost.push({ override: ov, why });
    else kept.push(ov);
  }
  return kept;
}

/**
 * Rebase a section's overrides across a source change.
 *
 * The edit is RECOVERED from before/after rather than threaded through the
 * string surgery — see `diff.ts` for why that is the safer direction. Lines
 * that survived and changed are rebased and checked against the letter each
 * mark was placed on; lines that did not survive give up their marks loudly.
 */
export function rebaseSection(
  overrides: readonly ChantOverride[],
  before: readonly VerseSource[],
  after: readonly VerseSource[],
): { overrides: ChantOverride[]; lost: LostMark[] } {
  let current = [...overrides];
  const lost: LostMark[] = [];
  const byId = new Map(after.map((v) => [v.id, v]));

  for (const old of before) {
    const now = byId.get(old.id);
    if (now === undefined) {
      current = forget(
        current,
        (ov) => ov.at.verse === old.id,
        `verse "${old.id}" was deleted`,
        lost,
      );
      continue;
    }
    if (old.lines.join('\n') === now.lines.join('\n')) continue;

    const matched = alignArrays([...old.lines], [...now.lines]);
    // A whole line added or removed moves every later line's marks with it.
    current = rebaseLines(
      current, old.id, old.lines.length, now.lines.length - old.lines.length,
    );

    matched.forEach((target, index) => {
      const oldLine = old.lines[index]!;
      if (target === null) {
        current = forget(
          current,
          (ov) => ov.at.verse === old.id && ov.at.line === index,
          `line ${index} of "${old.id}" was replaced`,
          lost,
        );
        return;
      }
      // Move the line index first, then the offsets within it: applying both
      // to one override in the other order double-counts the line shift.
      if (target !== index) {
        current = current.map((ov) => (
          ov.at.verse === old.id && ov.at.line === index
            ? { ...ov, at: { ...ov.at, line: target } }
            : ov
        ));
      }
      const newLine = now.lines[target]!;
      const change = contiguousDiff(oldLine, newLine);
      if (change === null) return;
      const result = rebase(
        current,
        {
          verseId: old.id,
          line: target,
          from: change.from,
          to: change.to,
          insert: change.insert,
        },
        oldLine,
        newLine,
      );
      current = result.overrides;
      lost.push(...result.dropped);
    });
  }

  return { overrides: current, lost };
}

/**
 * Write the new sources into a section, in the new order.
 *
 * Order comes from `sources`, not from the old section: a paste that added a
 * verse in the middle must not append it at the end. A verse that survived
 * keeps every field that is not derived — `words`, `audioId`, `translation`,
 * the instructions — because none of them is this function's business.
 *
 * An attested verse's `src` is never written. It has none, and inventing one
 * from its own recited text is precisely the re-derivation rule zero forbids.
 */
export function writeSources(
  section: ChantSection,
  sources: readonly VerseSource[],
): ChantSection {
  const existing = new Map(section.verses.map((v) => [v.id, v]));
  const verses: ChantVerse[] = sources.map((s) => {
    const was = existing.get(s.id);
    if (was === undefined) return { id: s.id, tokens: [], src: { lines: [...s.lines] } };
    if (was.src === undefined) return was;
    return { ...was, src: { ...was.src, lines: [...s.lines] } };
  });
  // `withVerses` because a composed section keeps its verses in `items` too,
  // and `normalizeChantDoc` rebuilds `verses` from those — writing only
  // `verses` would discard the author's edit on the next load.
  return withVerses(section, verses);
}

/** Re-derive the named verses. The one place a verse's tokens are replaced. */
export function rederive(
  doc: ChantDoc,
  section: ChantSection,
  verseIds: ReadonlySet<string>,
  overrides: readonly ChantOverride[],
): { section: ChantSection; reports: VerseReport[]; refusals: string[] } {
  const reports: VerseReport[] = [];
  const refusals: string[] = [];
  const verses = section.verses.map((verse) => {
    if (!verseIds.has(verse.id)) return verse;
    const result = deriveVerse(verse, section, doc.profile, overrides);
    if (!result.ok) {
      refusals.push(result.why);
      return verse;
    }
    reports.push(result.report);
    return result.verse;
  });
  return { section: withVerses(section, verses), reports, refusals };
}
