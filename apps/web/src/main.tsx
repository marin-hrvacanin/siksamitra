import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

/*
 * ORDER MATTERS. The TOKENS come first, because every stylesheet after this
 * reads their custom properties and one loaded earlier would compute against
 * nothing.
 *
 * THE FONTS ARE NOT HERE. They are vendored into `public/fonts` and linked
 * from `index.html`, which is the only way a stylesheet inside `public` can be
 * loaded: Vite refuses to import one from JS, because `public` is copied
 * verbatim and never passed through the bundler. Importing it here broke
 * `npm run dev` outright — the app served a 500 and nothing rendered — and it
 * stayed broken until something actually ran it.
 */
import '@siksamitra/tokens/tokens.css';
import '@siksamitra/render/mark-geometry.css';
import '@siksamitra/render/chant.css';
import '@siksamitra/render/hold-join.css';
/*
 * THE EXPORT FRAMES, loaded by the editor that never draws one.
 *
 * An exported page carries the app's own stylesheets — that is what makes it
 * look like the page it came from — and both halves of the export read the list
 * from THIS FILE: the window walks `document.styleSheets`, and the command
 * walks these import lines (`tools/export/css.mjs`). A frame sheet reached only
 * by one of them would be a page that differed depending on who exported it, so
 * it is loaded here with everything else. It is about a kilobyte, all of it
 * under `.export`, and nothing in the editor matches.
 */
import '@siksamitra/render/export.css';
import './app.css';

const root = document.getElementById('root');
if (root === null) throw new Error('no #root');
createRoot(root).render(<StrictMode><App /></StrictMode>);
