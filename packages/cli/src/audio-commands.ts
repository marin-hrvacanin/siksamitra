/**
 * MAPPING A RECORDING, from the command line.
 *
 * The reader has always been able to play a mapping — a verse, a pāda, the
 * line lit as it is sung — and nothing could ever make one, so every recording
 * in the corpus was mapped by hand or not at all. Fifty pādas is an afternoon
 * with a stopwatch, which is why most of them were not.
 *
 * WHAT THIS DOES. It listens for the breaths, works out what share of the time
 * each pāda's syllables are owed, and matches the two. Where a boundary lands
 * on a breath it is heard; where there is no breath near it, it is the
 * arithmetic's guess and is reported as one. That is not as good as a forced
 * aligner and does not pretend to be — `--report` writes the per-pāda source
 * so the doubtful ones can be fixed by hand or by a better aligner later.
 *
 * COMPRESSED AUDIO. Uncompressed WAV is read here; anything else is handed to
 * `ffmpeg` if the machine has one. Shipping a codec in a program for marking
 * text would be absurd, and the browser — where the editor lives — decodes
 * everything already.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import {
  checkMapping, confidence, decodeWav, detectSilences, mapPadas, padasOf, writeMapping,
  type Decoded, type MappedPada,
} from '@siksamitra/audio';
import { writeChantFile, type ChantDoc } from '@siksamitra/format';
import type { EditContext } from './edit-shared.js';

export const AUDIO_HELP = `Audio

  audio map <doc.json>       map a recording onto the text: which second is which pāda
                             --file <audio> [--section <id>] [--from <s>] [--to <s>]
                             [--report <path>] [--write]
  audio check <doc.json>     is the mapping in this document usable?
  audio show <doc.json>      what the document says about its audio, per verse

  --file <path>              the recording. WAV directly; anything else via ffmpeg
  --from / --to <seconds>    where the recitation starts and ends in the file
  --sensitivity <dB>         how quiet counts as a breath, below the peak (default 32)
  --gap <seconds>            the shortest gap that counts as one (default 0.18)
  --snap <seconds>           how far a boundary may move to reach a breath (default 1.2)
  --report <path>            write the per-pāda result, including which were guessed`;

/** Read any audio file the machine can be persuaded to decode. */
function load(ctx: EditContext, file: string): Decoded {
  if (!existsSync(file)) ctx.die(2, `no such file: ${file}`);
  if (extname(file).toLowerCase() === '.wav') {
    try {
      return decodeWav(new Uint8Array(readFileSync(file)));
    } catch (e) {
      /* A WAV that is really a compressed stream in a WAV container falls
         through to ffmpeg rather than failing — the extension lied, not the
         person. */
      if (!hasFfmpeg()) ctx.die(2, `${file}: ${(e as Error).message}`);
    }
  }
  if (!hasFfmpeg()) {
    ctx.die(
      2,
      `${basename(file)} is not an uncompressed WAV, and ffmpeg is not on this machine.\n`
      + '  Convert it first:  ffmpeg -i <file> -ac 1 -ar 16000 out.wav',
    );
  }
  /*
   * 16 kHz MONO. The analysis is loudness over 20 ms windows, so the sample
   * rate above about 8 kHz buys nothing and costs the whole decode — a 40
   * minute Rudram at 44.1 kHz stereo is 400 MB of floats for a measurement
   * that cannot see the difference.
   */
  const out = join(tmpdir(), `sm-audio-${process.pid}.wav`);
  const run = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-y', '-i', file, '-ac', '1', '-ar', '16000', '-f', 'wav', out],
    { encoding: 'utf8' },
  );
  if (run.status !== 0) ctx.die(2, `ffmpeg could not read ${basename(file)}: ${run.stderr.trim()}`);
  try {
    return decodeWav(new Uint8Array(readFileSync(out)));
  } finally {
    try { unlinkSync(out); } catch { /* a leftover temp file is not an error */ }
  }
}

const hasFfmpeg = (): boolean =>
  spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0;

const clock = (t: number): string => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
};

export function runAudioVerb(verb: string, ctx: EditContext): void {
  const doc = ctx.readDoc(ctx.path);
  switch (verb) {
    case 'map': return map(ctx, doc);
    case 'check': return check(ctx, doc);
    case 'show': return show(ctx, doc);
    default: return ctx.die(2, `audio: no such command "${verb}" — map, check or show`);
  }
}

