/**
 * The audio tab and the transport, in a DOM.
 *
 * What this tier is for: what somebody can SEE and PRESS. The mapping
 * arithmetic is tested in `@siksamitra/audio` where it belongs; these are the
 * things that only exist once it is on screen — that the transport says what
 * is being sung, that "Map it" is not offered before there is anything to map,
 * that the readout beside it is a fact and not a greyed-out button, and that
 * the highlight lands on the pāda the clock is inside.
 *
 * The WAVEFORM is drawn on a canvas in an effect, which server rendering does
 * not run, so what is checked here is everything about it that is not the
 * drawing: that it can be reached and read without a picture at all. What the
 * canvas actually paints is not covered by any test — see the report.
 */
import { describe, expect, it, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { ChantDoc } from '@siksamitra/format';
import {
  AudioBar, BoundaryGroup, MappingGroup, SpeedGroup, TransportGroup,
} from '../../apps/web/src/shell/AudioGroup.js';
import { padasOfDoc, sourceFor, type Recording } from '../../apps/web/src/audio/useRecording.js';
import type { Mapping } from '../../apps/web/src/audio/useMapping.js';
import { Waveform } from '../../apps/web/src/audio/Waveform.js';

function mount(node: React.ReactNode): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = renderToString(node as never);
  document.body.append(host);
  return host;
}
afterEach(() => { document.body.innerHTML = ''; });

const player = (over: Partial<Recording> = {}): Recording => ({
  name: 'take.wav',
  file: null,
  ready: true,
  playing: false,
  duration: 120,
  at: 12.5,
  rate: 1,
  loop: false,
  setRate: vi.fn(),
  setLoop: vi.fn(),
  open: vi.fn(),
  playVerse: vi.fn(),
  playPada: vi.fn(),
  playAll: vi.fn(),
  pause: vi.fn(),
  seek: vi.fn(),
  sung: null,
  ...over,
});

/** A mapping with nothing in it; each test names the two or three fields it
 *  is about, so a new field on `Mapping` does not rewrite every case. */
const mapping = (over: Partial<Mapping> = {}): Mapping => ({
  take: null,
  busy: null,
  padas: [],
  seams: [],
  kinds: [],
  guesses: 0,
  selected: null,
  view: { from: 0, to: 10 },
  duration: 10,
  attach: vi.fn(),
  align: vi.fn(),
  select: vi.fn(),
  drag: vi.fn(),
  nudge: vi.fn(),
  setFrom: vi.fn(),
  nextGuess: vi.fn(),
  zoom: vi.fn(),
  followPlayhead: vi.fn(),
  ...over,
});

const doc = (byVerse: Record<string, unknown> | null, base?: string): ChantDoc => ({
  title: 't',
  titleForms: { iast: 't' },
  sections: [],
  version: 4,
  ...(base === undefined ? {} : { audioBase: base }),
  ...(byVerse === null ? {} : { recording: { byVerse } }),
} as ChantDoc);

