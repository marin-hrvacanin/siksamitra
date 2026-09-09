/**
 * A stylesheet import, resolved to nothing, so Node can load the app's views.
 *
 * `ChantReader.tsx` opens with `import "./chant.css"`, which is how a bundler
 * is told a component brings its own styles. Node has no such concept: the
 * resolver reports `ERR_UNKNOWN_FILE_EXTENSION` for `.css` and the whole render
 * package fails to load — including `holdJoins`, the one function
 * `DocumentBlocks` actually wants from it.
 *
 * So a `.css` specifier resolves to an empty module here. Nothing is lost: an
 * export does not apply stylesheets while it renders, it EMBEDS them, and it
 * gets them from the app's own two entry files rather than from these imports
 * — see `css.mjs`, which reads the same specifiers as a list.
 */
import { registerHooks } from 'node:module';

const EMPTY = 'data:text/javascript,export default ""';

registerHooks({
  resolve(specifier, context, next) {
    if (/\.css(\?.*)?$/.test(specifier)) return { url: EMPTY, shortCircuit: true };
    return next(specifier, context);
  },
});
