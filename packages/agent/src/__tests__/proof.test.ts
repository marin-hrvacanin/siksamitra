/**
 * THE PROOF — the page read whole, and what a proofreader finds on it.
 *
 * A real run (sūryāṣṭottaraśatanāma stotram, 2026-10-02) passed every check
 * and was sent with a verse left in Devanāgarī, a vowel sign stranded in an
 * IAST word, another edition's name hung on a half-verse and a variant after
 * a verse's number. Each is found here — and none of it on his own pages,
 * which is what makes a finding worth acting on.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { setTextCommand } from '@siksamitra/edit';
import { readChantFile, toTextAndMarks, type ChantDoc } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import { openDocumentFile } from '@siksamitra/interop';
import { Workspace, documentOf, proofOf, proofread } from '../index.js';
import { markAll } from '../tools/marking.js';

const SLOKAS = [
  ["sūryo'ryamā bhagas tvaṣṭā pūṣārkaḥ savitā raviḥ ।", 'gabhastimān ajaḥ kālo mṛtyur dhātā prabhākaraḥ ॥'],
  ['pṛthivy āpaś ca tejaś ca khaṁ vāyuś ca parāyaṇam ।', "somo bṛhaspatiḥ śukro budho'ṅgāraka eva ca ॥"],
  ['indro vivasvān dīptāṁśuḥ śuciḥ śauriḥ śanaiścaraḥ ।', 'brahmā viṣṇuś ca rudraś ca skando vaiśravaṇo yamaḥ ॥'],
];
const strict = { strictMetre: () => true };
const stotra = (extra: string[][] = []): ChantDoc => documentOf({
  title: 'sūryāṣṭottaraśatanāma stotram', locus: 'mahābhārata, āraṇyakaparvan 3.3',
  sections: [{ verses: [...SLOKAS, ...extra].map((lines) => ({ lines })) }],
});

describe('what a proofreader finds', () => {
  it('a verse left in Devanāgarī in an IAST text', () => {
    const ws = new Workspace();
    ws.open(stotra());
    const done = setTextCommand(ws.need(), 's-1-v2', ['अनन्तः कपिलो भानुः कामदः सर्वतोमुखः ।', 'जयो विशालो वरदः सर्वभूतनिषेवितः ॥']);
    if (!done.ok) throw new Error(done.error);
    ws.run(done.value);
    expect(proofread(ws.need())).toEqual([
      expect.objectContaining({ severity: 'error', where: 's-1-v2', what: expect.stringMatching(/^letters of another script in an IAST verse/) }),
    ]);
  });

  it('a vowel sign stranded in an IAST word — the page’s श‍ृ read sign by sign', () => {
    const ws = new Workspace();
    ws.open(stotra());
    const done = setTextCommand(ws.need(), 's-1-v1', ['śaृṇuṣvāvahito rājan śucir bhūtvā samāhitaḥ ।', 'kṣaṇaṁ ca kuru rājendra guhyaṁ vakṣyāmi te hitam ॥']);
    if (!done.ok) throw new Error(done.error);
    ws.run(done.value);
    expect(proofread(ws.need()).map((f) => f.where)).toEqual(['s-1-v1']);
  });

  it('a name another edition hangs on a half-verse — the verse no longer scans as its section does', () => {
    const doc = stotra([['lokādhyakṣaḥ prajādhyakṣo viśvakarmā tamonudaḥ । kālādhyakṣaḥ', "varuṇaḥ sāgaro'ṁśuś ca jīmūto jīvano'rihā ॥"]]);
    expect(proofread(doc, strict)).toEqual([
      expect.objectContaining({ severity: 'error', where: 's-1-v4', what: expect.stringMatching(/^does not scan as its section does \(16 syllables a half-verse\): its halves have 16 · 20/) }),
    ]);
    /* The edition's own irregular verse, said so; and a Vedic metre, which is no śloka's. */
    expect(proofread(doc, { ...strict, irregular: (v) => v === 's-1-v4' })).toEqual([]);
    expect(proofread(doc)).toEqual([]);
  });

  it('but not a speaker’s line, a colophon, or a verse wholly in another metre', () => {
    const doc = stotra([
      ['vaiśampāyana uvāca ।', 'śṛṇuṣvāvahito rājan śucir bhūtvā samāhitaḥ ।', 'kṣaṇaṁ ca kuru rājendra guhyaṁ vakṣyāmi te hitam ॥'],
      ['iti śrīmahābhārate yudhiṣṭhiradhaumyasaṁvāde', 'āraṇyakaparvaṇi śrīsūryāṣṭottaraśatanāmastotraṁ sampūrṇam ॥'],
      ['suragaṇapitṛyakṣasevitaṁ hy asuraniśācarasiddhavanditam ।', 'varakanakahutāśanaprabhaṁ praṇipatito’smi hitāya bhāskaram ॥'],
    ]);
    expect(proofread(doc, strict)).toEqual([]);
  });

  it('a double daṇḍa with another verse’s words after it on its line is said, for the agent to judge', () => {
    const doc = stotra([['etad vai kīrtanīyasya sūryasyaiva mahātmanaḥ ।', 'nāmnām aṣṭaśataṁ puṇyaṁ śakreṇoktaṁ mahātmanā ॥ proktam etat svayambhuvā']]);
    const found = proofread(doc, strict);
    expect(found.map((f) => [f.severity, f.where])).toContainEqual(['warn', 's-1-v4']);
    expect(found.find((f) => f.severity === 'warn')!.what).toMatch(/with "proktam etat svayambhuvā" after it on its line/);
  });

  it('names numbered out of order', () => {
    const doc = documentOf({ title: 'x', sections: [{ verses: [{ lines: ['śrī mātā¹ śrī mahārājñī³ ।', 'cidagnikuṇḍasambhūtā⁴ ॥'] }] }] });
    expect(proofread(doc)).toEqual([expect.objectContaining({ severity: 'error', what: expect.stringMatching(/numbered 3 follows name 1/) })]);
  });
});

