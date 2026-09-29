/**
 * THE TOOLTIP, AS A PERSON MEETS IT — in the app and in the Word pane alike.
 *
 * What it must do that the browser's `title` popup did not: say WHY a button
 * is disabled, show the shortcut, appear on keyboard focus, go away on Escape,
 * and take its colours from the theme it is drawn in.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RibbonButton, TooltipLayer, tipProps } from '@siksamitra/ui';

let root: Root;
let host: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
  host = document.createElement('div');
  host.setAttribute('data-chrome', 'palladio');
  host.setAttribute('data-mode', 'dark');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

function render(node: React.ReactNode): void {
  act(() => root.render(<>{node}<TooltipLayer /></>));
}

/** jsdom has no layout and no PointerEvent: say what is under the pointer, and
    send a MouseEvent of the pointer type, which the same listener receives. */
function pointAt(el: Element): void {
  document.elementFromPoint = () => el;
  act(() => {
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 1, clientY: 1 }));
  });
}

const bubble = (): HTMLElement | null => document.querySelector('[role="tooltip"]');

describe('the tooltip layer', () => {
  it('appears after the pointer rests, not at once', () => {
    render(<RibbonButton label="Short" title="A thin box" accel="Ctrl+H" onClick={() => {}} />);
    pointAt(host.querySelector('button')!);
    expect(bubble()).toBeNull();
    act(() => { vi.advanceTimersByTime(500); });
    expect(bubble()?.textContent).toContain('A thin box');
    expect(bubble()?.querySelector('kbd')?.textContent).toBe('Ctrl+H');
  });

  it('over a DISABLED button, says why — the case the browser never could', () => {
    render(<RibbonButton label="Short" title="A thin box" why="Select at least one letter."
      disabled onClick={() => {}} />);
    pointAt(host.querySelector('button')!);
    act(() => { vi.advanceTimersByTime(500); });
    expect(bubble()?.textContent).toContain('Select at least one letter.');
  });

  it('and over an ENABLED one the reason is not shown — the control', () => {
    render(<RibbonButton label="Short" title="A thin box" why="Select at least one letter."
      onClick={() => {}} />);
    pointAt(host.querySelector('button')!);
    act(() => { vi.advanceTimersByTime(500); });
    expect(bubble()?.textContent).not.toContain('Select at least one letter.');
  });

  it('appears on keyboard focus at once, and Escape hides it', () => {
    render(<button type="button" {...tipProps('Open the palette')}>IAST</button>);
    act(() => { host.querySelector('button')!.focus(); vi.advanceTimersByTime(1); });
    expect(bubble()?.textContent).toContain('Open the palette');
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(bubble()).toBeNull();
  });

  it('pressing the control dismisses it', () => {
    render(<RibbonButton label="Long" title="A thick box" onClick={() => {}} />);
    pointAt(host.querySelector('button')!);
    act(() => { vi.advanceTimersByTime(500); });
    expect(bubble()).not.toBeNull();
    act(() => { document.dispatchEvent(new MouseEvent('pointerdown')); });
    expect(bubble()).toBeNull();
  });

  it('is drawn INSIDE the themed element, so it resolves the theme\'s tokens', () => {
    render(<RibbonButton label="Short" title="A thin box" onClick={() => {}} />);
    pointAt(host.querySelector('button')!);
    act(() => { vi.advanceTimersByTime(500); });
    expect(bubble()?.closest('[data-mode="dark"]')).toBe(host);
  });

  it('and the text is on the control too, for a screen reader', () => {
    render(<RibbonButton label="Short" title="A thin box" onClick={() => {}} />);
    expect(host.querySelector('button')!.getAttribute('aria-description')).toBe('A thin box');
  });
});
