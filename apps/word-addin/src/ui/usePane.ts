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
import type { ChantProfileKey, Stage } from '@siksamitra/format';
import { STAGES, rerun, resolveProfile } from '@siksamitra/engine';
import { applyCommand, selectionState } from '../model/command.js';
import { notCarried } from '../model/carry.js';
import {
  addStyles, documentStyles, locate, readDocument, writeDocument, writeParagraph,
  type DocStyles, type Located,
} from '../word/client.js';
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

export function usePane() {
  const [at, setAt] = useState<Located | null>(null);
  const [message, setMessage] = useState<Message>(quiet);
  const [styles, setStyles] = useState<DocStyles | null>(null);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState<Rules>({
    register: 'taittiriya', stages: new Set(STAGES), mode: 'keep-hand',
  });
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

  const press = useCallback(async (control: Control) => {
    const here = atRef.current;
    if (here === null) return;
    const lost = here.unresolved.filter((u) => u.lossy);
    if (lost.length > 0) {
      say('Refusing to write: this line carries text the reader cannot place.', 'warn',
        lost.map((u) => `${u.what}: ${u.raw}`));
      return;
    }
    await guard('cannot mark', async () => {
      const result = applyCommand(here.tm, here.from, here.to, control.command);
      const tm = { text: result.text ?? here.tm.text, marks: result.marks };
      await writeParagraph(tm, here.style);
      const undrawable = notCarried(result.marks);
      say(result.note, undrawable.length === 0 ? 'plain' : 'warn', undrawable.map((l) => l.why));
      await refresh();
      /* A marking brings the style it needs; re-read the table only while
         something is missing — a whole-body getOoxml on every press is what
         makes an add-in feel broken. */
      if (styles !== null && styles.missing.length > 0) await readStyles();
    });
  }, [guard, refresh, readStyles, say, styles]);

  const request = useCallback(() => ({
    stages: STAGES.filter((s) => rules.stages.has(s)),
    mode: rules.mode,
    profile: resolveProfile([{ preset: rules.register }]),
  }), [rules]);

  const runHere = useCallback(async () => {
    const here = atRef.current;
    if (here === null) return;
    await guard('the rules would not run', async () => {
      const { stages, mode, profile } = request();
      const whole = here.from === here.to;
      const out = rerun(here.tm, {
        stages, mode, profile,
        from: whole ? 0 : here.from,
        to: whole ? here.tm.text.length : here.to,
      });
      await writeParagraph({ text: out.text, marks: out.marks }, here.style);
      say(`${whole ? 'This line' : 'The selection'}: ${out.note}`,
        out.lost.length === 0 ? 'plain' : 'warn',
        [...out.warnings, ...out.lost.map((m) => `${m.k} at ${m.from} was placed by hand`)]);
      await refresh();
    });
  }, [guard, refresh, request, say]);

  const runDocument = useCallback(async () => {
    await guard('the rules would not run over the document', async () => {
      const { stages, mode, profile } = request();
      say('Reading the document…');
      const { lines, total } = await readDocument();
      let lost = 0;
      const changed = lines.map((p) => {
        const out = rerun(p.tm, { stages, mode, profile, from: 0, to: p.tm.text.length });
        lost += out.lost.length;
        return { ...p, tm: { text: out.text, marks: out.marks } };
      });
      const written = await writeDocument(changed, total);
      say(`${written} mantra line(s) re-marked`
        + `${lost === 0 ? '' : `, ${lost} hand marking(s) could not be carried`}.`,
      lost === 0 ? 'plain' : 'warn');
      await refresh();
    });
  }, [guard, refresh, request, say]);

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

  const state: ReturnType<typeof selectionState> | null = at === null ? null : selectionState(at.tm, at.from, at.to);

  return {
    at, state, message, styles, busy, rules, setRules,
    refresh, press, runHere, runDocument, putStyles,
  };
}

export type PaneModel = ReturnType<typeof usePane>;
