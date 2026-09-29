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
import type { ChantProfileKey } from '@siksamitra/format';
import { selectionAcross } from '@siksamitra/edit';
import { addStyles, documentStyles, type DocStyles } from '../word/client.js';
import { locate, type Located } from '../word/selection.js';
import { recordedRegister } from '../word/settings.js';
import { SAID_KEY } from '../commands-table.js';
import {
  defaultRules, markSelection, runOverDocument, runOverSelection, type Rules, type Said,
} from '../word/actions.js';
import type { Control } from './controls.js';

export interface Message {
  text: string;
  kind: 'plain' | 'warn';
  lines: readonly string[];
}

export type { Rules } from '../word/actions.js';

const quiet: Message = { text: '', kind: 'plain', lines: [] };

export function usePane() {
  const [at, setAt] = useState<Located | null>(null);
  const [message, setMessage] = useState<Message>(quiet);
  const [styles, setStyles] = useState<DocStyles | null>(null);
  const [busy, setBusy] = useState(false);
  /* The register the document RECORDS it is marked in, and the one chosen for
     the next run. They differ when a person picks another; nothing is
     rewritten until they run it. */
  const [marked, setMarked] = useState<ChantProfileKey | null>(() => recordedRegister());
  const [rules, setRules] = useState<Rules>(defaultRules);
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

  /* WHAT A RIBBON OR MENU COMMAND SAID. It runs in another window with no
     room to speak, and leaves its message in storage; the pane shows it, and
     re-reads the selection it changed. */
  useEffect(() => {
    const heard = (e: StorageEvent): void => {
      if (e.key !== SAID_KEY || e.newValue === null) return;
      try {
        const m = JSON.parse(e.newValue) as Partial<Said>;
        if (typeof m.text === 'string') {
          say(m.text, m.kind === 'warn' ? 'warn' : 'plain', Array.isArray(m.lines) ? m.lines.map(String) : []);
        }
      } catch { /* Not ours, or damaged: ignored. */ }
      setMarked(recordedRegister());
      void refresh();
    };
    window.addEventListener('storage', heard);
    return () => window.removeEventListener('storage', heard);
  }, [refresh, say]);

  /** Show what an action said. */
  const show = useCallback((m: Said) => { say(m.text, m.kind, m.lines); }, [say]);

  const press = useCallback(async (control: Control) => {
    const here = atRef.current;
    if (here === null) return;
    await guard('cannot mark', async () => {
      show(await markSelection(here, control.command));
      await refresh();
      /* A marking brings the style it needs; re-read the table only while
         something is missing — a whole-body getOoxml on every press is what
         makes an add-in feel broken. */
      if (styles !== null && styles.missing.length > 0) await readStyles();
    });
  }, [guard, refresh, readStyles, show, styles]);

  const runHere = useCallback(async () => {
    const here = atRef.current;
    if (here === null) return;
    await guard('the rules would not run', async () => {
      show(await runOverSelection(here, rules));
      setMarked(recordedRegister());
      await refresh();
    });
  }, [guard, refresh, rules, show]);

  const runDocument = useCallback(async () => {
    await guard('the rules would not run over the document', async () => {
      say('Reading the document…');
      show(await runOverDocument(rules));
      setMarked(recordedRegister());
      await refresh();
    });
  }, [guard, refresh, rules, say, show]);

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
