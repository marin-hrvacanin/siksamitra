/**
 * Reading Quill's generated HTML — a strict tokeniser for one known subset.
 *
 * WHY NOT A REAL HTML PARSER. This input is not the web: it is the output of
 * one editor's serialiser, and the vocabulary is closed (see
 * `documents/smdoc-format.md` in v1, and the classes actually found in the
 * owner's Library, which differ from it). A strict reader over a closed
 * vocabulary FAILS on anything unexpected, which is what an importer of
 * someone's only copy of a document should do. A forgiving parser would
 * silently drop a mark it did not recognise, and a lost holding in a 200-verse
 * text is not something anyone finds by reading.
 *
 * It also never touches `innerHTML` or the DOM: this runs in Node, in the
 * desktop shell and in a browser, over a file that arrived from outside, so
 * there is nothing here that could execute anything.
 */

export type SmdocNode =
  | { t: 'text'; s: string }
  | { t: 'open'; tag: string; classes: string[]; attrs: Record<string, string> }
  | { t: 'close'; tag: string }
  | { t: 'void'; tag: string; classes: string[] };

/** The tags Quill's serialiser produces. Anything else is refused. */
const KNOWN_TAGS = new Set([
  'p', 'span', 'br', 'strong', 'em', 'u', 's', 'sub', 'sup', 'b', 'i',
  // v1 used a bare custom element for the change colour in older files.
  'change', 'div', 'a',
  // Audio, stored inline as a base64 data URI. 39 MB of it in one document.
  'audio', 'source',
]);

const VOID_TAGS = new Set(['br']);

export class SmdocHtmlError extends Error {
  constructor(message: string, readonly at: number, readonly context: string) {
    super(`${message} (at ${at}: "${context}")`);
    this.name = 'SmdocHtmlError';
  }
}

/** The five entities Quill emits. Anything else numeric is decoded too. */
function unescape(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    switch (body) {
      case 'amp': return '&';
      case 'lt': return '<';
      case 'gt': return '>';
      case 'quot': return '"';
      case 'apos': return "'";
      case 'nbsp': return ' ';
      default: return whole;
    }
  });
}

function parseAttrs(raw: string, at: number): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    attrs[m[1]!.toLowerCase()] = unescape(m[3] ?? m[4] ?? '');
  }
  // A bare attribute with no value is legal HTML and Quill does not emit one;
  // finding one means this is not the input we think it is.
  const leftover = raw.replace(re, '').trim();
  if (leftover !== '' && leftover !== '/') {
    throw new SmdocHtmlError('an attribute this reader does not know', at, leftover.slice(0, 40));
  }
  return attrs;
}

/**
 * Tokenise the content string.
 *
 * Refuses: an unknown tag, an unbalanced close, a `<` that opens nothing. Each
 * refusal names the offset and the text around it, because the person who has
 * to act on it is holding a document that will not open.
 */
export function tokenizeSmdocHtml(html: string): SmdocNode[] {
  const out: SmdocNode[] = [];
  const stack: string[] = [];
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      const text = unescape(html.slice(i));
      if (text !== '') out.push({ t: 'text', s: text });
      break;
    }
    if (lt > i) {
      const text = unescape(html.slice(i, lt));
      if (text !== '') out.push({ t: 'text', s: text });
    }

    const gt = html.indexOf('>', lt);
    if (gt === -1) {
      throw new SmdocHtmlError('a `<` with no `>`', lt, html.slice(lt, lt + 40));
    }
    const inner = html.slice(lt + 1, gt).trim();
    i = gt + 1;

    if (inner.startsWith('!')) continue; // a comment or doctype: ignored.

    if (inner.startsWith('/')) {
      const tag = inner.slice(1).trim().toLowerCase();
      const open = stack.pop();
      if (open !== tag) {
        throw new SmdocHtmlError(
          `</${tag}> closes ${open === undefined ? 'nothing' : `<${open}>`}`,
          lt, html.slice(lt, lt + 40),
        );
      }
      out.push({ t: 'close', tag });
      continue;
    }

    const space = inner.search(/[\s/]/);
    const tag = (space === -1 ? inner : inner.slice(0, space)).toLowerCase();
    if (!KNOWN_TAGS.has(tag)) {
      throw new SmdocHtmlError(`<${tag}> is not a tag this reader knows`, lt, inner.slice(0, 40));
    }
    const attrs = parseAttrs(space === -1 ? '' : inner.slice(space), lt);
    const classes = (attrs['class'] ?? '').split(/\s+/).filter((c) => c !== '');

    if (VOID_TAGS.has(tag) || inner.endsWith('/')) {
      out.push({ t: 'void', tag, classes });
      continue;
    }
    stack.push(tag);
    out.push({ t: 'open', tag, classes, attrs });
  }

  if (stack.length > 0) {
    throw new SmdocHtmlError(
      `<${stack[stack.length - 1]}> is never closed`, html.length, '',
    );
  }
  return out;
}
