/**
 * THE PAGE WORD KEEPS LOADED, WHEN OFFICE IS NOT THERE — and when it is.
 *
 * `taskpane.tsx` is loaded by `taskpane.html` after a `<script>` for office.js,
 * which comes from Microsoft's CDN and not from this bundle. When that script
 * is blocked or the machine is offline, `Office` is not defined at all, and a
 * page that assumed it threw on its first line: an empty panel, and nothing to
 * say why. These load the real module into a DOM with and without an `Office`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const registered = vi.fn();
vi.mock('../../apps/word-addin/src/runtime.js', () => ({ registerAll: () => registered() }));
vi.mock('../../apps/word-addin/src/ui/Settings.js', () => ({ Settings: () => 'the settings were drawn' }));

const ENTRY = '../../apps/word-addin/src/taskpane.tsx';

beforeEach(() => {
  vi.resetModules();
  registered.mockClear();
  document.body.innerHTML = '<div id="root"></div>';
});
afterEach(() => { delete (globalThis as { Office?: unknown }).Office; });

const root = (): HTMLElement => document.getElementById('root') as HTMLElement;

describe('with no office.js', () => {
  it('says so in words, rather than leaving an empty panel', async () => {
    await expect(import(ENTRY)).resolves.toBeDefined();
    expect(root().textContent).toContain('appsforoffice.microsoft.com');
    expect(root().textContent).toContain('restart Word');
    expect(registered).not.toHaveBeenCalled();
  });
});

describe('with office.js', () => {
  const office = (host: string): void => {
    (globalThis as { Office?: unknown }).Office = {
      HostType: { Word: 'Word' },
      onReady: (cb: (info: { host: string }) => void) => { cb({ host }); },
    };
  };

  it('in Word, registers every command and draws Settings', async () => {
    office('Word');
    await act(async () => { await import(ENTRY); });
    expect(registered).toHaveBeenCalledOnce();
    expect(root().textContent).toBe('the settings were drawn');
  });

  it('outside Word, says it marks Word documents, and registers nothing', async () => {
    office('Excel');
    await import(ENTRY);
    expect(root().textContent).toContain('This is not Word');
    expect(registered).not.toHaveBeenCalled();
  });
});
