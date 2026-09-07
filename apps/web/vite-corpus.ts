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
] as const;

const TYPES: Record<string, string> = {
  css: 'text/css; charset=utf-8',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  md: 'text/markdown; charset=utf-8',
};

export function corpus(): Plugin {
  return {
    name: 'siksamitra-corpus',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        const tree = TREES.find((t) => url.startsWith(t.prefix));
        if (tree === undefined) return next();
        // Only a plain file name: no traversal out of the served directory.
        const name = decodeURIComponent(url.slice(tree.prefix.length).split('?')[0] ?? '');
        if (!tree.allow.test(name)) return next();
        try {
          const body = readFileSync(join(tree.from, name));
          const ext = name.split('.').pop() ?? '';
          res.setHeader('Content-Type', tree.type ?? TYPES[ext] ?? 'application/octet-stream');
          // Never cached in dev: a document is re-derived by the CLI often, and
          // a stale one is the exact failure this plugin exists to prevent.
          res.setHeader('Cache-Control', 'no-store');
          res.end(body);
        } catch {
          next();
        }
        return undefined;
      });
    },

    generateBundle() {
      for (const tree of TREES) {
        const dir = tree.prefix.slice(1, -1);
        for (const name of readdirSync(tree.from)) {
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
