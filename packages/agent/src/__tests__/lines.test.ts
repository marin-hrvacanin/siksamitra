/**
 * A SOURCE'S LINE, CLEANED — what a web text carries in its lines that is not
 * the text, and the number each verse ends with in his documents.
 *
 * The case that made this: the bot delivered the Gāyatrī from sanskritdocuments'
 * Taittirīya Āraṇyaka with `॥ ०। १०। ३५। ५३॥ ॥ ३५॥` still in the verse.
 */
import { describe, expect, it } from 'vitest';
import { cleanLine, clipped, layoutOf, numbered, paragraphsIn, syllablesOf, unnumbered } from '../lines.js';

describe('a source line, cleaned', () => {
  it('takes off a reference of two or more numbers at the end, and keeps the verse closed', () => {
    expect(cleanLine('ओमापो॒ ज्योती॒ रसो॒ऽमृतं॒ ब्रह्म॒ भूर्भुव॒स्सुव॒रोम् ॥ ०। १०। ३५। ५३॥ ॥ ३५॥')).toBe('ओमापो॒ ज्योती॒ रसो॒ऽमृतं॒ ब्रह्म॒ भूर्भुव॒स्सुव॒रोम् ॥');
    expect(cleanLine('tarase namaḥ || 0| 10| 2| 1|| || 2||')).toBe('tarase namaḥ ॥');
    expect(cleanLine('śaradyatropadṛśyate ॥ ०। १। ४। १२॥')).toBe('śaradyatropadṛśyate ॥');
  });

  it('takes off a running number opening a paragraph', () => {
    expect(cleanLine('५३ ओजो॑ऽसि॒ सहो॑ऽसि॒')).toBe('ओजो॑ऽसि॒ सहो॑ऽसि॒');
    expect(cleanLine('22 ānuśravika eva nau')).toBe('ānuśravika eva nau');
  });

  it('leaves a verse’s own single number, and every letter, as they are', () => {
    expect(cleanLine('dhiyo yo naḥ pracodayāt ॥ 10॥')).toBe('dhiyo yo naḥ pracodayātˎ॥ 10॥');
    expect(cleanLine('  bhūmir bhūmnā dyaur variṇā ।  ')).toBe('bhūmir bhūmnā dyaur variṇā ।');
  });
});

describe('a verse, numbered as his are', () => {
  it('ends with ॥ n॥, whatever ending the source gave it', () => {
    expect(numbered(['a ।', 'bha ॥ ५३॥'], 2)).toEqual(['a ।', 'bha ॥ 2॥']);
    expect(numbered(['a ।', 'bha ।'], 1)).toEqual(['a ।', 'bha ॥ 1॥']);
    expect(numbered(['a ।', 'bha'], 3)).toEqual(['a ।', 'bha ॥ 3॥']);
  });

  it('a text of one verse ends with ॥ alone', () => {
    expect(numbered(['dhiyo yo naḥ pracodayāt ॥ 10॥'], 1, 1)).toEqual(['dhiyo yo naḥ pracodayātˎ॥']);
  });
});

describe('a final consonant before a daṇḍa, clipped as his page clips it', () => {
  it('takes the virāma tick, with no space before the daṇḍa', () => {
    expect(clipped('ādityā viśve tad devā vasavaś ca samābharan ॥ 6॥')).toBe('ādityā viśve tad devā vasavaś ca samābharanˎ॥ 6॥');
    expect(clipped('ma̱hīṁ de̱vīṁ viṣṇu̍patnīm ajū̱ryām ।')).toBe('ma̱hīṁ de̱vīṁ viṣṇu̍patnīm ajū̱ryāmˎ।');
    expect(clipped('ṣaḍa̍-ṅgam । ra̱ktā-mbu̍ja saṁsthi̱tam ।')).toBe('ṣaḍa̍-ṅgamˎ। ra̱ktā-mbu̍ja saṁsthi̱tamˎ।');
  });
  it('leaves a vowel, a visarga, an anusvāra, a tick already there and Devanāgarī as they are', () => {
    for (const l of ['pri̱yāṇi̍ ।', 'dyubhi̍ḥ ॥ 3॥', 'oṁ ॥', 'samābharanˎ॥', 'भूर्भुव॒स्सुव॒रोम् ॥']) expect(clipped(l)).toBe(l);
  });
  it('a verse already clipped is numbered with no space after its tick', () => {
    expect(numbered(['samābharanˎ॥ 6॥'], 1)).toEqual(['samābharanˎ॥ 1॥']);
    expect(numbered(['pracodayātˎ॥ 10॥'], 1, 1)).toEqual(['pracodayātˎ॥']);
  });
  it('and a verse closed by numbering is clipped too', () => {
    expect(numbered(['tat sa̍vi̱tur vare̎ṇya̱m bhargo̍ de̱vasya̍ dhīmahi ।', 'dhiyo̱ yo na̍ḥ praco̱dayā̎t'], 3)).toEqual([
      'tat sa̍vi̱tur vare̎ṇya̱m bhargo̍ de̱vasya̍ dhīmahi ।', 'dhiyo̱ yo na̍ḥ praco̱dayā̎tˎ॥ 3॥',
    ]);
  });
});

