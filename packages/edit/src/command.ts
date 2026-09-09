/**
 * WHAT MAY BE DONE TO A DOCUMENT — the whole list, in one place.
 *
 * Six commands, and every editing gesture is one of them. Typing, deleting,
 * pasting three verses, splitting a line and joining two verses are all
 * `replace` — one range replacement — so they cannot disagree about what a
 * verse boundary is. A holding is `mark`; withdrawing an opinion is `unmark`;
 * `recompute` is the one command that runs the engine — over the stages named,
 * keeping or replacing what was placed by hand; and everything done to a
 * picture is `figure`.
 *
 * There used to be an `auto-holdings` alongside it, which handed the holdings
 * back to the rules by editing the OVERRIDE list. Nothing writes overrides any
 * more — a marking is a range over the verse's text — so it acted on a store
 * that was always empty. `recompute` with `stages: ['holdings']` is the same
 * request, said once.
 *
 * Split from `session.ts` at the 400-line module gate. The machinery that
 * applies them is there; what they ARE is here, because the list is what a
 * reader wants first and it is the part that grows.
 */
import type { OverrideField, ReRunMode } from '@siksamitra/engine';
import type { Stage } from '@siksamitra/format';
import type { MarkPatch, MarkReason, UnitAddress } from './marks.js';
import type { FigureCommand } from './figures.js';
import type { ProfileChange } from './set-profile.js';

export type EditCommand =
  /** Replace a flat range of one section's source. Every text change is this. */
  | {
    k: 'replace';
    sectionId: string;
    from: number;
    to: number;
    insert: string;
    /** Ids for verses a paste creates, in order. */
    newIds?: readonly string[];
    /** Same key as the previous command ⇒ one undo step. */
    coalesce?: string;
  }
  /** Place marks on letters by hand. */
  | {
    k: 'mark';
    sectionId: string;
    targets: readonly UnitAddress[];
    patch: MarkPatch;
    why: MarkReason;
    note?: string;
  }
  /** Withdraw an opinion, letting the rules decide again. */
  | {
    k: 'unmark';
    sectionId: string;
    targets: readonly UnitAddress[];
    fields: readonly OverrideField[];
  }
  /**
   * RUN THE RULES, because a person asked.
   *
   * The only command that invokes the engine's marking rules. Typing does not,
   * opening a document does not, changing the script does not — the owner's
   * question was "why does the engine immediately write the holdings and all
   * that? Who said that?", and the answer is that now nobody does unless they
   * press this.
   *
   * Per verse, per stage, keeping or replacing what was placed by hand. The
   * work is `rerun` in `@siksamitra/engine`, which the Word add-in's task pane
   * calls too — one implementation, so the two cannot drift.
   */
  | {
    k: 'recompute';
    sectionId: string;
    verseIds: readonly string[];
    stages: readonly Stage[];
    mode: ReRunMode;
  }
  /** A picture: put one in, change one, take one out — see `figures.ts`. */
  | FigureCommand
  /** Change which register's rules govern the document, or one section. */
  | ProfileChange;
