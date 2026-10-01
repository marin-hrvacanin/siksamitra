/**
 * THE WEB FETCHER REACHES ONLY THE PUBLIC INTERNET — and reads a search page.
 *
 * The model picks the URL, so these are what it must never reach: the
 * server's metadata service, the host, the containers beside it, its own
 * ports — directly, by a name that resolves there, or by a redirect.
 */
import { describe, expect, it } from 'vitest';
import { isPublicAddress, parseResults, publicUrl, webResearch } from '../research.js';

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

describe('a search page', () => {
  it('its results, the redirect links unwrapped', () => {
    const html = '<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fsanskritdocuments.org%2Fdoc_veda%2Fpurusha.html&amp;rut=x">Purusha <b>Suktam</b></a>'
      + '<a class="result__snippet" href="#">the &quot;accented&quot; text</a>';
    expect(parseResults(html)).toEqual([{ title: 'Purusha Suktam', url: 'https://sanskritdocuments.org/doc_veda/purusha.html', snippet: 'the "accented" text' }]);
  });
});
