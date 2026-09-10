/**
 * WHERE THE WORD ADD-IN IS SERVED FROM, and the manifest that says so.
 *
 * An Office add-in is a web page Word loads over HTTPS plus an XML manifest
 * naming its URLs. So "publish the add-in" is two things: put the built page
 * somewhere with a certificate, and hand Word a manifest whose URLs point
 * there. Nothing else about the add-in changes between one host and another.
 *
 * THREE HOSTS, AS DATA. `apps/word-addin/manifest.xml` is the one a developer
 * runs against — `office-addin-debugging start manifest.xml` and
 * `office-addin-manifest validate manifest.xml` both want a real file, not a
 * template — so it stays the localhost one, and the published manifests are
 * DERIVED from it here. One manifest, three hosts, and a URL that is wrong is
 * wrong in one place.
 *
 * WHY EACH HOST HAS ITS OWN `<Id>`. Word keys an installed add-in by that
 * GUID. Two manifests with one GUID are the same add-in to Word, so
 * sideloading the local build over the published one silently replaces it and
 * the Home-tab button then points at whichever was registered last. With
 * separate GUIDs both can be installed at once, which is what a person
 * developing the add-in on the machine they also use it on actually needs.
 *
 * WHY A LOCAL HOST AT ALL, when the point of publishing is that a URL exists.
 * Because the add-in is a static page with no server behind it, so serving it
 * from this machine costs nothing and means the marking pane works with no
 * network and nobody else in the path. The published copy is for everybody
 * else.
 */

/** Word's `<Version>` is four numbers. Nothing else is accepted. */
export function manifestVersion(semver) {
  const [core, pre] = String(semver).split('-');
  const parts = String(core).split('.').map((n) => Number.parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`not a version this can turn into Word's four numbers: ${semver}`);
  }
  /*
   * The prerelease NUMBER becomes the fourth part, so `2.0.0-alpha.3` is
   * `2.0.0.3` and a republished build states a higher number than the one it
   * replaces. Word decides whether to re-fetch a sideloaded add-in by
   * comparing these, so a manifest whose version never changes is one a person
   * has to clear a cache to update.
   */
  const build = /(\d+)\s*$/.exec(pre ?? '');
  return `${parts.join('.')}.${build === null ? 0 : build[1]}`;
}

/**
 * The landing page, and the two places on it the add-in itself links to.
 *
 * Here rather than in the add-in's own source because the manifest, the
 * publish tool, the install page and the task pane's own footer all name them,
 * and four copies of a URL is three that go stale. `vite.config.ts` injects
 * these into the bundle at build time — see `src/version.ts`.
 */
export const SITE = 'https://marin-hrvacanin.github.io/siksamitra';
/** What the marks MEAN — which a tooltip cannot say and a pane must not try. */
export const GUIDE_URL = `${SITE}/#marks`;
/** How to get the add-in into Word. Where the folder's own index.html points. */
export const INSTALL_URL = `${SITE}/#word`;

/**
 * The hosts, in the order the publish tool writes them.
 *
 * `base` has NO trailing slash: every URL in the manifest is `base` + `/…`,
 * and a doubled slash in a `SourceLocation` is a 404 on some static hosts and
 * a redirect on others — neither of which Word reports as anything but a blank
 * pane.
 */
export const ADDIN_HOSTS = {
  local: {
    label: 'this machine',
    base: 'https://localhost:3000',
    /* The GUID this repository has always used, kept so a machine that already
       has the development add-in registered does not gain a second copy. */
    id: '3f2b7c14-9d6a-4e8b-b0a5-51c7e2d4a930',
    name: 'śikṣāmitra (local)',
    what: 'the dev server, or `npm run word-addin:serve` over the built page',
  },
  pages: {
    label: 'GitHub Pages',
    base: `${SITE}/word-extension`,
    id: '8a41d0f6-25b7-4c93-9e12-6b0d7fa3c584',
    name: 'śikṣāmitra',
    what: 'published beside the landing page by .github/workflows/pages.yml',
  },
  vedaunion: {
    label: 'vedaunion.org',
    base: 'https://vedaunion.org/siksamitra/word-extension',
    id: 'c07e9b52-1f3a-4d68-8a75-2e4c91b06d3f',
    name: 'śikṣāmitra',
    what: 'upload out/word-extension/ there; the folder is self-contained',
  },
};

/** The origin of a base URL — what `<AppDomains>` speaks in. */
export const originOf = (base) => new URL(base).origin;

const xmlAttr = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function replaceOnce(xml, pattern, replacement, what) {
  if (pattern.exec(xml) === null) throw new Error(`the manifest has no <${what}> to replace`);
  return xml.replace(pattern, replacement);
}

/** `<AppDomain>` for an origin, added once and never twice. */
export function withAppDomain(xml, origin) {
  if (xml.includes(`<AppDomain>${origin}</AppDomain>`)) return xml;
  return replaceOnce(
    xml, /<AppDomains>/, `<AppDomains>\n    <AppDomain>${origin}</AppDomain>`, 'AppDomains',
  );
}

