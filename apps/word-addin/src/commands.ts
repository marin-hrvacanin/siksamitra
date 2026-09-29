/**
 * THE FUNCTION FILE — what the ribbon tab and the right-click menu run.
 *
 * One function per entry of `commands-table.ts`, each calling the same action
 * the pane's button calls (`word/actions.ts`). A function command has no
 * window of its own, so what it has to SAY is handed to the pane: written to
 * `localStorage` under `SAID_KEY`, which fires a `storage` event in the pane
 * if it is open (same origin, another window) and is read when it next opens.
 *
 * `event.completed()` is called on every path, thrown or not: a command that
 * never completes leaves Word showing it as still running.
 */
import { ENTRIES, SAID_KEY, type Entry } from './commands-table.js';
import { locate } from './word/selection.js';
import { defaultRules, markSelection, runOverSelection, type Said } from './word/actions.js';

function tell(m: Said): void {
  try {
    localStorage.setItem(SAID_KEY, JSON.stringify({ ...m, at: Date.now() }));
  } catch {
    /* Storage blocked: the command still ran; there is nowhere to say so. */
  }
}

/** Run one entry against the current selection. Exported for the tests. */
export async function runEntry(entry: Entry): Promise<Said> {
  /* `open` is the manifest's own ShowTaskpane action and never reaches here. */
  if (entry.does === 'open') return { text: '', kind: 'plain', lines: [] };
  const here = await locate();
  return entry.does === 'run-selection'
    ? runOverSelection(here, defaultRules())
    : markSelection(here, entry.does.mark);
}

function register(entry: Entry): void {
  const run = async (event: Office.AddinCommands.Event): Promise<void> => {
    try {
      const said = await runEntry(entry);
      if (said.text !== '') tell(said);
    } catch (e) {
      tell({ text: `${entry.label}: ${e instanceof Error ? e.message : String(e)}`, kind: 'warn', lines: [] });
    } finally {
      event.completed();
    }
  };
  /* Both ways a host finds a command: the global name the XML manifest's
     `FunctionName` resolves, and `Office.actions.associate` where it exists. */
  (globalThis as Record<string, unknown>)[entry.fn] = run;
  Office.actions?.associate?.(entry.fn, run);
}

if (typeof Office !== 'undefined') {
  void Office.onReady(() => { for (const e of ENTRIES) register(e); });
}
