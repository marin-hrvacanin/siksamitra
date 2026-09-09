/**
 * THE FOUR DROPDOWNS, as the data they are drawn from.
 *
 * The program has exactly four `<select>`s — the export style, a picture's
 * size, where its caption goes, and the page size — and each is a `.map` over
 * an authored list. `tools/interaction-ribbon.mjs` measures the boxes those
 * lists get in a real browser; this tier checks the lists themselves, which is
 * the half a browser cannot tell you is wrong: two options reading the same
 * word looks fine and is unusable.
 *
 * WHY THE LENGTH CHECK IS HERE. Every one of these lists was once trimmed to
 * fit a 48 px cap — "Medium — a half" became "Medium ½" because it clipped to
 * "Me". The cap is now `--panel-min`, and this asserts the labels against THAT
 * token, read out of the token source: so a list that grows past what the
 * ribbon can show fails here, and so does a cap quietly shrunk back. The two
 * numbers come from different files and neither is computed from the other.
 */
import { describe, expect, it } from 'vitest';
import { EXPORT_STYLES } from '@siksamitra/tokens/export-styles';
import { PAGE_SIZES } from '@siksamitra/layout';
import { BASE } from '@siksamitra/tokens/source';
import { CAPTION_AT, CUSTOM_WIDTH, customSizeLabel, FLOWS, SIZES } from '../PictureGroup.js';

/**
 * The widest label the ribbon can show, in characters.
 *
 * From the cap in `controls.css` — `--panel-min` — less the control's own
 * padding and Chromium's drop-down arrow, at a deliberately pessimistic
 * advance per character. The chrome's face is a UI sans at 14 px, where the
 * widest Latin letters run about 0.62 em; 0.68 em is the pessimism, so a list
 * that passes here has room even in a face wider than the one measured.
 */
const CAP_REM = Number.parseFloat(String(BASE['panel-min']));
const ROOT_PX = 16;
const PADDING_AND_ARROW_PX = 16 + 16;
const WORST_CHAR_PX = 14 * 0.68;
const MAX_CHARS = Math.floor((CAP_REM * ROOT_PX - PADDING_AND_ARROW_PX) / WORST_CHAR_PX);

const LISTS: readonly { what: string; rows: readonly { id: string; label: string }[] }[] = [
  { what: 'the export style', rows: EXPORT_STYLES.map((s) => ({ id: s.id, label: s.name })) },
  { what: "a picture's size", rows: SIZES },
  { what: 'where the caption goes', rows: CAPTION_AT.map((c) => ({ id: c.id, label: c.label })) },
  { what: 'the page size', rows: Object.values(PAGE_SIZES).map((p) => ({ id: p.id, label: p.label })) },
  /* Not a dropdown — three buttons — but the same authored shape, and the
     wrap labels are read in the same glance as the size list beside them. */
  { what: "a picture's wrap", rows: FLOWS.map((f) => ({ id: f.id, label: f.label })) },
];

describe('the ribbon\'s option lists', () => {
  it('the cap the labels are measured against is a real token', () => {
    /* If `panel-min` is ever removed or renamed, `MAX_CHARS` would silently
       become `NaN` and every length check below would pass on any label. */
    expect(Number.isFinite(CAP_REM), 'panel-min is not a number').toBe(true);
    expect(CAP_REM).toBeGreaterThan(0);
    expect(MAX_CHARS).toBeGreaterThan(8);
  });

  /*
   * THE SIXTH ROW OF THE SIZE LIST — the one a drag produces.
   *
   * `widthPct` beats `size`, so while one is set the list showing "Medium" is
   * naming a size that is not in force. The extra row says what the width
   * really is; it must never be storable as a size, and it must never collide
   * with one.
   */
  describe('the custom width the size list shows after a drag', () => {
    it('is not one of the five, so it can never be stored as a size', () => {
      expect(SIZES.map((s) => s.id)).not.toContain(CUSTOM_WIDTH);
    });

    it('reads as the width the drag produced, to the nearest per cent', () => {
      expect(customSizeLabel(57)).toBe('Custom 57%');
      expect(customSizeLabel(57.4)).toBe('Custom 57%');
      expect(customSizeLabel(56.5)).toBe('Custom 57%');
      expect(customSizeLabel(100)).toBe('Custom 100%');
      /* The drag floors at 5 %, and a label of "Custom 5%" is the narrowest
         thing this row will ever have to say. */
      expect(customSizeLabel(5)).toBe('Custom 5%');
    });

    it('fits the ribbon at its longest', () => {
      expect(customSizeLabel(100).length).toBeLessThanOrEqual(MAX_CHARS);
    });

    it('never reads like one of the five', () => {
      for (const pct of [5, 33, 50, 75, 100]) {
        expect(SIZES.map((s) => s.label)).not.toContain(customSizeLabel(pct));
      }
    });
  });

  for (const { what, rows } of LISTS) {
    describe(what, () => {
      it('offers more than one thing', () => {
        expect(rows.length).toBeGreaterThan(1);
      });

      it('says something in every row', () => {
        for (const row of rows) {
          expect(row.label.trim(), `${what}: "${row.id}" has no label`).not.toBe('');
          expect(row.id.trim(), `${what}: a row has no id`).not.toBe('');
        }
      });

      it('never says the same thing twice', () => {
        expect(new Set(rows.map((r) => r.label)).size, `${what}: two rows read alike`)
          .toBe(rows.length);
        expect(new Set(rows.map((r) => r.id)).size, `${what}: two rows share an id`)
          .toBe(rows.length);
      });

      it('is not abbreviated: every label is words, not a stub', () => {
        for (const row of rows) {
          /* A trailing full stop or ellipsis in an OPTION is an abbreviation —
             a dropdown option is a noun, not a sentence and not a command. */
          expect(row.label, `${what}: "${row.label}" is abbreviated`)
            .not.toMatch(/(\.\.\.|…|\.)$/);
        }
      });

      it(`fits the ribbon's cap — at most ${MAX_CHARS} characters`, () => {
        for (const row of rows) {
          expect(row.label.length, `${what}: "${row.label}" is ${row.label.length} characters, `
            + `past the ${MAX_CHARS} the --panel-min cap can show`)
            .toBeLessThanOrEqual(MAX_CHARS);
        }
      });
    });
  }
});
