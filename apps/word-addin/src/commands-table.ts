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
  | 'typing-help' | 'import-styles' | 'specimen' | 'settings' | 'guide';

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

const WITH_CARET = ' With nothing selected, the letter before the caret.';

function button(c: Omit<Command, 'fn'>): Control {
  return { kind: 'button', fn: fnOf(c.id), ...c };
}

const mark = (
  id: string, label: string, tip: string, icon: IconName, command: MarkCommand,
  extra: Partial<Command> = {},
): Control => button({ id, label, tip, icon: { name: icon }, does: { mark: command }, ...extra });

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
const SCRIPTS: readonly (readonly [ScriptKey, string])[] = [['iast', 'ā'], ['deva', 'अ'], ['tel', 'అ'], ['tam', 'அ']];

export const TAB: readonly TabGroup[] = [
  {
    id: 'holding',
    label: 'Holding',
    controls: [
      mark('hold-short', 'Short', `A short holding: a thin box around the letters.${WITH_CARET} Press again to take it off.`,
        'hold-short', { k: 'hold', v: 'short' }, { key: MARK_KEYS.holdShort, context: true }),
      mark('hold-long', 'Long', `A long holding: a thick box around the letters.${WITH_CARET} Press again to take it off.`,
        'hold-long', { k: 'hold', v: 'long' }, { key: MARK_KEYS.holdLong, context: true }),
      mark('hold-clear', 'Clear', `Take the holding off the letters, and leave every other marking.${WITH_CARET}`,
        'marks-clear', { k: 'clear', only: ['hold'] }, { key: MARK_KEYS.clearHold, context: true }),
    ],
  },
  {
    id: 'svara',
    label: 'Svara',
    controls: [
      mark('svara-anudatta', 'Anudātta', `The low tone: a bar under the letter.${WITH_CARET} Press again to take it off.`,
        'svara-anudatta', { k: 'svara', v: 'anudatta' }, { context: true }),
      mark('svara-svarita', 'Svarita', `The raised tone: a stroke over the letter.${WITH_CARET} Press again to take it off.`,
        'svara-svarita', { k: 'svara', v: 'svarita' }, { context: true }),
      mark('svara-dirgha', 'Dīrgha svarita', `The long raised tone: two strokes over the letter.${WITH_CARET} Press again to take it off.`,
        'svara-dirgha', { k: 'svara', v: 'dirgha-svarita' }, { context: true }),
    ],
  },
  {
    id: 'change',
    label: 'Change',
    controls: [
      mark('change-anusvara', 'Anusvāra', `These letters are recited in place of an anusvāra (ṁ), and are drawn in the change colour.${WITH_CARET}`,
        'change-anusvara', { k: 'was', v: ANU }, { context: true }),
      mark('change-visarga', 'Visarga', `These letters are recited in place of a visarga (ḥ), and are drawn in the change colour.${WITH_CARET}`,
        'change-visarga', { k: 'was', v: VIS }, { context: true }),
    ],
  },
  {
    id: 'aids',
    label: 'Reading aids',
    controls: [
      mark('candrabindu', 'Candrabindu', `The nasal m̐: the candrabindu laid on the letter.${WITH_CARET} Press again to take it off.`,
        'candrabindu', { k: 'combining', v: '̐' }),
      mark('svarabhakti', 'Svarabhakti', 'The svarabhakti dot, at the caret: between an r and the sibilant or h after it (var·ṣa).',
        'svarabhakti', { k: 'sbhakti' }),
      mark('pause-short', 'Short pause', 'A short pause at the caret: one bar.', 'bar-short', { k: 'pause', v: 'short' }),
      mark('pause-long', 'Long pause', 'A long pause at the caret: two bars.', 'bar-long', { k: 'pause', v: 'long' }),
      mark('clear-all', 'Clear all', 'Take every marking off the selected letters: holdings, svaras, changes, aids and pauses.',
        'marks-clear', { k: 'clear' }),
    ],
  },
  {
    id: 'insert',
    label: 'Insert',
    controls: [
      button({
        id: 'typing-help', label: 'Typing help', icon: { name: 'keyboard' }, does: 'typing-help',
        tip: 'Every IAST letter and Vedic sign on one keyboard. Press a letter for its long or dotted form (a → ā, t → ṭ), or click a key.',
        key: { key: 'i', ctrl: true, shift: true },
      }),
      paletteMenu('ins-vowels', 'Vowels', 'Long vowels, vocalic ṛ and ḷ, the anusvāra and the visarga.', [0], 'ā'),
      paletteMenu('ins-consonants', 'Consonants', 'The consonants, by where they are spoken: gutturals to sibilants.', [1, 2, 3, 4, 5, 6], 'ṭ'),
      paletteMenu('ins-vedic', 'Vedic', 'Vedic signs, accents and punctuation: ḻ, ꣳ, the daṇḍas and the avagraha.', [7], '।'),
    ],
  },
  {
    id: 'script',
    label: 'Script',
    controls: [{
      kind: 'menu', id: 'script', label: 'Script', icon: { name: 'script' },
      tip: 'Write the mantra lines in IAST, Devanāgarī, Telugu or Tamil — the selected ones, or the whole document '
        + 'when nothing is selected. Every mark is kept, and IAST again gives back exactly what was there.',
      items: SCRIPTS.map(([script, ch]): Command => ({
        id: `script-${script}`, fn: fnOf(`script-${script}`), label: getScript(script)?.name ?? script, icon: { ch },
        tip: `Write the selected mantra lines in ${getScript(script)?.name ?? script}, or the whole document when nothing is selected.`,
        does: { script },
      })),
    }],
  },
  {
    id: 'rules',
    label: 'Rules',
    controls: [
      {
        kind: 'menu', id: 'register', label: 'Register', icon: { name: 'tree' },
        tip: 'Which śākhā’s rules mark the text here — this part, or the document outside every part. '
          + 'A document may hold parts marked by different rules.',
        items: [
          ...CHANT_PROFILE_KEYS.map((k): Command => ({
            id: `reg-${k}`, fn: fnOf(`reg-${k}`), label: CHANT_PROFILE_NOTES[k].name,
            tip: `${CHANT_PROFILE_NOTES[k].where}. ${CHANT_PROFILE_NOTES[k].what}`.slice(0, 250), icon: { name: 'tree' }, does: { register: k },
          })),
          {
            id: 'part-new', fn: fnOf('part-new'), label: 'New part from these lines', icon: { name: 'part-new' }, does: 'part-new',
            tip: 'Give the selected lines rules of their own — a sūkta of another śākhā in the middle of the document. '
              + 'Word draws a frame around the part, titled with its register.',
          },
          {
            id: 'part-dissolve', fn: fnOf('part-dissolve'), label: 'Dissolve this part', icon: { name: 'part-dissolve' }, does: 'part-dissolve',
            tip: 'Undo the part the caret is in: its lines stay, and the document’s own rules apply to them again.',
          },
        ],
      },
      button({
        id: 'reapply', label: 'Re-apply rules', icon: { name: 'auto-keep' }, does: { rules: 'keep-hand' },
        tip: 'Run the marking rules over the selection, or over the whole document when nothing is selected. What you placed by hand stays.',
        key: MARK_KEYS.reapply, context: true,
      }),
      button({
        id: 'reapply-mine-out', label: 'Re-apply, mine out', icon: { name: 'auto-replace' }, does: { rules: 'replace-all' },
        tip: 'Run the marking rules and DROP what you placed by hand, over the selection or the whole document.',
      }),
    ],
  },
  {
    id: 'document',
    label: 'Document',
    controls: [
      button({
        id: 'import-styles', label: 'Import styles', icon: { name: 'style-import' }, does: 'import-styles',
        tip: 'Bring the śikṣāmitra styles into this document — the mantra line, the translation, the holdings, the svaras and the rest — so it looks like a Veda Union document.',
      }),
      button({
        id: 'specimen', label: 'Specimen', icon: { name: 'document' }, does: 'specimen',
        tip: 'Add the styles and a short marked passage at the end of the document, to see every mark as Word draws it.',
      }),
      button({
        id: 'settings', label: 'Settings', icon: { name: 'settings' }, does: 'settings',
        tip: 'The register and which rules run, the styles in this document, and the keyboard shortcuts — in the side panel.',
      }),
      button({
        id: 'guide', label: 'What the marks mean', icon: { name: 'help' }, does: 'guide',
        tip: 'The notation, mark by mark, in the browser.',
      }),
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

/** Everything the runtime registers: the tab's commands and the leader's. */
export const ALL_COMMANDS: readonly Command[] = [...COMMANDS, ...LEADER_COMMANDS];

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
