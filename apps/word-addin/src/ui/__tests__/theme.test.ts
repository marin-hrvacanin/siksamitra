/**
 * WHICH MODE THE PANE IS IN. Word's theme first, the system's only when Word
 * reports none — because a dark Word on a light Windows is common, and the
 * pane was light inside it.
 */
import { describe, expect, it } from 'vitest';
import { luminance, modeOf } from '../theme.js';

describe('Word says what its theme is', () => {
  it('dark, as Word on the web reports it — measured: #1B1A19', () => {  // token-exempt: a colour Word reports, the input under test
    expect(modeOf({ bodyBackgroundColor: '#1B1A19' }, false)).toBe('dark');  // token-exempt: a colour Word reports, the input under test
  });

  it('light, whatever the system prefers', () => {
    expect(modeOf({ bodyBackgroundColor: '#FFFFFF' }, true)).toBe('light');  // token-exempt: a colour Word reports, the input under test
  });

  it('Word\'s "colourful" and grey themes are light; its black theme is dark', () => {
    expect(modeOf({ bodyBackgroundColor: '#F3F2F1' }, true)).toBe('light');  // token-exempt: a colour Word reports, the input under test
    expect(modeOf({ bodyBackgroundColor: '#E6E6E6' }, true)).toBe('light');  // token-exempt: a colour Word reports, the input under test
    expect(modeOf({ bodyBackgroundColor: '#262626' }, false)).toBe('dark');  // token-exempt: a colour Word reports, the input under test
    expect(modeOf({ bodyBackgroundColor: '#000000' }, false)).toBe('dark');  // token-exempt: a colour Word reports, the input under test
  });

  it('the crossover is where white text would read better than black', () => {
    /* Two mid-greys, one either side of the crossover: the darker takes white
       text, the lighter black. Real Word themes are nowhere near the line. */
    expect(modeOf({ bodyBackgroundColor: '#595959' }, false)).toBe('dark');  // token-exempt: a colour Word reports, the input under test
    expect(modeOf({ bodyBackgroundColor: '#A0A0A0' }, true)).toBe('light');  // token-exempt: a colour Word reports, the input under test
  });
});

describe('Word says nothing, or nonsense', () => {
  it('no theme at all: the system preference decides', () => {
    expect(modeOf(null, true)).toBe('dark');
    expect(modeOf(undefined, false)).toBe('light');
    expect(modeOf({}, true)).toBe('dark');
  });

  it('a colour it cannot read is treated as no colour — never a crash', () => {
    for (const bad of ['', 'red', '#12', '#GGGGGG', 'rgb(0,0,0)', '  ']) {  // token-exempt: a colour Word reports, the input under test
      expect(modeOf({ bodyBackgroundColor: bad }, true), bad).toBe('dark');
      expect(modeOf({ bodyBackgroundColor: bad }, false), bad).toBe('light');
    }
  });
});

describe('luminance', () => {
  it('is WCAG\'s: white 1, black 0, with or without the #', () => {
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 6);  // token-exempt: a colour Word reports, the input under test
    expect(luminance('000000')).toBeCloseTo(0, 6);  // token-exempt: a colour Word reports, the input under test
    expect(luminance('#808080')).toBeCloseTo(0.2159, 3);  // token-exempt: a colour Word reports, the input under test
  });
  it('and null for anything that is not six hex digits', () => {
    expect(luminance('#FFF')).toBeNull();  // token-exempt: a colour Word reports, the input under test
    expect(luminance('white')).toBeNull();
  });
});
