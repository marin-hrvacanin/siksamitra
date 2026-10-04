// Assemble the Viṣṇu sahasranāma book: his sādhanā's front parts (as stored),
// the three built parts, his Youth Wing nārāyaṇa kṣamā prārthanā, his śānti.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { unpackDocument, packDocument } from '../../packages/interop/src/index.js';
import { openChantDoc } from '../../packages/engine/src/index.js';
import { readChantFile, writeChantFile, withVerses } from '../../packages/format/src/index.js';

const smdoc = (p: string): any => {
  const f: any = unpackDocument(new Uint8Array(readFileSync(p)));
  return openChantDoc(f.doc ?? f.document ?? f);
};
const sadRead: any = readChantFile(readFileSync('out/tmp/sadhana.json', 'utf8'));
const sadhana: any = openChantDoc(sadRead.doc ?? sadRead);
const nsRead: any = readChantFile(readFileSync('out/tmp/ns.json', 'utf8'));
const ns: any = openChantDoc(nsRead.doc ?? nsRead);
const youthRead: any = readChantFile(readFileSync('out/tmp/youth.json', 'utf8'));
const youth: any = openChantDoc(youthRead.doc ?? youthRead);
const b1 = smdoc('out/mcp/vsn-b1.smdoc');
const b2 = smdoc('out/mcp/vsn-b2.smdoc');
const b3 = smdoc('out/mcp/vsn-b3.smdoc');
console.error('profiles', JSON.stringify({ sadhana: sadhana.profile, youth: youth.profile, b1: b1.profile }));

const byId = (doc: any, id: string): any => {
  const s = doc.sections.find((x: any) => x.id === id);
  if (s === undefined) throw new Error(`no ${id}`);
  return s;
};
const byPartTitle = (doc: any, part: string, title?: string): any => {
  const s = doc.sections.find((x: any) => x.part === part && (title === undefined || x.title === title));
  if (s === undefined) throw new Error(`no ${part} ${title ?? ''}`);
  return s;
};

const out: any[] = [];
/** A section, given its place in the book: its own profile kept from its document. */
const note = (en: string) => ({ t: 'instruction', instruction: { comment: 'body', kind: 'note', text: { en } } });
const put = (s: any, from: any, over: Record<string, unknown>, remark?: string): void => {
  const sec: any = { ...s, ...over };
  if (remark !== undefined) {
    const items = sec.items ?? sec.verses.map((v: any) => ({ t: 'verse', ...v }));
    sec.items = [note(remark), ...items];
  }
  for (const k of Object.keys(over)) if (over[k] === undefined) delete sec[k];
  if (sec.profile === undefined && from.profile !== undefined) sec.profile = from.profile;
  out.push(sec);
};

/* 1. His sādhanā v9.1.13, as stored: the prastāvanā, gaṇapati ca sarasvatī,
      samāna sūktam, ṛgvedīya gaṇapati sūktam — as his Lalitā book opens. */
for (const id of ['s-1', 's-2', 's-3', 's-4', 's-5', 's-9']) put(byId(sadhana, id), sadhana, {});

/* 2. The text's own prastāvanā (built). */
const P1 = '॥ śrī viṣṇu sahasranāma stotra prastāvanā ॥';
const [pp, ny, rsy, kara, hrd, dhy, panca] = b1.sections;
put(pp, b1, { part: P1, title: 'pūrvapīṭhikā', source: 'mahābhārata, anuśāsana parva 149' }, 'The introductory chants of the thousand names of Śrī Viṣṇu');
put(ny, b1, { part: P1, title: 'nyāsaḥ', source: undefined });
put(rsy, b1, { part: P1, title: 'ṛṣyādi nyāsaḥ', sub: true, source: undefined });
put(kara, b1, { part: P1, title: 'karanyāsaḥ', sub: true, source: undefined });
put(hrd, b1, { part: P1, title: 'hṛdayādi nyāsaḥ', sub: true, source: undefined });
put(dhy, b1, { part: P1, title: 'dhyānāni', source: undefined });
put(panca, b1, { part: P1, title: 'laṁ ityādi pañcapūjā', source: undefined });

