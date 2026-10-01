/**
 * THE ŚIKṢĀMITRA TAB, AS DATA — every button, every menu, what each one does.
 *
 * Everything the add-in does is on the ribbon: there is no pane to hunt
 * through. Three things read this one table, so none of them can drift:
 *
 *   `runtime.ts`                   registers a function per command;
 *   `scripts/word-commands.ts`     writes the manifest's tab, its right-click
 *                                  menu and its keyboard shortcuts, and draws
 *                                  every icon;
 *   `commands-table.test.ts`       fails if the manifest on disk is not what
 *                                  this table generates.
 *
 * WHAT A BUTTON MARKS. With letters selected, those letters. With nothing
 * selected, the letter just before the caret — the one a person has just
 * typed — and the caret stays where it is, so typing carries on
 * (`letterBefore` in `@siksamitra/edit`). A pause and a svarabhakti go AT the
 * caret, because they sit between letters.
 *
 * Word gives a custom tab two kinds of control, a button and a dropdown menu
 * (learn.microsoft.com/office/dev/add-ins/design/add-in-commands); the typing
 * help and the messages are dialogs, and Settings is the one thing that opens
 * the side panel.
 */
import type { ChantProfileKey } from '@siksamitra/format';
import { CHANT_PROFILE_KEYS, CHANT_PROFILE_NOTES } from '@siksamitra/format';
import type { MarkCommand } from '@siksamitra/edit';
import type { ReRunMode, ScriptKey } from '@siksamitra/engine';
import { ANU, VIS, getScript } from '@siksamitra/engine';
import { IAST_LEADER, IAST_PALETTE, MARK_KEYS, type Chord, type IconName, type IastKey } from '@siksamitra/ui';

/** What pressing a command does. */
export type Does =
  | { mark: MarkCommand }
  /** The rules over the selection — or, with nothing selected, the document. */
  | { rules: ReRunMode }
  /** Mark the document in this register from now on, and offer to re-mark it. */
  | { register: ChantProfileKey }
  /** Type this character at the caret, through the model (`typeAt`). */
  | { insert: string }
  /** Write the selected mantra lines — or, with nothing selected, the document — in this script. */
  | { script: ScriptKey }
  /** Make the selected lines a part with rules of its own, or undo one. */
  | 'part-new' | 'part-dissolve'
  | 'typing-help' | 'import-styles' | 'specimen' | 'panel' | 'guide';

export interface Command {
  /** Unique, ASCII, at most 20 characters: the manifest id is built from it. */
  id: string;
  /** The global function the manifest's `ExecuteFunction` names. */
  fn: string;
  label: string;
  /** What it does, in plain words. The ribbon shows it on hover. */
  tip: string;
  /** Which picture: one of the app's icons, or a character drawn as one. */
  icon: { name: IconName } | { ch: string };
  does: Does;
  /** Its keyboard shortcut in Word, from the app's own table. */
  key?: Chord;
  /** Also on the right-click menu of selected text. */
  context?: true;
}

export interface Menu {
  kind: 'menu';
  id: string;
  label: string;
  tip: string;
  icon: Command['icon'];
  items: Command[];
}

export type Control = ({ kind: 'button' } & Command) | Menu;

export interface TabGroup {
  id: string;
  label: string;
  controls: Control[];
}

/** `hold-short` → `smHoldShort`: a name `ExecuteFunction` can call. */
const fnOf = (id: string): string =>
  `sm${id.split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join('')}`;

/* Said the same way on every button that marks letters, so a person learns it once. */
const ON = ' On the selected letters, or the letter before the caret.';
const OFF = ' Press again to take it off.';
const WHOLE = ' With nothing selected, the whole document — it asks first.';

function button(c: Omit<Command, 'fn'>): Control {
  return { kind: 'button', fn: fnOf(c.id), ...c };
}

const mark = (
  id: string, label: string, tip: string, icon: IconName, command: MarkCommand,
  extra: Partial<Command> = {},
): Control => button({ id, label, tip, icon: { name: icon }, does: { mark: command }, ...extra });

/** A menu item that marks: the same command as a button, in a list. */
const markItem = (
  id: string, label: string, tip: string, icon: IconName, command: MarkCommand, extra: Partial<Command> = {},
): Command => ({ id, fn: fnOf(id), label, tip, icon: { name: icon }, does: { mark: command }, ...extra });

