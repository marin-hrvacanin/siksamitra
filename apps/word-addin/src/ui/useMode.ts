/**
 * Word's theme, followed live — for the Settings panel and the dialogs alike.
 *
 * Office says nothing when its theme changes, so it is re-read on a timer
 * (`THEME_POLL_MS`) as well as when the system's own setting changes.
 */
import { useEffect, useState } from 'react';
import { modeOf, THEME_POLL_MS, type Mode } from './theme.js';

export function useMode(): Mode {
  /* `matchMedia` is a browser's; a host without it is light unless Word says otherwise. */
  const systemDark = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  const read = (): Mode => modeOf(
    typeof Office === 'undefined' ? null : Office.context?.officeTheme,
    systemDark(),
  );
  const [mode, setMode] = useState<Mode>(read);
  useEffect(() => {
    const again = (): void => setMode(read());
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    mq?.addEventListener('change', again);
    const timer = window.setInterval(again, THEME_POLL_MS);
    return () => { mq?.removeEventListener('change', again); window.clearInterval(timer); };
  }, []);
  return mode;
}
