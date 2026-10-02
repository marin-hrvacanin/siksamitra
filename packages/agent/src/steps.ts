/**
 * WHAT THE AGENT IS DOING, IN A SENTENCE — for the person watching.
 *
 * A step is told as it starts and finished with what came of it, from the
 * tool's OWN arguments and answer — "Reading lines 3700–3720 of “Taittiriya
 * AraNyaka”", "A second look: is this the Gāyatrī itself, and does 10.35 hold
 * it?" — never a tool's name, never a page's contents, and never the same
 * fixed words whatever is being done. The owner: "updates should be summaries
 * of what we really are doing, contextual … the way they are formatted, the
 * emojis, should be a premade template".
 *
 * The TEMPLATE is the icon: one per kind of work, the same for every step of
 * that kind (`stepIcon`), and one for how it ended (`OUTCOME_ICON`).
 */
import { TOOL_LABELS } from './modes.js';

const quoted = (s: unknown, n = 60): string => {
  const t = String(s ?? '').trim().replace(/\s+/g, ' ');
  return `“${t.length > n ? `${t.slice(0, n)}…` : t}”`;
};
const host = (u: unknown): string => {
  try { return new URL(String(u)).hostname.replace(/^www\./, ''); } catch { return 'a page'; }
};
/** The first clause of what the agent wrote, at most `n` letters. */
const gist = (s: unknown, n = 80): string => {
  const t = String(s ?? '').trim().replace(/\s+/g, ' ');
  const first = t.split(/(?<=[.?!])\s/)[0] ?? t;
  return first.length > n ? `${first.slice(0, n)}…` : first;
};

/** The kind of work a tool does, as the icon that stands for it. */
const KIND: Readonly<Record<string, string>> = {
  find_text: '📚', open_text: '📚',
  web_search: '🔎',
  fetch_page: '📖', read_witness: '📖', find_in_witness: '📖', outline: '📖', read_verses: '📖',
  build_document: '✍️', set_field: '✍️', replace_text: '✍️', add_verse: '✍️', remove_verse: '✍️',
  set_source: '🖋️', auto_mark: '🖋️',
  check: '🔬', review: '🧐',
  deliver: '📄', offer_choices: '❓',
};

/** The icon for a kind of step: the same for every step of its kind. */
export const stepIcon = (name: string): string => KIND[name] ?? '⚙️';

/** How a step ended. */
export const OUTCOME_ICON = { done: '✅', attention: '⚠️', failed: '❌' } as const;

/** The step as it starts — from its own arguments. */
export function stepStarted(name: string, argsJson: string): string {
  let a: Record<string, unknown> = {};
  try { a = JSON.parse(argsJson || '{}') as Record<string, unknown>; } catch { /* the label alone */ }
  switch (name) {
    case 'find_text': return `Looking in the library for ${quoted(a.query)}`;
    case 'open_text': return `Opening ${quoted(a.id, 50)} from the library`;
    case 'web_search': return `Searching the web for ${quoted(a.query)}`;
    case 'fetch_page': return `Reading ${host(a.url)}`;
    case 'find_in_witness': return `Finding ${quoted(a.phrase, 40)} in ${String(a.witness ?? 'the source')}`;
    case 'read_witness': return `Reading lines ${String(a.from ?? '?')}–${String(a.to ?? '?')} of ${String(a.witness ?? 'the source')}`;
    case 'build_document': {
      const sections = Array.isArray(a.sections) ? a.sections.length : 0;
      return `Building ${quoted(a.title)}${a.subtitle === undefined ? '' : `, ${String(a.subtitle)},`} from the source’s own lines`
        + `${sections > 1 ? ` (${sections} sections)` : ''}`;
    }
    case 'set_source': return `Marking it by the ${String(a.source ?? '')} rules`;
    case 'auto_mark': return `Marking ${a.section === undefined ? 'it' : String(a.section)} by the śikṣā rules`;
    case 'set_field': return `Setting the ${String(a.field ?? 'title')} to ${quoted(a.value, 50)}`;
    case 'replace_text': return `Correcting ${String(a.verse ?? 'a verse')}`;
    case 'add_verse': return `Adding a verse to ${String(a.section ?? 'the text')}`;
    case 'remove_verse': return `Removing ${String(a.verse ?? 'a verse')}`;
    case 'check': return 'Checking every letter against the source and every mark against the rules';
    case 'review': return a.focus === undefined ? 'A second look, by another reader' : `A second look: ${gist(a.focus)}`;
    case 'deliver': return a.format === undefined || a.format === 'pdf' ? 'Preparing the PDF' : `Preparing the ${String(a.format)}`;
    case 'offer_choices': return `Asking you: ${quoted(a.question, 70)}`;
    default: return TOOL_LABELS[name] ?? 'Working';
  }
}

/** What came of it, in a few words — and whether it wants attention. */
export function stepResult(name: string, text: string, failed: boolean): string {
  if (failed) return 'did not work';
  const first = text.split('\n')[0] ?? '';
  switch (name) {
    case 'find_text': {
      if (/^nothing in the library/.test(first)) return 'not in the library';
      const title = first.split(' · ')[1];
      return title === undefined ? 'found' : `found ${quoted(title, 50)}`;
    }
    case 'open_text': {
      const t = /^"([^"]+)"/.exec(first)?.[1];
      return t === undefined ? 'opened' : `opened ${quoted(t, 50)}`;
    }
    case 'web_search': {
      const n = text.split('\n').filter((l) => /^\d+\. /.test(l)).length;
      return n === 0 ? 'nothing found' : `${n} result(s)`;
    }
    case 'fetch_page': {
      if (/no Devanāgarī or IAST/.test(text)) return 'no Sanskrit text on it';
      const m = /^(w\d+): "([^"]*)", (\d+) lines/.exec(first);
      return m === null ? 'the text is there' : `${quoted(m[2], 40)}, ${m[3]} lines, kept as ${m[1]}`;
    }
    case 'find_in_witness': {
      if (/^not found/.test(first)) return 'not on that page';
      const at = /line (\d+)/.exec(text)?.[1];
      return at === undefined ? 'found it' : `found at line ${at}`;
    }
    case 'build_document': {
      const n = (text.match(/\bverse\(s\)/g) ?? []).length;
      const verses = /(\d+) verse\(s\)/.exec(text)?.[1];
      return verses === undefined ? (n > 0 ? 'built' : 'built') : `built, ${verses} verse(s), and marked`;
    }
    case 'check': {
      if (/^OK/.test(first)) return 'all correct';
      const errors = text.split('\n').filter((l) => l.startsWith('ERROR')).length;
      return errors === 0 ? 'a warning to look at' : `${errors} thing(s) to fix`;
    }
    case 'review': return /no problems found/i.test(text) ? 'no problems' : 'it raised points to answer';
    case 'deliver': return /^delivered|^put into|^opened in/.test(first) ? 'ready' : 'not yet';
    default: return '';
  }
}

/** Whether a step's outcome wants the person's attention rather than a tick. */
export function stepAttention(name: string, outcome: string): boolean {
  return /to fix|warning|raised points|not yet|nothing found|not on that page|no Sanskrit|not in the library/.test(outcome)
    && name !== 'find_text';
}
