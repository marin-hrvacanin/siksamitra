/**
 * THE MANIFEST THAT DECIDES WHETHER THE ADD-IN LOADS AT ALL.
 *
 * Every fault this file looks for has the same symptom, and it is the worst
 * symptom there is: Word opens the task pane, the pane is BLANK, and no error
 * appears anywhere a person can read. An `http` URL, a `localhost` URL on
 * somebody else's machine, a `SourceLocation` under a host the page was not
 * published to — all of them are a white rectangle.
 *
 * SO THE CHECKS COMPARE AGAINST THE REAL FILE, not against a fixture written
 * to satisfy them. `manifest.xml` is read off disk, and the derived manifests
 * are measured against the URL each host actually serves. When somebody adds a
 * URL to the template — a help page, an icon, a privacy note — and the
 * substitution does not know about it, `manifestFaults` names it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ADDIN_HOSTS, manifestFaults, manifestFor, manifestName, manifestVersion, originOf, urlsIn,
  withAppDomain,
} from '../word-addin.mjs';

const TEMPLATE = 'apps/word-addin/manifest.xml';
const xml = readFileSync(TEMPLATE, 'utf8');
const HOSTS = Object.entries(ADDIN_HOSTS);

describe('the manifest in the repository', () => {
  it('is the localhost one, which is what the Office tooling runs against', () => {
    /* `office-addin-debugging start manifest.xml` and `validate` both want a
       real file. If this ever became a template with a placeholder in it,
       both would break and the derivation below would have nothing to derive
       from. */
    expect(xml).toContain(ADDIN_HOSTS.local.base);
    expect(manifestFaults(xml, ADDIN_HOSTS.local)).toEqual([]);
  });

  it('names its URLs and nothing else pretends to be one', () => {
    const urls = urlsIn(xml);
    /* The namespaces are URLs too. The filter that separates them is what
       `manifestFaults` relies on, so it is worth stating that both kinds are
       actually present — a template with no namespaces would make the filter
       untested. */
    expect(urls.some((u) => u.startsWith('http://schemas.'))).toBe(true);
    expect(urls.some((u) => u.startsWith(ADDIN_HOSTS.local.base))).toBe(true);
  });
});

describe('each host gets a manifest that points at it', () => {
  for (const [key, host] of HOSTS) {
    it(`${key}: no faults`, () => {
      expect(manifestFaults(manifestFor(xml, host, '2.0.0.0'), host)).toEqual([]);
    });

    it(`${key}: every one of the template's URLs moved`, () => {
      /*
       * THE ONE THAT CATCHES A NEW URL. Counting them means a URL added to the
       * template — an icon, a help page — must either move to the new host or
       * be a deliberate exception, and cannot silently stay on localhost.
       */
      const out = manifestFor(xml, host, '2.0.0.0');
      /* `<AppDomains>` is left out of the count: an app domain is a
         permission, not an address the add-in is served from, and the derived
         manifest gains one. */
      const bare = (s) => s.replace(/<AppDomain>[^<]*<\/AppDomain>/g, '');
      const before = urlsIn(bare(xml)).filter((u) => u.startsWith(ADDIN_HOSTS.local.base));
      const after = urlsIn(bare(out)).filter((u) => u.startsWith(host.base));
      expect(after).toHaveLength(before.length);
      expect(before.length).toBeGreaterThan(3);
    });

    it(`${key}: the pane, the icons and the get-started link all resolve`, () => {
      const out = manifestFor(xml, host, '2.0.0.0');
      for (const path of ['/taskpane.html', '/icon-16.png', '/icon-32.png', '/icon-80.png']) {
        expect(out, path).toContain(`${host.base}${path}`);
      }
    });
  }

  it('and no two hosts are the same add-in to Word', () => {
    /* One GUID for two manifests means installing one uninstalls the other,
       silently, and the Home-tab button then points wherever the last
       registration did. */
    const ids = HOSTS.map(([, h]) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id, `${id} is not a GUID`).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
    }
  });

  it('and no base URL ends in a slash', () => {
    /* Every URL is `base` + `/…`; a trailing slash makes `//taskpane.html`,
       which is a 404 on one static host and a redirect on another. */
    for (const [key, host] of HOSTS) {
      expect(host.base.endsWith('/'), key).toBe(false);
      expect(host.base.startsWith('https://'), key).toBe(true);
    }
  });
});

