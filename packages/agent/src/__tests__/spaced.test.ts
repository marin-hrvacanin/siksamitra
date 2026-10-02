/**
 * HIS WORD BREAKS, OVER A SOURCE'S OWN LETTERS.
 *
 * The bot's real bhū sūktam (2026-10-02) ran its words together as the web
 * source does — `bhūmirbhūmnā dyaurvariṇā'ntarikṣam` — where his page
 * separates them and marks a junction. The agent may give a verse's lines with
 * his breaks (`spaced`), and only if every letter and svara is the source's:
 * the bot never retypes a mantra.
 */
import { describe, expect, it } from 'vitest';
import { Workspace, checkDocument, toolsFor, verseLetters, type Host } from '../index.js';
import { strictLetters } from '../letters.js';

const host: Host = { exporters: {} as never };
const build = toolsFor('deliver', host).find((t) => t.spec.name === 'build_document')!;
const run = (ws: Workspace, verse: Record<string, unknown>) => build.run({
  title: 'bhū sūktam', source: 'taittiriya', sections: [{ verses: [{ witness: 'w1', at: '1-2', ...verse }] }],
}, { ws, host, review: async () => '' });

const SOURCE = ['bhūmi̍rbhū̱mnā dyaurva̍ri̱ṇā’ntari̍kṣam mahi̱tvā ।', 'u̱pasthe̍ te devyadite̱’gnima̍nnā̱dama̱nnādyā̱yādadhe ॥ १॥'];
const HIS = ['bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā’ntari̍kṣam mahi̱tvā ।', 'u̱pasthe̍ te devya-dite̱’gnima̍-nnā̱dama̱-nnādyā̱yādadhe ॥ १॥'];

describe('a verse given with his word breaks', () => {
  it('is built so, when its letters and svaras are the source’s', async () => {
    const ws = new Workspace();
    ws.keep('https://sanskritdocuments.org/x', 'bhū sūktam', SOURCE);
    await run(ws, { spaced: HIS });
    const text = verseLetters(ws.need().sections[0]!.verses[0]!);
    expect(text).toContain('bhūmi̍r bhū̱mnā dyaur');
    expect(text).toContain('devya-dite');
    /* And the check, which compares letters with the source, finds nothing. */
    expect(checkDocument(ws).filter((f) => f.severity === 'error')).toEqual([]);
  });

  it('is refused when a single letter differs, and the place is named', async () => {
    const ws = new Workspace();
    ws.keep('https://sanskritdocuments.org/x', 'bhū sūktam', SOURCE);
    const wrong = [HIS[0]!.replace('mahi̱tvā', 'mahī̱tvā'), HIS[1]!];
    await expect(run(ws, { spaced: wrong })).rejects.toThrow(/line 1: spaced changes a letter at .*mahī/);
  });

  it('a svara moved is a letter changed', async () => {
    const ws = new Workspace();
    ws.keep('https://sanskritdocuments.org/x', 'bhū sūktam', SOURCE);
    const moved = [HIS[0]!.replace('bhūmi̍r', 'bhū̍mir'), HIS[1]!];
    await expect(run(ws, { spaced: moved })).rejects.toThrow(/spaced changes a letter/);
  });

  it('his spellings of a source’s junctions build, and check clean — vignanam’s second verse', async () => {
    const ws = new Workspace();
    ws.keep('https://vignanam.org/samskritam/bhu-suktam.html', 'bhū sūktam', ['आ-ऽयङ्गौः पृश्नि॑रक्रमी॒-दस॑नन्मा॒तर॒-म्पुनः॑ ।', 'पि॒तर॑-ञ्च प्र॒यन्-थ्सुवः॑ ॥']);
    await run(ws, { spaced: ["ā'yaṁ gauḥ pṛśni̍ra-kramī̱da-sa̍nan mā̱tara̱ṁ puna̍ḥ ।", 'pi̱tara̍ṁ ca pra̱yanth suva̍ḥ ॥'] });
    expect(verseLetters(ws.need().sections[0]!.verses[0]!)).toContain("ā'yaṁ gauḥ");
    expect(checkDocument(ws).filter((f) => f.severity === 'error')).toEqual([]);
  });

  it('an opening oṁ of the source left out, as his page does, builds and checks clean', async () => {
    const ws = new Workspace();
    ws.keep('https://vignanam.org/samskritam/bhu-suktam.html', 'bhū sūktam', ['ओम् ॥ ओ-म्भूमि॑र्भू॒म्ना द्यौर्व॑रि॒णा-ऽन्तरि॑क्ष-म्महि॒त्वा ।', 'उ॒पस्थे॑ ते देव्यदिते॒-ऽग्निम॑न्ना॒द-म॒न्नाद्या॒याद॑धे ॥']);
    await run(ws, { spaced: ["bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣaṁ mahi̱tvā ।", "u̱pasthe̍ te devya-dite̱'gnima̍-nnā̱dama̱-nnādyā̱yā''da̍dhe ॥"] });
    expect(verseLetters(ws.need().sections[0]!.verses[0]!)).toMatch(/^bhūmi̍r/);
    expect(checkDocument(ws).filter((f) => f.severity === 'error')).toEqual([]);
  });

  it('a Devanāgarī source is compared in IAST', () => {
    expect(strictLetters('भूमि॑र्भू॒म्ना')).toBe(strictLetters('bhūmi̍r bhū̱mnā'));
  });
});
