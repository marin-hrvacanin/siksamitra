/**
 * WHAT THE ADD-IN SAYS, SAID IN THE PANEL — never in a window of its own.
 *
 * A refusal, a question before the whole document is changed, a note about
 * what a command did: these were Office dialogs, a separate window popping up
 * over the document for every one. The owner asked for the opposite — "the
 * notifications and popups can appear within that panel and therefore make
 * the whole experience cleaner". So the panel shows them, under its tabs, and
 * a command pressed on the ribbon while the panel is closed opens it to say
 * so (`word/dialog.ts`).
 *
 * A store rather than React state, because the speakers are the commands in
 * the shared runtime, which are not React. The panel subscribes.
 */
export interface Notice {
  readonly id: number;
  readonly kind: 'plain' | 'warn' | 'ask';
  readonly text: string;
  readonly lines: readonly string[];
  /** The confirming button's words, for a question. */
  readonly yes?: string;
  /** How a question is answered. */
  readonly answer?: (yes: boolean) => void;
}

let notices: readonly Notice[] = [];
let next = 1;
let attached = 0;
const listeners = new Set<() => void>();
const emit = (): void => { for (const l of listeners) l(); };

export const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};
export const currentNotices = (): readonly Notice[] => notices;

/** The panel says it is there to speak; the dialogs are the fallback when it is not. */
export function attachPanel(): () => void {
  attached += 1;
  return () => { attached -= 1; };
}
export const panelAttached = (): boolean => attached > 0;

export function notify(n: Omit<Notice, 'id'>): number {
  const id = next;
  next += 1;
  /* The same sentence twice in a row is one notice: a person pressing a
     refused button twice should not get a stack of the same refusal. */
  notices = [...notices.filter((x) => x.kind === 'ask' || x.text !== n.text), { ...n, id }];
  emit();
  return id;
}

export function dismiss(id: number, yes = false): void {
  const n = notices.find((x) => x.id === id);
  notices = notices.filter((x) => x.id !== id);
  emit();
  n?.answer?.(yes);
}

/** Ask, in the panel. Resolves when a button is pressed. */
export const confirmInPanel = (text: string, yes: string, lines: readonly string[]): Promise<boolean> =>
  new Promise((resolve) => { notify({ kind: 'ask', text, lines, yes, answer: resolve }); });
