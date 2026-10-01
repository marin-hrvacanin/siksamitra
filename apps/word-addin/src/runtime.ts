/**
 * THE RUNTIME — what every button, menu item and keyboard shortcut runs.
 *
 * One page (`taskpane.html`) that Word keeps loaded behind the tab: the shared
 * runtime. Each command of `commands-table.ts` is registered here twice over —
 * as the global the manifest's `FunctionName` resolves, and through
 * `Office.actions.associate`, which is how a keyboard shortcut finds it — and
 * each calls the same action in `word/actions.ts`.
 *
 * WHAT IS SAID, AND WHEN. A marking that worked says nothing: the document
 * shows it. A press that could not do what was asked says why, in a dialog,
 * because a button that silently does nothing is the thing that made this
 * add-in feel broken. Re-marking the whole document asks first.
 *
 * `event.completed()` is called on every path, thrown or not: a command that
 * never completes leaves Word showing it as still running.
 */
import type { ChantProfileKey } from '@siksamitra/format';
import { CHANT_PROFILE_NOTES } from '@siksamitra/format';
import { ALL_COMMANDS, type Command } from './commands-table.js';
import { GUIDE_URL } from './version.js';
import { locate, type Located } from './word/selection.js';
import { markSelection, refusalOf, typeInSelection, type Said } from './word/actions.js';
import { defaultRules, markable, recordedFor, runOverDocument, runOverSelection } from './word/rules.js';
import { setSourceOfDocument, setSourceOfSelection } from './word/sources.js';
import { recordedRegister } from './word/settings.js';
import { addStyles, documentStyles } from './word/client.js';
import { convertDocument } from './word/convert.js';
import { scriptDocument, scriptName, scriptSelection } from './word/script.js';
import { DEFAULT_PROFILE_KEY, type ScriptKey } from '@siksamitra/engine';
import { DIALOG_SIZE, ask, dialog, tell } from './word/dialog.js';
import { openTab } from './ui/panel/nav.js';

/** Nothing selected: the caret alone, in one line. */
const isCaret = (here: Located): boolean => here.lines.length === 1 && here.from === here.to;

/** Say it only when it is a warning — a success shows in the document. */
const unlessFine = (m: Said): Promise<void> => (m.kind === 'warn' ? tell(m) : Promise.resolve());

/** The rules over the whole document, each part by its own register — asked first. */
async function wholeDocument(mode: 'keep-hand' | 'replace-all'): Promise<void> {
  const sure = await ask(mode === 'keep-hand' ? 'Auto-mark the whole document?' : 'Auto-mark the whole document afresh?', 'Auto-mark',
    `${mode === 'keep-hand' ? 'What you placed by hand stays.' : 'What you placed by hand is DROPPED.'} `
      + 'Every mantra line is marked by its own part’s rules. Word’s Undo takes it back.');
  if (sure) await tell(await runOverDocument(defaultRules(mode)));
}

/** The whole document in another script — asked first. */
async function wholeScript(script: ScriptKey): Promise<void> {
  const name = scriptName(script);
  const sure = await ask(`Write the whole document in ${name}?`, 'Write it',
    `Every mantra line is rewritten in ${name}, with every mark kept. Headings and translations stay as they are. `
      + 'Word’s Undo takes it back, and IAST again gives back exactly what was there.');
  if (sure) await tell(await scriptDocument(script));
}

/**
 * A SOURCE IS CHOSEN — the one place a line's source is changed, from the
 * ribbon's Source menu and the panel's alike.
 *
 * Every mantra line has one source, kept invisibly (`word/sources.ts`). With
 * lines selected, those lines take it; with nothing selected, every line does,
 * after asking. Each line is re-marked by the new source's rules, undoing
 * what ITS old source made first — a selection may reach over several — and
 * what a person placed by hand stays. There are no "parts" to know about: a
 * śākhā belongs to the text it marks (the owner, 2026-09-30, and 2026-10-01:
 * "the text itself has some record of what the source is").
 */
