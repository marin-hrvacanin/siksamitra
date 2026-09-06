#!/usr/bin/env tsx
/**
 * `vu-chant` — the headless face of the engine.
 *
 * Everything the editor can do is reachable from here, because both are thin
 * clients of the same engine over the same format. That is the requirement:
 * the owner authors documents by hand AND by handing the job to an agent, and
 * neither path may be able to do something the other cannot.
 *
 *   npx tsx tools/vu-chant.ts <command> [options]
 *
 * Every command takes `--json` (machine-readable on stdout, human on stderr).
 * Exit codes: 0 ok · 1 validation error · 2 bad input · 3 engine refusal.
 *
 * See specs/chant-editor/02-ENGINE.md §14.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import {
  PROFILES, derive, headword, normalize, resolveProfile, surfacesOf,
  transliterateSyllable, wordsAlign, type ScriptKey, type ScriptUnit,
  type Profile, type ProfileKey,
} from '@siksamitra/engine';
import { exportDocx, importDocx, pack, readManifest, unpack } from '@siksamitra/interop';
import {
  canonicalJson, normalizeChantDoc,
  type ChantDoc, type ChantSection, type ChantVerse,
} from '@siksamitra/format';

/** Stamped into every package so a reader can tell which engine produced it.
 *  Read from the workspace rather than repeated here — one version, one home. */
const ENGINE_VERSION = (
  JSON.parse(readFileSync(new URL('../../engine/package.json', import.meta.url), 'utf8')) as
    { version: string }
).version;

const argv = process.argv.slice(2);
const cmd = argv[0] ?? 'help';
const JSON_OUT = argv.includes('--json');