describe('a verse’s lines, set as his page sets them', () => {
  const stanza = ['sa̱pta te̍ agne sa̱midha̍ḥ sa̱pta ji̱hvāḥ', 'sa̱pta ṛṣa̍yaḥ sa̱pta dhāma̍ pri̱yāṇi̍ ।', 'sa̱pta hotrā̎ḥ sapta̱dhā tvā̍ yajanti', 'sa̱pta yonī̱r ā pṛ̍ṇasvā ghṛ̱tena̍ ॥ 8॥'];
  it('a stanza of four or six pādas: a paragraph per half-verse (bhū sūktam 8, 12)', () => {
    expect(layoutOf(stanza)).toBe('halves');
    expect(paragraphsIn(stanza, 'halves').map((p) => p.length)).toEqual([2, 2]);
    expect(layoutOf([
      'ma̱hīṁ de̱vīṁ viṣṇu̍patnīm ajū̱ryām ।', 'pra̱tīcī̍m enāṁ ha̱viṣā̍ yajāmaḥ ।', 'tre̱dhā viṣṇu̍r urugā̱yo vica̍krame ।',
      'ma̱hīṁ diva̍ṁ pṛthi̱vīm a̱ntari̍kṣam ।', 'tac chro̱ṇaiti̱ śrava̍ i̱cchamā̍nā ।', 'puṇya̱ṁ śloka̱ṁ yaja̍mānāya kṛṇva̱tī ॥ 12॥',
    ])).toBe('halves');
  });
  it('two lines, an odd number, or prose with daṇḍas inside its lines: one paragraph (sūryopaniṣat 1, 2)', () => {
    expect(layoutOf(stanza.slice(0, 2))).toBe('hang');
    expect(layoutOf(stanza.slice(0, 3))).toBe('hang');
    expect(layoutOf(['ṣaṭ svarā-rūḍhe̍na bīje̱na ṣaḍa̍-ṅgamˎ। ra̱ktā-mbu̍ja saṁsthi̱tamˎ।', 'b', 'c', 'd ॥ 2॥'])).toBe('hang');
    expect(paragraphsIn(stanza, 'hang')).toEqual([stanza]);
  });
  it('a refrain: a paragraph a line', () => {
    expect(paragraphsIn(stanza.slice(0, 3), 'flush').map((p) => p.length)).toEqual([1, 1, 1]);
  });
});

describe('a verse he leaves unnumbered', () => {
  it('keeps the ending its source gave it, and is closed only when it has none', () => {
    expect(unnumbered(['oṁ bhūr bhuva̱s suva̍ḥ ।'])).toEqual(['oṁ bhūr bhuva̱s suva̍ḥ ।']);
    expect(unnumbered(['॥ oṁ śānti̱ḥ śānti̱ḥ śānti̍ḥ ॥'])).toEqual(['॥ oṁ śānti̱ḥ śānti̱ḥ śānti̍ḥ ॥']);
    expect(unnumbered(['tanno̍ dharāḥ praco̱dayā̎t'])).toEqual(['tanno̍ dharāḥ praco̱dayā̎tˎ॥']);
  });
});

describe('a stanza told from prose', () => {
  it('counts a line’s syllables by its vowels, its svaras and hyphens aside', () => {
    expect(syllablesOf('sa̱pta te̍ agne sa̱midha̍ḥ sa̱pta ji̱hvāḥ')).toBe(12);
    expect(syllablesOf('tvame̱va pra̱tyakṣa̱ṁ karma̍ kartā-si ।')).toBe(11);
    expect(syllablesOf('aiṁ auṁ')).toBe(2);
  });
  it('lines longer than a pāda are prose, one paragraph (sūryopaniṣat 7)', () => {
    const prose = [
      'ā̱di̱tyo’ntaḥkaraṇa mano buddhi cittā̍-haṅkā̱rāḥ ।', 'ā̱di̱tyo vai vyānaḥ samāno-dāno’pā̍naḥ prā̱ṇaḥ ।',
      'ā̱di̱tyo vai śrotra tvak cakṣūra-sa̍na ghrā̱ṇāḥ ।', 'ā̱di̱tyo vai vākpāṇi pāda pāyū̍-pa̱sthāḥ ।',
      'ā̱di̱tyo vai śabda sparśa rūpa rasa ga̍ndhāḥ ।', 'ā̱di̱tyo vai vacanā-dānā-gamana visa̍rgā-na̱ndāḥ ॥ 7॥',
    ];
    expect(layoutOf(prose)).toBe('hang');
  });
  it('a litany of ten short lines is one paragraph (sūryopaniṣat 5)', () => {
    expect(layoutOf(Array.from({ length: 10 }, () => 'tvame̱va pra̱tyakṣa̱ṁ brahmā̍-si ।'))).toBe('hang');
  });
});

describe('a final consonant carrying an accent of his', () => {
  it('keeps the accent and takes the tick after it (agnimīḻe 1)', () => {
    expect(clipped('ya̱jñasya̅̍ de̱vamṛ̱-tvijam̎ ।')).toBe('ya̱jñasya̅̍ de̱vamṛ̱-tvijam̎ˎ।');
  });
});

describe('a gum the source writes out', () => {
  it('goes back to the anusvāra the rules make it from', () => {
    expect(cleanLine('pra̱tīcī̍menāgm̐ ha̱viṣā̍ yajāmaḥ ।')).toBe('pra̱tīcī̍menāṁ ha̱viṣā̍ yajāmaḥ ।');
    expect(cleanLine('sa de̱vām̐ eha va̍kṣati ।')).toBe('sa de̱vām̐ eha va̍kṣati ।');
  });
});
