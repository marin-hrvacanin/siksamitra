/**
 * WHAT THE MODEL WRITES, AS TELEGRAM WILL TAKE IT.
 *
 * Every case a model's answer has — bold in a sentence, a list, a heading, a
 * code block with < and &, a link, a table, IAST diacritics, raw HTML, an
 * asterisk that is not emphasis — comes out as Telegram's HTML: only its
 * tags, properly nested, everything else escaped.
 */
import { describe, expect, it } from 'vitest';
import { panelHtml, plainOf, telegramHtml, telegramPieces } from '../markdown.js';

/** Only Telegram's tags, each closed in the order it was opened. */
function wellFormed(html: string): boolean {
  const stack: string[] = [];
  for (const m of html.matchAll(/<(\/?)([a-z]+)(?:\s[^>]*)?>/g)) {
    const [, close, tag] = m;
    if (!['b', 'i', 's', 'code', 'pre', 'a', 'blockquote'].includes(tag!)) return false;
    if (close === '') stack.push(tag!);
    else if (stack.pop() !== tag) return false;
  }
  return stack.length === 0;
}

describe('Markdown to Telegram HTML', () => {
  it('bold, italic and code in a sentence, with IAST kept as it is', () => {
    expect(telegramHtml('Here is the **puruṣa sūktam** — *taittirīya āraṇyaka* `3.12`.'))
      .toBe('Here is the <b>puruṣa sūktam</b> — <i>taittirīya āraṇyaka</i> <code>3.12</code>.');
  });

  it('a list becomes bullets, a numbered one keeps its numbers, a heading is bold', () => {
    expect(telegramHtml('## Sources\n\n- sanskritdocuments.org\n- Wikisource')).toBe('<b>Sources</b>\n\n• sanskritdocuments.org\n• Wikisource');
    expect(telegramHtml('1. find\n2. build\n3. check')).toBe('1. find\n2. build\n3. check');
  });

  it('every <, > and & that is not markup is escaped — in text, in code, in raw HTML', () => {
    const html = telegramHtml('a < b & c > d\n\n```\nif (x < 1 && y > 2) {}\n```\n\n<script>alert(1)</script> and <b>not bold</b>');
    expect(html).toContain('a &lt; b &amp; c &gt; d');
    expect(html).toContain('<pre>if (x &lt; 1 &amp;&amp; y &gt; 2) {}</pre>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;not bold&lt;/b&gt;');
    expect(wellFormed(html)).toBe(true);
  });

  it('a web link is a link; anything else is only its words', () => {
    expect(telegramHtml('[sanskritdocuments](https://sanskritdocuments.org/a?b=1&c=2)'))
      .toBe('<a href="https://sanskritdocuments.org/a?b=1&amp;c=2">sanskritdocuments</a>');
    expect(telegramHtml('[run me](javascript:alert(1))')).toBe('run me');
  });

  it('a table is a block of monospaced text', () => {
    const html = telegramHtml('| verse | words |\n|---|---|\n| 1 | 12 |\n| 2 | 9 |');
    expect(html.startsWith('<pre>')).toBe(true);
    expect(html).toContain('verse  words');
    expect(wellFormed(html)).toBe(true);
  });

  it('a lone asterisk or underscore is not emphasis and does not break anything', () => {
    const html = telegramHtml('2 * 3 = 6 and snake_case_name, also **unclosed bold');
    expect(wellFormed(html)).toBe(true);
    expect(plainOf(html)).toContain('2 * 3 = 6');
    expect(plainOf(html)).toContain('snake_case_name');
  });

  it('nested emphasis stays nested, and a quote is a blockquote', () => {
    const html = telegramHtml('> **bold and *italic* inside**');
    expect(html).toBe('<blockquote><b>bold and <i>italic</i> inside</b></blockquote>');
    expect(wellFormed(html)).toBe(true);
  });

  it('the panel draws the same safe HTML, its links opening outside the panel', () => {
    expect(panelHtml('**a** [b](https://x.org) <script>')).toBe(
      '<b>a</b> <a href="https://x.org" target="_blank" rel="noopener noreferrer">b</a> &lt;script&gt;');
  });

  it('the plain text, when Telegram refuses the HTML, says the same words', () => {
    expect(plainOf(telegramHtml('**a** & <b>'))).toBe('a & <b>');
  });

  it('a long answer is cut between paragraphs, every piece well formed and short enough', () => {
    const md = Array.from({ length: 60 }, (_, i) => `**Verse ${i + 1}.** ${'sahasraśīrṣā puruṣaḥ '.repeat(8)}`).join('\n\n');
    const pieces = telegramPieces(md, 1000);
    expect(pieces.length).toBeGreaterThan(5);
    for (const p of pieces) {
      expect(p.length).toBeLessThanOrEqual(1000);
      expect(wellFormed(p)).toBe(true);
    }
    /* The same words in the same order — a piece is trimmed at its ends, nothing else. */
    const words = (t: string): string => t.replace(/[ \t]+(?=\n|$)/g, '');
    expect(words(pieces.map(plainOf).join('\n\n'))).toBe(words(plainOf(telegramHtml(md))));
  });
});