function flag(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
function positional(n: number): string | undefined {
  const rest = argv.slice(1).filter((a) => !a.startsWith('--'));
  // Drop values that belong to a flag.
  const flagValues = new Set<string>();
  argv.forEach((a, i) => {
    if (a.startsWith('--') && argv[i + 1] !== undefined && !argv[i + 1]!.startsWith('--')) {
      flagValues.add(argv[i + 1]!);
    }
  });
  return rest.filter((a) => !flagValues.has(a))[n];
}

/** Human output goes to stderr so `--json` stdout stays parseable. */
const say = (...a: unknown[]) => { if (!JSON_OUT) console.error(...a); };
const emit = (value: unknown) => {
  if (JSON_OUT) console.log(JSON.stringify(value, null, 2));
};
const die: (code: number, message: string) => never = (code, message) => {
  if (JSON_OUT) console.log(JSON.stringify({ error: message }));
  else console.error(`vu-chant: ${message}`);
  process.exit(code);
};

function readDoc(path: string): ChantDoc {
  if (!existsSync(path)) die(2, `no such file: ${path}`);
  return normalizeChantDoc(JSON.parse(readFileSync(path, 'utf8')) as ChantDoc);
}

function profileFor(): Profile {
  const preset = (flag('preset') ?? 'taittiriya') as ProfileKey;
  if (PROFILES[preset] === undefined) {
    die(2, `unknown preset "${preset}" — one of ${Object.keys(PROFILES).join(', ')}`);
  }
  const raw = flag('patch');
  let patch: Record<string, unknown> | undefined;
  if (raw !== undefined) {
    try { patch = JSON.parse(raw) as Record<string, unknown>; }
    catch { die(2, `--patch is not JSON: ${raw}`); }
  }
  return resolveProfile([{ preset, ...(patch === undefined ? {} : { patch }) }]);
}

/** Every verse of a document, with where it lives. */
function verses(doc: ChantDoc): { s: ChantSection; v: ChantVerse }[] {
  return doc.sections.flatMap((s) => s.verses.map((v) => ({ s, v })));
}

/**
 * The PRE-sandhi letters of a verse, reconstructed from its marked tokens.
 *
 * The file stores what is *recited*; the engine's holdings run BEFORE the
 * anusvāra/visarga substitutions (MARKING-RULES §7), so feeding the stored
 * letters back in measures a different input than the one that produced them.
 * Two things therefore have to be undone, and only these two:
 *
 *   - a `change` letter goes back to its trigger (`ṁ` or `ḥ`);
 *   - a `pause` token is DROPPED — the bīja pause and the vowel-hiatus pause
 *     are placed by the engine, so re-emitting one as `|` would put a saṁyukta
 *     barrier into the source that the author never wrote.
 *
 * Everything else on a unit — `sup`, `sbhakti`, `candra`, `svara` — is either
 * derived or attested, and neither belongs in the letters.
 */
function invert(v: ChantVerse): { lines: string[]; held: string[] } {
  const lines: string[] = [];
  const held: string[] = [];
  let line = '';
  for (const t of v.tokens) {
    if (t.t === 'syl') {
      for (const u of t.units) {
        let c = u.c;
        if (u.change === true) {
          if (['ṅ', 'ñ', 'ṇ', 'n', 'm'].includes(c)) c = 'ṁ';
          else if (['ś', 'ṣ', 's', 'r'].includes(c)) c = 'ḥ';
        }
        line += c;
        if (u.hold !== undefined) held.push(`${u.c}:${u.hold}`);
      }
    } else if (t.t === 'sp') line += ' ';
    else if (t.t === 'br') { lines.push(line.trim()); line = ''; }
    else if (t.t === 'danda') line += ` ${t.s === '॥' ? '||' : '|'} `;
  }
  if (line.trim() !== '') lines.push(line.trim());
  return { lines, held };
}

/**
 * THE measurement: re-derive every verse and compare the result with what the
 * document already says, letter by letter.
 *
 * One function, three views. `diff` reads the holdings out of it, `profile`
 * ranks candidate profiles by it, `roundtrip` prints all of it. They cannot
 * disagree about what "reproduced" means, because there is only one answer to
 * compare against.
 */
interface Score {
  /** Syllables compared, including those only one side has. */
  syllables: number;
  /** Syllables identical in every compared field and mark. */
  matched: number;
  /** Holdings alone — the coarse metric, kept because it is comparable to the
   *  Python generator's own self-test. */
  holdings: { agree: number; theirs: number; mine: number };
  /** Divergence kind → up to six examples, in document order. */
  divergences: Map<string, { count: number; examples: string[] }>;
  /** Svaras skipped because the verse is transcribed and they are attested. */
  attested: number;
}

interface ScoreOptions {
  /** Compare the Tamil column too. Off by default: the corpus's Tamil has
   *  never been checked by the owner, so a disagreement there says nothing
   *  about the engine. */
  tamil?: boolean;
}

const SCORED_MARKS = ['hold', 'hg', 'svara', 'change', 'sup', 'candra', 'sbhakti'] as const;

function score(doc: ChantDoc, profile: Profile, opts?: ScoreOptions): Score {
  const fields = opts?.tamil === true
    ? (['iast', 'deva', 'tel', 'tam'] as const)
    : (['iast', 'deva', 'tel'] as const);
  const divergences = new Map<string, { count: number; examples: string[] }>();
  const note = (key: string, example: string): void => {
    const row = divergences.get(key) ?? { count: 0, examples: [] };
    row.count += 1;
    if (row.examples.length < 6) row.examples.push(example);
    divergences.set(key, row);
  };
  const out: Score = {
    syllables: 0, matched: 0,
    holdings: { agree: 0, theirs: 0, mine: 0 },
    divergences, attested: 0,
  };

  type Syl = {
    iast: string; deva: string; tel?: string; tam?: string;
    units: Record<string, unknown>[];
  };

  for (const { v } of verses(doc)) {
    const { lines } = invert(v);
    if (lines.length === 0) continue;
    // A verse with no source layer is TRANSCRIBED: its svaras came off an
    // accented witness and exist nowhere in its letters. Comparing them
    // against a derivation measures rule zero, not the engine.
    const derivable = v.src?.lines !== undefined && v.src.lines.length > 0;
    const d = derive({ lines }, profile, { verseId: v.id, trace: false });
    const want = v.tokens.filter((t) => t.t === 'syl') as unknown as Syl[];
    const got = d.tokens.filter((t) => t.t === 'syl') as unknown as Syl[];

    for (const [a, b] of align(want, got, (x) => x.iast)) {
      out.syllables += 1;
      for (const u of a?.units ?? []) if (u['hold'] !== undefined) out.holdings.theirs += 1;
      for (const u of b?.units ?? []) if (u['hold'] !== undefined) out.holdings.mine += 1;
      if (a === null) { note('the engine adds a syllable', `${v.id}: "${b!.iast}"`); continue; }
      if (b === null) { note('the engine drops a syllable', `${v.id}: "${a.iast}"`); continue; }

      let clean = true;
      for (const f of fields) {
        const x = a[f];
        const y = b[f];
        // A column the file does not carry is not a divergence: the older
        // fragment tables shipped without `tel` and `tam`.
        if (x === undefined || y === undefined) continue;
        if (x !== y) { note(f, `${v.id} "${a.iast}": file "${x}" ≠ derived "${y}"`); clean = false; }
      }
      if (a.units.length !== b.units.length) {
        note('letters per syllable',
          `${v.id} "${a.iast}": ${a.units.length} letters in the file, ${b.units.length} derived`);
        clean = false;
      } else {
        for (let u = 0; u < a.units.length; u += 1) {
          const ua = a.units[u]!;
          const ub = b.units[u]!;
          const c = String(ua['c']);
          if (ua['c'] !== ub['c']) {
            note('letter', `${v.id} "${a.iast}": "${c}" ≠ "${String(ub['c'])}"`);
            clean = false;
          }
          for (const m of SCORED_MARKS) {
            // `hg` is a group id: what matters is whether the letter is in a
            // group, not which number the renumberer handed it.
            const x = m === 'hg' ? (ua['hg'] === undefined ? undefined : true) : ua[m];
            const y = m === 'hg' ? (ub['hg'] === undefined ? undefined : true) : ub[m];
            if (x === y) {
              if (m === 'hold' && x !== undefined) out.holdings.agree += 1;
              continue;
            }
            if (m === 'svara' && !derivable) { out.attested += 1; continue; }
            note(m, `${v.id} "${a.iast}" letter "${c}":`
              + ` file ${JSON.stringify(x)} ≠ derived ${JSON.stringify(y)}`);
            clean = false;
          }
        }
      }
      if (clean) out.matched += 1;
    }
  }
  return out;
}

/** Flatten a score's divergences for `--json` and for printing. */
function divergenceRows(s: Score): [string, { count: number; examples: string[] }][] {
  return [...s.divergences].sort((a, b) => b[1].count - a[1].count);
}

/**
 * Align two syllable sequences by their IAST, longest-common-subsequence.
 *
 * Index-by-index comparison is worthless here: one extra syllable near the
 * start of a verse — an avagraha the PDF transcription set apart, say — shifts
 * everything after it and reports forty divergences for one. Aligning first
 * means an insertion is reported as an insertion, and the letters on either
 * side of it are still compared.
 */
function align<T>(a: readonly T[], b: readonly T[], key: (x: T) => string):
  [T | null, T | null][] {
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = length of the LCS of a[i..] and b[j..]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i]![j] = key(a[i]!) === key(b[j]!)
        ? lcs[i + 1]![j + 1]! + 1
        : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: [T | null, T | null][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (key(a[i]!) === key(b[j]!)) { out.push([a[i]!, b[j]!]); i += 1; j += 1; }
    else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) { out.push([a[i]!, null]); i += 1; }
    else { out.push([null, b[j]!]); j += 1; }
  }
  while (i < n) { out.push([a[i]!, null]); i += 1; }
  while (j < m) { out.push([null, b[j]!]); j += 1; }
  return out;
}

