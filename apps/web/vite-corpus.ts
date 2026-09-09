/**
 * Serving the repository's own assets — ONE copy of each.
 *
 * Two directories used to be duplicated into `apps/web/public/`, and both
 * drifted the moment their source changed:
 *
 *   `chants/`  four documents copied out of `corpus/chants/`. The app was
 *              serving documents with no source layer while the corpus had
 *              them, so the editor refused to edit text that was editable.
 *   `fonts/`   73 files copied out of `assets/fonts/`. Vendoring three new
 *              faces updated one and not the other, so the page asked for a
 *              face the app did not serve — and a missing face does not error,
 *              it silently substitutes.
 *
 * So there are no copies. In dev both are served straight off disk; in a build
 * both are emitted into the bundle from the same place.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Where each served prefix comes from, and what may be served under it. */
const TREES = [
  {
    prefix: '/chants/',
    from: resolve(import.meta.dirname, '../../corpus/chants'),
    allow: /^[a-z0-9-]+\.json$/i,
    type: 'application/json; charset=utf-8',
  },
  {
    prefix: '/fonts/',
    from: resolve(import.meta.dirname, '../../assets/fonts'),
    allow: /^[a-z0-9._-]+\.(css|woff2|woff|ttf|md)$/i,
    type: null,
  },
  /*
   * His own Word template, which the Word export writes into: the style
   * definitions come from HIS file rather than ones we invented, and that is
   * what makes the export 1:1 instead of approximate. Served from the one copy
   * in `tools/chant/templates` for the same reason as the other two trees.
   */
  {
    prefix: '/templates/',
    from: resolve(import.meta.dirname, '../../tools/chant/templates'),
    allow: /^[a-z0-9._-]+\.docx$/i,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  /*
   * THE RECITATIONS, and this one is a fix rather than a tidy-up.
   *
   * A chant names its audio as `audioBase` plus a file — `/tests/durga-suktam/
   * audio/durga-1.mp3` — and this program served a bundle, so every one of
   * those paths 404'd and Play was a button that did nothing, silently.
   *
   * The obvious answer was to point them at vedaunion.org, which does serve
   * them. IT DOES NOT WORK, and the reason is worth writing down because it
   * looks like it should: those files come back
   *
   *     cross-origin-resource-policy: same-origin
   *
   * so no other origin may EMBED them. Not `fetch` — that much was known — but
   * not an `<audio>` element either. Chromium refuses the load outright with
   * `net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`, before any request goes out,
   * and the element reports `MEDIA_ERR_SRC_NOT_SUPPORTED` — which reads
   * exactly like a missing codec and is not one. Measured, in Edge headless,
   * against the real host.
   *
   * So the program serves them ITSELF, from the one copy already on this
   * machine, the same as the documents and the fonts. `SM_MEDIA_DIR` moves it;
   * a person without the platform checked out simply gets no audio, which is
   * the honest outcome and not a broken one.
   */
  {
    prefix: '/tests/',
    from: process.env['SM_MEDIA_DIR']
      ?? resolve(import.meta.dirname, '../../../vedaunion/app/client/public/tests'),
    allow: /^[a-z0-9-]+\/audio\/[a-z0-9._-]+\.(mp3|wav|m4a|ogg|opus)$/i,
    type: null,
    nested: true,
  },
] as const;

const TYPES: Record<string, string> = {
  css: 'text/css; charset=utf-8',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  md: 'text/markdown; charset=utf-8',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
};

/**
 * A media element seeks, and a seek is a `Range` request.
 *
 * Serving the whole file with a 200 is enough to PLAY — the element buffers
 * it — but `currentTime = x` on a source the server never said was seekable
 * behaves differently across browsers, and the audio gate seeks to the end of
 * a clip to watch it advance. Ten lines here rather than a flake there.
 */
function sendRanged(
  res: { setHeader: (k: string, v: string) => void; statusCode: number; end: (b?: Buffer) => void },
  body: Buffer,
  range: string | undefined,
): void {
  res.setHeader('Accept-Ranges', 'bytes');
  const match = range === undefined ? null : /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (match === null) { res.end(body); return; }
  const last = body.length - 1;
  const start = match[1] === '' ? Math.max(0, last + 1 - Number(match[2])) : Number(match[1]);
  const end = match[1] === '' || match[2] === '' ? last : Math.min(Number(match[2]), last);
  if (!Number.isFinite(start) || start > end) {
    res.statusCode = 416;
    res.setHeader('Content-Range', `bytes */${body.length}`);
    res.end();
    return;
  }
  res.statusCode = 206;
  res.setHeader('Content-Range', `bytes ${start}-${end}/${body.length}`);
  res.setHeader('Content-Length', String(end - start + 1));
  res.end(body.subarray(start, end + 1));
}

/** `<chant>/audio/<file>` under a root, as the paths a document names. */
function nestedNames(root: string): string[] {
  const out: string[] = [];
  for (const chant of readdirSync(root, { withFileTypes: true })) {
    if (!chant.isDirectory()) continue;
    let files: string[] = [];
    try { files = readdirSync(join(root, chant.name, 'audio')); } catch { continue; }
    for (const file of files) out.push(`${chant.name}/audio/${file}`);
  }
  return out;
}

export function corpus(): Plugin {
  return {
    name: 'siksamitra-corpus',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        const tree = TREES.find((t) => url.startsWith(t.prefix));
        if (tree === undefined) return next();
        /*
         * Only what the tree's own pattern allows, and no traversal out of the
         * served directory. The media tree is the only nested one, and its
         * pattern spells the shape out (`<chant>/audio/<file>`) rather than
         * allowing a slash generally — `..` is refused by both.
         */
        const name = decodeURIComponent(url.slice(tree.prefix.length).split('?')[0] ?? '');
        if (name.includes('..') || !tree.allow.test(name)) return next();
        try {
          const body = readFileSync(join(tree.from, name));
          const ext = name.split('.').pop() ?? '';
          res.setHeader('Content-Type', tree.type ?? TYPES[ext] ?? 'application/octet-stream');
          // Never cached in dev: a document is re-derived by the CLI often, and
          // a stale one is the exact failure this plugin exists to prevent.
          res.setHeader('Cache-Control', 'no-store');
          sendRanged(res, body, req.headers.range);
        } catch {
          next();
        }
        return undefined;
      });
    },

    generateBundle() {
      for (const tree of TREES) {
        const dir = tree.prefix.slice(1, -1);
        /*
         * THE RECITATIONS ARE NOT IN THE BUNDLE BY DEFAULT.
         *
         * They are 30 MB, they are not this repository's files, and a build
         * that silently grew by that much every time would be a build nobody
         * looked at. `SM_BUNDLE_MEDIA=1` puts them in — which is what an
         * offline desktop build wants — and without it the app asks its own
         * server for them and a deployment decides what answers. Either way
         * the path in the document never changes.
         */
        if (tree.nested === true && process.env['SM_BUNDLE_MEDIA'] !== '1') continue;
        let names: string[] = [];
        try {
          names = tree.nested === true ? nestedNames(tree.from) : readdirSync(tree.from);
        } catch {
          /* A tree that is not on this machine emits nothing rather than
             failing the build — see `SM_MEDIA_DIR`. */
          continue;
        }
        for (const name of names) {
          if (!tree.allow.test(name)) continue;
          this.emitFile({
            type: 'asset',
            fileName: `${dir}/${name}`,
            source: readFileSync(join(tree.from, name)),
          });
        }
      }
    },
  };
}
