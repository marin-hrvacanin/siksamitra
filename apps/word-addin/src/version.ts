/**
 * WHICH BUILD THIS IS, and where the notation is written down.
 *
 * Injected by `vite.config.ts` out of `scripts/word-addin.mjs` and
 * `package.json` rather than written here, because the manifest, the publish
 * tool, the folder's own index page and the pane's footer all name the same
 * two URLs — and four copies of a URL is three that go stale.
 *
 * THE VERSION IS IN THE PANE FOR A REASON. A task pane is a cached web page:
 * Word holds one for days, and there is nothing in the Office user interface
 * that says which build of an add-in is loaded. Without this, "is my fix in
 * there?" has no answer from inside Word.
 */

declare const __ADDIN_VERSION__: string;
declare const __GUIDE_URL__: string;

export const ADDIN_VERSION: string = __ADDIN_VERSION__;
export const GUIDE_URL: string = __GUIDE_URL__;