describe('none of it on his own pages', () => {
  /* His śloka texts are held to their metre; the Vedic ones are not. */
  const SLOKA_TEXTS = /mahatmyam|kanakadhara|minaksi|lakshmi|ganesha-ashtottara/u;
  const docs: [string, ChantDoc][] = readdirSync('corpus/chants').filter((f) => f.endsWith('.json')).map((f) => {
    const r = readChantFile(readFileSync(`corpus/chants/${f}`, 'utf8'));
    if (!r.ok) throw new Error(r.error);
    return [f, openChantDoc(r.doc)];
  });

  it('the verified corpus: no error', () => {
    for (const [f, doc] of docs) {
      const errors = proofread(doc, { strictMetre: (s) => SLOKA_TEXTS.test(f) || (s.profile?.preset ?? doc.profile?.preset) === 'smarta' })
        .filter((x) => x.severity === 'error');
      expect(errors, f).toEqual([]);
    }
  });

  const HIS = 'Library/bot-library';
  it.skipIf(!existsSync(HIS))('his reference documents: no error in a verse', async () => {
    for (const f of readdirSync(HIS).filter((n) => n.endsWith('.smdoc'))) {
      const doc = openChantDoc((await openDocumentFile(new Uint8Array(readFileSync(`${HIS}/${f}`)), f)).doc);
      const errors = proofread(doc, { strictMetre: () => SLOKA_TEXTS.test(f) })
        .filter((x) => x.severity === 'error' && x.where !== 'title');
      expect(errors, f).toEqual([]);
    }
  }, 120_000);
});