/** One palette key as a menu item: the character is the label and the icon. */
function insertItem(k: IastKey): Command {
  const hex = [...k.ch].map((c) => c.codePointAt(0)!.toString(16)).join('-');
  const shown = k.show ?? k.ch;
  return {
    id: `ins-${hex}`,
    fn: `smIns_${hex.replace(/-/g, '_')}`,
    label: k.name === undefined ? shown : `${shown}   ${k.name}`,
    tip: `Type ${shown} at the caret${k.name === undefined ? '' : ` — ${k.name}`}.`,
    icon: { ch: shown },
    does: { insert: k.ch },
  };
}

const paletteMenu = (id: string, label: string, tip: string, groups: number[], ch: string): Menu => ({
  kind: 'menu', id, label, tip, icon: { ch },
  items: groups.flatMap((g) => IAST_PALETTE[g]!.keys.map(insertItem)),
});

/** The scripts a line can be written in, each drawn as its own `a`. */
export const SCRIPTS: readonly (readonly [ScriptKey, string])[] = [['iast', 'ā'], ['deva', 'अ'], ['tel', 'అ'], ['tam', 'அ']];

/**
 * THE TAB, LEFT TO RIGHT IN THE ORDER A PERSON WORKS: let the rules mark the
 * text, correct what they did by hand — holdings, svaras, the other signs —
 * write it in a script, and the panel and the typing help at the end.
 *
 * SIX GROUPS, because that is Microsoft's recommended most for a tab
 * (learn.microsoft.com/office/dev/add-ins/design/add-in-commands, "Best
 * practices"). It had eight, and what is set once rather than pressed — the
 * document's styles, the specimen, the guide — went into the panel, where
 * there is room to say what each does.
 *
 * EVERY TIP SAYS THE SAME THREE THINGS in the same words: what it does, what
 * it does it to, and how it is taken back.
 */
