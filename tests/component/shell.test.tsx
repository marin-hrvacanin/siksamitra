/**
 * The window's chrome, in a DOM.
 *
 * What this tier is for: what a PERSON can see and do — the title bar carrying
 * the right buttons for the platform, a ribbon button announcing whether it is
 * pressed, an icon that is actually drawn. Not how any of it is implemented.
 *
 * The per-platform title bar is the case that earns this file. It cannot be
 * checked on three machines here, and the desktop shell needs a Rust toolchain
 * to build — so without a test the macOS layout would be a guess for ever.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Icon } from '../../apps/web/src/ui/Icon.js';
import { ICONS, ICON_NAMES } from '../../apps/web/src/ui/icons.generated.js';
import { RibbonButton, RibbonStack } from '../../apps/web/src/shell/RibbonButton.js';

/** Render to a real element, so `querySelector` and `textContent` work. */
function mount(node: React.ReactNode): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = renderToString(node as never);
  document.body.append(host);
  return host;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('the icons', () => {
  it('every one of them draws something', () => {
    /*
     * The failure this catches: a manifest name that does not exist in the
     * library. The generator fails loudly, but a hand-edited generated file
     * would render an empty `<svg>` — invisible, and exactly the sort of thing
     * that survives review.
     */
    expect(ICON_NAMES.length).toBeGreaterThan(40);
    for (const name of ICON_NAMES) {
      const host = mount(<Icon name={name} />);
      const svg = host.querySelector('svg')!;
      expect(svg, name).not.toBeNull();
      expect(svg.getAttribute('viewBox'), name).toMatch(/^[-\d\s.]+$/);
      expect(svg.innerHTML.length, `${name} draws nothing`).toBeGreaterThan(20);
      /* A path or a rect — the window's maximise glyph is a square, drawn as
         one on the platform's own 10-unit grid. */
      expect(svg.innerHTML, name).toMatch(/<(path|rect)/);
      document.body.innerHTML = '';
    }
  });

  it('takes the colour of whatever it sits in, and never states its own', () => {
    for (const name of ICON_NAMES) {
      expect(ICONS[name].body, `${name} hard-codes a colour`).not.toMatch(/#[0-9a-f]{3,6}/i);
    }
  });

  it('is decoration: a screen reader is told about the button, not the picture', () => {
    const host = mount(<Icon name="undo" />);
    expect(host.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('has three sizes, and they are the three roles the chrome has', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const host = mount(<Icon name="undo" size={size} />);
      expect(host.querySelector('svg')!.className.baseVal ?? host.querySelector('svg')!.getAttribute('class'))
        .toContain(`ic--${size}`);
      document.body.innerHTML = '';
    }
  });

  it('draws OUR notation for the holdings, not a borrowed glyph', () => {
    /* The box in its two stroke weights: the difference between a short and a
       long holding is the weight, and nothing else. */
    const short = ICONS['hold-short'].body;
    const long = ICONS['hold-long'].body;
    expect(short).toContain('stroke-width="1.2"');
    expect(long).toContain('stroke-width="2.6"');
    // Same box, same letter: only the weight differs.
    expect(short.replace('1.2', 'X')).toBe(long.replace('2.6', 'X'));
  });
});

describe('a ribbon button', () => {
  it('shows its label, so the ribbon can be read and not decoded', () => {
    const host = mount(<RibbonButton icon="undo" label="Undo" onClick={() => {}} />);
    expect(host.textContent).toContain('Undo');
  });

  it('announces a toggle s state, and says nothing for a plain action', () => {
    const toggle = mount(
      <RibbonButton icon="marks" label="Marks" pressed onClick={() => {}} />,
    );
    expect(toggle.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
    document.body.innerHTML = '';

    const action = mount(<RibbonButton icon="undo" label="Undo" onClick={() => {}} />);
    expect(action.querySelector('button')!.getAttribute('aria-pressed')).toBeNull();
  });

  it('puts the accelerator in the tooltip, as Word does', () => {
    const host = mount(
      <RibbonButton icon="undo" label="Undo" title="Take it back" accel="Ctrl+Z" onClick={() => {}} />,
    );
    expect(host.querySelector('button')!.title).toBe('Take it back (Ctrl+Z)');
  });

  it('is disabled rather than absent when it cannot run', () => {
    /* A control that disappears teaches nothing; a disabled one says the
       action exists and is not available now. */
    const host = mount(<RibbonButton icon="redo" label="Redo" disabled onClick={() => {}} />);
    expect(host.querySelector('button')!.disabled).toBe(true);
  });

  it('may have no glyph, when its label IS the picture', () => {
    // The script buttons: `IAST`, `देव`, `తెలు`, `தமி`.
    const host = mount(<RibbonButton label="देव" onClick={() => {}} />);
    expect(host.querySelector('svg')).toBeNull();
    expect(host.textContent).toBe('देव');
  });

  it('stacks in a column, or in two for a group of four', () => {
    const one = mount(<RibbonStack><span>a</span></RibbonStack>);
    expect(one.querySelector('div')!.className).toBe('rbs');
    document.body.innerHTML = '';
    const two = mount(<RibbonStack columns={2}><span>a</span></RibbonStack>);
    expect(two.querySelector('div')!.className).toContain('rbs--2');
  });
});

describe('the window s title bar, per platform', () => {
  /*
   * `host.ts` reads the platform once, at module load, so each case re-imports
   * it with a different user agent. `vi.resetModules` is what makes that
   * possible and is the only implementation detail this file touches.
   */
  const UA = {
    windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    macos: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    linux: 'Mozilla/5.0 (X11; Linux x86_64)',
  };

  let original: PropertyDescriptor | undefined;
  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
  });
  afterEach(() => {
    if (original !== undefined) Object.defineProperty(window.navigator, 'userAgent', original);
    document.body.innerHTML = '';
  });

  async function titleBarOn(platform: keyof typeof UA): Promise<HTMLElement> {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: UA[platform], configurable: true,
    });
    (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    const { resetModules } = await import('vitest').then((m) => ({ resetModules: m.vi.resetModules }));
    resetModules();
    const { TitleBar } = await import('../../apps/web/src/shell/TitleBar.js');
    const host = mount(<TitleBar title="durgā sūktam" subtitle="śikṣāmitra" />);
    delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    return host;
  }

  it('draws our own minimise, maximise and close on Windows', async () => {
    const host = await titleBarOn('windows');
    const buttons = [...host.querySelectorAll('.wctl__b')];
    expect(buttons.map((b) => b.getAttribute('aria-label')))
      .toEqual(['Minimise', 'Maximise', 'Close']);
    expect(host.querySelector('.tbar')!.getAttribute('data-platform')).toBe('windows');
  });

  it('draws them on Linux too, where GTK puts them in the same corner', async () => {
    const host = await titleBarOn('linux');
    expect(host.querySelectorAll('.wctl__b')).toHaveLength(3);
  });

  it('draws NONE on macOS, and leaves room for the system s own', async () => {
    /*
     * The window keeps its real traffic lights there: muscle memory, the green
     * button's full-screen behaviour and every accessibility tool expect the
     * system's. We inset 78px and put nothing in it.
     */
    const host = await titleBarOn('macos');
    expect(host.querySelectorAll('.wctl__b')).toHaveLength(0);
    expect(host.querySelector<HTMLElement>('.tbar')!.style.paddingLeft).toBe('78px');
  });

  it('carries the document s name, which is what a title bar is for', async () => {
    const host = await titleBarOn('windows');
    expect(host.querySelector('.tbar__title')!.textContent).toBe('durgā sūktam');
  });

  it('is not drawn at all in a browser — the browser has one', async () => {
    const { vi } = await import('vitest');
    vi.resetModules();
    const { TitleBar } = await import('../../apps/web/src/shell/TitleBar.js');
    const host = mount(<TitleBar title="durgā sūktam" />);
    expect(host.querySelector('.tbar')).toBeNull();
  });
});
