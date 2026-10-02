/**
 * THE REGISTERS THE PARTS SAID, as the app keeps them: a register every verse
 * of the document was marked in is the DOCUMENT's, and one every verse of a
 * section was is the SECTION's — the shape `exportWord` writes them from, so a
 * document goes out and comes back the same. A verse in a part its section
 * does not share keeps its own. Outside every part, the document's recorded
 * register marks a verse, and when there is none nothing is said: the app's
 * default is the add-in's.
 *
 * Out of `build-document.ts` when that file reached the 400-line limit.
 */
import type { ChantProfileKey, ChantSection, ChantVerse } from '@siksamitra/format';

export function registersOf(
  sections: readonly ChantSection[], registers: ReadonlyMap<ChantVerse, ChantProfileKey | null>,
  /** What marks a verse in no part: the document's recorded register. */
  outside: ChantProfileKey | null,
): { sections: ChantSection[]; register: ChantProfileKey | null } {
  const of = (v: ChantVerse): ChantProfileKey | null => registers.get(v) ?? outside;
  const shared = (regs: readonly (ChantProfileKey | null)[]): ChantProfileKey | null =>
    (regs.length > 0 && regs.every((r) => r !== null && r === regs[0]) ? regs[0]! : null);
  const whole = shared(sections.flatMap((s) => s.verses.map(of)));
  if (whole !== null) return { sections: [...sections], register: whole };
  return {
    register: null,
    sections: sections.map((s) => {
      const regs = s.verses.map(of);
      const one = shared(regs);
      if (one !== null) return { ...s, profile: { preset: one } };
      if (regs.every((r) => r === null)) return s;
      const verses = s.verses.map((v) => (of(v) === null ? v : { ...v, profile: { preset: of(v)! } }));
      const byId = new Map(verses.map((v) => [v.id, v]));
      return {
        ...s,
        verses,
        ...(s.items === undefined ? {} : {
          items: s.items.map((it) => (it.t === 'verse' ? { t: 'verse' as const, ...(byId.get(it.id) ?? it) } : it)),
        }),
      };
    }),
  };
}
