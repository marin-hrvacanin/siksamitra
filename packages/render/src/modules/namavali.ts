import type { SankalpaDeity } from './sankalpa.js';

/**
 * The nāmāvalī registry — WHICH garland of names belongs to WHICH deity.
 *
 * The sixteen-step pūjā offers a flower with each name of the deity being
 * worshipped, and the deck's own sentence at that step is "chant the 108, or
 * the 18, or the 12 names of the Lord". *The Lord* means whoever is being
 * worshipped, so the step's content follows the reader's chosen deity — the
 * same choice that already re-voices every āvāhana mantra through the `deity`
 * slot and composes the saṅkalpa.
 *
 * IT IS RESOLVED AT RENDER TIME, NOT AUTHORED PER DEITY. Pūjā Vidhi carries
 * ONE nāmāvalī step, holding an embed whose src is `{ module: 'namavali' }`;
 * the reader looks the chosen deity up here and renders that document in
 * place. That is the saṅkalpa's pattern — a section the document positions and
 * the reader fills — and it is why there are no `onlyDeity` groups for the
 * nāmāvalī any more. There used to be three, and every new garland meant a new
 * section, a new group, and an edit to the "everyone else" list that had to
 * keep partitioning the fifteen deities exactly or a reader silently got two
 * nāmāvalīs or none.
 *
 * ADDING A DEITY'S NĀMĀVALĪ IS ONE LINE HERE plus the document itself. Nothing
 * in `gen_puja.py` changes, and nothing in the reader does.
 *
 * A deity with NO entry is not an error — it is a garland we have not published
 * yet. The step keeps its number, its title and its direction, and shows the
 * deck's own sentence in place of the names.
 */
export interface NamavaliEntry {
  /** The chant document, as served (under `client/public`). */
  doc: string;
  /** Names the embed on its header, and on the placeholder if it fails. */
  title: string;
}

export const NAMAVALI: Partial<Record<SankalpaDeity, NamavaliEntry>> = {
  ganesha: {
    doc: '/chants/ganesha-ashtottara.json',
    title: 'Aṣṭādaśa Nāmāvaliḥ — the eighteen names of Gaṇapati',
  },
  lakshmi: {
    doc: '/chants/lakshmi-ashtottara.json',
    title: 'Śrī Lakṣmī Aṣṭottara Śatanāmāvalī',
  },
};

/** The registered garland for a deity, or null when none is published yet. */
export function namavaliFor(deity: SankalpaDeity | undefined | null): NamavaliEntry | null {
  return (deity && NAMAVALI[deity]) || null;
}