describe('the document as it will print', () => {
  const doc = documentOf({
    title: 'sūryāṣṭottaraśatanāma stotram', subtitle: 'sūryavarada stotram', locus: 'mahābhārata, āraṇyakaparvan 3.3',
    sections: [
      { title: 'dhyānam', verses: [{ lines: ['suragaṇapitṛyakṣasevitaṁ hy asuraniśācarasiddhavanditam ।', 'varakanakahutāśanaprabhaṁ praṇipatito’smi hitāya bhāskaram ॥'], numbered: false, note: '(puṣpitāgrā chandaḥ)' }] },
      { title: 'stotram', verses: [{ lines: ["sūryo'ryamā¹ bhagas² tvaṣṭā³ ।", 'gabhastimān⁴ ajaḥ⁵ ॥'], translation: '¹Sūrya; ²Aryaman; ³Bhaga\n⁴Gabhastimān; ⁵Aja' }] },
    ],
  });
  const proof = proofOf(doc);

  it('says every heading, note and line, with its number and its names’ numbers', () => {
    expect(proof).toMatch(/^“sūryāṣṭottaraśatanāma stotram”/);
    expect(proof).toContain('§ s-1 sūryavarada stotram › dhyānam · source: mahābhārata, āraṇyakaparvan 3.3');
    expect(proof).toContain('note: (puṣpitāgrā chandaḥ)');
    expect(proof).toContain('§ s-2 sūryavarada stotram › stotram');
    /* His short pādas two to a line; one numbered verse in all is closed with the double daṇḍa alone. */
    expect(proof).toContain("sūryo'ryamā¹ bhagas² tvaṣṭā³ । gabhastimān⁴ ajaḥ⁵ ॥");
    expect(proof).toContain('— ¹Sūrya; ²Aryaman; ³Bhaga ⁴Gabhastimān; ⁵Aja');
  });

  it('a long document in parts', () => {
    expect(proofOf(doc, 1, 1)).toMatch(/… verses 2-2 follow: proof with from: 2$/);
    expect(proofOf(doc, 2)).not.toContain('dhyānam');
  });

  it('the names’ numbers are raised marks on the letter before, never letters of the mantra', () => {
    const v = doc.sections[1]!.verses[0]!;
    const tm = toTextAndMarks(v);
    expect(tm.text).not.toMatch(/[0-9¹²³⁴⁵]/u);
    expect(tm.marks.filter((m) => m.k === 'sup').map((m) => [tm.text.slice(m.from, m.to), m.v])).toEqual([['ā', '1'], ['s', '2'], ['ā', '3'], ['n', '4'], ['ḥ', '5']]);
  });
});

describe('a śloka left bare among marked ones', () => {
  /* A verse that does not scan has no svara, and that verse alone of its
     stotra stood bare (a real run's verse 15, 2026-10-02). A half-verse merely
     set in two lines is read on and scans since 2026-10-04 (`svara.ts`), so the
     bare one here is a syllable short. */
  it('is found, with why, when its section’s other ślokas have svaras', () => {
    const ws = new Workspace();
    ws.open(documentOf({ title: 'x', sections: [{ verses: [...SLOKAS, ['śakrāc ca nāradaḥ prāpto dhaumyaś ca tad anantaram ।', 'dhaumyād yudhiṣṭhiraḥ prāpya', 'sarvān kāmān avāpta ॥']].map((lines) => ({ lines })) }] }));
    ws.run({ k: 'profile', scope: 'document', preset: 'smarta' });
    markAll(ws, 'keep-hand');
    const found = proofread(ws.need(), strict);
    expect(found).toEqual([expect.objectContaining({ severity: 'error', where: 's-1-v4', what: expect.stringMatching(/^has no svara where the section's other ślokas have theirs/) })]);
  });
  it('is not a fault when the edition itself has the verse outside its metre, said so', () => {
    const ws = new Workspace();
    ws.open(documentOf({ title: 'x', sections: [{ verses: [...SLOKAS, ['śakrāc ca nāradaḥ prāpto dhaumyaś ca tad anantaram ।', 'dhaumyād yudhiṣṭhiraḥ prāpya', 'sarvān kāmān avāpta ॥']].map((lines) => ({ lines })) }] }));
    ws.run({ k: 'profile', scope: 'document', preset: 'smarta' });
    markAll(ws, 'keep-hand');
    expect(proofread(ws.need(), { ...strict, irregular: (v) => v === 's-1-v4' })).toEqual([]);
  });
});
