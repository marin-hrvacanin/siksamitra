/**
 * THE MODEL'S MARKDOWN, AS TELEGRAM AND THE PANEL DRAW IT.
 *
 * The model writes Markdown; sent as it is, Telegram shows the asterisks.
 * Telegram's own "MarkdownV2" wants eighteen characters escaped everywhere
 * they are not markup — a full stop, a hyphen, a bracket — and one missed
 * is a message refused. Its HTML wants three (`<`, `>`, `&`), and its few
 * tags must be properly nested.
 *
 * So the Markdown is PARSED — by `marked`, not by expressions of ours (rule
 * 16) — and the tree written out in only the tags Telegram knows: b, i, s,
 * code, pre, a, blockquote. Everything else is text, escaped in one place.
 * A heading is bold, a list is bullets, a table is a block of monospaced
 * text; raw HTML in the model's text is shown as the characters it is.
 * Built from a tree, the tags cannot be unbalanced; and should Telegram
 * still refuse one, the adapter sends the plain text instead.
 *
 * THE PANEL DRAWS THE SAME HTML — in the Word add-in and in the app — and it
 * is safe to: every character the model wrote is escaped, the only tags are
 * these seven, and a link is only ever an http(s) one. There, a link opens
 * outside the panel (`target`), which Telegram's HTML has no attribute for.
 */
import { Marked, type Tokens } from 'marked';

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s: string): string => esc(s).replace(/"/g, '&quot;');

/** A table as Telegram can show one: monospaced, the columns padded. */
function tableText(t: Tokens.Table): string {
  const rows = [t.header.map((c) => c.text), ...t.rows.map((r) => r.map((c) => c.text))];
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => [...(r[i] ?? '')].length)));
  const line = (r: string[]): string => r.map((c, i) => c + ' '.repeat(Math.max(0, widths[i]! - [...c].length))).join('  ').trimEnd();
  return [line(rows[0]!), widths.map((w) => '─'.repeat(w)).join('  '), ...rows.slice(1).map(line)].join('\n');
}

function rendererFor(linkTarget: boolean): Marked {
  return new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    space() { return ''; },
    paragraph({ tokens }) { return `${this.parser.parseInline(tokens)}\n\n`; },
    heading({ tokens }) { return `<b>${this.parser.parseInline(tokens)}</b>\n\n`; },
    hr() { return '──────────\n\n'; },
    blockquote({ tokens }) { return `<blockquote>${this.parser.parse(tokens).trim()}</blockquote>\n\n`; },
    code({ text }) { return `<pre>${esc(text.replace(/\n+$/, ''))}</pre>\n\n`; },
    html({ text }) { return esc(text); },
    table(t) { return `<pre>${esc(tableText(t))}</pre>\n\n`; },
    list(t) {
      const start = typeof t.start === 'number' ? t.start : 1;
      const items = t.items.map((item, i) => {
        const mark = t.ordered ? `${start + i}.` : '•';
        const body = this.parser.parse(item.tokens).trim().replace(/\n{2,}/g, '\n');
        return `${mark} ${body.replace(/\n/g, '\n   ')}`;
      });
      return `${items.join('\n')}\n\n`;
    },
    checkbox({ checked }) { return checked ? '☑ ' : '☐ '; },
    strong({ tokens }) { return `<b>${this.parser.parseInline(tokens)}</b>`; },
    em({ tokens }) { return `<i>${this.parser.parseInline(tokens)}</i>`; },
    del({ tokens }) { return `<s>${this.parser.parseInline(tokens)}</s>`; },
    codespan({ text }) { return `<code>${esc(text)}</code>`; },
    br() { return '\n'; },
    link({ href, tokens }) {
      const inner = this.parser.parseInline(tokens);
      if (!/^https?:\/\//i.test(href)) return inner;
      return `<a href="${attr(href)}"${linkTarget ? ' target="_blank" rel="noopener noreferrer"' : ''}>${inner}</a>`;
    },
    image({ text }) { return esc(text); },
    text(t) {
      return 'tokens' in t && t.tokens !== undefined ? this.parser.parseInline(t.tokens) : esc(t.text);
    },
  },
  });
}

const telegram = rendererFor(false);
const panel = rendererFor(true);

/** Markdown as Telegram HTML. */
export function telegramHtml(markdown: string): string {
  return (telegram.parse(markdown, { async: false }) as string).replace(/\n{3,}/g, '\n\n').trim();
}

/** Markdown as the panel draws it: the same safe HTML, its links opening outside. */
export function panelHtml(markdown: string): string {
  return (panel.parse(markdown, { async: false }) as string).replace(/\n{3,}/g, '\n\n').trim();
}

/** The same message with no markup at all — what is sent if Telegram refuses the HTML. */
export function plainOf(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

/**
 * The message in pieces Telegram will take: at most `max` characters of HTML
 * each, cut between paragraphs of the Markdown so no piece opens a tag it
 * does not close. A single paragraph longer than that is cut at its lines.
 */
export function telegramPieces(markdown: string, max = 3800): string[] {
  const blocks = markdown.split(/\n{2,}/);
  const out: string[] = [];
  let at = '';
  const flush = (): void => { if (at.trim() !== '') out.push(telegramHtml(at)); at = ''; };
  for (const block of blocks) {
    const next = at === '' ? block : `${at}\n\n${block}`;
    if (telegramHtml(next).length <= max) { at = next; continue; }
    flush();
    if (telegramHtml(block).length <= max) { at = block; continue; }
    for (const line of block.split('\n')) {
      const more = at === '' ? line : `${at}\n${line}`;
      if (telegramHtml(more).length <= max) { at = more; continue; }
      flush();
      at = line.length > max ? line.slice(0, max) : line;
    }
  }
  flush();
  return out.length === 0 ? [''] : out;
}