describe('the transport', () => {
  it('says what it will do next, not what it is doing', () => {
    /* A button labelled with the CURRENT state is the classic media-player
       ambiguity — "Play" while it is playing reads as a status. */
    expect(mount(<TransportGroup audio={player()} at={null} />).textContent)
      .toContain('Play');
    expect(mount(<TransportGroup audio={player({ playing: true })} at={null} />).textContent)
      .toContain('Pause');
  });

  it('will not offer to play a verse or a line when the caret is in none', () => {
    const off = mount(<TransportGroup audio={player()} at={null} />);
    const named = (host: HTMLElement, label: string): HTMLButtonElement | undefined =>
      [...host.querySelectorAll('button')].find((b) => b.textContent === label);
    expect(named(off, 'This verse')?.disabled).toBe(true);
    expect(named(off, 'This line')?.disabled).toBe(true);

    const on = mount(<TransportGroup audio={player()} at={{ verseId: 'v-2', line: 1 }} />);
    expect(named(on, 'This verse')?.disabled).toBe(false);
    expect(named(on, 'This line')?.disabled).toBe(false);
  });

  it('shows which speed is in force, so the pressed one is unambiguous', () => {
    const host = mount(<SpeedGroup audio={player({ rate: 0.65 })} />);
    const on = [...host.querySelectorAll('button')].filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(on).toHaveLength(1);
    expect(on[0]?.textContent).toBe('0.65×');
  });

  it('reads the clock in minutes and seconds, and names what is being sung', () => {
    const host = mount(<AudioBar audio={player({ at: 65, duration: 3723 })} />);
    expect(host.textContent).toContain('1:05');
    expect(host.textContent).toContain('62:03');
    /* Nothing sung yet: the file's name, rather than an empty space. */
    expect(host.textContent).toContain('take.wav');

    const singing = mount(
      <AudioBar audio={player({ sung: { verseId: 'v-4', line: 2, start: 0, end: 1 } })} />,
    );
    expect(singing.textContent).toContain('v-4 · pāda 3');
  });

  it('has a seek control a keyboard can reach, and never a zero-length one', () => {
    const host = mount(<AudioBar audio={player({ duration: 0 })} />);
    const seek = host.querySelector('input[type="range"]') as HTMLInputElement;
    expect(seek).not.toBeNull();
    expect(seek.getAttribute('aria-label')).toBeTruthy();
    /* A range whose max is 0 cannot be dragged and reads as broken. */
    expect(Number(seek.max)).toBeGreaterThan(0);
  });
});

describe('mapping', () => {
  it('will not offer to map before a recording is open', () => {
    const host = mount(
      <MappingGroup doc={doc(null)} audio={player()} mapping={mapping()} />,
    );
    const map = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Map it');
    expect(map?.disabled).toBe(true);
  });

  it('says what it is doing while it is doing it, rather than looking hung', () => {
    /* Decoding a 40 minute take is the one thing in this program that takes
       long enough to look broken, and `decodeAudioData` reports no progress —
       so the stage is named instead of a bar being animated at nothing. */
    const host = mount(
      <MappingGroup doc={doc(null)} audio={player()} mapping={mapping({ busy: 'Decoding the audio…' })} />,
    );
    expect(host.textContent).toContain('Decoding the audio…');
    const open = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Open take');
    expect(open?.disabled).toBe(true);
  });

  it('states what the document already has as a FACT, not a dead button', () => {
    /* "Why are so many options greyed out?" — because half of them were never
       controls. This one is a readout. */
    const none = mount(
      <MappingGroup doc={doc(null)} audio={player()} mapping={mapping()} />,
    );
    expect(none.querySelector('.rbn__read')?.textContent).toContain('Not mapped yet');

    const some = mount(
      <MappingGroup
        doc={doc({ 'v-1': { file: 'a.wav' }, 'v-2': { file: 'a.wav' } })}
        audio={player()}
        mapping={mapping()}
      />,
    );
    expect(some.querySelector('.rbn__read')?.textContent).toContain('2 verses mapped');
    expect(some.querySelector('.rbn__read')?.tagName).not.toBe('BUTTON');
  });

  it('keeps the file input out of sight but in the accessibility tree', () => {
    const host = mount(
      <MappingGroup doc={doc(null)} audio={player()} mapping={mapping()} />,
    );
    const input = host.querySelector('input[type="file"]');
    expect(input?.className).toBe('u-offscreen');
    expect(input?.getAttribute('accept')).toBe('audio/*');
  });
});

