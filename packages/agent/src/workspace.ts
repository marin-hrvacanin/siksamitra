/**
 * THE AGENT'S OWN INSTANCE OF ŚIKṢĀMITRA — a document, open, and the sources
 * it was made from.
 *
 * The owner: "just like it's using its own instance of the software... so
 * it's greatly deterministic". So nothing here edits a document itself. A
 * change is an `EditCommand` handed to `apply` in `@siksamitra/edit` — the
 * function a key press in the window runs — and a title is `setDocField`, the
 * function the command line runs. The rules are the engine's, run by the
 * `recompute` command, as the window's Re-apply rules runs them.
 *
 * WHAT THE MODEL READS of a document is short on purpose: an outline of ids
 * and first words, and a verse's letters only when it asks for them. A
 * document is never pasted whole into the conversation — that is what makes a
 * long session expensive and the prompt cache useless.
 *
 * WITNESSES are the texts a source gave: a page fetched, a file from the
 * library. A document built from one records which lines of which witness each
 * section is (`builtFrom`), so the check can compare the document's letters
 * with the source's without asking the model.
 */
import {
  apply, emptyHistory, newState, setDocField, type EditCommand, type EditState, type History, type Outcome,
} from '@siksamitra/edit';
import { CHANT_PROFILE_NOTES, toTextAndMarks, type ChantDoc, type ChantProfileKey, type ChantVerse } from '@siksamitra/format';
import { SVARA_CHAR } from '@siksamitra/interop';

/* Every Indic virāma: after one, a ZWNJ or ZWJ is the conjunct control. */
const VIRAMA = '्্੍્୍்్್്';
const HINT = new RegExp(`(?<![${VIRAMA}])[\\u200C\\u200D]|[\\u00AD\\u200B\\u2060\\uFEFF]`, 'gu');

/**
 * A SOURCE'S LINE AS LETTERS. A page carries characters that are no letter:
 * a joiner it sets for the glyph it wants (sanskritdocuments' श‍ृ), a soft
 * hyphen, a zero-width space, a byte-order mark, a no-break space. Kept, the
 * letter check held a delivered PDF to the page's `śa‍ृṇuṣva` — a vowel sign
 * stranded — and the bot shipped it because "the check requires the source's
 * own letters" (2026-10-02). So they go when a witness is kept, before
 * anything reads it; a joiner after a virāma stays, as the conjunct choice.
 */
export function cleanWitnessLine(line: string): string {
  return line.normalize('NFC').replace(HINT, '').replace(/ /gu, ' ');
}

export interface Witness {
  readonly id: string;
  /** Where it came from: a URL, or `library:<id>`. */
  readonly origin: string;
  readonly title: string;
  readonly lines: readonly string[];
}

/** Which witness lines a section was built from. */
export interface BuiltFrom {
  readonly witness: string;
  readonly from: number;
  readonly to: number;
  /**
   * The verse's lines as they went in — his word breaks, the source's svaras
   * — already held to the witness's letters when it was built (`spaced`).
   * `check` marks THESE beside the verse: the Ṛgveda's svara rules see where a
   * word ends, so the source's run-together line, marked, is not the verse
   * marked, though no letter differs (manyu sūktam, 2026-10-02).
   */
  readonly input?: readonly string[];
  /** Whole words of those lines the verse leaves out — a variant, a table's other column (`wordsLeftOut`). */
  readonly left?: readonly string[];
  /** The edition has the verse outside its metre, by the agent's word: the proofreader's metre finding is not made. */
  readonly irregular?: true;
  /** Words the base edition has wrong, read as another witness has them (`readings.ts`). */
  readonly readings?: readonly { readonly source: string; readonly read: string; readonly witness: string }[];
}

/** What a second reader said, and of which state of the document. */
export interface Review {
  /** `Workspace.revision` when it was asked. */
  readonly at: number;
  /** It found nothing wrong. */
  readonly clean: boolean;
  readonly said: string;
}

/**
 * Where the open document came from. `author` is a text whose marks are its
 * author's — a verified corpus document, one of the owner's own files — and
 * the rules are never run over it unasked: they would replace evidence with
 * their opinion (the first real run re-marked the verified Puruṣa Sūktam and
 * lost one of his holdings).
 */
export type Origin = 'built' | 'author';

