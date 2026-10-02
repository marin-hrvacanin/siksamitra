/**
 * WHERE THE TEXTS ARE — the editions a request most often needs, each fetched
 * and found to hold its text, so a request goes to the text instead of
 * searching for it.
 *
 * A real run (nīla sūktam, 2026-10-02) spent its five pages on an
 * encyclopedia, a PDF, a TITUS frameset read three times and an address it
 * guessed (`taitsamhita4.itx`, which does not exist), and built nothing. The
 * whole taittirīya saṁhitā is ONE file at sanskritdocuments, in Devanāgarī
 * with his svaras: 4.4.12 is in it, `घृ॒तव॑ती सवित॒राधि॑पत्यैः॒`.
 *
 * Data, said to the model by `editionsSaid` — an entry added here is in the
 * next prompt. An address goes in only once it has been fetched and its text
 * seen in it.
 */
export interface Edition {
  /** The work, as his pages cite it. */
  readonly work: string;
  readonly url: string;
  /** What is at the address — so the model knows what it will read. */
  readonly holds: string;
}

export const EDITIONS: readonly Edition[] = [
  {
    work: 'taittirīya saṁhitā',
    url: 'https://sanskritdocuments.org/doc_veda/taittirIyasamhitA.html',
    holds: 'all seven kāṇḍas in one file (4.3 MB), Devanāgarī with his svaras',
  },
  {
    work: 'taittirīya saṁhitā, edited (TITUS)',
    url: 'https://titus.uni-frankfurt.de/texte/etcs/ind/aind/ved/yvs/ts/ts001.htm',
    holds: 'one prapāṭhaka a file, in order (1.1 is ts001.htm, 4.4 is ts023.htm); its own romanisation with the udātta marked — compare its letters, not its accents',
  },
  {
    work: 'taittirīya brāhmaṇam',
    url: 'https://sanskritdocuments.org/doc_veda/taittirIyabrAhmaNam.html',
    holds: 'the whole brāhmaṇa in one file (1.8 MB), Devanāgarī with his svaras',
  },
  {
    work: 'taittirīya āraṇyaka',
    url: 'https://sanskritdocuments.org/doc_veda/taittirIyaAraNyaka.html',
    holds: 'the whole āraṇyaka in one file (0.8 MB), Devanāgarī with his svaras',
  },
];

/** The editions, one per line, as the prompt lists them. */
export const editionsSaid = (): string =>
  EDITIONS.map((e) => `     · ${e.work}: ${e.url} — ${e.holds}`).join('\n');
