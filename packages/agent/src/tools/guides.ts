/**
 * HIS AUTHORING GUIDES, FOR THE AGENT TO READ — as the agent that wrote his
 * documents with him could.
 *
 * His words (2026-10-02): "I used to use Claude CLI which could read all of
 * that for building documents and it got it right so much… Now I want to
 * recreate that experience with the API and open it to the people." The guides
 * are `docs/authoring/` — copies of the platform's own — and they hold what no
 * prompt could carry whole: the marking rules, how a chant is written,
 * translated and sourced, the protected readings, one recension faithfully.
 * Read by section or by a word in them; the host says where they are.
 */
import { HOUSE_STYLE } from '../house-style.js';
import { arg, opt, params, str, type Tool } from './types.js';

/** Each guide, by the name the tool takes. */
export const GUIDES: Readonly<Record<string, { readonly file: string; readonly about: string }>> = {
  chants: { file: 'AUTHORING-CHANTS.md', about: 'writing a chant: its text, structure, translation, sources, protected readings, one recension' },
  documents: { file: 'AUTHORING-DOCUMENTS.md', about: 'the document around the chants: a manual, a pūjā, a course' },
  marking: { file: 'MARKING-RULES.md', about: 'what every mark means and when it is placed' },
  sankalpa: { file: 'AUTHORING-SANKALPA.md', about: 'the saṅkalpa, composed with its variables' },
  format: { file: 'CHANT-FORMAT.md', about: 'the document format, field by field' },
};

const MAX_LINES = 160;

const headingOf = (line: string): { level: number; title: string } | null => {
  const m = /^(#{1,6})\s+(.*)$/u.exec(line);
  return m === null ? null : { level: m[1]!.length, title: m[2]!.trim() };
};

export const GUIDE_TOOLS: readonly Tool[] = [
  {
    writes: false,
    spec: {
      name: 'house_style',
      description: 'How his pages set a text — what is asked for, each part under its heading, the viniyoga and the nyāsas, the dhyāna, '
        + 'a text of names, the close, his notes, and what his page never has — in his own lines. Read it whole before you build.',
      parameters: params({}),
    },
    async run() { return HOUSE_STYLE; },
  },
  {
    writes: false,
    needs: 'guides',
    spec: {
      name: 'read_guide',
      description: `Read his authoring guides — the rules he gave the agents that wrote his documents with him: ${Object.entries(GUIDES).map(([k, g]) => `${k} (${g.about})`).join('; ')}. `
        + 'Without section or find: its headings. section: one section, by its number ("5G") or words of its heading. find: the passages that say it.',
      parameters: params({
        guide: { type: 'string', enum: Object.keys(GUIDES) },
        section: str('A section: its number, as "0", "5G", "3.1", or words of its heading.'),
        find: str('Words to find in it: "translation", "protected", "gum".'),
      }, ['guide']),
    },
    async run(args, { host }) {
      const name = arg<string>(args, 'guide', 'string');
      const guide = GUIDES[name];
      if (guide === undefined) throw new Error(`no guide "${name}" — one of ${Object.keys(GUIDES).join(', ')}`);
      const text = await host.guides!(guide.file);
      if (text === null) return `the guide "${name}" is not here`;
      const lines = text.split(/\r?\n/);
      const section = opt<string>(args, 'section', 'string')?.trim();
      const find = opt<string>(args, 'find', 'string')?.trim();
      if (section !== undefined && section !== '') {
        const want = section.toLowerCase();
        const at = lines.findIndex((l) => {
          const h = headingOf(l);
          if (h === null) return false;
          const t = h.title.toLowerCase();
          return t.startsWith(`${want}.`) || t.startsWith(`${want} `) || t.split(/[\s.]+/u)[0] === want || t.includes(want);
        });
        if (at < 0) return `no section "${section}" in ${guide.file} — read its headings first`;
        const level = headingOf(lines[at]!)!.level;
        let end = at + 1;
        while (end < lines.length && !(headingOf(lines[end]!) !== null && headingOf(lines[end]!)!.level <= level)) end += 1;
        const body = lines.slice(at, Math.min(end, at + MAX_LINES));
        return `${guide.file}, lines ${at + 1}-${at + body.length}${end - at > MAX_LINES ? ` (the section runs on to line ${end}: ask for find, or the next part)` : ''}\n${body.join('\n')}`;
      }
      if (find !== undefined && find !== '') {
        const want = find.toLowerCase();
        const hits = lines.flatMap((l, i) => (l.toLowerCase().includes(want) ? [i] : [])).slice(0, 10);
        if (hits.length === 0) return `"${find}" is not in ${guide.file}`;
        return hits.map((i) => `${guide.file} ${i + 1}:\n${lines.slice(Math.max(0, i - 2), i + 4).join('\n')}`).join('\n---\n');
      }
      return `${guide.file} — its headings:\n${lines.flatMap((l, i) => (headingOf(l) === null ? [] : [`${i + 1}| ${l}`])).join('\n')}`;
    },
  },
];