function map(ctx: EditContext, doc: ChantDoc): void {
  const file = ctx.flag('file');
  if (file === undefined) ctx.die(2, 'audio map needs --file <recording>');

  const sectionId = ctx.flag('section');
  const sections = sectionId === undefined
    ? doc.sections
    : doc.sections.filter((s) => s.id === sectionId);
  if (sections.length === 0) ctx.die(2, `no section "${sectionId ?? ''}" in this document`);

  const audio = load(ctx, file);
  ctx.say(`  ${basename(file)} — ${clock(audio.duration)}, ${audio.rate} Hz`);

  const gaps = detectSilences(audio.pcm, audio.rate, {
    ...(ctx.flag('sensitivity') === undefined
      ? {} : { belowPeakDb: Number(ctx.flag('sensitivity')) }),
    ...(ctx.flag('gap') === undefined ? {} : { minSilence: Number(ctx.flag('gap')) }),
  });
  ctx.say(`  ${gaps.length} breath(s) found`);

  /*
   * WHERE THE RECITATION STARTS, if nobody said.
   *
   * A take almost always opens with room tone — the recorder was running
   * before the voice was. Taking the file's start as the chant's start gives
   * the first pāda that silence, and every boundary after it drifts. So a
   * leading gap is trimmed unless `--from` overrules it.
   */
  const head = gaps[0];
  const tail = gaps[gaps.length - 1];
  const from = ctx.flag('from') !== undefined
    ? Number(ctx.flag('from'))
    : (head !== undefined && head.start <= 0.05 ? head.end : 0);
  const to = ctx.flag('to') !== undefined
    ? Number(ctx.flag('to'))
    : (tail !== undefined && tail.end >= audio.duration - 0.05 ? tail.start : audio.duration);

  const padas = sections.flatMap((s) => padasOf(s));
  if (padas.length === 0) ctx.die(2, 'there is nothing chanted in the section(s) named');

  const mapped = mapPadas(padas, audio.duration, gaps, {
    from,
    to,
    ...(ctx.flag('snap') === undefined ? {} : { snapWithin: Number(ctx.flag('snap')) }),
  });

  const named = basename(file);
  const next = writeMapping(doc, named, mapped, { duration: Math.round(audio.duration * 100) / 100 });
  const heard = confidence(mapped);

  ctx.say(`  ${padas.length} pāda(s) over ${clock(from)}–${clock(to)}`);
  ctx.say(`  ${Math.round(heard * 100)}% landed on a breath; the rest are evenly spaced`);
  for (const m of mapped) {
    ctx.say(`    ${m.from === 'breath' ? ' ' : '?'} ${m.verseId}.${m.line + 1}  `
      + `${clock(m.start)} – ${clock(m.end)}`);
  }

  const report = ctx.flag('report');
  if (report !== undefined) {
    writeFileSync(report, `${JSON.stringify({ file: named, confidence: heard, padas: mapped }, null, 2)}\n`, 'utf8');
    ctx.say(`  report -> ${report}`);
  }

  ctx.emit({
    ok: true,
    file: named,
    duration: audio.duration,
    breaths: gaps.length,
    confidence: heard,
    padas: mapped,
  });

  save(ctx, next);
}

function save(ctx: EditContext, next: ChantDoc): void {
  const out = ctx.flag('out') ?? (ctx.has('write') ? ctx.path : null);
  if (out === null) {
    ctx.say('  not saved — add --write to save it, or --out <path>.');
    return;
  }
  writeFileSync(out, `${writeChantFile(next)}\n`, 'utf8');
  ctx.say(`  -> ${out}`);
}

function check(ctx: EditContext, doc: ChantDoc): void {
  const problems = checkMapping(doc);
  ctx.emit({ ok: problems.length === 0, problems });
  if (problems.length === 0) {
    const n = Object.keys(doc.recording?.byVerse ?? {}).length;
    ctx.say(n === 0 ? '  this document has no mapping.' : `  the mapping is sound — ${n} verse(s).`);
    return;
  }
  for (const p of problems) ctx.say(`  ${p.verseId}: ${p.why}`);
  ctx.say(`\n  ${problems.length} problem(s).`);
  process.exit(1);
}

function show(ctx: EditContext, doc: ChantDoc): void {
  const rows = Object.entries(doc.recording?.byVerse ?? {});
  ctx.emit({ base: doc.audioBase ?? null, byVerse: doc.recording?.byVerse ?? {} });
  if (rows.length === 0) { ctx.say('  no audio.'); return; }
  if (doc.audioBase !== undefined) ctx.say(`  files are under ${doc.audioBase}`);
  for (const [verseId, raw] of rows) {
    const row = raw as { file: string; lines?: { start: number; end: number }[] };
    const lines = row.lines ?? [];
    const span = lines.length === 0
      ? '(no offsets — the whole file)'
      : `${clock(lines[0]!.start)} – ${clock(lines[lines.length - 1]!.end)}, ${lines.length} pāda(s)`;
    ctx.say(`  ${verseId.padEnd(8)} ${row.file.padEnd(28)} ${span}`);
  }
}

/** Exported for the help text; the verbs themselves are dispatched by name. */
export const AUDIO_VERBS = ['map', 'check', 'show'] as const;

/** Kept for callers that want to know without running one. */
export const isAudioVerb = (v: string): boolean =>
  (AUDIO_VERBS as readonly string[]).includes(v);

export type { MappedPada };