/** A verse's own source lines, or its text reconstructed from tokens. */
function sourceOf(v: ChantVerse): string[] {
  const src = v.src;
  if (src?.lines !== undefined && src.lines.length > 0) return src.lines;
  const out: string[] = [];
  let line = '';
  for (const t of v.tokens) {
    if (t.t === 'syl') line += t.iast;
    else if (t.t === 'sp') line += ' ';
    else if (t.t === 'br') { out.push(line.trim()); line = ''; }
    else if (t.t === 'danda') line += ` ${t.s === '॥' ? '||' : '|'} `;
    // A `pause` token is DERIVED — the bīja pause and the vowel-hiatus pause
    // are placed by the engine, not written by the author. Emitting one as `|`
    // would put a saṁyukta barrier into the source that was never there.
  }
  if (line.trim() !== '') out.push(line.trim());
  return out;
}

const HELP = `vu-chant — the marking engine, headless

  mark "<iast>"              mark one fragment and print what it produces
  derive <doc.json>          re-derive every verse that carries a source layer
  diff <doc.json>            the engine's marks against the document's own
  profile <doc.json>         which profile reproduces this document
  roundtrip <doc.json>       re-derive and compare EVERY letter, mark and script
  validate <doc.json>        the document invariants
  words <doc.json>           every distinct word surface, with counts
  normalize "<text>"         fold any input to canonical IAST, reporting changes
  scripts <doc.json>         fill in the derived deva / tel / tam forms
  import <file>              read a marked .docx or .pdf into a chant document
  export <doc.json>          write a marked Word file
  stats <doc.json>           what the document contains
  corpus [dir]               score every document in a directory
  pack <doc.json>            write a .vuchant package
  unpack <file.vuchant>      expand one into a directory
  inspect <file.vuchant>     read a package's manifest without opening it

Options
  --preset <name>            taittiriya | rigveda | sukla-yajurveda | smarta | prose
  --patch '<json>'           field overrides on top of the preset
  --out <path>               where to write
  --template <path>          the Word template (default: the committed one)
  --assets <dir>             pack: a directory of audio / figures to carry along
  --original <file>          pack: the .docx or .pdf it was imported from
  --family auto|calibri|arial  import: which PDF reader (default: detect)
  --report <path>            import: where to write the ImportReport
  --scripts deva,tel         scripts: which columns to fill (default all three)
  --force                    scripts: overwrite forms that are already there
  --include-tam              compare the Tamil column too (it is unverified)
  --json                     machine-readable output on stdout

Exit codes: 0 ok · 1 validation error · 2 bad input · 3 engine refusal`;

