/**
 * A v1 `.smdoc` becomes a v2 document — by DERIVING it, not by translating it.
 *
 * The import reads v1's HTML into two things (see `content.ts`): the letters,
 * and the list of marks v1 drew on them. Then the engine derives the marks
 * from the letters. Where the two agree — which is the normal case, since v1's
 * rules are the ones this engine was ported from — the imported verse is a
 * DERIVED verse: it has a source layer, it is editable, and a rule fix rolls
 * forward through it.
 *
 * Where they disagree, v1's decision is kept as an override with
 * `provenance: 'v1 .smdoc'`, and the verse still becomes derived. Nothing is
 * silently normalised to what this engine would rather have said: the whole
 * point of importing someone's twenty years of marked texts is that their
 * decisions survive.
 *
 * Where the letters themselves cannot be re-derived into the same syllables,
 * the verse is imported as TRANSCRIBED — no source layer, marks exactly as v1
 * drew them — and rule zero then protects it from ever being re-derived. That
 * is the honest fallback, and the count is reported.
 */
import { derive, parseLetters, resolveProfile } from '@siksamitra/engine';
import type { Profile } from '@siksamitra/engine';
import { canonicalJson } from '@siksamitra/format';
import type {
  ChantDoc, ChantOverride, ChantSection, ChantSyllable, ChantToken, ChantVerse,
} from '@siksamitra/format';
import { parseSmdocContent, type SmdocBlock, type SmdocLine, type SmdocMark } from './content.js';
import { readSmdoc, type SmdocFile, type SmdocInflate } from './container.js';

export interface ImportReport {
  /** Verses whose marks the engine reproduced exactly. */
  derived: number;
  /** Verses that needed an override to reproduce v1's marks, and how many. */
  withOverrides: number;
  overrides: number;
  /** Verses imported as transcribed, because the letters do not re-derive. */
  transcribed: { verseId: string; why: string }[];
  /** Audio v1 had inlined as base64, extracted as bytes. */
  audio: { id: string; mime: string; bytes: number }[];
  /** Headings and translations carried across. */
  headings: number;
  translations: number;
}

export interface ImportResult {
  doc: ChantDoc;
  /** `assets/…` for the package: audio, no longer inline. */
  assets: Record<string, Uint8Array>;
  report: ImportReport;
}

const slugOf = (title: string): string =>
  title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'imported';

const sylsOf = (tokens: readonly ChantToken[]): ChantSyllable[] =>
  tokens.filter((t): t is ChantSyllable => t.t === 'syl');

/** v1's marks, keyed by `(line, letter index within the line)`. */
type MarkIndex = Map<string, SmdocMark>;

function indexMarks(lines: readonly SmdocLine[]): MarkIndex {
  const out: MarkIndex = new Map();
  lines.forEach((line, l) => {
    for (const mark of line.marks) out.set(`${l}:${mark.at}`, mark);
  });
  return out;
}

/**
 * What the engine derived, keyed the same way.
 *
 * `SrcMap.units` is one entry per emitted letter with the line it came from, so
 * counting letters per line reproduces v1's own indexing without either side
 * having to know about the other.
 */
function indexDerived(
  spans: readonly { line: number; start: number }[],
  tokens: readonly ChantToken[],
): Map<string, { unit: number; mark: SmdocMark }> {
  const out = new Map<string, { unit: number; mark: SmdocMark }>();
  const perLine = new Map<number, number>();
  let unit = 0;
  for (const syl of sylsOf(tokens)) {
    for (const u of syl.units) {
      const span = spans[unit];
      if (span === undefined) { unit += 1; continue; }
      const at = perLine.get(span.line) ?? 0;
      perLine.set(span.line, at + 1);
      const mark: SmdocMark = { at };
      if (u.hold !== undefined) mark.hold = u.hold;
      if (u.change === true) mark.change = true;
      if (u.svara !== undefined) mark.svara = u.svara;
      if (u.sbhakti === true) mark.sbhakti = true;
      if (u.sup !== undefined) mark.sup = u.sup;
      out.set(`${span.line}:${at}`, { unit, mark });
      unit += 1;
    }
  }
  return out;
}

const FIELDS = ['hold', 'change', 'svara', 'sbhakti', 'sup'] as const;

