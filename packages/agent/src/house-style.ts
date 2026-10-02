/**
 * HIS HOUSE STYLE — how his pages set each part of a text, in his own lines.
 *
 * Read off his documents (his Lalitā sahasranāma, the rudram's nyāsa, the
 * sādhanā's prastāvanā, the kanakadhārā and the mīnākṣī pañcaratna) on
 * 2026-10-02, after a real run set a stotra's pūrvāṅga as numbered verses, ran
 * its viniyoga on, set its two nyāsas as one table, made a rubric a verse and
 * a heading of "iti". The owner: "find the root of the issue… maybe he needs
 * more examples". These are the examples — not rules about one chant, but how
 * every part of a text is set, shown in his lines — and the agent reads them
 * before it builds. In the package, not a host's files, so the bot, the app
 * and the Word panel read the same page. Kept under a tool answer's length.
 */
export const HOUSE_STYLE = `HIS HOUSE STYLE — how his pages set a text. Set yours the same; his own document of the same kind (find_text, read_example) comes first where there is one.

1. WHAT IS ASKED FOR. "With the dhyānam and the other mantras" means the parts the text's own tradition recites with it: viniyoga, karanyāsa, hṛdayādi nyāsa with its digbandha, dhyāna, the text, its phalaśruti, the closing nyāsa with its digvimoka. Never the compiler's: an invocation at the head of a book ("śrīgaṇeśāya namaḥ"), ācamana, a saṅkalpa (the reciter's own declaration — only when asked), the edition's notes, numbers and variants, another edition's colophon. Offering choices, name the parts as asked; add none.

2. EACH PART ITS OWN SECTION, under his heading, lower case: "viniyogaḥ", "karanyāsaḥ", "hṛdayādi nyāsaḥ", "dhyānam" ("dhyānāni" for several), "stotram", "samāpta hṛdayādi nyāsaḥ" for the closing one. A rubric that heads a part is its heading ("lamityādi pañcapūjāṁ kuryāt") — never a verse. The parts' verses are unnumbered (numbered: false); the text's own verses are numbered from 1, as its edition numbers them.

3. THE VINIYOGA — one element a line, each closed with a daṇḍa, the last with the double:
  oṁ asya śrīlalitā sahasra nāma stotra mahā mantrasya ।
  vaśinyādi vāg devatā ṛṣayaḥ ।
  anuṣṭup chandaḥ ।
  śrī lalitā parameśvarī devatā ।
  śrīmad vāg bhava kūṭeti bījam ।
  madhya kūṭeti śaktiḥ ।
  śakti kūṭeti kīlakam ।
  mama śrī lalitā mahā tripurasundarī prasāda siddhi dvārā
  cintita phalāvāptyarthe jape viniyogaḥ ॥
A source that runs it on, with commas, is set so — a line an element (spaced may break lines and add daṇḍas). The pause bars his pages draw ( | ) are the program's: never type one.

4. THE NYĀSAS — one formula a line, the two as two sections:
  karanyāsaḥ
  aiṁ aṅguṣṭhābhyāṁ namaḥ । … sauḥ karatala karapṛṣṭhābhyāṁ namaḥ ॥
  hṛdayādi nyāsaḥ
  aiṁ hṛdayāya namaḥ ।  klīṁ śirase svāhā ।  sauḥ śikhāyai vaṣaṭ ।
  aiṁ kavacāya huṁ ।  klīṁ netratrayāya vauṣaṭ ।  sauḥ astrāya phaṭ ।
  bhūr bhuvas suvarom iti digbandhaḥ ॥
A source that prints the two side by side, as the columns of one table, is set as the two lists: each formula taken from the same lines, the other column's words left out of spaced (the program allows whole words of the source to be left out, and lists them). A line's gesture, where the source gives one, is its line note in English ("thumbs", "heart").

5. THE DHYĀNA — under "dhyānam", its metre in the verse's note: "(śārdūlavikrīḍitaṁ chandaḥ, 19 syllables per pāda, yatiḥ after the 12th, and 19th)", "(anuṣṭup chandaḥ, 8 syllables per pāda)". Unnumbered.

6. A TEXT OF NAMES (aṣṭottaraśata, triśatī, sahasranāma) — each name numbered as his Lalitā numbers it, a raised number after the name, written in spaced as a superscript digit:
  śrī mā̍tā¹ śrī̍ mahā̱rājñī² śrī̱mat si̱ṁhāsane̍śvarī³ ।
and the translation names them by the same numbers: "¹Great Mother; ²Great Empress; ³who sits on the lion throne". Counted from 1 through the whole text.

7. THE CLOSE — the colophon is the last verse of the text's section, unnumbered, never a heading: "॥ iti śrīmad śaṅkarācārya kṛta / śrī kanakadhārā stotraṁ sampūrṇam ॥". Then the closing parts under their headings. A closing śānti, where his texts of its kind have one: "oṁ śānti̱ś śānti̱ś śānti̍ḥ ॥", the last verse, unnumbered.

8. ONE EDITION, ITS VERSES WHOLE. A verse ends at its edition's number. A word or a line the edition prints beside a verse — another reading after the number, a name hung on the end of a half-verse — is no part of the text: leave it out of spaced. A verse the base edition has wrong is taken from the other witness, by its lines. What the authentic editions have both with and without goes in brackets: a word "(atha)"; a verse optional: true, its note naming its source.

9. NOTES — a verse's note above it (where else it is; its ṛṣi, devatā and chandas; its metre); a line's note after it (another reading "p.b. sūryā̍d", a gesture, why a line is there). Never the working: no website, no witness, no comparison.

10. A SŪKTA says its ṛṣi, devatā and chandas once, before its first verse — an unnumbered verse with no translation, in Sanskrit, as his agnimīḻe sūktam: "agnimīḻe iti navarcasyāsya sūktasya । madhucchandā vaiśvāmitra ṛṣiḥ । agnirdevatā । gāyatrī chandaḥ ॥"; a metre that changes from verse to verse as his samāna sūktam says it: "prathamā dvitīyā caturthīnām ṛcām anuṣṭup । tṛtīyāyāś ca triṣṭup chandasī ॥". A single ṛk taken out of its sūkta has them in its note: "ṚV 3.62.10. - gāthino viśvāmitraḥ ṛṣiḥ, savitā devatā, gāyatrī chandaḥ".

11. NEVER on his page: a letter of another script in an IAST verse; a digit or a dash in a mantra line; a capital in a heading; a heading that repeats the title; an edition's verse number or reference; a double daṇḍa inside a verse.`;