export const TAB: readonly TabGroup[] = [
  {
    id: 'rules',
    label: 'Auto-mark',
    controls: [
      button({
        id: 'reapply', label: 'Auto-mark', icon: { name: 'auto-keep' }, does: { rules: 'keep-hand' },
        tip: 'Mark the selected lines by the śikṣā rules of their register: holdings, svaras, substitutions, aids and pauses.'
          + `${WHOLE} What you marked by hand stays.`,
        key: MARK_KEYS.reapply, context: true,
      }),
      button({
        id: 'reapply-mine-out', label: 'Auto-mark afresh', icon: { name: 'auto-replace' }, does: { rules: 'replace-all' },
        tip: `Like Auto-mark, but what you marked by hand goes too: the rules decide every mark in the selected lines.${WHOLE}`,
      }),
      {
        kind: 'menu', id: 'register', label: 'Register', icon: { name: 'tree' },
        tip: 'Which śākhā’s rules Auto-mark uses: for the part the caret is in, or for the selected lines — they become a part '
          + 'of their own. One document can hold parts of different śākhās.',
        items: [
          ...CHANT_PROFILE_KEYS.map((k): Command => ({
            id: `reg-${k}`, fn: fnOf(`reg-${k}`), label: CHANT_PROFILE_NOTES[k].name,
            tip: `${CHANT_PROFILE_NOTES[k].where}. ${CHANT_PROFILE_NOTES[k].what}`.slice(0, 250), icon: { name: 'tree' }, does: { register: k },
          })),
          {
            id: 'part-new', fn: fnOf('part-new'), label: 'New part from these lines', icon: { name: 'part-new' }, does: 'part-new',
            tip: 'Give the selected lines rules of their own — a sūkta of another śākhā among the others. '
              + 'Word draws a thin frame around the part, titled with its register.',
          },
          {
            id: 'part-dissolve', fn: fnOf('part-dissolve'), label: 'Dissolve this part', icon: { name: 'part-dissolve' }, does: 'part-dissolve',
            tip: 'Undo the part the caret is in. Its lines and their marks stay; they are outside every part again.',
          },
        ],
      },
    ],
  },
  {
    id: 'holding',
    label: 'Holding',
    controls: [
      mark('hold-short', 'Short', `A short holding: a thin box around the letter.${ON}${OFF}`,
        'hold-short', { k: 'hold', v: 'short' }, { key: MARK_KEYS.holdShort, context: true }),
      mark('hold-long', 'Long', `A long holding: a thick box around the letter.${ON}${OFF}`,
        'hold-long', { k: 'hold', v: 'long' }, { key: MARK_KEYS.holdLong, context: true }),
      {
        kind: 'menu', id: 'clear', label: 'Clear', icon: { name: 'marks-clear' },
        tip: `Take marks off — one kind, or all of them.${ON} The letters themselves stay.`,
        items: [
          markItem('hold-clear', 'Clear holdings', `Take the holdings off, and leave every other mark.${ON}`,
            'hold-none', { k: 'clear', only: ['hold'] }, { key: MARK_KEYS.clearHold, context: true }),
          markItem('clear-svara', 'Clear svaras', `Take the svaras off, and leave every other mark.${ON}`,
            'marks-clear', { k: 'clear', only: ['svara'] }),
          markItem('clear-change', 'Clear substitutions',
            `Forget which letters stand for an anusvāra or a visarga: they lose the change colour and their reading aids.${ON}`,
            'marks-clear', { k: 'clear', only: ['was', 'sup'] }),
          markItem('clear-signs', 'Clear pauses and dots', `Take the pauses and the svarabhakti dots off.${ON}`,
            'marks-clear', { k: 'clear', only: ['pause', 'sbhakti'] }),
          markItem('clear-all', 'Clear all marks', `Take every mark off: holdings, svaras, substitutions, aids, pauses and dots.${ON}`,
            'marks-clear', { k: 'clear' }),
        ],
      },
    ],
  },
  {
    id: 'svara',
    label: 'Svara',
    controls: [
      mark('svara-anudatta', 'Anudātta', `The low tone: a bar under the letter.${ON}${OFF}`,
        'svara-anudatta', { k: 'svara', v: 'anudatta' }, { context: true }),
      mark('svara-svarita', 'Svarita', `The raised tone: a stroke over the letter.${ON}${OFF}`,
        'svara-svarita', { k: 'svara', v: 'svarita' }, { context: true }),
      mark('svara-dirgha', 'Dīrgha svarita', `The long raised tone: two strokes over the letter.${ON}${OFF}`,
        'svara-dirgha', { k: 'svara', v: 'dirgha-svarita' }, { context: true }),
    ],
  },
  {
    id: 'signs',
    label: 'Signs',
    controls: [
      mark('change-anusvara', 'Anusvāra change',
        `These letters are recited in place of an anusvāra (ṁ), and are drawn in the change colour.${ON}${OFF}`,
        'change-anusvara', { k: 'was', v: ANU }, { context: true }),
      mark('change-visarga', 'Visarga change',
        `These letters are recited in place of a visarga (ḥ), and are drawn in the change colour.${ON}${OFF}`,
        'change-visarga', { k: 'was', v: VIS }, { context: true }),
      mark('candrabindu', 'Candrabindu', `The nasal m̐: the candrabindu laid on the letter.${ON}${OFF}`,
        'candrabindu', { k: 'combining', v: '̐' }),
      mark('svarabhakti', 'Svarabhakti',
        `The svarabhakti dot, at the caret — between an r and the sibilant or h after it (var·ṣa).${OFF}`,
        'svarabhakti', { k: 'sbhakti' }),
      mark('pause-short', 'Short pause', `A short pause at the caret: one bar, in blue.${OFF}`, 'bar-short', { k: 'pause', v: 'short' }),
      mark('pause-long', 'Long pause', `A long pause at the caret: one bar, in red.${OFF}`, 'bar-long', { k: 'pause', v: 'long' }),
    ],
  },
  {
    id: 'script',
    label: 'Script',
    controls: SCRIPTS.map(([script, ch]) => button({
      id: `script-${script}`, label: getScript(script)?.name ?? script, icon: { ch }, does: { script },
      tip: `Write the selected mantra lines in ${getScript(script)?.name ?? script}, every mark kept.${WHOLE} `
        + (script === 'iast' ? 'It gives back exactly what was there.' : 'IAST gives back exactly what was there.'),
    })),
  },
  {
    id: 'tools',
    label: 'śikṣāmitra',
    controls: [
      button({
        id: 'panel', label: 'Panel', icon: { name: 'panel-side' }, does: 'panel',
        tip: 'The śikṣāmitra panel: what is marked where the caret is, every mark at one click, the register and the rules, '
          + 'and the document’s styles.',
      }),
      button({
        id: 'typing-help', label: 'Typing help', icon: { name: 'keyboard' }, does: 'typing-help',
        tip: 'Every IAST letter and Vedic sign on one keyboard. Press a letter for its long or dotted form (a → ā, t → ṭ), or click a key.',
        key: { key: 'i', ctrl: true, shift: true },
      }),
      paletteMenu('ins-vowels', 'Vowels', 'Type a long vowel, vocalic ṛ or ḷ, the anusvāra or the visarga at the caret.', [0], 'ā'),
      paletteMenu('ins-consonants', 'Consonants', 'Type a consonant at the caret, by where it is spoken: gutturals to sibilants.', [1, 2, 3, 4, 5, 6], 'ṭ'),
      paletteMenu('ins-vedic', 'Vedic', 'Type a Vedic sign, accent or punctuation at the caret: ḻ, ꣳ, the daṇḍas and the avagraha.', [7], '।'),
    ],
  },
];

