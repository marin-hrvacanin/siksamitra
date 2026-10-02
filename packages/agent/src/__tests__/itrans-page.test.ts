/**
 * A SANSKRITDOCUMENTS `.itx`, FETCHED — read into IAST, a line for a line, and
 * built from. A real run fetched one, built from it, and was refused ten
 * times: the program held the model's IAST to letters it could not read
 * (2026-10-02).
 */
import { describe, expect, it } from 'vitest';
import { Workspace, checkDocument, toolsFor, type Host } from '../index.js';
import { isItransPage, readItrans } from '../itrans-page.js';

const ITX = [
  '% Text title            : sUryAShTottarashatanAmastotram',
  '% File name             : sUryAShTottarashatanAmastotram.itx',
  '\\documentstyle[11pt,multicol,itrans]{article}',
  '#include=ijag.inc',
  '\\begin{document}',
  '\\engtitle{.. shrI sUryAShTottarashatanAma stotram ..}##',
  'vaishampAyana uvAcha |',
  'shR^iNuShvAvahito rAjan shuchirbhUtvA samAhitaH |',
  'kShaNaM cha kuru rAjendra guhyaM vakShyAmi te hitam || 1||',
  'oM hrAM aghora shrIsUryanArAyaNAya \\- a~NguShThAbhyAM namaH \\- hR^idayAyanamaH',
  '\\end{document}',
];

describe('an ITRANS file', () => {
  it('is known by its address, or by its header and its typesetting', () => {
    expect(isItransPage('https://sanskritdocuments.org/doc_z_misc_navagraha/x.itx', [])).toBe(true);
    expect(isItransPage('https://example.org/page', ITX)).toBe(true);
    expect(isItransPage('https://sanskritdocuments.org/x.html', ['श्रीसूर्याष्टोत्तरशतनामस्तोत्रम्'])).toBe(false);
  });

  it('is read into IAST a line for a line; its header and its typesetting are left as they are', () => {
    const read = readItrans(ITX);
    expect(read).toHaveLength(ITX.length);
    expect(read.slice(0, 5)).toEqual(ITX.slice(0, 5));
    expect(read[6]).toBe('vaiśampāyana uvāca ।');
    expect(read[7]).toBe('śṛṇuṣvāvahito rājan śucirbhūtvā samāhitaḥ ।');
    expect(read[8]).toBe('kṣaṇaṁ ca kuru rājendra guhyaṁ vakṣyāmi te hitam ॥ 1॥');
    expect(read[9]).toBe('oṁ hrāṁ aghora śrīsūryanārāyaṇāya - aṅguṣṭhābhyāṁ namaḥ - hṛdayāyanamaḥ');
  });

  it('fetched, it is a witness of IAST lines, said so — and a verse is built from it and checked', async () => {
    const delivered: unknown[] = [];
    const host: Host = {
      research: { search: async () => [], fetch: async () => ({ title: 'sUryAShTottarashatanAmastotram.itx', text: ITX.join('\n') }) },
      exporters: { pdf: async (_d, name) => ({ name: `${name}.pdf`, mime: '', bytes: new Uint8Array(1), format: 'pdf' }) },
      deliver: async (f) => { delivered.push(f); },
    };
    const ws = new Workspace();
    const run = (name: string, args: Record<string, unknown>) => toolsFor('deliver', host).find((t) => t.spec.name === name)!.run(args, { ws, host, review: async () => '' });
    const said = await run('fetch_page', { url: 'https://sanskritdocuments.org/doc_z_misc_navagraha/sUryAShTottarashatanAmastotram.itx' });
    expect(said).toMatch(/an ITRANS file, read into IAST by the program a line for a line/);
    expect(ws.witnesses.get('w1')!.lines[7]).toBe('śṛṇuṣvāvahito rājan śucirbhūtvā samāhitaḥ ।');
    await run('build_document', {
      title: 'sūryāṣṭottaraśatanāma stotram', source: 'smarta', locus: 'mahābhārata, āraṇyakaparvan 3.3',
      sections: [{ verses: [{ witness: 'w1', at: '7-9', spaced: ['vaiśampāyana uvāca ।', 'śṛṇuṣvāvahito rājan śucir bhūtvā samāhitaḥ ।', 'kṣaṇaṁ ca kuru rājendra guhyaṁ vakṣyāmi te hitam ॥'] }] }],
    });
    expect(checkDocument(ws).filter((f) => f.severity === 'error')).toEqual([]);
  });
});
