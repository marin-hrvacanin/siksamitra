/**
 * What the last edit did — the honest half of the status bar.
 *
 * Every refusal and every hand-placed mark that could not follow the text is
 * shown HERE, once, plainly. The alternative is what most editors do: succeed
 * partially and say nothing, so an author discovers three years later that a
 * box moved. This program can tell them, so it does.
 *
 * Not a toast. A toast is gone before it is read and cannot be re-read; this
 * sits in the status bar until the next command replaces it.
 */
import type { ReactNode } from 'react';
import { caretLabel } from './EditorSurface.js';
import type { Session } from './useSession.js';

export function EditStatus({ session }: { session: Session }): ReactNode {
  if (!session.editing) return null;

  const problems = [
    ...session.refusals,
    ...session.lostMarks.map((m) => (
      `a ${m.override.why} mark on "${m.override.ch ?? '?'}" `
      + `in ${m.override.at.verse} could not follow the text: ${m.why}`
    )),
    ...session.orphaned.map((id) => (
      `verse "${id}" is gone — its recording and word analysis point at nothing`
    )),
  ];

  return (
    <>
      <span className="status__caret">{caretLabel(session)}</span>
      {problems.length > 0 && (
        <span className="status__warn" title={problems.join('\n')}>
          {problems[0]}
          {problems.length > 1 && ` (+${problems.length - 1} more)`}
        </span>
      )}
    </>
  );
}
