/**
 * THE ADD-IN'S DIALOGS — the only windows it opens besides Settings.
 *
 * A ribbon button has nowhere to speak, so what it has to SAY — a refusal, a
 * question before the whole document is re-marked, the typing help — is an
 * Office dialog (`displayDialogAsync`): a small page of ours in its own
 * window, over the document. It talks back through `messageParent`, and this
 * side hears it through `DialogMessageReceived`
 * (learn.microsoft.com/office/dev/add-ins/develop/dialog-api-in-office-add-ins).
 *
 * ONE AT A TIME. Word refuses a second dialog while one is open (12007), so a
 * press while one is showing closes it and opens the new one rather than
 * failing silently.
 */
import type { Said } from './actions.js';

/**
 * How big each window is, in PERCENT of the screen — Word's unit. Sized to fit
 * the smallest screen they must work on, a 1366 × 768 laptop, without a
 * scrollbar: measured by `tools/word-pane.mjs`, which reads this table.
 */
export const DIALOG_SIZE = {
  said: { width: 28, height: 22 },
  type: { width: 48, height: 55 },
} as const;

/** What a dialog page sends back. */
export type Reply = { ch: string; close?: boolean } | { answer: 'yes' | 'no' } | { close: true };

let open: Office.Dialog | null = null;

/** The page, beside the runtime's own, with its arguments in the query. */
const urlOf = (page: string, args: Record<string, string>): string => {
  const u = new URL(page, globalThis.location.href);
  for (const [k, v] of Object.entries(args)) u.searchParams.set(k, v);
  return u.href;
};

/**
 * Open a dialog and hand every message it sends to `heard`. Resolves when it
 * closes, whichever side closed it.
 */
export function dialog(
  page: string, args: Record<string, string>, size: { width: number; height: number },
  heard: (reply: Reply, close: () => void) => void | Promise<void>,
): Promise<void> {
  open?.close();
  open = null;
  return new Promise((done) => {
    Office.context.ui.displayDialogAsync(urlOf(page, args),
      { width: size.width, height: size.height, displayInIframe: true, promptBeforeOpen: false },
      (result) => {
        if (result.status !== Office.AsyncResultStatus.Succeeded) { done(); return; }
        const d = result.value;
        open = d;
        const close = (): void => {
          if (open === d) open = null;
          d.close();
          done();
        };
        d.addEventHandler(Office.EventType.DialogMessageReceived, (arg) => {
          if (!('message' in arg)) return;
          let reply: Reply;
          try { reply = JSON.parse(arg.message) as Reply; } catch { return; }
          void heard(reply, close);
        });
        d.addEventHandler(Office.EventType.DialogEventReceived, () => {
          if (open === d) open = null;
          done();
        });
      });
  });
}

/** Say something: one line, any detail under it, and OK. */
export async function tell(m: Said): Promise<void> {
  if (m.text === '') return;
  await dialog('said.html', { text: m.text, kind: m.kind, lines: JSON.stringify(m.lines) },
    DIALOG_SIZE.said, (_reply, close) => close());
}

/** Ask before doing something big. `true` for yes. */
export function ask(question: string, yes: string, detail = ''): Promise<boolean> {
  let answer = false;
  return dialog('said.html', { text: question, kind: 'ask', yes, lines: JSON.stringify(detail === '' ? [] : [detail]) },
    DIALOG_SIZE.said, (reply, close) => {
      answer = 'answer' in reply && reply.answer === 'yes';
      close();
    }).then(() => answer);
}
