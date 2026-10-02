/**
 * WHAT A DELIVERED FILE IS, SAID BY THE PROGRAM — from the document in it.
 *
 * The bot once described a Gāyatrī it had not sent: "compared word for word"
 * with a witness it had read twenty lines of. The description now comes from
 * the file's own document and the witnesses it was built from.
 */
import { describe, expect, it } from 'vitest';
import { Workspace, describeDocument, documentOf } from '../index.js';

describe('a delivered file, described', () => {
  it('names the text, its tradition, its source line, how many verses and how it begins', () => {
    const ws = new Workspace();
    ws.keep('https://sanskritdocuments.org/doc_veda/bhu.html', 'bhū sūktam', ['bhūmir bhūmnā dyaur variṇā ।', 'upasthe te devyadite ॥ 1॥']);
    ws.open(documentOf({
      title: 'bhū sūktam', subtitle: 'kṛṣṇa yajurvedīya', locus: 'taittirīya saṁhitā 1.5.3',
      sections: [{ verses: [{ lines: ['bhūmir bhūmnā dyaur variṇā ।', 'upasthe te devyadite ॥ 1॥'] }] }],
    }));
    ws.builtFrom.set(ws.need().sections[0]!.id, { witness: 'w1', from: 1, to: 2 });
    const said = describeDocument(ws, ws.need(), 'Checked: every letter is the source’s, every mark the rules’.');
    expect(said.split('\n')).toEqual([
      'bhū sūktam — kṛṣṇa yajurvedīya',
      'From: taittirīya saṁhitā 1.5.3',
      /* Two pādas of eight, so one line of his (`pairedPadas`). */
      '1 verse, beginning “bhūmir bhūmnā dyaur variṇā । upasthe te devyadite ॥”',
      'Its letters are those of bhū sūktam (sanskritdocuments.org).',
      'Checked: every letter is the source’s, every mark the rules’.',
    ]);
  });

  it('says so when the letters were typed and not taken from a source', () => {
    const ws = new Workspace();
    ws.open(documentOf({ title: 'x', sections: [{ verses: [{ lines: ['oṁ ।'] }] }] }));
    expect(describeDocument(ws, ws.need(), 'Checked.')).toContain('Its letters were typed, not taken from a source.');
  });
});
