import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

/*
 * ORDER MATTERS, twice over.
 *
 * The FONTS first, so a face is declared before anything asks for it. They are
 * served from the app's own `public/fonts`, vendored — never from a CDN — which
 * is what lets the desktop build work with no network and lets pagination
 * measure the same glyphs on every machine.
 *
 * Then the TOKENS, because every stylesheet after this reads their custom
 * properties and one loaded earlier would compute against nothing.
 */
import '/fonts/fonts.css';
import '@siksamitra/tokens/tokens.css';
import '@siksamitra/render/mark-geometry.css';
import '@siksamitra/render/chant.css';
import './app.css';

const root = document.getElementById('root');
if (root === null) throw new Error('no #root');
createRoot(root).render(<StrictMode><App /></StrictMode>);
