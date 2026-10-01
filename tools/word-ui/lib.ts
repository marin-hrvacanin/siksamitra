/**
 * WHAT THE REAL-WORD SCENARIOS SHARE — driving Word, and reading what it holds.
 *
 * `drive` hands a plan to `drive.ps1`, which places text and selections
 * through COM and runs each command in the add-in's own runtime
 * (`press.mjs`); `lines` reads the document back with the add-in's own reader.
 * An expectation is never computed by the code under test's Word half: it is
 * the engine's answer for the TEXT, or what the line was before (rule 9).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChantProfileKey, TextAndMarks } from '@siksamitra/format';
import { mergeRuns, paragraphXml, readParagraphs, scriptOfLine } from '@siksamitra/interop';
import { STAGES, conventionsPatch, rerun, resolveProfile } from '@siksamitra/engine';
import { decodeRuns, isVerseParagraph } from '../../apps/word-addin/src/model/paragraph.js';
import { documentPartOf } from '../../apps/word-addin/src/model/opc.js';
import { ALL_COMMANDS } from '../../apps/word-addin/src/commands-table.js';

export const DIR = 'artifacts/word-ui';

/** A fresh artifacts folder — once, by the entry point. */
export function freshDir(): void {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
}

export type Step = Record<string, unknown>;
export interface Read { ok: boolean; error?: string; body?: string; text?: string; selection?: [number, number] }

/** A button's label, as the function its press calls. */
export const fnOf = (label: string): string => {
  const c = ALL_COMMANDS.find((x) => x.label === label);
  if (c === undefined) throw new Error(`no command labelled '${label}'`);
  return c.fn;
};

export function drive(given: Step[]): Read[] {
  const steps = given.map(({ press, ...rest }) => (press === undefined ? rest : { ...rest, fn: fnOf(String(press)) }));
  const plan = join(DIR, `plan-${Date.now()}.json`);
  const out = join(DIR, 'out.json');
  writeFileSync(plan, JSON.stringify({ steps }), 'utf8');
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'tools/word-ui/drive.ps1', '-Plan', plan, '-Out', out],
    { stdio: ['ignore', 'inherit', 'inherit'], timeout: 20 * 60_000 });
  const r = JSON.parse(readFileSync(out, 'utf8')) as { steps: Read[] | Read };
  return Array.isArray(r.steps) ? r.steps : [r.steps];
}

/** The steps that failed, by their error. */
export const errorsOf = (r: readonly Read[]): (string | undefined)[] => r.filter((x) => !x.ok).map((x) => x.error);
/** The reads a plan made, in order. */
export const readsOf = (r: readonly Read[]): Read[] => r.filter((x) => x.body !== undefined);

/** A read's package, as saved. */
export const packageOf = (read: Read): string => readFileSync(join(DIR, read.body!), 'utf8');

/** One paragraph as the add-in reads it. */
export interface WordLine {
  runs: ReturnType<typeof mergeRuns>; tm: TextAndMarks; xml: string; style: string | null; verse: boolean;
  /** The script the line is WRITTEN in, from its visible text — as the add-in tells it. */
  script: ReturnType<typeof scriptOfLine>;
}

/** Every paragraph Word now has, as the add-in reads it. */
export function lines(read: Read): WordLine[] {
  const pkg = packageOf(read);
  const part = documentPartOf(pkg);
  const raw = paragraphXml(part);
  return readParagraphs(part, pkg).map((p, i) => {
    const runs = mergeRuns(p.runs);
    const script = scriptOfLine(runs.filter((r) => r.hidden !== true).map((r) => r.text).join(''));
    return { runs, tm: decodeRuns(runs, script), xml: raw[i]!, style: p.pStyle, verse: isVerseParagraph(p), script };
  });
}

/** The first paragraph. */
export const line = (read: Read): WordLine => lines(read)[0]!;

export const marks = (tm: { marks: readonly { k: string; from: number; to: number; v?: string }[] }): string[] =>
  tm.marks.filter((m) => m.k !== 'syl').map((m) => `${m.k}:${m.from}-${m.to}:${m.v ?? ''}`).sort();

/** What the ENGINE makes of a text in a register, with the conventions given. */
export function engine(text: string, register: ChantProfileKey, conventions: Record<string, boolean> = {}): TextAndMarks {
  return rerun({ text, marks: [] }, {
    stages: STAGES, mode: 'keep-hand', from: 0, to: text.length,
    profile: resolveProfile([{ preset: register, patch: conventionsPatch(conventions) as never }]),
  });
}

export const results: { ok: boolean; what: string; got: unknown; want: unknown }[] = [];
export const check = (what: string, got: unknown, want: unknown): void => {
  results.push({ ok: JSON.stringify(got) === JSON.stringify(want), what, got, want });
};
