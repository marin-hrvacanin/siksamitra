/**
 * A DOCUMENT THE AGENT MAKES IS LAID OUT AS HIS ARE.
 *
 * His newer single documents — bhū sūktam v1.1, pūrṇakumbha mantra,
 * sūryopaniṣat — open: Heading 2 the name ("bhū sūktam"), Heading 3 its
 * tradition ("kṛṣṇa yajurvedīya"), the source line on a mantra line
 * ("taittirīya saṁhitā 1.5.3"), then each verse — one paragraph, its lines on
 * soft breaks, its number at the end ("॥ 1॥") — a note above a verse that is
 * also elsewhere ("Also in maitrāyaṇī saṁhitā 1.7.1.1"), and every verse's
 * translation under it. The agent's outline is written as those paragraphs and
 * read back by the importers' builder, so the document it makes — and the Word
 * file made from that — has his shape. Read out of the exported file itself.
 */
import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { exportWord, readParagraphs } from '@siksamitra/interop';
import { exportStyle, styleStacks } from '@siksamitra/tokens/export-styles';
import { toTextAndMarks } from '@siksamitra/format';
import { documentOf } from '../index.js';

const BHU = {
  title: 'bhū sūktam',
  subtitle: 'kṛṣṇa yajurvedīya',
  locus: 'taittirīya saṁhitā 1.5.3',
  description: 'The hymn to the Earth',
  sections: [{
    verses: [
      {
        lines: ['bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā’ntari̍kṣam mahi̱tvā ।', 'u̱pasthe̍ te devya-dite̱’gnima̍-nnā̱dama̱-nnādyā̱yā’’da̍dhe ॥ ०। १। ५। ३। १॥'],
        translation: 'The Earth with her greatness, the Heaven with its expanse,\no Goddess Aditi, in your lap I establish Agni.',
      },
      {
        lines: ['yattvā̎ kru̱ddhaḥ pa̍ro̱ vapa̍ ma̱nyunā̱ yada-va̍rtyā ।', 'su̱kalpa̍ma-gne̱ tat tava̱ puna̱s tvo-ddī̍payāmasi ॥'],
        note: 'Also in maitrāyaṇī saṁhitā 1.7.1.1',
        translation: 'Having thrown away whatever, provoked by anger,\no Agni, that which is yours, we rekindle once more.',
      },
    ],
  }],
};

const text = (v: Parameters<typeof toTextAndMarks>[0]): string => toTextAndMarks(v).text;

async function paragraphs(doc: ReturnType<typeof documentOf>): Promise<{ style: string; text: string; runs: string[] }[]> {
  const style = exportStyle('veda-union');
  const stacks = styleStacks(style);
  const bytes = await exportWord({ doc, style, textStack: stacks.text, uiStack: stacks.ui, engine: 'test', slug: 'x.docx', script: 'iast' });
  const xml = strFromU8(unzipSync(bytes)['word/document.xml']!);
  return readParagraphs(xml)
    .map((p) => ({
      style: p.pStyle ?? 'Normal',
      text: p.runs.filter((r) => r.hidden !== true).map((r) => r.text).join('').trim(),
      runs: p.runs.map((r) => r.rStyle ?? '-'),
    }))
    .filter((p) => p.text !== '');
}