export class Workspace {
  private state: EditState | null = null;
  /** Where the open document came from — see `Origin`. */
  origin: Origin | null = null;
  private history: History = emptyHistory();
  private seq = 0;
  readonly witnesses = new Map<string, Witness>();
  readonly builtFrom = new Map<string, BuiltFrom>();
  /**
   * What this request has spent on research — reset when a request begins
   * (`newRequest`). A real run (bhū sūktam, 2026-10-02) spent 18 of its 24
   * steps on seven searches and eleven pages, and ran out before delivering.
   */
  readonly spent = { searches: 0, pages: 0 };

  /** Each page read, by its address and what was found on it — so asking again is free. */
  readonly fetched = new Map<string, string>();
  /**
   * HOW MANY TIMES ITS LETTERS, VERSES OR MARKS HAVE CHANGED — a document
   * opened, a command run. A title or a note set (`setField`) is not counted:
   * what a review read is still what it read.
   */
  revision = 0;
  /** The second readers' answers, in order — what `deliver` holds the agent to. */
  readonly reviews: Review[] = [];

  /** A request begins: its research budget is whole again. */
  newRequest(): void { this.spent.searches = 0; this.spent.pages = 0; }

  get doc(): ChantDoc | null { return this.state?.doc ?? null; }

  /** The document, or the reason there is none — for a tool to say. */
  need(): ChantDoc {
    if (this.state === null) throw new Error('no document is open — build one or open one from the library first');
    return this.state.doc;
  }

  /**
   * The library text that is open, as it was opened — `open_text` says so.
   * While the document IS that one, untouched, `deliver` may send his own
   * file instead of a file made from it.
   */
  opened: { readonly id: string; readonly doc: ChantDoc } | null = null;

  open(doc: ChantDoc, origin: Origin = 'built'): void {
    this.revision += 1;
    this.state = newState(doc);
    this.history = emptyHistory();
    this.builtFrom.clear();
    this.origin = origin;
    this.opened = null;
  }

  /** A witness kept, under a fresh id — its lines as letters, the page's invisible hints taken off (`cleanWitnessLine`). */
  keep(origin: string, title: string, lines: readonly string[]): Witness {
    this.seq += 1;
    const w: Witness = { id: `w${this.seq}`, origin, title, lines: lines.map(cleanWitnessLine) };
    this.witnesses.set(w.id, w);
    return w;
  }

  /** Witnesses a saved session kept, under their own ids — the next one kept is numbered after them. */
  restoreWitnesses(witnesses: readonly Witness[]): void {
    for (const w of witnesses) {
      this.witnesses.set(w.id, w);
      const n = /^w(\d+)$/u.exec(w.id);
      if (n !== null) this.seq = Math.max(this.seq, Number(n[1]));
    }
  }

  /** One command through `apply`, and what it did in a line or two. */
  run(command: EditCommand): string {
    if (this.state === null) this.need();
    const { state, history } = apply(this.state as EditState, this.history, command);
    const changed = state.doc !== this.state!.doc;
    if (changed) this.revision += 1;
    this.state = state;
    this.history = history;
    const said: string[] = [];
    if (state.refusals.length > 0) said.push(`${changed ? 'cost' : 'refused'}: ${state.refusals.join('; ')}`);
    if (state.lostMarks.length > 0) said.push(`${state.lostMarks.length} mark(s) placed by hand could not be kept`);
    if (state.reports.length > 0) said.push(`${state.reports.length} verse(s) re-derived`);
    if (!changed && said.length === 0) said.push('nothing changed');
    return said.join('. ') || 'done';
  }

  /** A title, heading, translation or source line — `setDocField`'s allow-list. */
  setField(path: string, value: string | null): string {
    const done: Outcome<ChantDoc> = setDocField(this.need(), path, value);
    if (!done.ok) throw new Error(done.error);
    this.state = { ...(this.state as EditState), doc: done.value };
    return value === null ? `${path} cleared` : `${path} set`;
  }
}

/* ── what the model reads ──────────────────────────────────────────────── */

/**
 * A verse's letters as TYPED — each substitution undone, the letter its `was`
 * marking carries put back — with its svaras as the characters he types them
 * with. What the model compares with a source, which has the typed letters and
 * never the rules' substitutions. One pass from the end, so no edit moves
 * another; at one position the substitution goes first, so a svara written at
 * the end of a vowel lands before the letter that follows.
 */