async function chooseSource(source: ChantProfileKey): Promise<void> {
  const name = CHANT_PROFILE_NOTES[source].name;
  const here = await locate();
  const selected = here.lines.length > 1 || here.from !== here.to;
  const rules = { ...defaultRules('keep-hand'), register: source };
  if (!selected) {
    if (!(await ask(`Mark every line as ${name}?`, 'Mark every line',
      'Every mantra line takes this source and is re-marked by its rules. What you placed by hand stays; '
        + 'Word’s Undo takes it back.'))) return;
    const done = await runOverDocument(rules);
    await setSourceOfDocument(source);
    await tell({ ...done, text: `Every line is ${name} now. ${done.text}` });
    return;
  }
  /* Refused BEFORE the record changes: a line the rules may not rewrite would
     otherwise be left with a source its marks are not of. */
  const refused = refusalOf(here);
  if (refused !== null) { await tell(refused); return; }
  const count = here.lines.filter(markable).length;
  if (count === 0) {
    await tell({ text: 'Nothing to mark: these are not mantra lines.', kind: 'warn',
      lines: ['A source is for mantra lines. Titles, translations and comments have none.'] });
    return;
  }
  /* Each line's source as it was, before the record changes. */
  const was = here.lines.map((l) => recordedFor(l.part));
  await setSourceOfSelection(source, recordedRegister() ?? DEFAULT_PROFILE_KEY);
  const now = await locate();
  if (now.lines.length !== here.lines.length) {
    await tell({ text: 'The source is set, but the lines could not be re-marked.', kind: 'warn',
      lines: ['Select the same lines and press Auto-mark.'] });
    return;
  }
  const whole = { ...now, lines: now.lines.map((l) => ({ ...l, from: 0, to: l.tm.text.length })) };
  const done = await runOverSelection(whole, { ...rules, wasEach: was });
  await tell({ ...done, text: `${count === 1 ? 'This line is' : `These ${count} lines are`} ${name} now. ${done.text}` });
}

async function styles(keep: boolean): Promise<void> {
  await addStyles(keep);
  /* A document in his older style names is taken into the clean ones — the
     same look (`word/convert.ts`). */
  const before = await documentStyles();
  const converted = before.older.length > 0 ? await convertDocument() : null;
  const now = await documentStyles();
  const said = converted === null ? [] : [
    `${converted.written} paragraph(s) now in the clean styles, looking as they did.`,
    ...(converted.removed.length === 0 ? [] : [`The older styles went: ${converted.removed.join(', ')}.`]),
    ...converted.kept.map((k) => `Left as it was — ${k}.`),
  ];
  await tell(now.missing.length === 0
    ? { text: `The ${now.total} śikṣāmitra styles are in this document.`, kind: converted?.kept.length ? 'warn' : 'plain',
      lines: [...said, ...(keep ? ['The specimen is at the end of the document. Delete it when you have read it; the styles stay.'] : [])] }
    : { text: 'Some styles did not go in.', kind: 'warn', lines: [...said, `Still missing: ${now.missing.join(', ')}.`] });
}

/** The typing help: every key of the palette, and a letter pressed for its long form. */
function typingHelp(): Promise<void> {
  return dialog('type.html', {}, DIALOG_SIZE.type, async (reply, close) => {
    if ('ch' in reply) {
      const m = await typeInSelection(await locate(), reply.ch);
      if (m.kind === 'warn') { close(); await tell(m); return; }
    }
    if ('close' in reply && reply.close === true) close();
  });
}

/** What one command does. Exported for the tests. */
export async function run(c: Command): Promise<void> {
  const d = c.does;
  /* The keyboard opens the panel on its Type tab — the palette beside the
     document rather than a dialog over it; the dialog only where there is no panel. */
  if (d === 'typing-help') {
    openTab('type');
    try { await Office.addin.showAsTaskpane(); return undefined; } catch { return typingHelp(); }
  }
  if (d === 'import-styles') return styles(false);
  if (d === 'specimen') return styles(true);
  if (d === 'guide') { Office.context.ui.openBrowserWindow(GUIDE_URL); return undefined; }
  if (d === 'panel') { await Office.addin.showAsTaskpane(); return undefined; }
  if ('register' in d) return chooseSource(d.register);
  const here = await locate();
  if ('rules' in d) {
    return isCaret(here) ? wholeDocument(d.rules) : unlessFine(await runOverSelection(here, defaultRules(d.rules)));
  }
  if ('insert' in d) return unlessFine(await typeInSelection(here, d.insert));
  if ('script' in d) return isCaret(here) ? wholeScript(d.script) : unlessFine(await scriptSelection(here, d.script));
  return unlessFine(await markSelection(here, d.mark));
}

function register(c: Command): void {
  const handler = async (event?: Office.AddinCommands.Event): Promise<void> => {
    try {
      await run(c);
    } catch (e) {
      console.error(c.label, e);
      await tell({ text: `${c.label} did not work.`, kind: 'warn', lines: [e instanceof Error ? e.message : String(e)] })
        .catch(() => undefined);
    } finally {
      event?.completed?.();
    }
  };
  (globalThis as Record<string, unknown>)[c.fn] = handler;
  Office.actions?.associate?.(c.fn, handler);
}

/** Register every command. Called once Office is ready. */
export function registerAll(): void {
  for (const c of ALL_COMMANDS) if (c.does !== 'panel') register(c);
}
