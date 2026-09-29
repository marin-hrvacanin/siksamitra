/**
 * THE PANE'S ENTRY POINT, WHEN OFFICE IS NOT THERE.
 *
 * `taskpane.ts` is loaded by `taskpane.html` after a `<script>` for office.js,
 * which comes from Microsoft's CDN and not from this bundle. When that script
 * is blocked or the machine is offline, `Office` is not defined at all, and the
 * entry point used to throw on its first line — an empty pane, and nothing to
 * say why. These load the real module into a DOM with and without an `Office`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../apps/word-addin/src/ui/Pane.js', () => ({
  Pane: () => 'the pane was built',
}));

const ENTRY = '../../apps/word-addin/src/taskpane.tsx';

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '<div id="root"></div>';
});

afterEach(() => {
  delete (globalThis as { Office?: unknown }).Office;
});

const root = (): HTMLElement => document.getElementById('root') as HTMLElement;

describe('with no office.js', () => {
  it('says so in words, rather than leaving an empty pane', async () => {
    expect((globalThis as { Office?: unknown }).Office).toBeUndefined();
    await expect(import(ENTRY)).resolves.toBeDefined();
    expect(root().textContent).toContain('appsforoffice.microsoft.com');
    expect(root().textContent).toContain('reopen the pane');
  });
});

describe('with office.js', () => {
  function office(host: string) {
    const addHandlerAsync = vi.fn();
    (globalThis as { Office?: unknown }).Office = {
      HostType: { Word: 'Word' },
      EventType: { DocumentSelectionChanged: 'documentSelectionChanged' },
      onReady: (cb: (info: { host: string }) => void) => { cb({ host }); },
      context: { document: { addHandlerAsync } },
    };
    return addHandlerAsync;
  }

  it('draws the pane in Word — the control', async () => {
    office('Word');
    await act(async () => { await import(ENTRY); });
    expect(root().textContent).toBe('the pane was built');
  });

  it('and outside Word, says it marks Word documents', async () => {
    office('Excel');
    await import(ENTRY);
    expect(root().textContent).toContain('This is not Word');
  });
});