describe('fixing a boundary by hand', () => {
  const named = (host: HTMLElement, label: string): HTMLButtonElement | undefined =>
    [...host.querySelectorAll('button')].find((b) => b.textContent === label);

  it('offers nothing to move until a boundary is picked', () => {
    const host = mount(<BoundaryGroup audio={player()} mapping={mapping()} />);
    expect(named(host, 'Set here')?.disabled).toBe(true);
    expect(named(host, 'Earlier')?.disabled).toBe(true);
    expect(named(host, 'Later')?.disabled).toBe(true);

    const picked = mount(
      <BoundaryGroup audio={player()} mapping={mapping({ selected: 2, seams: [0, 4, 9, 13] })} />,
    );
    expect(named(picked, 'Set here')?.disabled).toBe(false);
    expect(named(picked, 'Earlier')?.disabled).toBe(false);
  });

  it('offers "next guess" only while there is a guess left to look at', () => {
    const clean = mount(<BoundaryGroup audio={player()} mapping={mapping({ guesses: 0 })} />);
    expect(named(clean, 'Next guess')?.disabled).toBe(true);
    /* And it says WHY, rather than being a dead control with no explanation —
       "why are so many options greyed out?" is the complaint this answers. */
    expect(named(clean, 'Next guess')?.title).toContain('landed on a breath');

    const work = mount(<BoundaryGroup audio={player()} mapping={mapping({ guesses: 3 })} />);
    expect(named(work, 'Next guess')?.disabled).toBe(false);
  });
});

describe('the strip under the document', () => {
  const seams = [0, 4, 9, 13, 20];

  it('is reachable and readable without the picture', () => {
    const host = mount(
      <Waveform
        take={null}
        view={{ from: 0, to: 20 }}
        seams={seams}
        kinds={['even', 'breath', 'even', 'breath', 'even']}
        selected={2}
        at={17}
        says="v-1 pāda 2 to v-2 pāda 1"
        onSelect={vi.fn()}
        onDrag={vi.fn()}
        onScrub={vi.fn()}
      />,
    );
    const strip = host.querySelector('.wave') as HTMLElement;
    expect(strip.getAttribute('role')).toBe('slider');
    expect(strip.getAttribute('tabindex')).toBe('0');
    /* The value a screen reader announces is the SELECTED boundary, not the
       playhead — the strip is a boundary editor that happens to show a clock. */
    /* 9 is the selected boundary; 17 is the playhead. The boundary wins. */
    expect(strip.getAttribute('aria-valuenow')).toBe('9');
    expect(strip.getAttribute('aria-valuetext')).toContain('pāda 2');
  });

  it('puts the playhead where the clock is, as a fraction of what is shown', () => {
    const host = mount(
      <Waveform
        take={null}
        view={{ from: 10, to: 20 }}
        seams={seams}
        kinds={[]}
        selected={null}
        at={15}
        says={null}
        onSelect={vi.fn()}
        onDrag={vi.fn()}
        onScrub={vi.fn()}
      />,
    );
    const head = host.querySelector('.wave__head') as HTMLElement;
    expect(head.style.left).toBe('50%');
  });
});

describe('reading the mapping out of a document', () => {
  it('puts every pāda in time order, whatever order the verses are written in', () => {
    const out = padasOfDoc(doc({
      'v-2': { file: 'a.wav', lines: [{ start: 30, end: 40 }] },
      'v-1': { file: 'a.wav', lines: [{ start: 0, end: 10 }, { start: 10, end: 30 }] },
    }));
    expect(out.map((p) => [p.verseId, p.line])).toEqual([['v-1', 0], ['v-1', 1], ['v-2', 0]]);
  });

  it('has nothing to say about a document with no recording', () => {
    expect(padasOfDoc(doc(null))).toEqual([]);
    expect(padasOfDoc(null)).toEqual([]);
  });

  it('resolves a file name against the document’s base, and leaves a URL alone', () => {
    const withBase = doc({ 'v-1': { file: 'durga.mp3' } }, '/audio/durga/');
    expect(sourceFor(withBase, 'v-1')).toBe('/audio/durga/durga.mp3');

    const absolute = doc({ 'v-1': { file: 'https://cdn/x.mp3' } }, '/audio/');
    expect(sourceFor(absolute, 'v-1')).toBe('https://cdn/x.mp3');

    const rooted = doc({ 'v-1': { file: '/already/rooted.mp3' } }, '/audio/');
    expect(sourceFor(rooted, 'v-1')).toBe('/already/rooted.mp3');

    expect(sourceFor(doc(null), 'v-1')).toBeNull();
  });
});