/** One verse, imported. */
function importVerse(
  id: string,
  n: string | null,
  lines: readonly SmdocLine[],
  profile: Profile,
  report: ImportReport,
  overrides: ChantOverride[],
): ChantVerse {
  const src = {
    lines: lines.map((l) => l.source),
    ...(lines.some((l) => l.accents > 0)
      ? { accented: lines.map((l) => l.accented) }
      : {}),
  };

  const run = (extra: readonly ChantOverride[]) => derive(src, profile, {
    verseId: id,
    verseN: n,
    trace: false,
    overrides: [...overrides, ...extra],
  });

  const first = run([]);
  const wanted = indexMarks(lines);
  const got = indexDerived(first.srcMap.units, first.tokens);

  /*
   * The letters have to agree before a mark comparison means anything. If v1's
   * line has letters the engine did not emit, or the other way round, the two
   * are not talking about the same text and the verse is transcribed instead.
   */
  const v1Letters = lines.reduce((sum, l) => sum + countLetters(l), 0);
  const derivedLetters = got.size;
  if (v1Letters !== derivedLetters) {
    report.transcribed.push({
      verseId: id,
      why: `v1 has ${v1Letters} letters, the engine derives ${derivedLetters}`,
    });
    return frozenVerse(id, n, first.tokens, wanted, first.srcMap.units);
  }

  const added: ChantOverride[] = [];
  for (const [key, mark] of wanted) {
    const mine = got.get(key);
    if (mine === undefined) continue;
    const set: Record<string, unknown> = {};
    for (const field of FIELDS) {
      if (mark[field] === mine.mark[field]) continue;
      set[field] = mark[field] ?? null;
    }
    if (Object.keys(set).length === 0) continue;
    const span = first.srcMap.units[mine.unit];
    if (span === undefined) continue;
    added.push({
      at: { verse: id, line: span.line, letter: span.start },
      set,
      // v1 drew it and these rules do not. That is either an unsettled rule or
      // a defect in one of the two engines, and neither is ours to decide by
      // discarding the mark.
      why: 'source-witness',
      // The SOURCE at that offset, not the recited letter: they differ for
      // anything anusvāra or visarga sandhi produced, and the rebase checks
      // the source.
      ch: first.srcMap.lines[span.line]?.slice(span.start, span.end) ?? '',
      provenance: 'v1 .smdoc',
      note: 'imported from śikṣāmitra v1, which drew this mark where the rules do not',
    });
  }
  // A mark the ENGINE places that v1 did not is also a disagreement, and
  // suppressing it is what `null` is for.
  for (const [key, mine] of got) {
    if (wanted.has(key)) continue;
    const set: Record<string, unknown> = {};
    for (const field of FIELDS) {
      if (mine.mark[field] !== undefined) set[field] = null;
    }
    if (Object.keys(set).length === 0) continue;
    const span = first.srcMap.units[mine.unit];
    if (span === undefined) continue;
    added.push({
      at: { verse: id, line: span.line, letter: span.start },
      set,
      why: 'source-witness',
      ch: first.srcMap.lines[span.line]?.slice(span.start, span.end) ?? '',
      provenance: 'v1 .smdoc',
      note: 'imported from śikṣāmitra v1, which did NOT draw the mark the rules place here',
    });
  }

  const final = added.length === 0 ? first : run(added);
  overrides.push(...added);
  report.derived += 1;
  report.overrides += added.length;
  if (added.length > 0) report.withOverrides += 1;

  return {
    id,
    ...(n === null ? {} : { n }),
    tokens: final.tokens,
    src: { ...src, lines: [...final.srcMap.lines] },
    ...(src.accented === undefined ? {} : { svaraRegister: 'attested' as const }),
  };
}

/**
 * How many LETTERS a v1 line has.
 *
 * Letters, not characters: `bh`, `kh`, `ai` are one letter each and two
 * characters, and counting characters made every verse containing a digraph
 * look like a disagreement with the engine — 33 of Rudram's 37 verses were
 * being frozen for it. `parseLetters` is the engine's own splitter, so the two
 * sides count the same way by construction.
 */
const countLetters = (line: SmdocLine): number =>
  parseLetters(line.source).filter((l) => !STRUCTURE.test(l)).length;

/** Whitespace, the bars, a verse number's digits and dot: not letters. */
const STRUCTURE = /^[\s|.0-9०-९౦-౯௦-௯¦]+$/u;

/**
 * A verse the engine cannot re-derive: v1's marks, kept verbatim, no `src`.
 *
 * Rule zero then applies to it — it is a transcription, and this program will
 * refuse to re-derive it rather than replace evidence with a guess.
 */
function frozenVerse(
  id: string,
  n: string | null,
  tokens: readonly ChantToken[],
  wanted: MarkIndex,
  spans: readonly { line: number; start: number }[],
): ChantVerse {
  const perLine = new Map<number, number>();
  let unit = 0;
  const out = tokens.map((token): ChantToken => {
    if (token.t !== 'syl') return token;
    const units = token.units.map((u) => {
      const span = spans[unit];
      unit += 1;
      if (span === undefined) return u;
      const at = perLine.get(span.line) ?? 0;
      perLine.set(span.line, at + 1);
      const mark = wanted.get(`${span.line}:${at}`);
      if (mark === undefined) return { c: u.c, ...(u.cj === undefined ? {} : { cj: u.cj }) };
      return {
        c: u.c,
        ...(u.cj === undefined ? {} : { cj: u.cj }),
        ...(mark.hold === undefined ? {} : { hold: mark.hold }),
        ...(mark.change === true ? { change: true } : {}),
        ...(mark.svara === undefined ? {} : { svara: mark.svara }),
        ...(mark.sbhakti === true ? { sbhakti: true } : {}),
        ...(mark.sup === undefined ? {} : { sup: mark.sup }),
      };
    });
    return { ...token, units };
  });
  return { id, ...(n === null ? {} : { n }), tokens: out };
}

