/**
 * WHERE A FILE THE DOCUMENT ONLY NAMES ACTUALLY IS.
 *
 * A chant carries its recitation as a path, not as bytes: `audioBase` plus one
 * `.mp3` per verse — `/tests/durga-suktam/audio/durga-1.mp3`. That is right and
 * it is not going to change. Śrī Rudram's take is 15 MB, the corpus's is 30,
 * and a document that carried its own audio would be a document nobody could
 * send. The pictures went the other way for the opposite reason, and both
 * reasons are written down where the decision was taken
 * (`packages/format/src/figure.ts`).
 *
 * SO SOMETHING HAS TO SAY WHERE `/tests/…` IS, and this program is not the
 * platform: it serves a bundle and nothing else, so every one of those paths
 * resolved to a 404 and Play did nothing at all, in silence. The owner's
 * report: "audio should be fully functional, as it used to be on
 * vedaunion.org."
 *
 * The answer is the origin those paths were written for. It is not hardcoded
 * at the point of use — it is one value, in one place, overridable three ways:
 *
 *   ?media=<origin>        for a session, which is what the gates use
 *   localStorage           for a person who keeps a local copy of the corpus
 *   MEDIA_ORIGIN below     the default, and where the files really are
 *
 * A path the document gives as absolute (`https:`, `blob:`, `data:`) is
 * already resolved and is passed through untouched — a take somebody opened
 * off their own disk is a `blob:` and must not be prefixed with anything.
 *
 * WHEN THE CONFIG FILE EXISTS this moves into it. It is a value a person may
 * want to change and it is written down once, which is the property that
 * matters either way.
 */

/**
 * Where the documents' own media paths are served from.
 *
 * EMPTY MEANS THIS PROGRAM'S OWN SERVER, and that is the default because the
 * obvious alternative does not work. `https://vedaunion.org` does serve every
 * one of these files — and refuses to let anything else embed them:
 *
 *     cross-origin-resource-policy: same-origin
 *
 * which stops an `<audio>` element as firmly as it stops a `fetch`. Chromium
 * refuses before the request leaves, with
 * `net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`, and the element then reports
 * `MEDIA_ERR_SRC_NOT_SUPPORTED` — indistinguishable, from inside the page,
 * from a missing codec. Measured against the real host.
 *
 * So the program serves them itself: `apps/web/vite-corpus.ts` maps `/tests/`
 * onto the recitations already on this machine, exactly as it already does for
 * the documents and the fonts. A host that WANTS to serve them to us sends
 * `cross-origin-resource-policy: cross-origin`, and then this can name it.
 */
export const MEDIA_ORIGIN = '';

/** The key a local override is kept under. */
const STORED = 'sm.mediaOrigin';

/** Already a URL a browser can fetch — nothing to resolve. */
const ABSOLUTE = /^(https?:|blob:|data:|file:)/i;

/**
 * The origin in force, in the order a more specific answer beats a general one.
 *
 * Read on every call rather than once at module load: the gates set the query
 * parameter, and a value captured at import time would be the value before the
 * page had a location.
 */
export function mediaOrigin(): string {
  if (typeof location !== 'undefined') {
    const asked = new URLSearchParams(location.search).get('media');
    if (asked !== null && asked !== '') return asked.replace(/\/$/, '');
  }
  try {
    const kept = localStorage.getItem(STORED);
    if (kept !== null && kept !== '') return kept.replace(/\/$/, '');
  } catch {
    /* A browser with site data blocked. The default is still right. */
  }
  return MEDIA_ORIGIN;
}

/** Keep an origin for this browser, or clear it back to the default. */
export function setMediaOrigin(origin: string | null): void {
  try {
    if (origin === null || origin === '') localStorage.removeItem(STORED);
    else localStorage.setItem(STORED, origin.replace(/\/$/, ''));
  } catch { /* as above */ }
}

/**
 * A document's media path, as something that can be loaded.
 *
 * `''` and an absolute URL come back unchanged; a root-relative path is joined
 * to the origin; anything else is relative to the page, which is what a
 * document opened from a folder of its own means.
 */
export function resolveMedia(path: string): string {
  if (path === '' || ABSOLUTE.test(path)) return path;
  if (path.startsWith('/')) return mediaOrigin() + path;
  return path;
}