/* 3. The stotram. */
put(b2.sections[0], b2, { part: '॥ stotram ॥', title: 'śrī viṣṇu sahasranāma stotram', source: 'mahābhārata, anuśāsana parva 149' });

/* 4. The phalaśruti. */
put(b3.sections[0], b3, { part: '॥ śrī viṣṇu sahasranāma stotra uttarabhāgaḥ ॥', title: 'phalaśrutiḥ', source: 'mahābhārata, anuśāsana parva 149' }, 'The concluding chants of the thousand names of Śrī Viṣṇu');

/* 4b. His sādhanā's puruṣa sūktam, and his nārāyaṇa sūktam v1.0. */
for (const s of sadhana.sections.filter((x: any) => (x.part ?? '').normalize('NFC').replace(/[\s ]+/gu, ' ').includes('puruṣa'))) put(s, sadhana, {});
{
  const s = ns.sections[0];
  /* The PDF read its subtitle as a verse and lost its source lines; as his page has them. */
  const verses = s.verses.slice(1).map((v: any, i: number, all: any[]) => (
    i === 12 ? { ...v, source: 'taittirīyāraṇyakam 10.23' } : i === 13 ? { ...v, source: 'nārāyaṇa gāyatrī - taittirīyāraṇyakam 10.1.6' } : v));
  put(withVerses({ ...s, items: undefined }, verses), ns, {
    part: '॥ nārāyaṇa sūktam ॥', title: 'Hymn of nārāyaṇa',
  });
}

/* 5. His Youth Wing sādhanā v1.0.1: the nārāyaṇa kṣamā prārthanā, as stored. */
put(byPartTitle(youth, '॥ nārāyaṇa kṣamā prārthanā ॥'), youth, {});

/* 6. His sādhanā's śānti mantrāṇi, as his Lalitā book closes: pavamāna, svasti vācaka. */
put(byId(sadhana, 's-85'), sadhana, {});
put(byId(sadhana, 's-87'), sadhana, {});

/* Ids made unique, verse ids under their section's. */
const sections = out.map((s, i) => {
  const id = `s-${i + 1}`;
  const re = (v: any, k: number) => ({ ...v, id: `${id}-v${k + 1}` });
  const verses = s.verses.map(re);
  const seen = new Map(s.verses.map((v: any, k: number) => [v.id, verses[k].id]));
  const items = s.items?.map((it: any) => (it.t === 'verse' ? { ...it, id: seen.get(it.id) ?? it.id } : it));
  return { ...s, id, verses, ...(items === undefined ? {} : { items }) };
});

const doc: any = {
  ...b2,
  title: 'Śrī Viṣṇu Sahasranāma Stotram',
  subtitle: 'The thousand names of Śrī Viṣṇu, from the Mahābhārata',
  source: 'mahābhārata, anuśāsana parva 149',
  titleForms: {},
  sections,
  book: true,
  cover: { lines: ['Śrī Viṣṇu', 'Sahasranāma Stotram'], under: ['mahābhārata, anuśāsana parva 149'], figure: JSON.parse(readFileSync('out/tmp/cover-figure.json', 'utf8')) },
};
delete doc.profile;
const opened = openChantDoc(doc);
mkdirSync('out/vsn', { recursive: true });
writeFileSync('out/vsn/vsn-book.json', writeChantFile(opened));
console.error('sections', sections.length, 'verses', sections.reduce((n: number, s: any) => n + s.verses.length, 0));
for (const s of sections) console.error(s.id, s.part, '|', s.title, s.sub ? '(sub)' : '', '|', s.verses.length, JSON.stringify(s.profile ?? null));