switch (cmd) {
  /* ── mark one fragment ─────────────────────────────────────────────────── */
  case 'mark': {
    const text = positional(0);
    if (text === undefined) die(2, 'nothing to mark');
    const profile = profileFor();
    const d = derive({ lines: text!.split(' // ') }, profile, { trace: true });
    say(`\n  ${text}\n`);
    for (const t of d.tokens) {
      if (t.t !== 'syl') continue;
      const marks = t.units
        .map((u) => [
          u.hold !== undefined ? `hold:${u.hold}` : '',
          u.svara !== undefined ? `svara:${u.svara}` : '',
          u.change === true ? 'change' : '',
          u.sup !== undefined ? `sup:${u.sup}` : '',
          u.candra === true ? 'candra' : '',
          u.sbhakti === true ? 'sbhakti' : '',
        ].filter((x) => x !== '').join(' '))
        .map((m, i) => (m === '' ? '' : `${t.units[i]!.c} → ${m}`))
        .filter((x) => x !== '');
      say(`  ${t.iast.padEnd(8)} ${t.deva.padEnd(8)} ${marks.join(' · ')}`);
    }
    say(`\n  ${d.stats.syllables} syllables · ${d.stats.holdings} holdings`
      + ` · ${d.stats.svaras} svaras`);
    for (const w of d.warnings) say(`  ! ${w.message}`);
    emit({ tokens: d.tokens, stats: d.stats, warnings: d.warnings, trace: d.trace });
    break;
  }

  /* ── re-derive a document ──────────────────────────────────────────────── */
  case 'derive': {
    const path = positional(0);
    if (path === undefined) die(2, 'which document?');
    const doc = readDoc(path!);
    const profile = profileFor();
    let derived = 0;
    let frozen = 0;
    const warnings: string[] = [];
    for (const { v } of verses(doc)) {
      const src = v.src;
      if (src?.lines === undefined || src.lines.length === 0) {
        // A verse with no source layer is TRANSCRIBED: re-deriving it is
        // refused, not attempted (01 §2.3). Its svaras are attested and exist
        // nowhere in its letters.
        frozen += 1;
        continue;
      }
      const d = derive({ lines: src.lines }, profile, { verseId: v.id, trace: false });
      v.tokens = d.tokens;
      derived += 1;
      for (const w of d.warnings) warnings.push(`${v.id}: ${w.message}`);
    }
    say(`\n  ${derived} verses re-derived · ${frozen} transcribed and left alone`);
    for (const w of warnings.slice(0, 20)) say(`  ! ${w}`);
    const out = flag('out');
    if (out !== undefined) {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, `${JSON.stringify(doc)}\n`, 'utf8');
      say(`  → ${out}`);
    }
    emit({ derived, frozen, warnings });
    if (derived === 0 && frozen > 0) {
      die(3, 'every verse is transcribed — nothing to re-derive');
    }
    break;
  }

  /* ── the holdings view ─────────────────────────────────────────────────── */
  case 'diff': {
    const path = positional(0);
    if (path === undefined) die(2, 'which document?');
    const r = score(readDoc(path!), profileFor(), { tamil: argv.includes('--include-tam') });
    const { agree, theirs, mine } = r.holdings;
    const pct = theirs === 0 ? 0 : (agree / theirs) * 100;
    say(`\n  ${agree} of ${theirs} of the document's holdings reproduced (${pct.toFixed(1)}%)`);
    say(`  the engine places ${mine}`);
    const hold = r.divergences.get('hold');
    if (hold !== undefined) {
      say(`  ${hold.count} letters disagree:`);
      for (const e of hold.examples) say(`    ${e}`);
    }
    emit({ agree, theirs, mine, percent: Number(pct.toFixed(2)),
      divergences: hold?.examples ?? [] });
    break;
  }

  /* ── which profile produced this document ──────────────────────────────── */
  case 'profile': {
    const path = positional(0);
    if (path === undefined) die(2, 'which document?');
    const doc = readDoc(path!);
    const tamil = argv.includes('--include-tam');

    /**
     * The candidate space. Deliberately SMALL and declared: every entry is a
     * switch a shipped generator actually flipped, not a search over
     * everything a profile can express. A best fit found by brute force would
     * be a number, not an explanation — and the point of this command is to
     * tell an author which preset to write the next verse under.
     */
    const CANDIDATES: readonly { label: string; patch: Record<string, unknown> }[] = [
      { label: '', patch: {} },
      { label: ' −bīja-pause', patch: { pauses: { bija: false, hiatus: true } } },
      { label: ' −hiatus-pause', patch: { pauses: { bija: true, hiatus: false } } },
      { label: ' −both-pauses', patch: { pauses: { bija: false, hiatus: false } } },
      { label: ' +initial-box', patch: { holdings: { noInitialBox: false } } },
      { label: ' −bīja-pause +initial-box',
        patch: { pauses: { bija: false, hiatus: true }, holdings: { noInitialBox: false } } },
    ];

    const results: {
      name: string; percent: number; matched: number; syllables: number; worst: string;
    }[] = [];
    for (const preset of Object.keys(PROFILES) as ProfileKey[]) {
      for (const cand of CANDIDATES) {
        const r = score(doc, resolveProfile([{ preset, patch: cand.patch as never }]), { tamil });
        if (r.syllables === 0) continue;
        const rows = divergenceRows(r);
        results.push({
          name: `${preset}${cand.label}`,
          percent: (r.matched / r.syllables) * 100,
          matched: r.matched, syllables: r.syllables,
          worst: rows.length === 0 ? '' : `${rows[0]![0]} ${rows[0]![1].count}`,
        });
      }
    }
    results.sort((a, b) => b.percent - a.percent || a.name.length - b.name.length);
    const best = results[0];
    if (best === undefined) die(3, 'the document has nothing to measure against');
    say(`\n  ${doc.title}\n`);
    for (const r of results.slice(0, 8)) {
      say(`  ${r.percent === best.percent ? '→' : ' '} ${r.name.padEnd(34)}`
        + ` ${r.percent.toFixed(2)}%  (${r.matched}/${r.syllables})`
        + `${r.worst === '' ? '' : `  worst: ${r.worst}`}`);
    }
    say(`\n  best fit: ${best.name}`);
    emit({ best: best.name, percent: Number(best.percent.toFixed(2)), results });
    break;
  }

  /* ── everything ────────────────────────────────────────────────────────────
     `diff` scores holdings alone. This scores the syllable text in every
     verified script and every mark on every letter — the only measurement that
     says whether `derive` may be trusted with a document.                     */
  case 'roundtrip': {
    const path = positional(0);
    if (path === undefined) die(2, 'which document?');
    const doc = readDoc(path!);
    const tamil = argv.includes('--include-tam');
    const r = score(doc, profileFor(), { tamil });
    const pct = r.syllables === 0 ? 0 : (r.matched / r.syllables) * 100;
    say(`\n  ${doc.title}`);
    say(`  ${r.matched} of ${r.syllables} syllables reproduced exactly (${pct.toFixed(2)}%)`);
    if (r.attested > 0) {
      say(`  ${r.attested} attested svaras held out — this document has no source layer,`);
      say("  so its accents are a transcription and are not the engine's to reproduce");
    }
    if (!tamil) say("  Tamil held out — the corpus's Tamil is unverified (--include-tam)");
    const rows = divergenceRows(r);
    if (rows.length === 0) say('\n  every letter, every mark, every script: identical');
    else {
      say('');
      for (const [k, row] of rows) {
        say(`  ${String(row.count).padStart(6)}  ${k}`);
        for (const e of row.examples) say(`          ${e}`);
      }
    }
    emit({
      title: doc.title, syllables: r.syllables, matched: r.matched,
      percent: Number(pct.toFixed(2)), attestedSvarasHeldOut: r.attested,
      holdings: r.holdings,
      divergences: Object.fromEntries(rows),
    });
    if (rows.length > 0) process.exit(1);
    break;
  }

  /* ── fill in the derived script forms ───────────────────────────────────
     `vu-import` reads a PDF and writes IAST-only syllables, because the
     transliterator is TypeScript and porting it to Python would be a second
     transliterator — the one thing the corpus gate exists to prevent. This is
     the seam: the Python reads the marks, this fills the scripts.            */
  case 'scripts': {
    const path = positional(0);
    if (path === undefined) die(2, 'which document?');
    const doc = readDoc(path!);
    const only = flag('scripts');
    const want = (only === undefined
      ? ['deva', 'tel', 'tam']
      : only.split(',').map((x) => x.trim())) as ScriptKey[];
    const force = argv.includes('--force');

    let filled = 0;
    let kept = 0;
    const problems = new Map<string, number>();
    for (const { v } of verses(doc)) {
      for (const t of v.tokens) {
        if (t.t !== 'syl') continue;
        // Units carry the CONJUNCT CONTROLS, so transliterating from them
        // preserves a split the IAST string cannot express (01 §2.5).
        const units: ScriptUnit[] = t.units.map((u) => ({
          c: u.c,
          ...((u as { cj?: ScriptUnit['cj'] }).cj === undefined
            ? {}
            : { cj: (u as { cj?: ScriptUnit['cj'] }).cj }),
        }));
        for (const sc of want) {
          const before = t[sc];
          if (before !== undefined && before !== '' && !force) { kept += 1; continue; }
          const form = transliterateSyllable(units, sc);
          if (form === '') {
            const key = `${sc}: no form for "${t.iast}"`;
            problems.set(key, (problems.get(key) ?? 0) + 1);
            continue;
          }
          t[sc] = form;
          filled += 1;
        }
      }
    }

    say(`\n  ${filled} script forms filled · ${kept} already present and kept`);
    if (force) say('  --force: existing forms were overwritten');
    for (const [k, n] of [...problems].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      say(`  ! ${n}× ${k}`);
    }
    const out = flag('out') ?? path!;
    writeFileSync(out, `${canonicalJson(doc)}\n`, 'utf8');
    say(`  → ${out}`);
    emit({ filled, kept, problems: Object.fromEntries(problems), out });
    break;
  }

  /* ── the whole corpus at once ──────────────────────────────────────────── */
  case 'corpus': {
    const dir = positional(0) ?? 'corpus/chants';
    if (!existsSync(dir)) die(2, `no such directory: ${dir}`);
    const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
    if (files.length === 0) die(2, `no documents in ${dir}`);
    const tamil = argv.includes('--include-tam');
    const rows: {
      file: string; percent: number; matched: number; syllables: number; worst: string;
    }[] = [];
    say('');
    for (const f of files) {
      const doc = readDoc(join(dir, f));
      const r = score(doc, profileFor(), { tamil });
      const d = divergenceRows(r);
      const row = {
        file: f.replace(/\.json$/, ''),
        percent: r.syllables === 0 ? 100 : (r.matched / r.syllables) * 100,
        matched: r.matched, syllables: r.syllables,
        worst: d.length === 0 ? '' : `${d[0]![0]} ${d[0]![1].count}`,
      };
      rows.push(row);
      say(`  ${row.file.padEnd(26)} ${row.percent.toFixed(2).padStart(6)}%`
        + `  ${row.matched}/${row.syllables}`.padEnd(14) + row.worst);
    }
    const syllables = rows.reduce((n, r) => n + r.syllables, 0);
    const matched = rows.reduce((n, r) => n + r.matched, 0);
    const pct = (matched / syllables) * 100;
    say(`\n  ${matched} of ${syllables} syllables across ${rows.length} documents`
      + ` (${pct.toFixed(2)}%)`);
    say('  under one profile — `profile <doc>` finds each document\'s own');
    emit({ documents: rows, syllables, matched, percent: Number(pct.toFixed(2)) });
    break;
  }

  /* ── the portable package ──────────────────────────────────────────────── */
  case 'pack': {
    const path = positional(0);
    if (path === undefined) die(2, 'which document?');
    const doc = readDoc(path!);
    const slug = flag('slug') ?? basename(path!).replace(/\.json$/i, '');
    const out = flag('out') ?? `${slug}.vuchant`;

    // Assets are COPIED IN, never inlined. `--assets <dir>` walks a directory
    // and keeps its shape under `assets/`.
    const assets: Record<string, Uint8Array> = {};
    const assetDir = flag('assets');
    if (assetDir !== undefined) {
      if (!existsSync(assetDir)) die(2, `no such directory: ${assetDir}`);
      const walk = (d: string): void => {
        for (const name of readdirSync(d)) {
          const full = join(d, name);
          if (statSync(full).isDirectory()) walk(full);
          else assets[relative(assetDir, full).split(sep).join('/')] = new Uint8Array(readFileSync(full));
        }
      };
      walk(assetDir);
    }
    const originals: Record<string, Uint8Array> = {};
    const orig = flag('original');
    if (orig !== undefined) {
      if (!existsSync(orig)) die(2, `no such file: ${orig}`);
      originals[basename(orig)] = new Uint8Array(readFileSync(orig));
    }

    // The document's OWN bytes, not a re-serialisation: `document.json` in a
    // package must be what the web serves, and normalising fills `items` from
    // `verses` so a round trip would store every verse twice.
    const bytes = await pack(doc, {
      slug, engine: ENGINE_VERSION, assets, originals,
      documentBytes: new Uint8Array(readFileSync(path!)),
    });
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, bytes);
    const raw = JSON.stringify(doc).length;
    say(`\n  ${out} — ${(bytes.length / 1024).toFixed(0)} KB`);
    say(`  document ${(raw / 1024).toFixed(0)} KB → ${((bytes.length / raw) * 100).toFixed(0)}%`
      + ` of its JSON, with ${Object.keys(assets).length} asset(s) stored uncompressed`);
    emit({ out, bytes: bytes.length, documentBytes: raw, assets: Object.keys(assets).length });
    break;
  }

  case 'unpack': {
    const path = positional(0);
    if (path === undefined) die(2, 'which package?');
    if (!existsSync(path!)) die(2, `no such file: ${path}`);
    const bytes = new Uint8Array(readFileSync(path!));
    const pkg = await unpack(bytes).catch((e: unknown) => {
      die(1, e instanceof Error ? e.message : 'could not read the package');
      throw e;
    });
    const dir = flag('out') ?? pkg.manifest.slug;
    mkdirSync(join(dir, 'assets'), { recursive: true });
    writeFileSync(join(dir, 'document.json'), Buffer.from(pkg.documentBytes));
    writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(pkg.manifest, null, 2)}\n`);
    for (const [name, text] of Object.entries(pkg.source)) {
      mkdirSync(dirname(join(dir, 'source', name)), { recursive: true });
      writeFileSync(join(dir, 'source', name), text, 'utf8');
    }
    for (const [name, content] of Object.entries(pkg.assets)) {
      mkdirSync(dirname(join(dir, 'assets', name)), { recursive: true });
      writeFileSync(join(dir, 'assets', name), Buffer.from(content));
    }
    for (const [name, content] of Object.entries(pkg.originals)) {
      mkdirSync(join(dir, 'originals'), { recursive: true });
      writeFileSync(join(dir, 'originals', name), Buffer.from(content));
    }
    say(`\n  ${pkg.manifest.title}`);
    say(`  made by engine ${pkg.manifest.engine} on ${pkg.manifest.createdAt}`);
    say(`  document hash verified — ${pkg.manifest.docHash.slice(0, 16)}…`);
    say(`  → ${dir}/`);
    emit({ out: dir, manifest: pkg.manifest });
    break;
  }

  case 'inspect': {
    const path = positional(0);
    if (path === undefined) die(2, 'which package?');
    if (!existsSync(path!)) die(2, `no such file: ${path}`);
    const m = await readManifest(new Uint8Array(readFileSync(path!)));
    say(`\n  ${m.title}  (${m.slug})`);
    say(`  ${m.format} v${m.version} · engine ${m.engine} · ${m.createdAt}`);
    say(`  document ${(m.contents.documentBytes / 1024).toFixed(0)} KB`
      + ` · ${m.contents.assets} assets, ${(m.contents.assetBytes / 1024 / 1024).toFixed(1)} MB`);
    say(`  hash ${m.docHash}`);
    emit(m);
    break;
  }

  /* ── invariants ────────────────────────────────────────────────────────── */
  case 'validate': {
    const path = positional(0);
    if (path === undefined) die(2, 'which document?');
    const doc = readDoc(path!);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (doc.title === undefined || doc.title === '') errors.push('V-doc: no title');
    for (const s of doc.sections) {
      if ((s.title ?? s.label ?? '') === '') errors.push(`V06 ${s.id}: no title`);
      for (const v of s.verses) {
        const align = wordsAlign(v);
        if (!align.ok) {
          errors.push(
            `V05 ${v.id}: ${align.words} words but ${align.surfaces} surfaces`
            + ' — words[] is indexed positionally, so every popover after the'
            + ' drift describes the wrong word',
          );
        }
        for (const [k, w] of (v.words ?? []).entries()) {
          for (const g of w.entries) {
            if (headword(g).trim() === '') {
              warnings.push(`W-gram ${v.id} word ${k}: an entry with no lemma or root`);
            }
          }
        }
        for (const t of v.tokens) {
          if (t.t !== 'syl') continue;
          for (const u of t.units) {
            if (u.hold !== undefined && u.hg === undefined) {
              errors.push(`V01 ${v.id}: hold with no hg on "${u.c}"`);
            }
            if (u.hg !== undefined && u.hold === undefined) {
              errors.push(`V01 ${v.id}: hg with no hold on "${u.c}"`);
            }
            if (u.candra === true && u.c !== 'm') {
              warnings.push(`M04 ${v.id}: candra on "${u.c}", which is not m`);
            }
          }
          if (t.deva === undefined || t.deva === '') {
            warnings.push(`V13 ${v.id}: "${t.iast}" has no Devanāgarī`);
          }
        }
        // V09 — no rendered line long enough to wrap.
        for (const l of sourceOf(v)) {
          if (l.length > 60) warnings.push(`V09 ${v.id}: a line is ${l.length} characters`);
        }
      }
    }
    say(`\n  ${errors.length} errors · ${warnings.length} warnings`);
    for (const e of errors.slice(0, 30)) say(`  ✗ ${e}`);
    for (const w of warnings.slice(0, 15)) say(`  ! ${w}`);
    if (errors.length === 0 && warnings.length === 0) say('  the document is sound');
    emit({ ok: errors.length === 0, errors, warnings });
    if (errors.length > 0) process.exit(1);
    break;
  }

  /* ── the glossary keys ─────────────────────────────────────────────────── */
  case 'words': {
    const path = positional(0);
    if (path === undefined) die(2, 'which document?');
    const doc = readDoc(path!);
    const counts = new Map<string, number>();
    let parsed = 0;
    let total = 0;
    for (const { v } of verses(doc)) {
      // `surfacesOf` is the one definition of a word surface — the reader, the
      // editor and the validator all use it, so this cannot drift from them.
      for (const s of surfacesOf(v.tokens)) {
        counts.set(s.iast, (counts.get(s.iast) ?? 0) + 1);
        total += 1;
      }
      parsed += (v.words ?? []).filter((w) => w.entries.length > 0).length;
    }
    const rows = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    say(`\n  ${rows.length} distinct surfaces · ${total} words`
      + ` · ${parsed} analysed (${((parsed / Math.max(total, 1)) * 100).toFixed(0)}%)`);
    for (const [w, n] of rows.slice(0, 40)) say(`  ${String(n).padStart(4)}  ${w}`);
    emit({ distinct: rows.length, total, parsed, surfaces: Object.fromEntries(rows) });
    break;
  }

  /* ── normalisation, audited ────────────────────────────────────────────── */
  case 'normalize': {
    const text = positional(0);
    if (text === undefined) die(2, 'nothing to normalise');
    const r = normalize(text!);
    say(`\n  ${r.text}\n`);
    for (const c of r.changes) {
      say(`  ${c.count}× ${c.from} → ${c.to}${c.note === undefined ? '' : `  (${c.note})`}`);
    }
    if (r.changes.length === 0) say('  nothing changed');
    emit(r);
    break;
  }

  /* ── Word ──────────────────────────────────────────────────────────────── */
  case 'import': {
    const path = positional(0);
    if (path === undefined) die(2, 'which file?');
    if (!existsSync(path!)) die(2, `no such file: ${path}`);

    /**
     * A PDF goes to the Python reader, and this is not a compromise.
     *
     * `pdf_marks.py` and `pdf_marks_gana.py` are calibrated against two export
     * families and verified at 553/554 and 106/106 rows; one of them recovers
     * 93 letters an exporter flattened into vector paths and that are absent
     * from the text layer entirely. That calibration is the asset. What comes
     * back is IAST-only, and `scripts` fills the rest through the ONE
     * transliterator — so there is still exactly one of those.
     */
    if (/\.pdf$/i.test(path!)) {
      const out = flag('out') ?? `${basename(path!).replace(/\.pdf$/i, '')}.json`;
      const reportAt = flag('report');
      const args = [
        join('tools', 'chant', 'vu_import.py'),
        '--in', path!,
        '--out', out,
        ...(flag('family') === undefined ? [] : ['--family', flag('family')!]),
        ...(reportAt === undefined ? [] : ['--report', reportAt]),
        ...(flag('title') === undefined ? [] : ['--title', flag('title')!]),
      ];
      const r = spawnSync('python', args, { encoding: 'utf8' });
      if (r.error !== undefined) {
        die(2, 'python is not on PATH — PDF import needs Python with PyMuPDF,'
          + ' or the vu-import sidecar in the desktop app');
      }
      if (r.stderr !== '') say(r.stderr.trimEnd());
      if (r.status !== 0) process.exit(r.status ?? 4);

      // Fill the derived scripts in the same breath: an author who has to run
      // a second command to get Devanāgarī will one day forget, and a document
      // with no Devanāgarī renders as nothing in three of the four columns.
      const doc = readDoc(out);
      let filled = 0;
      for (const { v } of verses(doc)) {
        for (const t of v.tokens) {
          if (t.t !== 'syl') continue;
          const units = t.units.map((u) => ({ c: u.c }));
          for (const sc of ['deva', 'tel', 'tam'] as ScriptKey[]) {
            if (t[sc] !== undefined && t[sc] !== '') continue;
            const form = transliterateSyllable(units, sc);
            if (form !== '') { t[sc] = form; filled += 1; }
          }
        }
      }
      writeFileSync(out, `${canonicalJson(doc)}
