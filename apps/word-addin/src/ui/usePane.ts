/**
 * THE PANE'S STATE — what is selected, what was last said, and every action.
 *
 * The logic of the old DOM pane, unchanged, with one fault fixed at its root:
 * the selection's own notes and the LAST ACTION'S MESSAGE are two different
 * things and are now two different pieces of state. They used to share one
 * line, and `refresh()` cleared it after every write — so pressing Short over
 * a word with no letter a holding may take showed the reason for no time at
 * all, measured in Word on the web. A message now stays until the next action.
 *
 * Every entry point goes through `guard`: whatever throws — the model, an
 * Office `RichApi.Error`, a network failure — becomes one line naming what was
 * being done, and the pane stays usable.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CHANT_PROFILE_NOTES, type ChantProfileKey, type Stage, type TextAndMarks } from '@siksamitra/format';
import { STAGES, rerun, resolveProfile, showsLengthening } from '@siksamitra/engine';
import { applyAcross, selectionAcross } from '@siksamitra/edit';
import { notCarried } from '../model/carry.js';
import {
  addStyles, documentStyles, readDocument, writeDocument, type DocStyles,
} from '../word/client.js';
import { locate, writeLines, type Line, type LineWrite, type Located } from '../word/selection.js';
import { recordRegister, recordedRegister } from '../word/settings.js';
import type { Control } from './controls.js';

export interface Message {
  text: string;
  kind: 'plain' | 'warn';
  lines: readonly string[];
}

export interface Rules {
  register: ChantProfileKey;
  stages: ReadonlySet<Stage>;
  mode: 'keep-hand' | 'replace-all';
}

const quiet: Message = { text: '', kind: 'plain', lines: [] };

/** One text and its markings, in an order that does not depend on how they
 *  were produced — so "did the rules change this line?" has one answer. */
const canon = (tm: TextAndMarks): string => JSON.stringify([tm.text, [...tm.marks]
  .map((m) => JSON.stringify(m)).sort()]);
export const sameText = (a: TextAndMarks, b: TextAndMarks): boolean => canon(a) === canon(b);

