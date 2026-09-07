/**
 * Serving the corpus — ONE copy of it.
 *
 * `apps/web/public/chants/` used to hold four documents copied out of
 * `corpus/chants/`, and they drifted the moment the corpus changed: the app
 * was serving documents with no source layer while the corpus had them, so the
 * editor refused to edit text that was perfectly editable. A copied file is a
 * file that will disagree.
 *
 * So there is no copy. In dev the corpus is served straight off disk; in a
 * build it is emitted into the bundle from the same place. Both read
 * `corpus/chants`, which is the only corpus.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';

const CORPUS = resolve(import.meta.dirname, '../../corpus/chants');
const PREFIX = '/chants/';

const documents = (): string[] =>
  readdirSync(CORPUS).filter((f) => f.endsWith('.json'));

export function corpus(): Plugin {
  return {
    name: 'siksamitra-corpus',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith(PREFIX)) return next();
        // Only a plain file name: no traversal out of the corpus directory.
        const name = decodeURIComponent(url.slice(PREFIX.length).split('?')[0] ?? '');
        if (!/^[a-z0-9-]+\.json$/i.test(name)) return next();
        try {
          const body = readFileSync(join(CORPUS, name));
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
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
      for (const name of documents()) {
        this.emitFile({
          type: 'asset',
          fileName: `chants/${name}`,
          source: readFileSync(join(CORPUS, name), 'utf8'),
        });
      }
    },
  };
}
