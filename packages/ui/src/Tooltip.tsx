/**
 * THE TOOLTIP — one layer for every control in both programs.
 *
 * It replaces the browser's `title` popup, which says one line, late, in the
 * operating system's font, and says NOTHING over a disabled button — the one
 * place a person most needs to be told something ("why can I not press
 * this?").
 *
 * A control opts in with data, not with a wrapper component:
 *
 *   data-tip   what it does            "A thin box — his Holding style."
 *   data-accel its shortcut            "Ctrl+H"
 *   data-why   why it is disabled now  "Select at least one letter."
 *
 * so a control stays one element and the ribbon's layout is untouched.
 *
 * WHY THE POINTER IS HIT-TESTED rather than listened for on the control: a
 * disabled `<button>` dispatches no pointer events at all, so a tooltip wired
 * to the button's own events can never explain why it is disabled. The layer
 * listens on the document and asks what is UNDER the pointer, which finds a
 * disabled control like any other.
 *
 * Keyboard: focusing a control shows its tip; Escape hides it. The text is
 * also exposed to assistive technology through `aria-description` on the
 * control, so the tooltip is never the only place it lives.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Tip {
  text: string;
  accel: string | null;
  why: string | null;
  box: DOMRect;
}

/** How long the pointer rests before a tip appears, and how long it lingers. */
const SHOW_MS = 450;
const HIDE_MS = 80;

function tipOf(el: Element | null): HTMLElement | null {
  return el instanceof HTMLElement ? el.closest<HTMLElement>('[data-tip]') : null;
}

function read(el: HTMLElement): Tip {
  const disabled = el.matches(':disabled, [aria-disabled="true"]');
  return {
    text: el.dataset.tip ?? '',
    accel: el.dataset.accel ?? null,
    why: disabled ? (el.dataset.why ?? null) : null,
    box: el.getBoundingClientRect(),
  };
}

/** Mount once, near the root. Everything with `data-tip` below it gets a tip. */
export function TooltipLayer(): ReactNode {
  const [tip, setTip] = useState<Tip | null>(null);
  const over = useRef<HTMLElement | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const clear = (): void => { window.clearTimeout(timer.current); };
    const later = (fn: () => void, ms: number): void => {
      clear();
      timer.current = window.setTimeout(fn, ms);
    };
    const arm = (el: HTMLElement | null, ms: number): void => {
      if (el === over.current) return;
      over.current = el;
      if (el === null) later(() => setTip(null), HIDE_MS);
      else later(() => setTip(read(el)), ms);
    };
    const onMove = (e: PointerEvent): void => {
      arm(tipOf(document.elementFromPoint(e.clientX, e.clientY)), SHOW_MS);
    };
    const onFocus = (e: FocusEvent): void => { arm(tipOf(e.target as Element), 0); };
    const onBlur = (): void => { arm(null, 0); };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { over.current = null; clear(); setTip(null); }
    };
    const onDown = (): void => { over.current = null; clear(); setTip(null); };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onDown, true);
    return () => {
      clear();
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onDown, true);
    };
  }, []);

  if (tip === null || tip.text === '') return null;
  /* Into the element that carries the theme (`data-chrome` / `data-mode`), as
     `Popover` does, or the bubble would resolve no tokens at all. */
  return createPortal(<Bubble tip={tip} />, document.querySelector('[data-chrome]') ?? document.body);
}

/** The bubble, placed below the control, flipped above and kept on screen. */
function Bubble({ tip }: { tip: Tip }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const gap = Number.parseFloat(getComputedStyle(el).getPropertyValue('--tip-gap')) || 0;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const centre = tip.box.left + tip.box.width / 2;
    const left = Math.min(Math.max(gap, centre - w / 2), Math.max(gap, vw - w - gap));
    const below = tip.box.bottom + gap;
    const top = below + h <= vh - gap ? below : Math.max(gap, tip.box.top - gap - h);
    setAt({ left, top });
  }, [tip]);

  return (
    <div
      ref={ref}
      className="tip"
      role="tooltip"
      style={at === null ? { visibility: 'hidden' } : { left: at.left, top: at.top }}
    >
      <span className="tip__text">{tip.text}</span>
      {tip.accel !== null && <kbd className="tip__accel">{tip.accel}</kbd>}
      {tip.why !== null && <span className="tip__why">{tip.why}</span>}
    </div>
  );
}

/** The attributes a control spreads to get a tip. `title` is deliberately not one. */
export function tipProps(
  text: string,
  accel?: string,
  why?: string,
): Record<string, string> {
  const props: Record<string, string> = { 'data-tip': text, 'aria-description': text };
  if (accel !== undefined) props['data-accel'] = accel;
  if (why !== undefined) props['data-why'] = why;
  return props;
}
