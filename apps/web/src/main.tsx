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
import './app.css';

const root = document.getElementById('root');
if (root === null) throw new Error('no #root');
createRoot(root).render(<StrictMode><App /></StrictMode>);
