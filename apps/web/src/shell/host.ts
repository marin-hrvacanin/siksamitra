/**
 * What the program is running INSIDE, and what that lets it do.
 *
 * The same bundle is the web app and the desktop app — that is the point of
 * the architecture — so exactly one module is allowed to know the difference,
 * and everything else asks it. Without that rule the desktop's affordances
 * leak into the browser build as buttons that do nothing.
 *
 * THE DESKTOP API IS IMPORTED LAZILY, and that is not an optimisation. A
 * static `import` of `@tauri-apps/api` in a browser build ships a module whose
 * every call fails; behind a dynamic import inside a guard, a browser never
 * loads it at all and the bundle splits it out on its own.
 *
 * THE PLATFORM COMES FROM THE USER AGENT, deliberately, rather than from
 * `plugin-os`. The only thing the platform decides here is where the window's
 * buttons go, and the web view already knows which one it is: WebView2 says
 * Windows, WKWebView says Macintosh, WebKitGTK says Linux. Reading it costs
 * nothing, needs no plugin and no capability, and cannot be wrong about the
 * machine it is running on.
 */

export type HostKind = 'browser' | 'desktop';
export type Platform = 'windows' | 'macos' | 'linux' | 'unknown';

/** Whether the Tauri shell is present. Set before any React renders. */
const isDesktop = (): boolean =>
  typeof window !== 'undefined'
  && (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== undefined;

function platformOf(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macos';
  if (/Linux|X11|CrOS/i.test(ua)) return 'linux';
  return 'unknown';
}

export interface Host {
  readonly kind: HostKind;
  readonly platform: Platform;
  /**
   * Whether WE draw the window's title bar.
   *
   * True on the desktop, because the window is created without decorations —
   * a document tool's title bar carries the document's name, its save state
   * and its quick actions, and an OS caption above our own bar would be two
   * title bars stacked.
   */
  readonly ownTitleBar: boolean;
  /**
   * Whether we draw the minimise/maximise/close buttons.
   *
   * Not on macOS: there the window keeps its real traffic lights (the window
   * is decorated, with an overlay title bar style) because a macOS user's
   * muscle memory, their green-button behaviours and every accessibility tool
   * expect the system's own buttons. We leave room for them instead.
   */
  readonly ownWindowButtons: boolean;
  /** Space to leave at the start of the title bar for the system's buttons. */
  readonly captionInset: number;
}

/**
 * A DEVELOPMENT OVERRIDE, and it earns its keep.
 *
 * `?chrome=native` draws the window's title bar in a plain browser, and
 * `&os=macos|windows|linux` pretends to be that platform. The desktop shell
 * needs a Rust toolchain to build, so without this the one part of the program
 * that differs per operating system could only be looked at on three machines
 * — which in practice means it would be looked at on none, and the macOS
 * layout would be a guess. The buttons do nothing here (there is no window to
 * minimise); the LAYOUT is what this is for, and it is what the screenshots
 * check.
 */
const override = typeof location === 'undefined'
  ? null
  : new URLSearchParams(location.search);
const forced = override?.get('chrome') === 'native';
const forcedOs = override?.get('os');

export const host: Host = (() => {
  const kind: HostKind = isDesktop() ? 'desktop' : 'browser';
  const platform: Platform = forcedOs === 'macos' || forcedOs === 'windows' || forcedOs === 'linux'
    ? forcedOs
    : platformOf();
  const desktop = kind === 'desktop' || forced;
  return {
    kind,
    platform,
    ownTitleBar: desktop,
    ownWindowButtons: desktop && platform !== 'macos',
    /* 78px is the width macOS gives its three buttons plus their margins at
       the default title-bar height. Measured from a decorated window rather
       than guessed, and it is only ever used on macOS. */
    captionInset: desktop && platform === 'macos' ? 78 : 0,
  };
})();

/** What the title bar needs from the window. `null` in a browser. */
export interface WindowControls {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  /** Fires when the window is maximised or restored, by us or by the OS. */
  onResized: (fn: () => void) => Promise<() => void>;
}

let controls: Promise<WindowControls | null> | null = null;

/**
 * The window, once.
 *
 * Memoised because every caller wants the same window and the import is
 * asynchronous; a component that awaited it on each render would flicker.
 */
export function windowControls(): Promise<WindowControls | null> {
  if (controls !== null) return controls;
  if (host.kind !== 'desktop') {
    controls = Promise.resolve(null);
    return controls;
  }
  controls = (async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const w = getCurrentWindow();
      return {
        minimize: () => w.minimize(),
        toggleMaximize: () => w.toggleMaximize(),
        close: () => w.close(),
        isMaximized: () => w.isMaximized(),
        onResized: async (fn: () => void) => {
          const stop = await w.onResized(() => fn());
          return stop;
        },
      };
    } catch {
      /* A desktop shell without the window permissions is a real state: the
         title bar then draws without buttons rather than throwing on click. */
      return null;
    }
  })();
  return controls;
}
