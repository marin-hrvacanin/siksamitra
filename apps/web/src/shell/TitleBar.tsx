/**
 * The window's own title bar — ours, not the operating system's.
 *
 * WHY OURS. A document tool's title bar is part of the tool: it carries the
 * document's name, whether it has unsaved changes, and the actions you reach
 * for without thinking. Word, VS Code and every editor of this kind draw their
 * own for that reason. An OS caption above our bar would be two title bars,
 * and the document would start 60 px lower for nothing.
 *
 * THREE PLATFORMS, ONE BAR, and the differences are exactly the conventions
 * that matter:
 *
 *   Windows   we draw minimise / maximise / close at the RIGHT, in the
 *             platform's own hairline glyphs on a 10-unit grid, with the
 *             close button turning red on hover — because that is what every
 *             other window on that desktop does.
 *   Linux     the same, since GTK's own client-side decorations put them there
 *             too. (A GNOME user with buttons on the left is a real
 *             configuration; it is read from the desktop's settings by the
 *             shell in a later pass, not guessed at here.)
 *   macOS     we draw NONE. The window keeps its real traffic lights — the
 *             window is decorated with an overlay title-bar style — because a
 *             macOS user's muscle memory, the green button's full-screen
 *             behaviour and every accessibility tool expect the system's own.
 *             We leave 78 px at the start for them and put nothing there.
 *   a browser nothing renders at all; the browser has a title bar already.
 *
 * DRAGGING is `data-tauri-drag-region`, which hands the gesture to the native
 * move loop. That matters for more than tidiness: it is what makes Aero Snap,
 * snap layouts, double-click-to-maximise and Mission Control work. A
 * JavaScript drag that moved the window by setting its position would break
 * all four. Interactive children opt out with `data-no-drag`.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Icon } from '../ui/Icon.js';
import { host, windowControls } from './host.js';

/** The window's maximised state, kept in step with the OS. */
function useMaximized(): boolean {
  const [max, setMax] = useState(false);
  useEffect(() => {
    if (!host.ownWindowButtons) return;
    let stop: (() => void) | undefined;
    let live = true;
    void (async () => {
      const w = await windowControls();
      if (w === null || !live) return;
      const read = (): void => { void w.isMaximized().then((v) => { if (live) setMax(v); }); };
      read();
      /* Not only after OUR button: the window is also maximised by a snap
         gesture, a double-click on the bar, and Win+Up. The restore glyph has
         to follow the window, not our last click. */
      stop = await w.onResized(read);
    })();
    return () => { live = false; stop?.(); };
  }, []);
  return max;
}

export function TitleBar(
  { title, subtitle, leading, trailing }: {
    /** The document's name — the most useful thing a title bar can say. */
    title: string;
    /** What it is, or where it came from. Shown when there is room. */
    subtitle?: string;
    /** The application menu button and quick actions. */
    leading?: ReactNode;
    /** Anything that belongs before the window buttons. */
    trailing?: ReactNode;
  },
): ReactNode {
  const max = useMaximized();
  const act = useCallback((what: 'min' | 'max' | 'close') => () => {
    void windowControls().then((w) => {
      if (w === null) return;
      if (what === 'min') return w.minimize();
      if (what === 'max') return w.toggleMaximize();
      return w.close();
    });
  }, []);

  if (!host.ownTitleBar) return null;

  return (
    <div
      className="tbar"
      data-platform={host.platform}
      data-tauri-drag-region
      style={host.captionInset > 0 ? { paddingLeft: `${host.captionInset}px` } : undefined}
    >
      <div className="tbar__lead" data-no-drag>{leading}</div>

      {/*
        The name, centred like Word's. `data-tauri-drag-region` on the text too:
        the middle of a title bar is the part people grab, and a label that
        swallowed the gesture would leave a dead strip across the window.
      */}
      <div className="tbar__name" data-tauri-drag-region>
        <span className="tbar__title">{title}</span>
        {subtitle !== undefined && subtitle !== '' && (
          <span className="tbar__sub">{subtitle}</span>
        )}
      </div>

      <div className="tbar__trail" data-no-drag>{trailing}</div>

      {host.ownWindowButtons && (
        <div className="wctl" data-no-drag>
          <button
            type="button"
            className="wctl__b"
            onClick={act('min')}
            aria-label="Minimise"
            title="Minimise"
          >
            <Icon name="win-min" size="sm" />
          </button>
          <button
            type="button"
            className="wctl__b"
            onClick={act('max')}
            aria-label={max ? 'Restore' : 'Maximise'}
            title={max ? 'Restore' : 'Maximise'}
          >
            <Icon name={max ? 'win-restore' : 'win-max'} size="sm" />
          </button>
          <button
            type="button"
            className="wctl__b wctl__b--close"
            onClick={act('close')}
            aria-label="Close"
            title="Close"
          >
            <Icon name="win-close" size="sm" />
          </button>
        </div>
      )}
    </div>
  );
}
