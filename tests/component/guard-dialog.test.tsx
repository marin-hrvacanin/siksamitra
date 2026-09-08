/**
 * THE GUARD, in a DOM.
 *
 * The pure half — what each answer means — is tested in
 * `apps/web/src/shell/__tests__/doc-file.test.ts`. What can only be tested
 * here is the part a person actually touches, and it is the part that decides
 * whether the dialog protects anything:
 *
 *   Escape must mean Cancel. It is the reflex, it is what dismisses every
 *   other dialog, and if it meant "don't save" the guard would be a faster way
 *   to lose work than no guard at all.
 *
 *   The focused button must be the safe one. Enter on an unfocused dialog goes
 *   to whatever the browser picked, which in source order would be the
 *   destructive one.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GuardDialog } from '../../apps/web/src/shell/GuardDialog.js';
import type { GuardAnswer } from '../../apps/web/src/shell/doc-file.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

/** Put the dialog on a real page, and hand back what it answered. */
function open(): { answers: GuardAnswer[]; box: HTMLElement } {
  const answers: GuardAnswer[] = [];
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <GuardDialog
        name="durga.json"
        action={{ k: 'close' }}
        onAnswer={(a) => answers.push(a)}
      />,
    );
  });
  return { answers, box: host };
}

const buttonSaying = (box: HTMLElement, text: string): HTMLButtonElement => {
  const found = [...box.querySelectorAll('button')]
    .find((b) => b.textContent?.trim() === text);
  if (found === undefined) throw new Error(`no button says "${text}"`);
  return found;
};

describe('the guard dialog', () => {
  it('names the document, so it is obvious which one is at stake', () => {
    const { box } = open();
    expect(box.textContent).toContain('durga.json');
  });

  it('says what will happen after the answer', () => {
    const { box } = open();
    expect(box.textContent).toContain('close');
  });

  it('offers exactly three answers', () => {
    const { box } = open();
    const labels = [...box.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(labels).toHaveLength(3);
    expect(labels).toContain('Save');
    expect(labels).toContain('Cancel');
  });

  it('starts with the keyboard on Save, not on the destructive answer', () => {
    const { box } = open();
    expect(document.activeElement).toBe(buttonSaying(box, 'Save'));
  });

  it('reports what was pressed', () => {
    for (const [label, expected] of [['Save', 'save'], ['Cancel', 'cancel']] as const) {
      const { answers, box } = open();
      act(() => { buttonSaying(box, label).click(); });
      expect(answers).toEqual([expected]);
      act(() => root?.unmount());
      host?.remove();
      root = null;
      host = null;
    }
  });

  it('reads Don’t save as discard, and nothing else does', () => {
    const { answers, box } = open();
    const destructive = [...box.querySelectorAll('button')]
      .find((b) => b.className.includes('danger'));
    expect(destructive?.textContent?.trim()).toMatch(/save/i);
    act(() => { destructive?.click(); });
    expect(answers).toEqual(['discard']);
  });

  it('takes Escape as Cancel', () => {
    const { answers } = open();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(answers).toEqual(['cancel']);
  });

  it('does not answer for any other key', () => {
    const { answers } = open();
    for (const key of ['Enter', 'a', 'Tab', 'Delete']) {
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });
    }
    expect(answers).toEqual([]);
  });

  it('is announced as a dialog that must be answered', () => {
    const { box } = open();
    const dialog = box.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).not.toBeNull();
  });
});
