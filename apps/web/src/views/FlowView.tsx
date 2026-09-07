/**
 * The flow view — continuous scroll, for writing.
 *
 * The default, because an author spends their day here. No page furniture and
 * nothing that moves while you type: a break indicator that jumped as you
 * added a syllable would pull the eye off the word being edited.
 *
 * The column is the PAGE's content box, not an arbitrary reading measure, so a
 * line that fits here fits on paper. Switching to pages then reflows nothing —
 * which is what makes the two views feel like one document.
 */

import type { ReactNode } from 'react';
import type { ChantDoc, ChantScriptKey } from '@siksamitra/format';
import { flowColumnWidthPx, type PageGeometry } from '@siksamitra/layout';
import { DocumentBlocks } from './DocumentBlocks.js';

export function FlowView(
  { doc, script, showMarks, page, zoom }: {
    doc: ChantDoc;
    script: ChantScriptKey;
    showMarks: boolean;
    page: PageGeometry;
    zoom: number;
  },
): ReactNode {
  return (
    <div className="flow">
      <div
        className="flow__column chant-marks"
        style={{ width: `${flowColumnWidthPx(page, zoom)}px`, fontSize: `${zoom}rem` }}
      >
        <DocumentBlocks doc={doc} script={script} showMarks={showMarks} />
      </div>
    </div>
  );
}
