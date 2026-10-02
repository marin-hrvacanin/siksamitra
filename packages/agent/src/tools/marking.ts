/**
 * THE RULES, RUN — Re-apply rules pressed, over every section or one.
 * Shared by the tools that build a document and those that check one.
 */
import type { ChantProfileKey } from '@siksamitra/format';
import { STAGES } from '@siksamitra/engine';
import type { Workspace } from '../workspace.js';

/** Every verse of every section (or of one) run by the rules — Re-apply rules, pressed. */
export function markAll(ws: Workspace, mode: 'keep-hand' | 'replace-all', only?: string, previous?: ChantProfileKey): string {
  const doc = ws.need();
  const said: string[] = [];
  for (const s of doc.sections) {
    if (only !== undefined && s.id !== only) continue;
    if (s.verses.length === 0) continue;
    said.push(`${s.id}: ${ws.run({
      k: 'recompute', sectionId: s.id, verseIds: s.verses.map((v) => v.id), stages: STAGES, mode,
      ...(previous === undefined ? {} : { previous }),
    })}`);
  }
  return said.join('\n');
}

