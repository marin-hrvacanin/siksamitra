/**
 * The add-in's faces are the app's, rule for rule — only the path differs —
 * because both are written by `tools/fonts/gen-css.mjs` from one manifest.
 * This fails if either file was edited by hand, or regenerated alone.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../../../../../assets/fonts/fonts.css', import.meta.url), 'utf8');
const ours = readFileSync(new URL('../fonts.generated.css', import.meta.url), 'utf8');
const faces = (css: string) => [...css.matchAll(/@font-face\s*\{[^}]*\}/g)].map((m) => m[0]);

describe('the add-in fonts', () => {
  it('are rules the app has, with the path to the same file', () => {
    const own = faces(ours);
    expect(own.length).toBeGreaterThanOrEqual(6);
    const theirs = new Set(faces(app));
    for (const f of own) expect(theirs.has(f.replaceAll("url('../../../../assets/fonts/", "url('./")), f).toBe(true);
  });
  it('cover the interface face, the Word verse face and both halves of the app’s', () => {
    for (const family of ['IBM Plex Sans', 'Arimo', 'Gentium Book Plus', 'Noto Serif Devanagari']) { // token-exempt: the families under test
      expect(ours).toContain(`font-family: '${family}'`); // token-exempt: asserts the rule, sets nothing
    }
  });
});
