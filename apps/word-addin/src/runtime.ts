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
import { markSelection, typeInSelection, type Said } from './word/actions.js';
import { defaultRules, runOverDocument, runOverSelection } from './word/rules.js';
import { dissolvePartHere, makePart, selectPartHere } from './word/parts.js';
import { registerHere, setRegisterHere } from './word/register.js';
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
 * A register chosen from the menu — for the text it is chosen FOR.
 *
 * A śākhā belongs to a chant, a part, a selection; never to "the document"
 * (the owner, 2026-09-30: "'of the document' has no meaning"). So: with the
 * caret in a part, that part; with lines SELECTED outside every part, those
 * lines become a part of their own in it; with a bare caret outside every
 * part, the lines outside every part. Then, if the person says so, the text it
 * applies to is re-marked, undoing what the old register made first.
 */
async function chooseRegister(register: ChantProfileKey): Promise<void> {
  const name = CHANT_PROFILE_NOTES[register].name;
  const here = await locate();
  const selected = here.lines.length > 1 || here.from !== here.to;
  /* A selection in more than one place — partly in a part and partly not, or
     over parts of different registers — has no one "here" to choose for. It
     used to take the FIRST line's: a selection beginning outside and reaching
     into a part changed every line outside every part. */
  const places = new Set(here.lines.map((l) => l.part?.register ?? null));
  if (selected && places.size > 1) {
    await tell({ text: 'The selection is in more than one place.', kind: 'warn', lines: [
      places.has(null)
        ? 'Some of it is in a part and some is not. Select only lines outside every part to make them a part of their own, or put the caret in the part to change its register.'
        : 'It reaches over parts of different registers. Put the caret in the part whose register is to change.',
    ] });
    return;
  }
  if (selected && here.lines.every((l) => l.part === null)) {
    const was = (await registerHere()).register;
    if (!(await ask(`Mark these lines as ${name}?`, 'Mark them',
      'They become a part of their own, in this register, and are re-marked by its rules; what you placed by hand stays. '
        + 'The lines outside every part keep theirs.'))) return;
    if ((await makePart({ register })) !== 'made') {
      await tell({ text: 'The selection reaches into a part.', kind: 'warn', lines: ['Parts do not nest. Select lines outside every part, or dissolve the part first.'] });
      return;
    }
    await selectPartHere();
    await tell(await runOverSelection(await locate(), { ...defaultRules('keep-hand'), register, was }));
    return;
  }
  const before = await setRegisterHere(register);
  if (before.register === register) {
    await tell({ text: `${before.inPart ? 'This part is' : 'The lines outside every part are'} marked as ${name} already.`, kind: 'plain',
      lines: ['Auto-mark re-marks it, if the text has changed.'] });
    return;
  }
  const rules = { ...defaultRules('keep-hand'), register, was: before.register };
  if (before.inPart) {
    if (!(await ask(`Re-mark this part as ${name}?`, 'Re-mark it',
      'Its lines are re-marked by the rules of the new register. What you placed by hand stays.'))) return;
    await selectPartHere();
    await tell(await runOverSelection(await locate(), rules));
    return;
  }
  if (!(await ask(`Re-mark the lines outside every part as ${name}?`, 'Re-mark them',
    'Every mantra line outside a part of its own is re-marked by the new register. Parts keep their own. '
      + 'To give only some lines a register, select them and choose it.'))) return;
  await tell(await runOverDocument(rules, (p) => p.part === null));
}

async function newPart(): Promise<void> {
  const register = (await registerHere()).register ?? DEFAULT_PROFILE_KEY;
  const made = await makePart({ register });
  await tell(made === 'made'
    ? { text: `These lines are a part of their own now, marked as ${CHANT_PROFILE_NOTES[register].name}.`, kind: 'plain',
      lines: ['Choose a register from this menu, with the caret inside it, to mark it by other rules.'] }
    : { text: 'These lines are in a part already.', kind: 'warn', lines: ['Parts do not nest. Select lines outside every part, or dissolve the part first.'] });
}

async function dissolvePart(): Promise<void> {
  const was = await dissolvePartHere();
  if (was === null) {
    await tell({ text: 'The caret is not in a part.', kind: 'warn', lines: [] });
    return;
  }
  const doc = (await registerHere()).register;
  await tell({ text: 'The part is gone; its lines are outside every part again.', kind: 'plain',
    lines: doc === was.register ? [] : ['They are still marked as the part was. Auto-mark re-marks them by the register of the lines outside every part.'] });
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
  if (d === 'part-new') return newPart();
  if (d === 'part-dissolve') return dissolvePart();
  if ('register' in d) return chooseRegister(d.register);
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