const commandsOf = (c: Control): Command[] => (c.kind === 'menu' ? c.items : [c]);

/** Every command, menu items included. */
export const COMMANDS: readonly Command[] = TAB.flatMap((g) => g.controls.flatMap(commandsOf));

/**
 * THE APP'S F9 LEADER, AS ONE CHORD PER LETTER.
 *
 * In the app F9 and then `s` types ś. Word lets a shortcut be one chord and
 * never a sequence, and never a function key, so here it is Alt with the same
 * letter: Alt+S for ś, Alt+Shift+S for ṣ — the capital half of the table is
 * Shift, exactly as in the app. Every letter comes from `IAST_LEADER`, the
 * table F9 reads, so the two cannot disagree. Alt and not Ctrl+Alt, because
 * Ctrl+Alt IS AltGr on a Croatian keyboard and would take { } @ € from it.
 */
export const LEADER_COMMANDS: readonly Command[] = Object.entries(IAST_LEADER).map(([letter, ch]): Command => {
  const upper = letter !== letter.toLowerCase();
  const code = upper ? `${letter.toLowerCase()}-up` : letter;
  return {
    id: `alt-${code}`, fn: `smAlt_${code.replace('-', '_')}`,
    label: `Type ${ch}`, tip: `Type ${ch} at the caret.`, icon: { ch },
    does: { insert: ch },
    key: { key: letter.toLowerCase(), alt: true, ...(upper ? { shift: true as const } : {}) },
  };
});

/**
 * WHAT THE PANEL DOES THAT THE TAB DOES NOT — set once rather than pressed,
 * so it has the room to say what it does (`ui/Panel.tsx`). The same commands
 * as the tab's, run by the same `run`; only where they are pressed differs.
 */
export const PANEL_COMMANDS: readonly Command[] = [
  {
    id: 'import-styles', fn: fnOf('import-styles'), label: 'Import styles', icon: { name: 'style-import' }, does: 'import-styles',
    tip: 'Bring the śikṣāmitra styles into this document — the mantra line, the translation, the holdings, the svaras and '
      + 'the rest — so it looks like a Veda Union document. A document in the older names is taken into the clean ones.',
  },
  {
    id: 'specimen', fn: fnOf('specimen'), label: 'Add a specimen', icon: { name: 'document' }, does: 'specimen',
    tip: 'Add the styles and a short marked passage at the end of the document, to see every mark as Word draws it.',
  },
  {
    id: 'guide', fn: fnOf('guide'), label: 'What the marks mean', icon: { name: 'help' }, does: 'guide',
    tip: 'The notation, mark by mark, in the browser.',
  },
];

/** Everything the runtime registers: the tab's, the panel's and the leader's. */
export const ALL_COMMANDS: readonly Command[] = [...COMMANDS, ...PANEL_COMMANDS, ...LEADER_COMMANDS];

/** Every picture the tab needs, by the file name it is drawn to. */
export const iconFile = (icon: Command['icon']): string => ('name' in icon
  ? icon.name
  : `ch-${[...icon.ch].map((c) => c.codePointAt(0)!.toString(16)).join('-')}`);

export const ICONS_NEEDED: readonly Command['icon'][] = [
  ...TAB.flatMap((g) => g.controls.flatMap((c) => [c.icon, ...(c.kind === 'menu' ? c.items.map((i) => i.icon) : [])])),
  { name: 'marks' },
];

/** The ribbon's register menu offers these; `register` keeps the list honest. */
export const REGISTERS: readonly ChantProfileKey[] = CHANT_PROFILE_KEYS;
