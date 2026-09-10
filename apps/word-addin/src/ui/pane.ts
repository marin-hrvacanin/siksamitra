/**
 * THE TASK PANE.
 *
 * Builds the controls from `controls.ts` and `CHANT_PROFILE_NOTES`, reads the
 * selection through `word/client.ts`, runs the command, writes the paragraph
 * back. It holds no model of its own: what it shows is read from Word each
 * time, so a paragraph edited in Word while the pane is open cannot go stale.
 *
 * NO FRAMEWORK. A pane is four rows of buttons and a status line, and React in
 * a Word add-in would be 140 kB of runtime to redraw a dozen `aria-pressed`
 * attributes. The DOM is built once and only the attributes change.
 */
import { CHANT_PROFILE_KEYS, CHANT_PROFILE_NOTES } from '@siksamitra/format';
import type { ChantProfileKey, Stage } from '@siksamitra/format';
import { resolveProfile } from '@siksamitra/engine';
import { applyCommand, selectionState } from '../model/command.js';
import { notCarried } from '../model/carry.js';
import { STAGES, rerun } from '@siksamitra/engine';
import { locate, readDocument, writeDocument, writeParagraph } from '../word/client.js';
import type { Located } from '../word/client.js';
import { GROUPS, type Control } from './controls.js';
import { arming, el } from './dom.js';
import { setupGroup, type SetupGroup } from './setup-group.js';
import { ADDIN_VERSION, GUIDE_URL } from '../version.js';

/** What the pane is currently looking at. Re-read, never cached across an edit. */
let at: Located | null = null;

const where = el('div', { class: 'where', 'data-state': 'none' });
const note = el('div', { class: 'note' });
const buttons = new Map<HTMLButtonElement, Control>();

/** Say what happened, or what went wrong. */
function say(text: string, kind: 'plain' | 'warn' = 'plain', lines: string[] = []): void {
  note.replaceChildren(text);
  note.setAttribute('data-kind', kind);
  if (lines.length > 0) {
    note.append(el('ul', {}, ...lines.map((l) => el('li', {}, l))));
  }
}

/** The document group, built with the pane. */
let setup: SetupGroup | null = null;

/** Everything the caller can get wrong reaches the reader as one line. */
async function guard(what: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (e) {
    say(`${what}: ${e instanceof Error ? e.message : String(e)}`, 'warn');
  }
}

/* ── the selection ─────────────────────────────────────────────────────── */

function paint(): void {
  if (at === null) {
    where.setAttribute('data-state', 'none');
    where.replaceChildren('Put the caret in a line of text.');
    for (const b of buttons.keys()) b.disabled = true;
    return;
  }
  const { tm, from, to } = at;
  where.setAttribute('data-state', from === to ? 'caret' : 'range');
  where.replaceChildren(
    from === to
      ? `The caret is at letter ${from} of ${tm.text.length}.`
      : el('span', {}, `Selected: `, el('strong', {}, tm.text.slice(from, to))),
  );
  const state = selectionState(tm, from, to);
  for (const [button, control] of buttons) {
    button.disabled = control.point !== true && from === to;
    const on = control.state === undefined ? 'none' : state[control.state];
    button.setAttribute('aria-pressed', String(on === 'all'));
  }
}

export async function refresh(): Promise<void> {
  await guard('cannot read the selection', async () => {
    at = await locate();
    paint();
    const lost = at.unresolved.filter((u) => u.lossy);
    if (lost.length > 0) {
      say('This paragraph carries text the reader cannot place. Marking it '
        + 'would delete that text, so the buttons are refused here.',
      'warn', lost.map((u) => `${u.what}: ${u.raw}`));
    } else if (at.unresolved.length > 0) {
      say('Read, with a note:', 'plain', at.unresolved.map((u) => `${u.what}: ${u.raw}`));
    }
  });
}

/* ── a command ─────────────────────────────────────────────────────────── */

async function press(control: Control): Promise<void> {
  const here = at;
  if (here === null) return;
  const lost = here.unresolved.filter((u) => u.lossy);
  if (lost.length > 0) {
    say('Refusing to write: see above.', 'warn', lost.map((u) => `${u.what}: ${u.raw}`));
    return;
  }
  await guard('cannot mark', async () => {
    const result = applyCommand(here.tm, here.from, here.to, control.command);
    /* `text` comes back only when the command changed it — a combining
       character does, every other control does not. */
    const tm = { text: result.text ?? here.tm.text, marks: result.marks };
    await writeParagraph(tm, here.style);
    const undrawable = notCarried(result.marks);
    say(result.note, undrawable.length === 0 ? 'plain' : 'warn',
      undrawable.map((l) => l.why));
    await refresh();
    /*
     * A marking brings the style it needs with it, so a document that had
     * none of them now has one or two. The line in "This document" would
     * otherwise still say "none of the seventeen".
     *
     * ONLY WHILE SOMETHING IS MISSING. Reading it means `Body.getOoxml()` over
     * the WHOLE document — Śrī Rudram is megabytes of it — and doing that after
     * every press is what makes an add-in feel broken.
     */
    if (setup !== null && !setup.ready()) await setup.refresh();
  });
}

/* ── the rules ─────────────────────────────────────────────────────────── */

