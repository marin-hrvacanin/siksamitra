/**
 * THE BASE EDITION'S TYPO, READ AS ANOTHER WITNESS HAS IT — and the edition's
 * own line labels, which are no letters.
 *
 * A real run (2026-10-02): its base edition wrote `aṣṭotara`, the model wrote
 * the right `aṣṭottara`, and the program refused it, five builds over — every
 * letter is a source's, and there was no way to say which other source had it
 * right. And the critical edition's `03003018a` labels made every one of its
 * lines "a changed letter".
 */
import { describe, expect, it } from 'vitest';
import { Workspace, checkDocument, toolsFor } from '../index.js';
import { withReadings } from '../readings.js';
import { testHost } from './fixtures.js';

const BASE = ['अस्य श्रीसूर्याष्टोतरशतनामस्तोत्रमहामन्त्रस्य, ब्रह्मा ऋषिः,'];
const OTHER = ['asya śrī sūryāṣṭottaraśatanāma stotra mahāmantrasya brahmā ṛṣiḥ'];

const kept = (): Workspace => {
  const ws = new Workspace();
  ws.keep('https://sanskritdocuments.org/x.html', 'base', BASE);
  ws.keep('https://stotranidhi.com/y', 'other', OTHER);
  ws.keep('https://bombay.indology.info/mahabharata/text/UR/MBh03.txt', 'MBh 3', [
    "03003018a sūryo 'ryamā bhagas tvaṣṭā pūṣārkaḥ savitā raviḥ",
    '03003018c gabhastimān ajaḥ kālo mṛtyur dhātā prabhākaraḥ',
  ]);
  return ws;
};

describe('a reading another witness has', () => {
  it('goes in for the base edition’s word, when that witness has it', () => {
    const ws = kept();
    expect(withReadings(BASE, [{ source: 'śrīsūryāṣṭotaraśatanāmastotramahāmantrasya', read: 'śrīsūryāṣṭottaraśatanāmastotramahāmantrasya', witness: 'w2' }], ws.witnesses, 'w1'))
      .toEqual(['asya śrīsūryāṣṭottaraśatanāmastotramahāmantrasya brahmā ṛṣiḥ']);
  });

  it('and is refused when the witness does not have it, is the verse’s own, or the word is not in the line', () => {
    const ws = kept();
    expect(() => withReadings(BASE, [{ source: 'brahmā', read: 'viṣṇu', witness: 'w2' }], ws.witnesses, 'w1')).toThrow(/"viṣṇu" is not in w2/);
    expect(() => withReadings(BASE, [{ source: 'brahmā', read: 'brahmā', witness: 'w1' }], ws.witnesses, 'w1')).toThrow(/ANOTHER witness/);
    expect(() => withReadings(BASE, [{ source: 'rudraḥ', read: 'brahmā', witness: 'w2' }], ws.witnesses, 'w1')).toThrow(/"rudraḥ" is not in the verse's lines/);
  });

  it('built with it, the verse is the corrected one — the check holds it, the reviewer is told', async () => {
    const ws = kept();
    const host = testHost();
    const asked: string[] = [];
    const run = (name: string, args: Record<string, unknown>) => toolsFor('deliver', host).find((t) => t.spec.name === name)!
      .run(args, { ws, host, review: async (task) => { asked.push(task); return 'VERDICT: clean'; } });
    const without = run('build_document', {
      title: 'x', source: 'smarta',
      sections: [{ title: 'viniyogaḥ', verses: [{ witness: 'w1', at: '1', spaced: ['asya śrīsūryāṣṭottaraśatanāmastotramahāmantrasya ।', 'brahmā ṛṣiḥ ॥'], numbered: false }] }],
    });
    await expect(without).rejects.toThrow(/readings: \[\{ source, read, witness \}\]/);
    await run('build_document', {
      title: 'x', source: 'smarta',
      sections: [{ title: 'viniyogaḥ', verses: [{
        witness: 'w1', at: '1', spaced: ['asya śrīsūryāṣṭottaraśatanāmastotramahāmantrasya ।', 'brahmā ṛṣiḥ ॥'], numbered: false,
        readings: [{ source: 'śrīsūryāṣṭotaraśatanāmastotramahāmantrasya', read: 'śrīsūryāṣṭottaraśatanāmastotramahāmantrasya', witness: 'w2' }],
      }] }],
    });
    expect(checkDocument(ws).filter((f) => f.severity === 'error')).toEqual([]);
    await run('review', { focus: 'the viniyoga' });
    expect(asked[0]).toContain('reading “śrīsūryāṣṭottaraśatanāmastotramahāmantrasya” with w2 for “śrīsūryāṣṭotaraśatanāmastotramahāmantrasya”');
  });
});

describe('an edition’s own line labels', () => {
  it('are no letters: the critical text is built from as it is', async () => {
    const ws = kept();
    const host = testHost();
    await toolsFor('deliver', host).find((t) => t.spec.name === 'build_document')!.run({
      title: 'sūryāṣṭottaraśatanāma stotram', source: 'smarta', locus: 'mahābhārata, āraṇyakaparvan 3.3.18',
      sections: [{ verses: [{ witness: 'w3', at: '1-2', spaced: ["sūryo'ryamā bhagas tvaṣṭā pūṣārkaḥ savitā raviḥ ।", 'gabhastimān ajaḥ kālo mṛtyur dhātā prabhākaraḥ ॥'] }] }],
    }, { ws, host, review: async () => '' });
    expect(checkDocument(ws).filter((f) => f.severity === 'error')).toEqual([]);
  });
});

describe('a stotra’s svaras are the rules’, not its source’s', () => {
  /* The rules place a śloka's svaras by its verse among the others, so a verse
     marked again on its own can carry other ones. Compared as letters, two
     real runs were told a stotra's verse "differs from its source" where no
     letter did (2026-10-02). The letters are compared without them; whether
     the marks are the rules' is the marks' check. */
  it('a verse whose svaras are not the rules’ is not called a changed letter — the marks’ check says what it is', async () => {
    const host = testHost();
    const ws = new Workspace();
    ws.keep('https://sanskritdocuments.org/x.html', 'stotram', ['शक्राच्च नारदः प्राप्तो धौम्यश्च तदनन्तरम् ।', 'धौम्याद्युधिष्ठिरः प्राप्य सर्वान्कामानवाप्तवान् ॥ १६॥']);
    await toolsFor('deliver', host).find((t) => t.spec.name === 'build_document')!.run({
      title: 'x', source: 'smarta', sections: [{ verses: [{ witness: 'w1', at: '1-2' }] }],
    }, { ws, host, review: async () => '' });
    /* The verse's svaras taken off, as a verse marked otherwise in its context would differ. */
    const doc = structuredClone(ws.need());
    for (const t of doc.sections[0]!.verses[0]!.tokens) if (t.t === 'syl') for (const u of t.units) delete u.svara;
    const from = [...ws.builtFrom.entries()];
    ws.open(doc);
    for (const [k, f] of from) ws.builtFrom.set(k, f);
    ws.run({ k: 'profile', scope: 'document', preset: 'smarta' });
    const found = checkDocument(ws);
    expect(found.some((f) => /^differs from/u.test(f.what))).toBe(false);
    expect(found.map((f) => f.what)).toContain('the marks of s-1-v1 are not what the rules make — run auto_mark');
  });
});
