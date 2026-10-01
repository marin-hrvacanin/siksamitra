/**
 * THE WEB, FROM A SERVER — search and fetch, no key needed.
 *
 * SEARCH IS SEARXNG WHERE THE SERVER RUNS IT — a maintained metasearch
 * engine, its own container beside the bot and reachable only from it, whose
 * project keeps the engines' parsers working (rule 16: scraping search pages
 * is not ours to keep alive). Without it — a run on a laptop — DuckDuckGo's
 * HTML page, then Bing's. A page that is an engine REFUSING (DuckDuckGo
 * answers a server it has seen too often with a page of no results) is a
 * refusal, said as one: it was read as "no results" twenty times in a row,
 * and the agent searched on until its steps ran out.
 *
 * A page is fetched as a browser would and turned into text by
 * `html-to-text` (rule 16 — a page's markup is not ours to parse), line by
 * line as the page lays it out, so the agent can name lines by number.
 *
 * Only http(s), only text, and only so much of it: a page that is a 40 MB
 * scan is not a witness.
 *
 * ONLY THE PUBLIC INTERNET. The model chooses the URL, and a page it read can
 * try to choose it — so an address that is not public is refused before a
 * byte is sent, and so is every redirect that points at one: the server's
 * metadata service (169.254.169.254), the host, the other containers, the
 * machine's own ports. Nothing internal can be fetched, and so none of it can
 * be read back to anyone.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { convert } from 'html-to-text';
import type { Research, SearchHit } from '@siksamitra/agent';

/** Is this address one on the public internet? */
export function isPublicAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return !(a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19))
      || a >= 224);
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === '::' || x === '::1') return false;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mapped !== null) return isPublicAddress(mapped[1]!);
    return !/^(fc|fd|fe[89ab]|ff)/.test(x);
  }
  return false;
}

/** The URL, if it names a public host over http(s); otherwise why not. */
export async function publicUrl(raw: string, resolve: (host: string) => Promise<string[]> = defaultResolve): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error(`"${raw}" is not a web address`); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('only http and https pages can be fetched');
  if (u.username !== '' || u.password !== '') throw new Error('an address with a name and password in it is not fetched');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) !== 0 ? [host] : await resolve(host);
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) throw new Error('that address is not on the public internet');
  return u;
}

const defaultResolve = async (host: string): Promise<string[]> => (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const MAX_BYTES = 3_000_000;

const decode = (s: string): string => s
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

/** The results of a Bing page: `<li class="b_algo">` with its link and caption. */
export function parseBing(html: string): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const block of html.split('<li class="b_algo"').slice(1)) {
    const a = /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    if (a === null) continue;
    let url = a[1]!.replace(/&amp;/g, '&');
    /* Bing's own redirect: the target in `u=`, base64 after an "a1". */
    const u = /[?&]u=a1([^&]+)/.exec(url);
    if (u !== null) {
      try { url = atob(u[1]!.replace(/-/g, '+').replace(/_/g, '/')); } catch { continue; }
    }
    if (!/^https?:\/\//.test(url)) continue;
    const p = /<p[^>]*>([\s\S]*?)<\/p>/.exec(block);
    hits.push({ title: decode(a[2]!), url, snippet: decode(p?.[1] ?? '') });
  }
  return hits;
}

/** SearXNG's JSON answer. */
export function parseSearxng(json: unknown): SearchHit[] {
  const results = (json as { results?: { title?: string; url?: string; content?: string }[] }).results ?? [];
  return results.filter((r) => typeof r.url === 'string' && /^https?:\/\//.test(r.url))
    .map((r) => ({ title: r.title ?? r.url!, url: r.url!, snippet: r.content ?? '' }));
}

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

/** One engine: its results, or `null` for a refusal (an error, or a page that is not results). */
type Engine = { readonly name: string; readonly run: (q: string) => Promise<SearchHit[] | null> };

export function webResearch(fetchImpl: typeof fetch = fetch, searxng: string | undefined = process.env.SEARXNG_URL): Research {
  const page = async (url: string): Promise<string | null> => {
    try {
      const res = await fetchImpl(url, { headers: { 'user-agent': UA, 'accept-language': 'en' } });
      return res.ok ? await res.text() : null;
    } catch { return null; }
  };
  const engines: Engine[] = [
    ...(searxng === undefined || searxng === '' ? [] : [{
      name: 'searxng',
      run: async (q: string) => {
        const body = await page(`${searxng.replace(/\/+$/, '')}/search?q=${encodeURIComponent(q)}&format=json&language=en`);
        if (body === null) return null;
        try { return parseSearxng(JSON.parse(body)); } catch { return null; }
      },
    }]),
    {
      name: 'duckduckgo',
      run: async (q: string) => {
        const body = await page(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`);
        /* A refusal is a page without its results list at all. */
        return body === null || !body.includes('class="results') ? null : parseResults(body);
      },
    },
    {
      name: 'bing',
      run: async (q: string) => {
        const body = await page(`https://www.bing.com/search?q=${encodeURIComponent(q)}`);
        return body === null || !body.includes('b_results') ? null : parseBing(body);
      },
    },
  ];
  return {
    async search(query) {
      let refused = 0;
      for (const e of engines) {
        const hits = await e.run(query);
        if (hits === null) { refused += 1; continue; }
        if (hits.length > 0) return hits;
      }
      if (refused === engines.length) {
        throw new Error('the search engines are refusing just now — go straight to a known source with fetch_page: '
          + 'sanskritdocuments.org/doc_veda/, sanskritdocuments.org/doc_z_misc_major_works/, wisdomlib.org');
      }
      return [];
    },
    async fetch(url) {
      /* Redirects are followed here, one by one, so each is checked as the first was. */
      let at = await publicUrl(url);
      let res: Response | undefined;
      for (let hop = 0; hop <= 5; hop += 1) {
        res = await fetchImpl(at, { redirect: 'manual', headers: { 'user-agent': UA, accept: 'text/html,text/plain;q=0.9,*/*;q=0.5' } });
        const to = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
        if (to === null) break;
        if (hop === 5) throw new Error(`${url} redirects too many times`);
        at = await publicUrl(new URL(to, at).toString());
      }
      if (res === undefined || !res.ok) throw new Error(`${url} answered ${res?.status ?? 'nothing'}`);
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