`, 'utf8');
      say(`  ${filled} script forms filled by the engine`);
      say(`  → ${out}`);
      emit({ out, scriptFormsFilled: filled });
      break;
    }

    const bytes = new Uint8Array(readFileSync(path!));
    const title = flag('title') ?? basename(path!).replace(/\.docx$/i, '');
    const { doc, report } = importDocx(bytes, title);
    say(`\n  ${report.structure.paragraphs} paragraphs · ${report.structure.runs} runs`);
    say(`  → ${report.structure.sections} sections · ${report.structure.verses} verses`
      + ` · ${report.structure.syllables} syllables`);
    say(`  marks: ${Object.entries(report.marks).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
    if (report.unresolved.length > 0) {
      const kinds = new Map<string, number>();
      for (const u of report.unresolved) kinds.set(u.what, (kinds.get(u.what) ?? 0) + 1);
      say(`  ${report.unresolved.length} item(s) need a decision — nothing was guessed:`);
      for (const [what, n] of kinds) say(`    ${n}× ${what}`);
    }
    const out = flag('out');
    if (out !== undefined) {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, `${canonicalJson(doc)}\n`, 'utf8');
      say(`  → ${out}`);
    }
    emit({ report, ...(flag('out') === undefined ? { doc } : {}) });
    break;
  }

  case 'export': {
    const path = positional(0);
    if (path === undefined) die(2, 'which document?');
    const doc = readDoc(path!);
    const tpl = flag('template') ?? 'tools/chant/templates/vu-word-template.docx';
    if (!existsSync(tpl)) die(2, `no template at ${tpl} — run npm run gen:word-template`);
    const out = flag('out') ?? `${basename(path!).replace(/\.json$/i, '')}.docx`;
    const bytes = exportDocx(doc, new Uint8Array(readFileSync(tpl)));
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, bytes);
    say(`\n  ${out} — ${(bytes.length / 1024).toFixed(0)} KB`);
    say('  styles.xml, the theme and the fonts come from the template unchanged');
    emit({ out, bytes: bytes.length });
    break;
  }

  /* ── what is in here ───────────────────────────────────────────────────── */
  case 'stats': {
    const path = positional(0);
    if (path === undefined) die(2, 'which document?');
    const doc = readDoc(path!);
    let syl = 0;
    let units = 0;
    let words = 0;
    let translated = 0;
    let transcribed = 0;
    const holds = new Set<string>();
    const svaras = new Map<string, number>();
    for (const { s, v } of verses(doc)) {
      if (v.translation?.en !== undefined) translated += 1;
      words += v.words?.length ?? 0;
      const src = v.src;
      if (src?.lines === undefined || src.lines.length === 0) transcribed += 1;
      for (const t of v.tokens) {
        if (t.t !== 'syl') continue;
        syl += 1;
        for (const u of t.units) {
          units += 1;
          if (u.hg !== undefined) holds.add(`${s.id}/${v.id}/${u.hg}`);
          if (u.svara !== undefined) svaras.set(u.svara, (svaras.get(u.svara) ?? 0) + 1);
        }
      }
    }
    const vs = verses(doc).length;
    say(`\n  ${doc.title}`);
    if (doc.source != null) say(`  ${doc.source}`);
    say(`\n  ${doc.sections.length} sections · ${vs} verses · ${syl} syllables · ${units} letters`);
    say(`  ${holds.size} holdings · ${[...svaras].map(([k, n]) => `${k} ${n}`).join(' · ')}`);
    say(`  ${words} words parsed · ${translated} of ${vs} verses translated`);
    say(`  ${transcribed} transcribed (frozen) · ${vs - transcribed} derived`);
    emit({
      title: doc.title, sections: doc.sections.length, verses: vs, syllables: syl,
      letters: units, holdings: holds.size, svaras: Object.fromEntries(svaras),
      words, translated, transcribed,
    });
    break;
  }

  default:
    console.error(HELP);
    process.exit(cmd === 'help' || cmd === '--help' ? 0 : 2);
}