/**
 * The manifest for one host, out of the localhost one.
 *
 * Textual substitution rather than an XML rewrite, and deliberately: the
 * manifest's element ORDER is a schema sequence, and a library that
 * pretty-prints or reorders it produces a file that is not an error a person
 * sees — it is a sideload that does nothing. So the bytes stay the bytes, with
 * four things replaced.
 */
export function manifestFor(xml, host, version) {
  if (!xml.includes(ADDIN_HOSTS.local.base)) {
    throw new Error(`the manifest does not mention ${ADDIN_HOSTS.local.base}; `
      + 'the substitution below would produce a manifest pointing at nothing');
  }
  let out = xml.split(ADDIN_HOSTS.local.base).join(host.base);
  out = replaceOnce(out, /<Id>[^<]*<\/Id>/, `<Id>${host.id}</Id>`, 'Id');
  out = replaceOnce(
    out, /<DisplayName DefaultValue="[^"]*"\/>/,
    `<DisplayName DefaultValue="${xmlAttr(host.name)}"/>`, 'DisplayName',
  );
  if (version !== undefined) {
    out = replaceOnce(out, /<Version>[^<]*<\/Version>/, `<Version>${version}</Version>`, 'Version');
  }
  /* The host's own origin joins `<AppDomains>`: it is implicitly allowed as
     the source location, but a link the pane opens is a navigation, and a
     navigation to a domain not listed leaves the pane. */
  return withAppDomain(out, originOf(host.base));
}

/** Every absolute URL the manifest names, in document order. */
export function urlsIn(xml) {
  return [...xml.matchAll(/https?:\/\/[^"'<>\s]+/g)].map((m) => m[0]);
}

/**
 * The origins listed in `<AppDomains>`.
 *
 * Read apart from the rest, because they are the one place in the manifest
 * where a URL is DELIBERATELY not the add-in's own address — an app domain is
 * a permission, and the check below would otherwise report every one of them
 * as a URL pointing at the wrong host.
 */
export function appDomainsIn(xml) {
  return [...xml.matchAll(/<AppDomain>([^<]*)<\/AppDomain>/g)].map((m) => m[1]);
}

/** The manifest with its `<AppDomains>` block removed, for reading its URLs. */
const withoutAppDomains = (xml) => xml.replace(/<AppDomain>[^<]*<\/AppDomain>/g, '');

/** The XML namespaces and the Office CDN are URLs and are not the add-in's. */
const notOurs = (url) => url.startsWith('https://appsforoffice.microsoft.com/')
  || url.startsWith('http://schemas.') || url.startsWith('https://schemas.')
  || url.startsWith('http://www.w3.org/');

/** The support link is deliberately a domain the add-in is not served from. */
const SUPPORT = 'https://vedaunion.org/';

/**
 * What is wrong with a manifest, as a list of sentences. Empty is a pass.
 *
 * These are the five mistakes that produce a blank pane rather than an error,
 * which is why they are checked rather than trusted:
 *   - an `http` URL. Office refuses to load one, in development as much as in
 *     production, and says nothing about why.
 *   - a `localhost` URL in a manifest meant for somebody else's machine.
 *   - a URL under a different host than this manifest is for — what happens
 *     when a URL is added to the template and the substitution above does not
 *     know about it.
 *   - the add-in's own origin missing from `<AppDomains>`.
 *   - the wrong `<Id>`, which is how two hosts become one add-in.
 */
export function manifestFaults(xml, host) {
  const faults = [];
  const ours = urlsIn(withoutAppDomains(xml)).filter((u) => !notOurs(u));
  for (const url of ours) {
    if (url.startsWith('http://')) faults.push(`${url} is not https; Office will refuse it`);
  }
  const stray = ours.filter((u) => !u.startsWith(`${host.base}/`)
    && u !== host.base && !u.startsWith(SUPPORT));
  for (const url of stray) faults.push(`${url} is not under ${host.base}`);
  if (host.base !== ADDIN_HOSTS.local.base && ours.some((u) => u.includes('localhost'))) {
    faults.push('a localhost URL survived into a published manifest');
  }
  if (!xml.includes(`<AppDomain>${originOf(host.base)}</AppDomain>`)) {
    faults.push(`<AppDomains> does not list ${originOf(host.base)}`);
  }
  if (!xml.includes(`<Id>${host.id}</Id>`)) faults.push(`<Id> is not ${host.id}`);
  return faults;
}

/** `manifest.local.xml`, `manifest.pages.xml`, … — what the publish tool writes. */
export const manifestName = (key) => `manifest.${key}.xml`;

/**
 * What the pane is told about itself, as Vite/Vitest `define` entries.
 *
 * Here, and not in each config, because BOTH the build and the test runner
 * have to inject them: a constant the bundler replaces is `undefined` in a
 * test that imports the same module, and the whole suite fails to load with
 * "__ADDIN_VERSION__ is not defined" — which says nothing about the tests.
 * See `apps/word-addin/src/version.ts`.
 */
export function addinDefines(readFileSync, pkgPath = 'apps/word-addin/package.json') {
  return {
    __ADDIN_VERSION__: JSON.stringify(JSON.parse(readFileSync(pkgPath, 'utf8')).version),
    __GUIDE_URL__: JSON.stringify(GUIDE_URL),
  };
}
