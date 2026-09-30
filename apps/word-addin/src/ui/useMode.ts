/**
 * Word's theme, followed live — for the Settings panel and the dialogs alike.
 *
 * Office says nothing when its theme changes, so it is re-read on a timer
 * (`THEME_POLL_MS`) as well as when the system's own setting changes.
 */
import { useEffect, useState } from 'react';
import { modeOf, THEME_POLL_MS, type Mode } from './theme.js';

export function useMode(): Mode {
  const read = (): Mode => modeOf(
    typeof Office === 'undefined' ? null : Office.context?.officeTheme,
    matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const [mode, setMode] = useState<Mode>(read);
  useEffect(() => {
    const again = (): void => setMode(read());
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', again);
    const timer = window.setInterval(again, THEME_POLL_MS);
    return () => { mq.removeEventListener('change', again); window.clearInterval(timer); };
  }, []);
  return mode;
}