export function usePane() {
  const [at, setAt] = useState<Located | null>(null);
  const [message, setMessage] = useState<Message>(quiet);
  const [styles, setStyles] = useState<DocStyles | null>(null);
  const [busy, setBusy] = useState(false);
  /* The register the document RECORDS it is marked in, and the one chosen for
     the next run. They differ when a person picks another; nothing is
     rewritten until they run it. */
  const [marked, setMarked] = useState<ChantProfileKey | null>(() => recordedRegister());
  const [rules, setRules] = useState<Rules>(() => ({
    register: recordedRegister() ?? 'taittiriya', stages: new Set(STAGES), mode: 'keep-hand',
  }));
  const atRef = useRef(at);
  atRef.current = at;

  const say = useCallback((text: string, kind: Message['kind'] = 'plain', lines: string[] = []) => {
    setMessage({ text, kind, lines });
  }, []);

  const guard = useCallback(async (what: string, run: () => Promise<void>) => {
    setBusy(true);
    try {
      await run();
    } catch (e) {
      console.error(what, e);
      say(`${what}: ${e instanceof Error ? e.message : String(e)}`, 'warn');
    } finally {
      setBusy(false);
    }
  }, [say]);

  /** Re-read the selection. Never touches the message. */
  const refresh = useCallback(async () => {
    try {
      setAt(await locate());
    } catch (e) {
      console.error('cannot read the selection', e);
      setAt(null);
    }
  }, []);

  const readStyles = useCallback(async () => {
    try { setStyles(await documentStyles()); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { void refresh(); void readStyles(); }, [refresh, readStyles]);

  /**
   * A selection with a line that may not be written, said — and `true` so the
   * caller stops. Checked before anything is computed, for every button
   * alike, and for EVERY line: a press over five lines where one has a picture
   * writes none of them rather than four, so nothing half-happens.
   */
  const refused = useCallback((here: Located): boolean => {
    const many = here.lines.length > 1;
    const where = (i: number): string => (many ? `line ${i + 1} of the selection` : 'this line');
    const blocked = here.lines.flatMap((l, i) => (l.blocked.length > 0 ? [[i, l] as const] : []));
    if (blocked.length > 0) {
      const [i, l] = blocked[0]!;
      say(`Left alone: ${where(i)} has ${l.blocked.join(' and ')} on it, and rewriting it would lose that.`,
        'warn', ['Move it to a line of its own, or remove it, and press again.']);
      return true;
    }
    const lost = here.lines.flatMap((l, i) => l.unresolved.filter((u) => u.lossy)
      .map((u) => `${many ? `line ${i + 1}: ` : ''}${u.what}: ${u.raw}`));
    if (lost.length > 0) {
      say(`Refusing to write: ${many ? 'the selection' : 'this line'} carries text the reader cannot place.`,
        'warn', lost);
      return true;
    }
    return false;
  }, [say]);

  const press = useCallback(async (control: Control) => {
    const here = atRef.current;
    if (here === null) return;
    if (refused(here)) return;
    await guard('cannot mark', async () => {
      const results = applyAcross(here.lines, control.command);
      const writes: LineWrite[] = [];
      results.forEach((r, i) => {
        const l = here.lines[i]!;
        const tm = { text: r.text ?? l.tm.text, marks: r.marks };
        if (!sameText(tm, l.tm)) writes.push({ line: i, tm, style: l.style, wordText: l.wordText });
      });
      await writeLines(writes);
      const undrawable = results.flatMap((r) => notCarried(r.marks));
      const note = here.lines.length === 1 ? results[0]!.note
        : `${writes.length} of ${here.lines.length} lines changed`;
      say(note, undrawable.length === 0 ? 'plain' : 'warn', undrawable.map((l) => l.why));
      await refresh();
      /* A marking brings the style it needs; re-read the table only while
         something is missing — a whole-body getOoxml on every press is what
         makes an add-in feel broken. */
      if (styles !== null && styles.missing.length > 0) await readStyles();
    });
  }, [guard, refresh, readStyles, refused, say, styles]);

  const request = useCallback(() => ({
    stages: STAGES.filter((s) => rules.stages.has(s)),
    mode: rules.mode,
    profile: resolveProfile([{ preset: rules.register }]),
  }), [rules]);

  /**
   * The register a line is marked in NOW, to be undone before the chosen one
   * runs. What the document RECORDS decides, because a register may carry
   * marks another would read differently — the corpus has overlines under a
   * Ṛgveda with lengthening switched off. Only where nothing is recorded does
   * the line's own evidence speak: the Ṛgveda's marks mean the Ṛgveda, and
   * otherwise the line is taken as marked in the register chosen.
   */
  const previousOf = useCallback((tm: Line['tm']) => resolveProfile([{
    preset: marked ?? (showsLengthening(tm) ? 'rigveda' : rules.register),
  }]), [marked, rules.register]);

  /** After a run: the document is marked in the register just used — unless
   *  only part of it was, into a register the rest is not in. */
  const remember = useCallback(async (whole: boolean): Promise<string | null> => {
    if (whole || marked === null || marked === rules.register) {
      await recordRegister(rules.register);
      setMarked(rules.register);
      return null;
    }
    return `Only these lines are ${CHANT_PROFILE_NOTES[rules.register].name} now; `
      + `the rest of the document stays ${CHANT_PROFILE_NOTES[marked].name}.`;
  }, [marked, rules.register]);

  const runHere = useCallback(async () => {
    const here = atRef.current;
    if (here === null || refused(here)) return;
    await guard('the rules would not run', async () => {
      const { stages, mode, profile } = request();
      /* A caret means its whole line; a selection means the part of each line
         that is selected — recompute over a range, as the app does. */
      const whole = here.lines.length === 1 && here.from === here.to;
      const range = (l: Line): [number, number] => (whole ? [0, l.tm.text.length] : [l.from, l.to]);
      const outs = here.lines.map((l) => {
        const [from, to] = range(l);
        return to > from ? rerun(l.tm, { stages, mode, profile, from, to, previous: previousOf(l.tm) }) : null;
      });
      const writes: LineWrite[] = [];
      outs.forEach((out, i) => {
        const l = here.lines[i]!;
        if (out === null) return;
        const tm = { text: out.text, marks: out.marks };
        if (!sameText(tm, l.tm)) writes.push({ line: i, tm, style: l.style, wordText: l.wordText });
      });
      await writeLines(writes);
      const mixed = await remember(false);
      const done = outs.filter((o): o is NonNullable<typeof o> => o !== null);
      const lost = done.flatMap((o) => o.lost);
      const head = here.lines.length > 1
        ? `The selection: ${writes.length === 0 ? 'nothing to change' : `${writes.length} line(s) re-marked`}`
        : `${whole ? 'This line' : 'The selection'}: ${writes.length === 0 ? 'nothing to change' : done[0]?.note ?? ''}`;
      say(head, lost.length === 0 ? 'plain' : 'warn',
        [...(mixed === null ? [] : [mixed]), ...done.flatMap((o) => o.warnings),
          ...lost.map((m) => `${m.k} at ${m.from} was placed by hand`)]);
      await refresh();
    });
  }, [guard, previousOf, refresh, refused, remember, request, say]);

  const runDocument = useCallback(async () => {
    await guard('the rules would not run over the document', async () => {
      const { stages, mode, profile } = request();
      say('Reading the document…');
      const { lines, total } = await readDocument();
      let lost = 0;
      const skipped = lines.filter((p) => p.blocked.length > 0);
      /* Only the lines the rules actually change are written: a second run
         over a marked document writes nothing, and says so. */
      const changed = lines.filter((p) => p.blocked.length === 0).flatMap((p) => {
        const out = rerun(p.tm, {
          stages, mode, profile, from: 0, to: p.tm.text.length, previous: previousOf(p.tm),
        });
        lost += out.lost.length;
        const tm = { text: out.text, marks: out.marks };
        return sameText(tm, p.tm) ? [] : [{ ...p, tm }];
      });
      const written = await writeDocument(changed, total);
      await remember(true);
      say(`${written === 0 ? 'Nothing to change' : `${written} mantra line(s) re-marked`}`
        + `${lost === 0 ? '' : `, ${lost} hand marking(s) could not be carried`}`
        + `${skipped.length === 0 ? '' : `, ${skipped.length} left alone`}.`,
      lost === 0 && skipped.length === 0 ? 'plain' : 'warn',
      skipped.map((p) => `line ${p.index + 1}: it has ${p.blocked.join(' and ')} on it`));
      await refresh();
    });
  }, [guard, previousOf, refresh, remember, request, say]);

  const putStyles = useCallback(async (keep: boolean) => {
    await guard(keep ? 'the specimen would not go in' : 'the styles would not go in', async () => {
      await addStyles(keep);
      const now = await documentStyles();
      setStyles(now);
      await refresh();
      say(now.missing.length === 0
        ? `${now.total} styles are in the document now.${keep
          ? ' The specimen is at the end — delete it when you have read it; the styles stay.'
          : ''}`
        : `Still missing: ${now.missing.join(', ')}.`,
      now.missing.length === 0 ? 'plain' : 'warn');
    });
  }, [guard, refresh, say]);

  const state: ReturnType<typeof selectionAcross> | null = at === null ? null : selectionAcross(at.lines);

  return {
    at, state, message, styles, busy, rules, setRules, marked,
    refresh, press, runHere, runDocument, putStyles,
  };
}

export type PaneModel = ReturnType<typeof usePane>;
