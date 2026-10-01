/**
 * A PART MADE IN XML — for when Word will not make one through its API.
 *
 * MEASURED IN WORD 16.0.20430: `insertContentControl` fails with
 * `GeneralException` on every range, of every kind, whenever ANOTHER document
 * is open in the same Word — a blank one is enough — while a content control
 * arriving inside an `insertOoxml` package goes in, and retitling or
 * dissolving one works as always. A person with two documents open could not
 * make a part at all.
 *
 * So the paragraphs' own package — what Word gives for their range, their
 * runs, relationships and styles all in it — has its body wrapped in the
 * `<w:sdt>` a part is (`word/rule-parts.ts` in interop: the tag and the
 * title), and goes back in over the same range. Nothing of the paragraphs is
 * rebuilt; they are Word's own XML, inside a part.
 */

const W15 = 'http://schemas.microsoft.com/office/word/2012/wordml';
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The body's paragraphs and what must stay after them: the section's properties. */
function split(body: string): { paras: string; tail: string } {
  const m = /(<w:sectPr\b[\s\S]*?<\/w:sectPr>|<w:sectPr\b[^>]*\/>)\s*$/.exec(body);
  return m === null ? { paras: body, tail: '' } : { paras: body.slice(0, m.index), tail: m[1]! };
}

/**
 * `pkg` with its document's paragraphs wrapped in one part, tagged `tag` and
 * titled `title`, with no frame drawn, as every part is (`word/parts.ts`). `dropLast` takes off
 * the empty paragraph Word's `getOoxml` adds after a range's own, which put
 * back would be a paragraph the person never had.
 */
export function asPart(pkg: string, tag: string, title: string, dropLast = false): string {
  return pkg.replace(/(<w:document\b[^>]*>)([\s\S]*?<w:body>)([\s\S]*)(<\/w:body>)/, (_all, root: string, head: string, body: string, close: string) => {
    let { paras, tail } = split(body);
    if (dropLast) paras = paras.replace(/<w:p\b(?:[^>]*\/>|[^>]*>(?:(?!<w:p\b)[\s\S])*?<\/w:p>)\s*$/, (p) => (/<w:t\b/.test(p) ? p : ''));
    const withW15 = root.includes('xmlns:w15=') ? root : root.replace(/>$/, ` xmlns:w15="${W15}">`);
    const sdt = `<w:sdt><w:sdtPr><w:alias w:val="${esc(title)}"/><w:tag w:val="${esc(tag)}"/><w15:appearance w15:val="hidden"/></w:sdtPr>`
      + `<w:sdtContent>${paras}</w:sdtContent></w:sdt>`;
    return `${withW15}${head}${sdt}${tail}${close}`;
  });
}
