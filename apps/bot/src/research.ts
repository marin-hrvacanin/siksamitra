/**
 * THE WEB, FROM A SERVER — search and fetch, no key needed.
 *
 * Search is DuckDuckGo's HTML endpoint, the one a browser without scripts
 * gets: no account, no key, results as links. A page is fetched as a browser
 * would and turned into text by `html-to-text` (rule 16 — a page's markup is
 * not ours to parse), line by line as the page lays it out, so the agent can
 * name lines by number.
 *
 * Only http(s), only text, and only so much of it: a page that is a 40 MB
 * scan is not a witness.
 */
import { convert } from 'html-to-text';
import type { Research, SearchHit } from '@siksamitra/agent';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const MAX_BYTES = 3_000_000;

const decode = (s: string): string => s
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

/** The results of a DuckDuckGo HTML page. */
export function parseResults(html: string): SearchHit[] {
  const hits: SearchHit[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>)?/g;
  for (let m = re.exec(html); m !== null; m = re.exec(html)) {
    let url = m[1]!.replace(/&amp;/g, '&');
    const redirect = /[?&]uddg=([^&]+)/.exec(url);
    if (redirect !== null) url = decodeURIComponent(redirect[1]!);
    if (url.startsWith('//')) url = `https:${url}`;
    if (!/^https?:\/\//.test(url) || /duckduckgo\.com\/y\.js/.test(url)) continue;
    hits.push({ title: decode(m[2]!), url, snippet: decode(m[3] ?? '') });
  }
  return hits;
}

export function webResearch(fetchImpl: typeof fetch = fetch): Research {
  return {
    async search(query) {
      const res = await fetchImpl(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: { 'user-agent': UA } });
      if (!res.ok) throw new Error(`the search answered ${res.status}`);
      return parseResults(await res.text());
    },
    async fetch(url) {
      if (!/^https?:\/\//i.test(url)) throw new Error('only http and https pages can be fetched');
      const res = await fetchImpl(url, { headers: { 'user-agent': UA, accept: 'text/html,text/plain;q=0.9,*/*;q=0.5' } });
      if (!res.ok) throw new Error(`${url} answered ${res.status}`);
      const type = res.headers.get('content-type') ?? '';
      if (!/text\/|html|xml|json/.test(type)) throw new Error(`${url} is ${type || 'not text'}, not a page to read`);
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) throw new Error(`${url} is ${Math.round(buf.length / 1e6)} MB — too large to be a witness`);
      const raw = new TextDecoder('utf-8').decode(buf);
      if (!/html/.test(type)) return { title: url, text: raw };
      const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw)?.[1] ?? url);
      const text = convert(raw, {
        wordwrap: false,
        selectors: [
          { selector: 'a', options: { ignoreHref: true } },
          { selector: 'img', format: 'skip' },
          { selector: 'nav', format: 'skip' },
          { selector: 'script', format: 'skip' },
          { selector: 'style', format: 'skip' },
        ],
      });
      return { title, text };
    },
  };
}
