/**
 * Holding-box geometry — sized from the GLYPH'S INK, not from the baseline.
 *
 * A holding box must enclose the letters it marks. The old rule drew a frame at
 * a fixed distance from the baseline (0.948 em above / 0.271 em below, i.e. an
 * inline-block at `line-height: 1` plus .1em/.12em padding). Those constants
 * were read off Latin type, so they clipped every script that writes outside
 * them: 184/199 Devanāgarī and 150/199 Telugu held clusters had ink outside the
 * frame (worst `ङ्कु`, +0.252 em below), while IAST was fine (1/29).
 *
 * The same fixed frame also made MARKING-RULES §2.4's "the same air above as
 * below" impossible: the air it produced was wildly unequal (`p` → 0.485 above
 * / 0.040 below, `b` → 0.176 / 0.271). Measuring the ink fixes both at once —
 * equal air by construction, and nothing can fall outside.
 *
 * Measurement is done once per (font stack × text) with a canvas, in em, so it
 * is independent of `--fs` and of the reader's font size. `actualBoundingBox*`
 * gives the ink; `fontBoundingBox*` gives where the element's own content box
 * sits relative to the baseline, which is what the box offsets are measured
 * from. Both are resolved by the SAME font fallback the DOM uses, so a
 * Devanāgarī cluster is measured in Noto Serif Devanagari and a Latin one in
 * Gentium Book Plus without us having to know which.
 */
import type { CSSProperties } from 'react';

/** Air left between the ink and the box — the same above as below (§2.4). */
const AIR = 0.1;
/** Sideways air. Kept at the old horizontal padding so Latin, where the frame
 *  was never wrong left-to-right, is pixel-identical; scripts whose marks reach
 *  past the advance (Telugu `ి`, Devanāgarī `ि`) get the same clearance. */
const AIR_X = 0.07;
/** Measurement size; results are divided back out, so any size would do. */
const EM = 100;

const cache = new Map<string, CSSProperties>();
let ctx: CanvasRenderingContext2D | null | undefined;

function context(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  ctx = null;
  if (typeof document === 'undefined') return ctx;
  try {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    // Older engines expose measureText without the ink metrics; treat that as
    // "cannot measure" rather than measuring garbage. The CSS then falls back
    // to the old fixed frame (see `--hb-t` / `--hb-b` defaults in chant.css).
    if (g && 'actualBoundingBoxAscent' in g.measureText('x')) ctx = g;
  } catch { /* canvas unavailable — fall back */ }
  return ctx;
}

/** Drop every cached measurement (call when the webfonts finish loading — the
 *  first paint may have measured a fallback face). */
export function resetHoldBoxes(): void { cache.clear(); }

/**
 * CSS custom properties positioning one holding box around `text`.
 *
 * `--hb-t` / `--hb-b` are the box's top and bottom edges expressed as an offset
 * (in em) from the host element's own content box — which is what `top:` and
 * `bottom:` on an absolutely-positioned child are measured against. Negative
 * means "outside the content box", which is the normal case.
 *
 * `fontStack` is `.pada`'s family list, read from the `--pada-font` custom
 * property so this file can never drift from the CSS.
 */
export function holdBoxVars(text: string, fontStack: string): CSSProperties {
  if (!text || !fontStack) return {};
  const key = `${fontStack} ${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const g = context();
  let vars: CSSProperties = {};
  if (g) {
    g.font = `${EM}px ${fontStack}`;
    const m = g.measureText(text);
    const inkTop = m.actualBoundingBoxAscent / EM;      // ink above the baseline
    const inkBot = m.actualBoundingBoxDescent / EM;     // ink below the baseline
    const inkLeft = m.actualBoundingBoxLeft / EM;       // ink left of the origin
    const inkRight = m.actualBoundingBoxRight / EM;     // ink right of the origin
    const advance = m.width / EM;
    const fbTop = m.fontBoundingBoxAscent / EM;
    const fbBot = m.fontBoundingBoxDescent / EM;
    if (Number.isFinite(inkTop) && Number.isFinite(inkBot) && fbTop + fbBot > 0) {
      // At `line-height: 1` the content box is 1 em tall, so the half-leading
      // that positions the baseline inside it is (1 − (ascent + descent)) / 2.
      const half = (1 - (fbTop + fbBot)) / 2;
      const contentTop = fbTop + half;                  // content box, above baseline
      const contentBot = fbBot + half;                  // content box, below baseline
      vars = {
        ['--hb-t' as string]: round(contentTop - (inkTop + AIR)),
        ['--hb-b' as string]: round(contentBot - (inkBot + AIR)),
        ['--hb-l' as string]: round(-(inkLeft + AIR_X)),
        ['--hb-r' as string]: round(advance - (inkRight + AIR_X)),
      } as CSSProperties;
    }
  }
  cache.set(key, vars);
  return vars;
}

function round(n: number): string { return (Math.round(n * 1000) / 1000).toString(); }
