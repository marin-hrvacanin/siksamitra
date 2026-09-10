/**
 * WHAT THE PANE OFFERS — the buttons, as data.
 *
 * Two holding weights, three svaras, the reading aids, the two pauses. The list
 * is here rather than in the markup because the same table draws the buttons,
 * decides which one is lit, and says which command a press runs; three copies
 * of it is three chances for a button to be labelled one thing and do another.
 *
 * TWO HOLDING BUTTONS, NOT FOUR. `None` and `Clear` are gone from the holding
 * row: they existed because derivation ran continuously and had to be
 * suppressed. Pressing Long on a long holding removes it, and the record that
 * makes the removal survive a re-run is written without anybody learning the
 * word "none" — see `model/command.ts`.
 */
import type { Stage } from '@siksamitra/format';
import type { MarkCommand } from '../model/command.js';

export interface Control {
  /** The key `selectionState` reports this button's coverage under. */
  state?: string;
  label: string;
  /** What it means, in the pane's own words. Shown as the tooltip. */
  tip: string;
  /** Which palette the button wears — see `pane.css`. */
  mark: 'hold-short' | 'hold-long' | 'svara' | 'aid' | 'pause';
  command: MarkCommand;
  /** A point marking has no width, so it is placed at the caret. */
  point?: true;
}

export interface Group {
  title: string;
  controls: Control[];
}

export const GROUPS: readonly Group[] = [
  {
    title: 'Holding',
    controls: [
      {
        state: 'hold-short',
        label: 'Short',
        tip: 'A thin box — 0.25 pt, his `Holding` style. Press again to take it off.',
        mark: 'hold-short',
        command: { k: 'hold', v: 'short' },
      },
      {
        state: 'hold-long',
        label: 'Long',
        tip: 'A thick box — 1.5 pt, his `2Holding` style. The weight is the only '
          + 'difference between the two.',
        mark: 'hold-long',
        command: { k: 'hold', v: 'long' },
      },
    ],
  },
  {
    title: 'Svara',
    controls: [
      {
        state: 'anudatta',
        label: 'Anudātta',
        tip: 'The low tone — a bar under the letter.',
        mark: 'svara',
        command: { k: 'svara', v: 'anudatta' },
      },
      {
        state: 'svarita',
        label: 'Svarita',
        tip: 'The falling tone — a stroke over the letter.',
        mark: 'svara',
        command: { k: 'svara', v: 'svarita' },
      },
      {
        state: 'dirgha-svarita',
        label: 'Dīrgha svarita',
        tip: 'The long falling tone — a double stroke over the letter.',
        mark: 'svara',
        command: { k: 'svara', v: 'dirgha-svarita' },
      },
    ],
  },
  {
    title: 'Aids',
    controls: [
      {
        label: 'Candrabindu',
        /* A CHARACTER, not a marking — U+0310 laid on the letter. It was a
           marking until the run renderer showed it could not be drawn as one:
           a run is one element with one text node, with nowhere for a mark
           laid over a letter to live. */
        tip: 'The nasalised `m̐` — the combining mark, typed onto each letter.',
        mark: 'aid',
        command: { k: 'combining', v: '̐' },
      },
      {
        label: 'Svarabhakti',
        tip: 'The epenthetic dot, written before the letter it belongs to.',
        mark: 'aid',
        command: { k: 'sbhakti' },
        point: true,
      },
      {
        label: 'Pause',
        tip: 'A short pause — one bar, in his `Pause` style.',
        mark: 'pause',
        command: { k: 'pause', v: 'short' },
        point: true,
      },
      {
        label: 'Long pause',
        tip: 'A long pause — two bars.',
        mark: 'pause',
        command: { k: 'pause', v: 'long' },
        point: true,
      },
      {
        label: 'Clear',
        tip: 'Withdraw every marking in the selection.',
        mark: 'aid',
        command: { k: 'clear' },
      },
    ],
  },
];

/**
 * THE FIVE STAGES, in the pane's words rather than the engine's.
 *
 * `Stage` is `sandhi | change | holdings | svara | aids` — identifiers, and
 * the pane printed them as they are: five lowercase words in a row beside
 * five checkboxes, three of which mean nothing to a reader. `svara` is a
 * technical term the audience knows; `change` is not, and it does not mean
 * "change" — it means a letter the rules REPLACED.
 *
 * Here rather than in `packages/format`, because it is display text for this
 * pane and the engine has no business holding English. A stage with no label
 * falls back to its id and `setup.test.ts` fails, so adding one to the engine
 * makes somebody write a word for it.
 */
export const STAGE_LABEL: Readonly<Record<Stage, string>> = {
  sandhi: 'Sandhi',
  change: 'Substitutions',
  holdings: 'Holdings',
  svara: 'Accents',
  aids: 'Reading aids',
};
