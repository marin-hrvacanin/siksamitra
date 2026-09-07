import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

// The token stylesheet FIRST: everything else reads its custom properties, and
// a component stylesheet loaded before them would compute against nothing.
import '@siksamitra/tokens/tokens.css';
import '@siksamitra/render/mark-geometry.css';
import '@siksamitra/render/chant.css';
import './app.css';

const root = document.getElementById('root');
if (root === null) throw new Error('no #root');
createRoot(root).render(<StrictMode><App /></StrictMode>);
