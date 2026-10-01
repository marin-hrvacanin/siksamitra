/**
 * WHAT THE AGENT IS DOING, IN A SENTENCE — for the person watching.
 *
 * A step is told as it starts ("Looking in the library for “gāyatrī”") and
 * finished with what came of it ("— found “Gāyatrī” in pūjā vidhi"), from
 * the tool's own arguments and answer: never a tool's name, never a page's
 * contents. The bot keeps these as a checklist under the request; the panel
 * can show the same.
 */
import { TOOL_LABELS } from './modes.js';

const quoted = (s: unknown, n = 60): string => {
  const t = String(s ?? '').trim();
  return `“${t.length > n ? `${t.slice(0, n)}…` : t}”`;
};
const host = (u: unknown): string => {
  try { return new URL(String(u)).hostname.replace(/^www\./, ''); } catch { return 'a page'; }
};

/** The step as it starts. */
export function stepStarted(name: string, argsJson: string): string {
  let a: Record<string, unknown> = {};
  try { a = JSON.parse(argsJson || '{}') as Record<string, unknown>; } catch { /* the label alone */ }
  switch (name) {
    case 'find_text': return `Looking in the library for ${quoted(a.query)}`;
    case 'open_text': return 'Opening it from the library';
    case 'web_search': return `Searching the web for ${quoted(a.query)}`;
    case 'fetch_page': return `Reading ${host(a.url)}`;
    case 'find_in_witness': return `Finding ${quoted(a.phrase, 40)} in the source`;
    case 'read_witness': return 'Reading the source closely';
    case 'build_document': return `Building ${quoted(a.title)} from the source’s own lines`;
    case 'set_source': return 'Marking it by the rules of its śākhā';
    case 'auto_mark': return 'Marking it by the śikṣā rules';
    case 'set_field': return 'Setting the titles';
    case 'check': return 'Checking every letter and mark';
    case 'review': return 'A second look, to find anything wrong';
    case 'deliver': return a.format === undefined || a.format === 'pdf' ? 'Preparing the PDF' : `Preparing the ${String(a.format)}`;
    case 'offer_choices': return 'Asking you to choose';
    default: return TOOL_LABELS[name] ?? 'Working';
  }
}

/** What came of it, in a few words — or nothing worth saying. */
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
    case 'fetch_page': return /no Devanāgarī or IAST/.test(text) ? 'no Sanskrit text on it' : 'the text is there';
    case 'find_in_witness': return /^not found/.test(first) ? 'not on that page' : 'found it';
    case 'check': return /^OK/.test(first) ? 'all correct' : 'found something to fix';
    case 'review': return /no problems found/i.test(text) ? 'no problems' : 'it raised points to answer';
    case 'deliver': return /^delivered|^put into|^opened in/.test(first) ? 'ready' : 'not yet';
    default: return '';
  }
}