const register = el('select', { id: 'sm-register' });
const modeKeep = el('input', { type: 'radio', name: 'sm-mode', value: 'keep-hand', checked: '' });
const modeAll = el('input', { type: 'radio', name: 'sm-mode', value: 'replace-all' });
const stageBoxes = new Map<Stage, HTMLInputElement>();

const request = () => ({
  stages: STAGES.filter((s) => stageBoxes.get(s)?.checked === true),
  mode: modeKeep.checked ? ('keep-hand' as const) : ('replace-all' as const),
  profile: resolveProfile([{ preset: register.value as ChantProfileKey }]),
});

async function runHere(): Promise<void> {
  const here = at;
  if (here === null) return;
  await guard('the rules would not run', async () => {
    const { stages, mode, profile } = request();
    const whole = here.from === here.to;
    const out = rerun(here.tm, {
      stages,
      mode,
      profile,
      from: whole ? 0 : here.from,
      to: whole ? here.tm.text.length : here.to,
    });
    await writeParagraph({ text: out.text, marks: out.marks }, here.style);
    say(`${whole ? 'This line' : 'The selection'}: ${out.note}`,
      out.lost.length === 0 ? 'plain' : 'warn',
      [...out.warnings, ...out.lost.map((m) => `${m.k} at ${m.from} was placed by hand`)]);
    await refresh();
  });
}

async function runDocument(): Promise<void> {
  await guard('the rules would not run over the document', async () => {
    const { stages, mode, profile } = request();
    say('Reading the document…');
    const paragraphs = await readDocument();
    let lost = 0;
    const changed = paragraphs.map((p) => {
      const out = rerun(p.tm, { stages, mode, profile, from: 0, to: p.tm.text.length });
      lost += out.lost.length;
      return { ...p, tm: { text: out.text, marks: out.marks } };
    });
    const written = await writeDocument(changed);
    say(`${written} mantra line(s) re-marked`
      + `${lost === 0 ? '' : `, ${lost} hand marking(s) could not be carried`}.`,
    lost === 0 ? 'plain' : 'warn');
    await refresh();
  });
}

/* ── building it ───────────────────────────────────────────────────────── */

function markGroups(): HTMLElement[] {
  return GROUPS.map((group) => {
    const row = el('div', { class: 'row' });
    for (const control of group.controls) {
      const button = el('button', {
        type: 'button', title: control.tip, 'data-mark': control.mark, 'aria-pressed': 'false',
      }, control.label);
      button.addEventListener('click', () => { void press(control); });
      buttons.set(button, control);
      row.append(button);
    }
    return el('div', { class: 'group' }, el('h2', {}, group.title), row);
  });
}

function rulesGroup(): HTMLElement {
  for (const key of CHANT_PROFILE_KEYS) {
    const n = CHANT_PROFILE_NOTES[key];
    register.append(el('option', { value: key, title: `${n.where}. ${n.what}` }, n.name));
  }
  const stages = el('div', { class: 'stages' });
  for (const stage of STAGES) {
    const box = el('input', { type: 'checkbox', checked: '' });
    stageBoxes.set(stage, box);
    stages.append(el('label', {}, box, stage));
  }
  const here = el('button', { type: 'button' }, 'Run over the selection');
  here.addEventListener('click', () => { void runHere(); });
  /*
   * THE DESTRUCTIVE ONE, AND IT ASKS FIRST. It rewrites every mantra paragraph
   * in the file, and `insertOoxml` over a paragraph replaces the whole
   * paragraph — so a comment, a bookmark or a tracked change inside one does
   * not survive, and one Ctrl+Z does not bring back four hundred of them.
   */
  const all = el('button', { type: 'button', id: 'sm-run-all' });
  arming(all, {
    calm: 'Run over the document',
    ask: 'Rewrite every mantra line?',
    run: runDocument,
  });

  return el('div', { class: 'group' },
    el('h2', {}, 'The rules'),
    el('label', {}, 'Register', register),
    stages,
    el('label', {}, modeKeep, 'Keep markings placed by hand'),
    el('label', {}, modeAll, 'Replace everything'),
    el('div', { class: 'row' }, here, all));
}

/**
 * The line at the bottom: which build this is, and where the notation is
 * written down.
 *
 * The version because a task pane is a CACHED web page — Word holds one for
 * days — and "which version am I looking at" is otherwise unanswerable from
 * inside it. The link because the pane's tooltips can say what a button does
 * and cannot say what a holding IS.
 */
function footer(): HTMLElement {
  const link = el('a', {
    href: GUIDE_URL, target: '_blank', rel: 'noopener noreferrer',
  }, 'What the marks mean');
  return el('div', { class: 'foot' }, link, el('span', {}, `v${ADDIN_VERSION}`));
}

export function build(root: HTMLElement): void {
  const group = setupGroup({ say, guard, changed: refresh });
  setup = group;
  root.replaceChildren(
    el('div', { class: 'pane' },
      where, ...markGroups(), rulesGroup(), group.element, note, footer()),
  );
  paint();
  /* Asked once, at startup. A document's style table does not change under
     us — only the two buttons in that group change it, and they re-read it
     themselves. */
  void group.refresh();
}
