/**
 * THE RULES AGREE WITH THEMSELVES OVER WHAT THE AGENT BUILDS.
 *
 * `check` runs the rules once more over a copy and calls any change an error.
 * On a real run (bhū sūktam, 2026-10-02) it found one: a source that wrote the
 * gum out as letters (`pratīcīmenāgm̐`) was marked bare by `build_document`
 * and with its reading aid by the second run — the agent rebuilt the document
 * and ran out of steps before delivering it.
 */
import { describe, expect, it } from 'vitest';
import { toTextAndMarks } from '@siksamitra/format';
import { Workspace, checkDocument, documentOf } from '../index.js';
import { markAll } from '../tools/document.js';

const key = (ws: Workspace): string => ws.need().sections
  .flatMap((s) => s.verses)
  .map((v) => { const tm = toTextAndMarks(v); return `${tm.text}|${tm.marks.map((m) => `${m.k}:${m.from}:${m.to}:${m.v ?? ''}`).sort().join(',')}`; })
  .join('\n');

describe('a document the agent built, marked twice', () => {
  it('is the same document — the gum written out in its source included', () => {
    const ws = new Workspace();
    ws.open(documentOf({
      title: 'bhū sūktam',
      sections: [{ verses: [
        { lines: ['ma̱hīṁ de̱vīṁ viṣṇu̍patnīm ajū̱ryām ।', 'pra̱tīcī̍menāgm̐ ha̱viṣā̍ yajāmaḥ ॥'] },
        { lines: ['puṇya̱ggm̐ śloka̱ṁ yaja̍mānāya kṛṇva̱tī ॥'] },
      ] }],
    }));
    ws.run({ k: 'profile', scope: 'document', preset: 'taittiriya' });
    markAll(ws, 'keep-hand');
    const once = key(ws);
    markAll(ws, 'keep-hand');
    expect(key(ws)).toBe(once);
    expect(checkDocument(ws).filter((f) => f.severity === 'error')).toEqual([]);
  });
});