/** Turn the parsed blocks into sections, headings and verses. */
function assemble(
  blocks: readonly SmdocBlock[],
  title: string,
  profile: Profile,
): ImportResult {
  const report: ImportReport = {
    derived: 0, withOverrides: 0, overrides: 0, transcribed: [],
    audio: [], headings: 0, translations: 0,
  };
  const overrides: ChantOverride[] = [];
  const assets: Record<string, Uint8Array> = {};

  let docTitle = title;
  let subtitle: string | undefined;
  let source: string | undefined;
  const sections: ChantSection[] = [];
  let current: ChantSection | null = null;
  let counter = 0;

  const section = (): ChantSection => {
    if (current === null) {
      current = { id: `sec-${sections.length + 1}`, title: '', verses: [] };
      sections.push(current);
    }
    return current;
  };

  for (const block of blocks) {
    if (block.kind === 'heading') {
      report.headings += 1;
      if (block.level === 'title') { docTitle = block.text; continue; }
      if (block.level === 'subtitle') { subtitle = block.text; continue; }
      if (block.level === 'comment') { source = block.text; continue; }
      // A section heading starts a section; a subsection titles the one open.
      if (block.level === 'section') {
        current = { id: `sec-${sections.length + 1}`, title: block.text, verses: [] };
        sections.push(current);
        continue;
      }
      const open = section();
      if (open.title === '') open.title = block.text;
      continue;
    }

    if (block.kind === 'translation') {
      report.translations += 1;
      const open = section();
      const last = open.verses[open.verses.length - 1];
      // A translation paragraph belongs to the verse above it, which is where
      // v1 put it and how it reads.
      if (last !== undefined) last.translation = { en: block.text };
      continue;
    }

    if (block.kind === 'audio') {
      const bytes = decodeBase64(block.base64);
      const name = `audio/${block.id}.${extensionFor(block.mime)}`;
      assets[name] = bytes;
      report.audio.push({ id: block.id, mime: block.mime, bytes: bytes.byteLength });
      continue;
    }

    counter += 1;
    const open = section();
    open.verses.push(
      importVerse(`v-${counter}`, null, block.lines, profile, report, overrides),
    );
  }

  const doc: ChantDoc = {
    title: docTitle,
    titleForms: { iast: docTitle },
    sections: sections.filter((s) => s.verses.length > 0),
    version: 4,
    ...(subtitle === undefined ? {} : { subtitle }),
    ...(source === undefined ? {} : { source }),
    ...(overrides.length > 0 ? { overrides } : {}),
  };
  return { doc, assets, report };
}

function extensionFor(mime: string): string {
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('m4a') || mime.includes('mp4')) return 'm4a';
  if (mime.includes('webm')) return 'webm';
  return 'bin';
}

/** Base64 → bytes, without Node's Buffer: this runs in a browser too. */
function decodeBase64(text: string): Uint8Array {
  const clean = text.replace(/\s+/g, '');
  const binary = typeof atob === 'function'
    ? atob(clean)
    // eslint-disable-next-line no-undef
    : Buffer.from(clean, 'base64').toString('binary');
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export interface ImportOptions {
  /** The parametrization to derive under. The engine default otherwise. */
  profile?: Profile;
  /** Needed only for an `SMDI` file, whose payload is an XZ stream. */
  inflate?: SmdocInflate;
  /** A slug for the imported document; derived from the title otherwise. */
  slug?: string;
}

/** Import a v1 `.smdoc`, from its bytes. */
export async function importSmdoc(
  bytes: Uint8Array,
  options: ImportOptions = {},
): Promise<ImportResult & { file: SmdocFile; slug: string }> {
  const file = await readSmdoc(bytes, options.inflate);
  const blocks = parseSmdocContent(file.content ?? '');
  const profile = options.profile ?? resolveProfile([]);
  const title = file.meta?.title ?? 'Untitled';
  const result = assemble(blocks, title, profile);
  return {
    ...result,
    file,
    slug: options.slug ?? slugOf(result.doc.title || title),
  };
}

/** The document's canonical bytes — what a package stores and hashes. */
export const documentBytesOf = (doc: ChantDoc): Uint8Array =>
  new TextEncoder().encode(`${canonicalJson(doc)}\n`);