export function verseLetters(v: ChantVerse, o: { prose?: boolean; names?: boolean } = {}): string {
  const tm = toTextAndMarks(v);
  /* `prose: false` — the MANTRA's letters: without the prose a line carries in
     his Comment face (a `plain` marking: "p.b. pṛśni̍r"), which is no
     source's. A real run's check read such a note as letters of the verse and
     called the verse wrong (2026-10-02). Taken out first at its place, so a
     svara that ends the vowel before it still lands there. */
  const prose = o.prose === false ? tm.marks.filter((m) => m.k === 'plain') : [];
  const inProse = (from: number, to: number): boolean => prose.some((p) => from >= p.from && to <= p.to && to > p.from);
  const edits = [
    ...prose.map((m) => ({ at: m.from, end: m.to, put: '', order: -1 })),
    ...tm.marks.filter((m) => m.k === 'was' && !inProse(m.from, m.to)).map((m) => ({ at: m.from, end: m.to, put: m.v ?? '', order: 0 })),
    ...tm.marks.filter((m) => m.k === 'svara' && m.v !== undefined && !inProse(m.to - 1, m.to))
      .map((m) => ({ at: m.to, end: m.to, put: SVARA_CHAR.get(m.v as never) ?? '', order: 1 })),
    /* `names`: a name's number, raised after it — as the model writes it:
       after the vowel's svara, before a letter the rules replaced. */
    ...(o.names === true ? tm.marks.filter((m) => m.k === 'sup' && /^[0-9]+$/u.test(m.v ?? ''))
      .map((m) => ({ at: m.to, end: m.to, put: [...m.v!].map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]).join(''), order: 0.5 })) : []),
  ].sort((a, b) => b.at - a.at || a.order - b.order);
  let text = tm.text;
  for (const e of edits) text = text.slice(0, e.at) + e.put + text.slice(e.end);
  return text;
}

/** How many marks of each kind a verse has: what the rules did, in a few words. */
export function marksSummary(v: ChantVerse): string {
  const counts = new Map<string, number>();
  for (const m of toTextAndMarks(v).marks) {
    if (m.k === 'syl') continue;
    const key = m.k === 'hold' ? `hold ${m.v ?? ''}`.trim() : m.k;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([k, n]) => `${n} ${k}`).join(', ') || 'no marks';
}

const registerName = (doc: ChantDoc, section?: { profile?: { preset?: string } }): string => {
  const key = (section?.profile?.preset ?? doc.profile?.preset) as ChantProfileKey | undefined;
  return key === undefined ? 'none set' : (CHANT_PROFILE_NOTES[key]?.name ?? key);
};

/** The document in a few lines: ids, titles, sources, first words. */
export function outlineOf(doc: ChantDoc, firstWords = 48): string {
  const out = [`"${doc.title}"${doc.source === undefined ? '' : ` · ${doc.source}`} — source: ${registerName(doc)}`];
  for (const s of doc.sections) {
    const own = s.profile?.preset === undefined ? '' : ` · source ${registerName(doc, s)}`;
    out.push(`${s.id}${s.part === undefined ? '' : ` [${s.part}]`} "${s.title ?? ''}"${s.source === undefined ? '' : ` · cite: ${s.source}`}${own} · ${s.verses.length} verse(s)`);
    for (const v of s.verses) {
      const letters = verseLetters(v).replace(/\n/g, ' / ');
      out.push(`  ${v.id}${v.n === undefined ? '' : ` (${v.n})`}: ${letters.length > firstWords ? `${letters.slice(0, firstWords)}…` : letters}`);
    }
  }
  return out.join('\n');
}

/** Verses in full: their letters line by line, and what is marked on them. */
export function versesOf(doc: ChantDoc, ids?: readonly string[], section?: string): string {
  const out: string[] = [];
  for (const s of doc.sections) {
    if (section !== undefined && s.id !== section) continue;
    for (const v of s.verses) {
      if (ids !== undefined && ids.length > 0 && !ids.includes(v.id)) continue;
      out.push(`${v.id}${v.n === undefined ? '' : ` (${v.n})`} [${marksSummary(v)}]`);
      for (const line of verseLetters(v).split('\n')) out.push(`  ${line}`);
      if (v.translation?.en !== undefined) out.push(`  — ${v.translation.en}`);
    }
  }
  return out.length === 0 ? 'no such verses' : out.join('\n');
}
