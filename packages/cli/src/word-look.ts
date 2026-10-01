/**
 * WHAT WORD WOULD DRAW — each character of a paragraph, with its resolved look.
 *
 * "Visually indistinguishable from his" is a claim about the PAGE, not about
 * style names: our `Visarga` and his `Anusvara` are both blue italic, and a
 * line carrying either looks the same. So the comparison is made where Word
 * makes it — each drawn character with the face, weight, slant, colour, size,
 * raise and box Word resolves for it, from `docDefaults` through the paragraph
 * style, the character style (with its `basedOn` chain) and the run's own
 * formatting, in that order.
 *
 * DELIBERATELY A SECOND IMPLEMENTATION. It shares nothing with the writer
 * (`packages/interop/src/word/body.ts`) or the reader: it reads the OOXML the
 * way Word does. An expectation computed by the code under test would be the
 * conformance suite's old tautology (`tests/README.md`).
 *
 * WHAT IT LEAVES OUT, each because it does not change the page: whitespace
 * before a line break and at the end of the paragraph, and the look of a space
 * that is neither boxed, underlined nor highlighted. Hidden text is not drawn,
 * so it is not a character here.
 */

/** A run property, resolved: `font=Arial`, `b=true`, `bdr=single/2/538135`. */
type Props = Record<string, string>;

const attr = (x: string, a: string): string | undefined =>
  new RegExp(`\\b${a}="([^"]*)"`).exec(x)?.[1];

/** The properties an `<w:rPr>` states, in the vocabulary of `Props`. */
export function runProps(rPr: string | undefined): Props {
  const o: Props = {};
  if (rPr === undefined) return o;
  const fonts = /<w:rFonts\b([^>]*)\/?>/.exec(rPr);
  const ascii = fonts === null ? undefined : attr(fonts[1]!, 'w:ascii');
  if (ascii !== undefined) o.font = ascii;
  for (const t of ['b', 'i', 'caps', 'strike', 'vanish']) {
    const m = new RegExp(`<w:${t}(\\s[^>]*)?/>`).exec(rPr);
    if (m !== null) {
      const v = attr(m[1] ?? '', 'w:val') ?? 'true';
      o[t] = /^(0|off|false)$/.test(v) ? 'false' : 'true';
    }
  }
  const one = (el: string, key: string, a = 'w:val', up = false): void => {
    const m = new RegExp(`<w:${el}\\b([^>]*)/>`).exec(rPr);
    const v = m === null ? undefined : attr(m[1]!, a);
    if (v !== undefined) o[key] = up ? v.toUpperCase() : v;
  };
  one('color', 'color', 'w:val', true);
  one('sz', 'sz');
  one('vertAlign', 'va');
  one('position', 'pos');
  one('u', 'u');
  one('highlight', 'hl');
  const bdr = /<w:bdr\b([^>]*)\/>/.exec(rPr);
  if (bdr !== null) {
    o.bdr = `${attr(bdr[1]!, 'w:val')}/${attr(bdr[1]!, 'w:sz')}/${(attr(bdr[1]!, 'w:color') ?? '').toUpperCase()}`;
  }
  return o;
}

interface Style { based?: string; props: Props }

/** A document's styles and its defaults, from `word/styles.xml`. */
export interface StyleTable {
  styles: ReadonlyMap<string, Style>;
  defaults: Props;
}

export function styleTable(stylesXml: string): StyleTable {
  const styles = new Map<string, Style>();
  for (const m of stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const id = attr(m[1]!, 'w:styleId');
    if (id === undefined) continue;
    const based = /<w:basedOn w:val="([^"]+)"/.exec(m[2]!)?.[1];
    styles.set(id, { ...(based === undefined ? {} : { based }), props: runProps(/<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(m[2]!)?.[1]) });
  }
  const defaults = runProps(/<w:rPrDefault>[\s\S]*?<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(stylesXml)?.[1]);
  return { styles, defaults };
}

/**
 * Two tables as Word merges them on an insertion: a style the document
 * already has keeps the DOCUMENT's definition, and one it lacks arrives with
 * the inserted package's.
 *
 * AND WITH THE PACKAGE'S DEFAULTS FOLDED IN — measured in real Word: where the
 * package's `docDefaults` differ from the document's, an arriving style that
 * is based on nothing gets the package's value written into it, so it looks
 * as it did where it was authored. That is how his `Translit`, carried as
 * `Mantra` in a package with our defaults, came out black instead of
 * automatic; this model did not know it, and so no gate without Word could.
 */
export function inserted(into: StyleTable, carried: StyleTable): StyleTable {
  const folded: Props = Object.fromEntries(Object.entries(carried.defaults).filter(([k, v]) => into.defaults[k] !== v));
  const arriving = [...carried.styles].map(([id, s]): [string, Style] =>
    [id, s.based === undefined ? { ...s, props: { ...folded, ...s.props } } : s]);
  return { styles: new Map([...arriving, ...into.styles]), defaults: into.defaults };
}

