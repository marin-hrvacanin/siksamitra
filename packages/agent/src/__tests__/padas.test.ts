/**
 * HIS SHORT PĀDAS, TWO TO A LINE, AND THE SOURCE'S DAṆḌAS BETWEEN THEM — the
 * krimi saṁhāraka sūktam the bot built (2026-10-02) set a source line of
 * pādas as a line a pāda and dropped every daṇḍa between them; his page reads
 *
 *   atriṇā tvā krime hanmi । kaṇvena jamadagninā ।
 *   viśvāvasor brahmaṇā hataḥ । krimīṇāgṁ rājā ।
 */
import { describe, expect, it } from 'vitest';
import { recitationText } from '@siksamitra/format';
import { documentOf } from '../build.js';
import { withSourceDandas } from '../letters.js';
import { pairedPadas } from '../lines.js';

const SOURCE = ['atriṇā tvā krime hanmi । kaṇvena jamadagninā । viśvāvasor brahmaṇā hataḥ । krimīṇāgṁ rājā ॥'];
const AS_GIVEN = ['atriṇā tvā krime hanmi', 'kaṇvena jamadagninā', 'viśvāvasor brahmaṇā hataḥ', 'krimīṇāgṁ rājā'];
const fits = (): boolean => true;

describe('the source’s daṇḍas, by where they stand', () => {
  it('a source line of pādas set a line a pāda keeps the daṇḍa after each — the last the builder’s', () => {
    expect(withSourceDandas(SOURCE, AS_GIVEN)).toEqual([
      'atriṇā tvā krime hanmi ।', 'kaṇvena jamadagninā ।', 'viśvāvasor brahmaṇā hataḥ ।', 'krimīṇāgṁ rājā',
    ]);
  });

  it('a daṇḍa already there is not written twice', () => {
    expect(withSourceDandas(SOURCE, ['atriṇā tvā krime hanmi । kaṇvena jamadagninā', 'viśvāvasor brahmaṇā hataḥ ।', 'krimīṇāgṁ rājā']))
      .toEqual(['atriṇā tvā krime hanmi । kaṇvena jamadagninā ।', 'viśvāvasor brahmaṇā hataḥ ।', 'krimīṇāgṁ rājā']);
  });
});

describe('his short pādas, two to a line', () => {
  const four = ['atriṇā tvā krime hanmi ।', 'kaṇvena jamadagninā ।', 'viśvāvasor brahmaṇā hataḥ ।', 'krimīṇāgṁ rājā ॥'];

  it('pādas of eight go two to a line, as his krimi saṁhāraka sūktam has them', () => {
    expect(pairedPadas(four, fits)).toEqual({
      lines: ['atriṇā tvā krime hanmi । kaṇvena jamadagninā ।', 'viśvāvasor brahmaṇā hataḥ । krimīṇāgṁ rājā ॥'],
      from: [[0, 1], [2, 3]],
    });
  });

  it('a gāyatrī’s third pāda keeps its own line, as his agnimīḻe sūktam', () => {
    const g = ['agnim īḻe purohitaṁ ।', 'yajñasya devam ṛtvijam ।', 'hotāraṁ ratnadhātamam ॥'];
    expect(pairedPadas(g, fits).lines).toEqual(['agnim īḻe purohitaṁ । yajñasya devam ṛtvijam ।', 'hotāraṁ ratnadhātamam ॥']);
  });

  it('a triṣṭubh’s pādas of eleven keep a line each, as his bhū sūktam', () => {
    const t = ['na karmaṇā na prajayā dhanena ।', 'tyāgenaike amṛtatvam ānaśuḥ ॥'];
    expect(pairedPadas(t, fits).lines).toEqual(t);
  });

  it('nor are two joined that do not fit his column, nor a pāda that ends with no daṇḍa', () => {
    expect(pairedPadas(four, () => false).lines).toEqual(four);
    expect(pairedPadas(['atriṇā tvā krime hanmi', 'kaṇvena jamadagninā ।'], fits).lines).toHaveLength(2);
  });
});

describe('the krimi verse, built', () => {
  it('his two lines, each two pādas and their daṇḍas', () => {
    const doc = documentOf({ title: 'krimi saṁhāraka sūktam', locus: 'taittirīya āraṇyaka 4.36', sections: [{ verses: [{ lines: withSourceDandas(SOURCE, AS_GIVEN) }] }] });
    const text = recitationText(doc.sections[0]!.verses[0]!.tokens, 'iast');
    /* The gum is stored as the anusvāra it is drawn from (`spelling`). */
    expect(text.split('\n')).toEqual(['atriṇā tvā krime hanmi । kaṇvena jamadagninā ।', 'viśvāvasor brahmaṇā hataḥ । krimīṇāṁ rājā ॥']);
  });
});