describe('a document the agent builds', () => {
  it('has his single document’s parts: the name, the tradition under it, the source line, the verses', () => {
    const doc = documentOf(BHU);
    expect(doc.title).toBe('bhū sūktam');
    expect(doc.sections.map((s) => s.part)).toEqual(['kṛṣṇa yajurvedīya']);
    expect(doc.sections[0]!.source).toBe('taittirīya saṁhitā 1.5.3');
    expect(doc.sections[0]!.verses).toHaveLength(2);
    expect(doc.sections[0]!.verses[1]!.source).toBe('Also in maitrāyaṇī saṁhitā 1.7.1.1');
    expect(doc.sections[0]!.verses[0]!.translation?.en).toBe('The Earth with her greatness, the Heaven with its expanse,\no Goddess Aditi, in your lap I establish Agni.');
    /* Kept for the website beside the name, and where the text is from. */
    expect(doc.subtitle).toBe('The hymn to the Earth');
    expect(doc.source).toBe('taittirīya saṁhitā 1.5.3');
  });

  it('takes the source’s references off and numbers each verse as he does', () => {
    const [a, b] = documentOf(BHU).sections[0]!.verses;
    expect(text(a!)).not.toMatch(/[०-९]/);
    expect(text(a!).endsWith('॥ 1॥')).toBe(true);
    expect(text(b!).endsWith('॥ 2॥')).toBe(true);
    /* One paragraph of his: the second line follows a soft break, and hangs in. */
    expect(a!.paragraphs).toBeUndefined();
    expect(text(a!).split('\n')).toHaveLength(2);
  });

  it('a text of one verse ends with the double daṇḍa alone', () => {
    const doc = documentOf({ title: 'gāyatrī mantra', sections: [{ verses: [{ lines: ['tat sa̍vi̱tur vare̎ṇya̱m bhargo̍ de̱vasya̍ dhīmahi ।', 'dhiyo̱ yo na̍ḥ praco̱dayā̎t ॥ १०॥'] }] }] });
    const v = doc.sections[0]!.verses[0]!;
    /* …its last consonant clipped with the virāma tick, as his are. */
    expect(text(v).endsWith('pracodayātˎ॥')).toBe(true);
  });

  it('exports to Word as his file opens: Heading 2, Heading 3, the source line, then mantra and translation', async () => {
    const ps = await paragraphs(documentOf(BHU));
    expect(ps.slice(0, 3).map((p) => [p.style, p.text])).toEqual([
      ['Heading2', 'bhū sūktam'],
      ['Heading3', 'kṛṣṇa yajurvedīya'],
      ['Source', 'taittirīya saṁhitā 1.5.3'],
    ]);
    expect(ps[2]!.runs).toEqual(['Comment']);
    expect(ps[3]!.style).toBe('Translit');
    expect(ps[4]!.style).toBe('Prijevod');
    /* The note over the second verse: a mantra line holding only his comment. */
    const note = ps.find((p) => p.text === 'Also in maitrāyaṇī saṁhitā 1.7.1.1')!;
    expect(note.style).toBe('Translit');
    expect(note.runs).toEqual(['Comment']);
  });

  it('a text with sections: each its own title (his Heading 4) and its source line under it', async () => {
    const doc = documentOf({
      title: 'puruṣa sūktam',
      subtitle: 'kṛṣṇa yajurvedīya',
      sections: [
        { title: 'prathamo’nuvākaḥ', cite: 'taittirīya āraṇyaka 3.12', verses: [{ lines: ['sa̱hasra̍śīrṣā̱ puru̍ṣaḥ ।'] }] },
        { title: 'dvitīyo’nuvākaḥ', cite: 'taittirīya āraṇyaka 3.13', verses: [{ lines: ['a̱dbhyas sambhū̍taḥ pṛthi̱vyai rasā̎cca ।'] }] },
      ],
    });
    expect(doc.sections.map((s) => [s.title, s.source, s.part])).toEqual([
      ['prathamo’nuvākaḥ', 'taittirīya āraṇyaka 3.12', 'kṛṣṇa yajurvedīya'],
      ['dvitīyo’nuvākaḥ', 'taittirīya āraṇyaka 3.13', 'kṛṣṇa yajurvedīya'],
    ]);
    const ps = await paragraphs(doc);
    const at = (t: string) => ps.findIndex((p) => p.text === t);
    expect(ps[at('prathamo’nuvākaḥ')]!.style).toBe('Heading4');
    expect(at('taittirīya āraṇyaka 3.12')).toBe(at('prathamo’nuvākaḥ') + 1);
  });

  it('several sections with neither a title nor a source line are refused — they would run together', () => {
    expect(() => documentOf({ title: 'x', sections: [{ verses: [{ lines: ['a'] }] }, { verses: [{ lines: ['b'] }] }] }))
      .toThrow(/needs a title or a source line/);
  });

  /* bhū sūktam v1.1, from verse 11 on: a source line over verses from
     elsewhere with no heading, an optional verse unnumbered, the closing
     śānti unnumbered, and a refrain of three lines each at the margin. */
  const TAIL = {
    title: 'bhū sūktam',
    subtitle: 'kṛṣṇa yajurvedīya',
    locus: 'taittirīya saṁhitā 1.5.3',
    sections: [
      {
        verses: [
          { lines: ['bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā’ntari̍kṣam mahi̱tvā ।', 'u̱pasthe̍ te devya-dite̱’gnima̍-nnā̱dama̱-nnādyā̱yā’’da̍dhe ॥'] },
          {
            lines: ['leka̱s sale̍kas su̱leka̱s te na̍ ādi̱tyā ājya̍ṁ juṣā̱ṇā vi̍yantu', 'keta̱s sake̍tas su̱keta̱s te na̍ ādi̱tyā ājya̍ṁ juṣā̱ṇā vi̍yantu'],
            layout: 'flush' as const,
          },
        ],
      },
      {
        cite: 'taittirīya brāhmaṇam 3.1.2.6',
        verses: [
          { lines: ['ma̱hīṁ de̱vīṁ viṣṇu̍patnīm ajū̱ryām ।', 'pra̱tīcī̍m enāṁ ha̱viṣā̍ yajāmaḥ ॥'] },
          { lines: ['dha̱nu̱r dha̱rāyai̍ vi̱dmahe̍ sarvasi̱ddhyai ca̍ dhīmahi ।', 'tanno̍ dharāḥ praco̱dayā̎t ॥'], note: 'optional', numbered: false },
          { lines: ['॥ oṁ śānti̱ś śānti̱ś śānti̍ḥ ॥'], numbered: false },
        ],
      },
    ],
  };

  it('a verse he leaves unnumbered ends with the double daṇḍa alone, and the count goes on without it', () => {
    const verses = documentOf(TAIL).sections.flatMap((s) => s.verses);
    expect(verses.map((v) => /॥ (\d+)॥$/u.exec(text(v))?.[1] ?? 'none')).toEqual(['1', '2', '3', 'none', 'none']);
    /* The optional verse: its last consonant clipped, and the daṇḍa against it. */
    expect(text(verses[3]!).endsWith('pracodayātˎ॥')).toBe(true);
    expect(text(verses[4]!)).toBe('॥ oṁ śāntiś śāntiś śāntiḥ ॥');
  });

  it('a source line over verses from elsewhere begins a section of its own, with no heading', async () => {
    const doc = documentOf(TAIL);
    expect(doc.sections.map((s) => [s.title ?? '', s.source])).toEqual([
      ['', 'taittirīya saṁhitā 1.5.3'],
      ['', 'taittirīya brāhmaṇam 3.1.2.6'],
    ]);
    expect(doc.sections[1]!.verses[1]!.source).toBe('optional');
    const ps = await paragraphs(doc);
    expect(ps.filter((p) => p.style.startsWith('Heading')).map((p) => p.text)).toEqual(['bhū sūktam', 'kṛṣṇa yajurvedīya']);
    expect(ps.find((p) => p.text === 'taittirīya brāhmaṇam 3.1.2.6')!.style).toBe('Source');
  });

  it('a refrain is a paragraph a line, at the margin, and still one verse', async () => {
    const doc = documentOf(TAIL);
    const refrain = doc.sections[0]!.verses[1]!;
    expect(text(refrain).split('\n')).toHaveLength(2);
    const ps = await paragraphs(doc);
    const lines = ps.filter((p) => /^(leka|keta)/u.test(p.text));
    expect(lines).toHaveLength(2);
    expect(lines.every((p) => p.style === 'Translit' && !p.text.includes('\n'))).toBe(true);
    expect(lines[1]!.text.endsWith('॥ 2॥')).toBe(true);
  });

  it('a note at the end of a line is his comment run, after the line and its number (sūryopaniṣat 4)', async () => {
    const doc = documentOf({
      title: 'sūryopaniṣat',
      sections: [{
        verses: [{
          lines: ['sūrya̍ ā̱tmā jaga̍tas ta̱sthuṣa̍ś ca ।', 'sūryā̎d ya̱jñaḥ parjanyo̎’nnamā̱tmā ॥ ४॥'],
          lineNotes: ['', 'p.b. sūryā̍d (with svarita)'],
        }, { lines: ['ā̱di̱tyād vā̍yur jā̱yate ॥'] }],
      }],
    });
    const v = doc.sections[0]!.verses[0]!;
    /* In the document: a note token at the line's end, after its number — not a letter of the mantra. */
    expect(text(v).split('\n')[1]!.endsWith('॥ 1॥ p.b. sūryā̍d (with svarita)')).toBe(true);
    expect(v.tokens.filter((t) => t.t === 'text' && (t as { note?: true }).note === true).map((t) => (t as { s: string }).s.trim()))
      .toEqual(['p.b. sūryā̍d (with svarita)']);
    /* In Word: the comment run, after the number. */
    const ps = await paragraphs(doc);
    const line = ps.find((p) => p.text.includes('p.b.'))!;
    expect(line.style).toBe('Translit');
    expect(line.runs.at(-1)).toBe('Comment');
    expect(line.text.endsWith('॥ 1॥ p.b. sūryā̍d (with svarita)')).toBe(true);
  });

  it('a stanza of four pādas is two paragraphs, a half-verse each — and its translation too, line for line', async () => {
    const doc = documentOf({
      title: 'bhū sūktam',
      sections: [{
        verses: [{
          lines: ['sa̱pta te̍ agne sa̱midha̍ḥ sa̱pta ji̱hvāḥ', 'sa̱pta ṛṣa̍yaḥ sa̱pta dhāma̍ pri̱yāṇi̍ ।', 'sa̱pta hotrā̎ḥ sapta̱dhā tvā̍ yajanti', 'sa̱pta yonī̱r ā pṛ̍ṇasvā ghṛ̱tena̍ ॥ 8॥'],
          translation: 'O Agni, seven are your kindling sticks,\nseven Ṛṣis, seven beloved abodes,\nseven priests worship in seven ways,\nyou fill the seven fire pits with ghee.',
        }],
      }],
    });
    const v = doc.sections[0]!.verses[0]!;
    expect(v.paragraphs).toEqual([2, 2]);
    expect(v.translation?.paragraphs).toEqual([2, 2]);
    const ps = await paragraphs(doc);
    expect(ps.filter((p) => p.style === 'Translit').map((p) => p.text.split('\n').length)).toEqual([2, 2]);
    expect(ps.filter((p) => p.style === 'Prijevod').map((p) => p.text.split('\n').length)).toEqual([2, 2]);
  });
});
