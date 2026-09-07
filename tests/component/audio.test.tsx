/**
 * The audio tab and the transport, in a DOM.
 *
 * What this tier is for: what somebody can SEE and PRESS. The mapping
 * arithmetic is tested in `@siksamitra/audio` where it belongs; these are the
 * things that only exist once it is on screen — that the transport says what
 * is being sung, that "Map it" is not offered before there is anything to map,
 * that the readout beside it is a fact and not a greyed-out button, and that
 * the highlight lands on the pāda the clock is inside.
 */
import { describe, expect, it, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { ChantDoc } from '@siksamitra/format';
import { AudioBar, MappingGroup, SpeedGroup, TransportGroup } from '../../apps/web/src/shell/AudioGroup.js';
import { padasOfDoc, sourceFor, type Recording } from '../../apps/web/src/audio/useRecording.js';

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
    expect(mount(<TransportGroup audio={player()} verseId={null} />).textContent)
      .toContain('Play');
    expect(mount(<TransportGroup audio={player({ playing: true })} verseId={null} />).textContent)
      .toContain('Pause');
  });

  it('will not offer to play "this verse" when the caret is in none', () => {
    const off = mount(<TransportGroup audio={player()} verseId={null} />);
    const button = [...off.querySelectorAll('button')].find((b) => b.textContent === 'This verse');
    expect(button?.disabled).toBe(true);

    const on = mount(<TransportGroup audio={player()} verseId="v-2" />);
    const live = [...on.querySelectorAll('button')].find((b) => b.textContent === 'This verse');
    expect(live?.disabled).toBe(false);
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
      <MappingGroup doc={doc(null)} audio={player()} onMap={vi.fn()} onNote={vi.fn()} />,
    );
    const map = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Map it');
    expect(map?.disabled).toBe(true);
  });

  it('states what the document already has as a FACT, not a dead button', () => {
    /* "Why are so many options greyed out?" — because half of them were never
       controls. This one is a readout. */
    const none = mount(
      <MappingGroup doc={doc(null)} audio={player()} onMap={vi.fn()} onNote={vi.fn()} />,
    );
    expect(none.querySelector('.rbn__read')?.textContent).toContain('Not mapped yet');

    const some = mount(
      <MappingGroup
        doc={doc({ 'v-1': { file: 'a.wav' }, 'v-2': { file: 'a.wav' } })}
        audio={player()}
        onMap={vi.fn()}
        onNote={vi.fn()}
      />,
    );
    expect(some.querySelector('.rbn__read')?.textContent).toContain('2 verses mapped');
    expect(some.querySelector('.rbn__read')?.tagName).not.toBe('BUTTON');
  });

  it('keeps the file input out of sight but in the accessibility tree', () => {
    const host = mount(
      <MappingGroup doc={doc(null)} audio={player()} onMap={vi.fn()} onNote={vi.fn()} />,
    );
    const input = host.querySelector('input[type="file"]');
    expect(input?.className).toBe('u-offscreen');
    expect(input?.getAttribute('accept')).toBe('audio/*');
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
