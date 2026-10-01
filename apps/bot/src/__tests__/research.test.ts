/**
 * THE WEB FETCHER REACHES ONLY THE PUBLIC INTERNET — and reads a search page.
 *
 * The model picks the URL, so these are what it must never reach: the
 * server's metadata service, the host, the containers beside it, its own
 * ports — directly, by a name that resolves there, or by a redirect.
 */
import { describe, expect, it } from 'vitest';
import { isPublicAddress, parseBing, parseResults, parseSearxng, publicUrl, webResearch } from '../research.js';

describe('only the public internet', () => {
  it('private, loopback, link-local and metadata addresses are not public', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '172.17.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    for (const ip of ['2.28.234.5', '104.21.3.4', '2606:4700::6810:1']) expect(isPublicAddress(ip), ip).toBe(true);
  });

  it('a URL is refused for its address, for a name that resolves inside, and for not being the web', async () => {
    await expect(publicUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow(/not on the public internet/);
    await expect(publicUrl('http://metadata.example/', async () => ['169.254.169.254'])).rejects.toThrow(/not on the public internet/);
    await expect(publicUrl('http://mixed.example/', async () => ['93.184.216.34', '10.0.0.1'])).rejects.toThrow(/not on the public internet/);
    await expect(publicUrl('file:///etc/passwd')).rejects.toThrow(/only http and https/);
    await expect(publicUrl('http://user:pw@sanskritdocuments.org/')).rejects.toThrow(/name and password/);
    expect((await publicUrl('https://sanskritdocuments.org/a', async () => ['104.21.3.4'])).hostname).toBe('sanskritdocuments.org');
  });

  it('a redirect to an inside address is refused, not followed', async () => {
    const fetchImpl = (async () => new Response('', { status: 302, headers: { location: 'http://127.0.0.1:5432/' } })) as unknown as typeof fetch;
    await expect(webResearch(fetchImpl).fetch('https://93.184.216.34/page')).rejects.toThrow(/not on the public internet/);
  });
});

describe('the search engines, one after another', () => {
  const page = (body: string, status = 200) => new Response(body, { status });
  it('SearXNG first when the server has it', async () => {
    const seen: string[] = [];
    const f = (async (u: string) => {
      seen.push(String(u));
      return page(JSON.stringify({ results: [{ title: 'Purusha Suktam', url: 'https://sanskritdocuments.org/p', content: 'accented' }] }));
    }) as unknown as typeof fetch;
    expect(await webResearch(f, 'http://searxng:8080').search('purusha')).toEqual([{ title: 'Purusha Suktam', url: 'https://sanskritdocuments.org/p', snippet: 'accented' }]);
    expect(seen[0]).toMatch(/^http:\/\/searxng:8080\/search\?q=purusha&format=json/);
  });

  it('DuckDuckGo refusing — a page with no results list — is passed by for Bing', async () => {
    const f = (async (u: string) => (String(u).includes('duckduckgo')
      ? page('<html><title>DuckDuckGo</title><body>nothing</body></html>')
      : page('<ol id="b_results"><li class="b_algo"><h2><a href="https://www.bing.com/ck/a?!&&p=x&u=a1aHR0cHM6Ly93d3cud2lzZG9tbGliLm9yZy94&ntb=1">Wisdom Library</a></h2><p>Gāyatrī</p></li></ol>'))) as unknown as typeof fetch;
    expect(await webResearch(f, '').search('gayatri')).toEqual([{ title: 'Wisdom Library', url: 'https://www.wisdomlib.org/x', snippet: 'Gāyatrī' }]);
  });

  it('every engine refusing is said as a refusal, with where to go instead — never "no results"', async () => {
    const f = (async () => page('', 503)) as unknown as typeof fetch;
    await expect(webResearch(f, '').search('anything')).rejects.toThrow(/refusing just now — go straight to a known source/);
  });

  it('SearXNG\'s and Bing\'s answers are read', () => {
    expect(parseSearxng({ results: [{ url: 'javascript:x' }, { url: 'https://a.org', title: 'A' }] })).toEqual([{ title: 'A', url: 'https://a.org', snippet: '' }]);
    expect(parseBing('<li class="b_algo"><h2><a href="https://direct.org/x">Direct</a></h2></li>')).toEqual([{ title: 'Direct', url: 'https://direct.org/x', snippet: '' }]);
  });
});

describe('a search page', () => {
  it('its results, the redirect links unwrapped', () => {
    const html = '<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fsanskritdocuments.org%2Fdoc_veda%2Fpurusha.html&amp;rut=x">Purusha <b>Suktam</b></a>'
      + '<a class="result__snippet" href="#">the &quot;accented&quot; text</a>';
    expect(parseResults(html)).toEqual([{ title: 'Purusha Suktam', url: 'https://sanskritdocuments.org/doc_veda/purusha.html', snippet: 'the "accented" text' }]);
  });
});