function chain(t: StyleTable, id: string | undefined, seen = new Set<string>()): Props {
  if (id === undefined || seen.has(id)) return {};
  const s = t.styles.get(id);
  if (s === undefined) return {};
  seen.add(id);
  return { ...chain(t, s.based, seen), ...s.props };
}

const XML_TEXT: Readonly<Record<string, string>> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
};

/** One drawn character and the look Word gives it. */
export interface Drawn {
  ch: string;
  look: string;
}

/** Every character one `<w:p>` draws, in order. */
/**
 * THE OWNER'S RULINGS ON HOW A THING IS DRAWN, where they part from his files —
 * applied to BOTH sides of a comparison, so what is measured is everything
 * else. One, so far: a pause bar is upright (2026-10-01: "why are pauses here
 * in italic? Not good"). His files set the rules' pauses in the italic blue of
 * `Anusvara`; the add-in writes them upright, in the same blue.
 */
const BARS = new Set(['|', '¦']);
export function asRuled(d: readonly Drawn[]): Drawn[] {
  return d.map((x) => (BARS.has(x.ch) ? { ...x, look: x.look.split(',').filter((p) => !/^i(Cs)?=/.test(p)).join(',') } : x));
}

export function drawn(paragraph: string, t: StyleTable): Drawn[] {
  const pStyle = /<w:pStyle w:val="([^"]+)"/.exec(paragraph)?.[1] ?? 'Normal';
  const base = { ...t.defaults, ...chain(t, pStyle) };
  const out: Drawn[] = [];
  for (const r of paragraph.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g)) {
    const body = r[1]!;
    const rPr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(body)?.[1];
    const rStyle = rPr === undefined ? undefined : /<w:rStyle w:val="([^"]+)"/.exec(rPr)?.[1];
    const pr: Props = { ...base, ...chain(t, rStyle), ...runProps(rPr) };
    if (pr.vanish === 'true') continue;
    delete pr.vanish;
    const look = Object.entries(pr).filter(([, v]) => v !== 'false').map(([k, v]) => `${k}=${v}`).sort().join(',');
    const spaceLook = pr.bdr !== undefined || pr.u !== undefined || pr.hl !== undefined ? look : '';
    for (const c of body.matchAll(/<w:t\b[^>]*>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>|<w:sym\b([^>]*)\/>/g)) {
      const text = c[0].startsWith('<w:tab') ? '\t'
        : c[0].startsWith('<w:br') ? '\n'
          : c[0].startsWith('<w:sym') ? String.fromCharCode(parseInt(attr(c[2]!, 'w:char') ?? '0', 16))
            : c[1]!.replace(/&(amp|lt|gt|quot|apos);/g, (e) => XML_TEXT[e] ?? e);
      for (const ch of text) out.push({ ch, look: /\s/.test(ch) ? spaceLook : look });
    }
  }
  /* What draws nothing: trailing whitespace, and whitespace before a break. */
  let end = out.length;
  while (end > 0 && /^[  \t]$/.test(out[end - 1]!.ch)) end -= 1;
  const kept = out.slice(0, end);
  const beforeBreak = (i: number): boolean => {
    let k = i;
    while (k < kept.length && /^[  ]$/.test(kept[k]!.ch)) k += 1;
    return kept[k]?.ch === '\n';
  };
  return kept.filter((d, i) => !(/^[  ]$/.test(d.ch) && beforeBreak(i)));
}

/** How two drawn lines differ, one entry per KIND of difference. */
export function differences(his: readonly Drawn[], ours: readonly Drawn[]): string[] {
  const n = his.length;
  const m = ours.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let x = n - 1; x >= 0; x -= 1) {
    for (let y = m - 1; y >= 0; y -= 1) {
      lcs[x]![y] = his[x]!.ch === ours[y]!.ch ? lcs[x + 1]![y + 1]! + 1 : Math.max(lcs[x + 1]![y]!, lcs[x]![y + 1]!);
    }
  }
  const hex = (c: string): string => (/^[!-~]$/.test(c) ? c : `U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
  const found = new Set<string>();
  let x = 0;
  let y = 0;
  while (x < n || y < m) {
    if (x < n && y < m && his[x]!.ch === ours[y]!.ch) {
      if (his[x]!.look !== ours[y]!.look) {
        const a = new Set(his[x]!.look.split(','));
        const b = new Set(ours[y]!.look.split(','));
        found.add(`look ${[...a].filter((q) => !b.has(q)).join(',')} → ${[...b].filter((q) => !a.has(q)).join(',')}`);
      }
      x += 1;
      y += 1;
    } else if (y < m && (x >= n || lcs[x]![y + 1]! >= lcs[x + 1]![y]!)) {
      found.add(`added ${hex(ours[y]!.ch)}`);
      y += 1;
    } else {
      found.add(`lost ${hex(his[x]!.ch)}`);
      x += 1;
    }
  }
  return [...found];
}