describe('the faults it refuses', () => {
  /* THE PROOF THAT THE GATE CAN FAIL. Each of these is a real mistake with a
     blank pane for a symptom, and each must be caught. */
  const pages = ADDIN_HOSTS.pages;
  const good = manifestFor(xml, pages, '2.0.0.0');

  it('an http URL', () => {
    const broken = good.replace(`${pages.base}/taskpane.html`, 'http://example.test/taskpane.html');
    expect(manifestFaults(broken, pages).join(' ')).toContain('not https');
  });

  it('a localhost URL that survived', () => {
    const broken = good.replace(
      `${pages.base}/icon-16.png`, `${ADDIN_HOSTS.local.base}/icon-16.png`,
    );
    expect(manifestFaults(broken, pages).join(' ')).toContain('localhost');
  });

  it('a URL under the wrong host', () => {
    const broken = good.replace(
      `${pages.base}/taskpane.html`, 'https://somewhere.test/taskpane.html',
    );
    expect(manifestFaults(broken, pages).join(' ')).toContain('is not under');
  });

  it('a missing AppDomain', () => {
    const broken = good.replace(`<AppDomain>${originOf(pages.base)}</AppDomain>`, '');
    expect(manifestFaults(broken, pages).join(' ')).toContain('<AppDomains> does not list');
  });

  it('the wrong Id', () => {
    const broken = good.replace(pages.id, ADDIN_HOSTS.local.id);
    expect(manifestFaults(broken, pages).join(' ')).toContain('<Id> is not');
  });

  it('and a template that has stopped mentioning localhost', () => {
    /* The substitution is textual. A template that no longer contains the
       string it substitutes would produce a manifest pointing at nothing at
       all, with every check above still passing. */
    expect(() => manifestFor(xml.split(ADDIN_HOSTS.local.base).join('https://x.test'), pages))
      .toThrow(/does not mention/);
  });
});

describe('the element order is not disturbed', () => {
  /*
   * `CT_OfficeApp` is a schema SEQUENCE and Word reports a violation of it as
   * nothing at all. So the derivation is textual, and this says so by
   * measuring: the derived manifest differs from the template only in the
   * substituted values, and every line is where it was.
   */
  it('the derived manifest has the template’s lines, in the template’s order', () => {
    const host = ADDIN_HOSTS.vedaunion;
    const out = manifestFor(xml, host, '2.0.0.0');
    const strip = (s) => s.split('\n')
      .filter((l) => !l.includes('<AppDomain>'))
      .map((l) => l.split(host.base).join(ADDIN_HOSTS.local.base))
      .map((l) => l.replace(/<Id>[^<]*<\/Id>/, '<Id/>'))
      .map((l) => l.replace(/<Version>[^<]*<\/Version>/, '<Version/>'))
      .map((l) => l.replace(/<DisplayName [^/]*\/>/, '<DisplayName/>'));
    expect(strip(out)).toEqual(strip(xml));
  });

  it('and adding an AppDomain twice adds it once', () => {
    const once = withAppDomain(xml, 'https://a.test');
    expect(withAppDomain(once, 'https://a.test')).toBe(once);
    expect([...once.matchAll(/<AppDomain>https:\/\/a\.test<\/AppDomain>/g)]).toHaveLength(1);
  });
});

describe('Word’s four numbers', () => {
  it('a prerelease build number becomes the fourth', () => {
    /* Word decides whether to re-fetch a sideloaded add-in by comparing these,
       so a version that never moves is a version a person clears a cache to
       update. */
    expect(manifestVersion('2.0.0-alpha.0')).toBe('2.0.0.0');
    expect(manifestVersion('2.0.0-alpha.7')).toBe('2.0.0.7');
    expect(manifestVersion('2.1.3')).toBe('2.1.3.0');
    expect(manifestVersion('2.0.0-rc.12')).toBe('2.0.0.12');
  });

  it('and the add-in’s real version is one of them', () => {
    const pkg = JSON.parse(readFileSync('apps/word-addin/package.json', 'utf8'));
    expect(manifestVersion(pkg.version)).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  it('and anything else throws rather than shipping a manifest Word rejects', () => {
    expect(() => manifestVersion('2.0')).toThrow();
    expect(() => manifestVersion('latest')).toThrow();
  });
});

describe('the file names', () => {
  it('are one per host', () => {
    expect(HOSTS.map(([k]) => manifestName(k)))
      .toEqual(['manifest.local.xml', 'manifest.pages.xml', 'manifest.vedaunion.xml']);
  });
});
