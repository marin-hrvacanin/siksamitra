/**
 * ONE CONVERSATION WITH THE AGENT — the session behind the panel.
 *
 * The harness is `@siksamitra/agent`; this keeps one `Session` for as long as
 * the conversation lasts, says what the agent is doing while it works (in the
 * words of `TOOL_LABELS`), counts what it has cost, and turns a failure into a
 * sentence a person can act on. "New conversation" is a new session.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChantDoc } from '@siksamitra/format';
import {
  ModelError, OverBudget, Session, TOOL_LABELS, memoryLedger, withoutPaths,
  type Host, type Mode, type Model, type Tool,
} from '@siksamitra/agent';
import { modelOf, priceOf, type AgentSettings } from './settings.js';

export interface ChatLine {
  readonly who: 'person' | 'agent' | 'note';
  readonly text: string;
}

export interface AgentOptions {
  readonly settings: AgentSettings | null;
  readonly host: Host;
  readonly mode: Mode;
  /** A model of the host's own — a test's. Otherwise the settings name one. */
  readonly model?: Model;
  readonly tools?: readonly Tool[];
  /** Document mode: the document open now, given to the agent before each question. */
  readonly openDoc?: () => Promise<ChantDoc | null>;
  /** Document mode: the document as the agent left it. */
  readonly onChanged?: (doc: ChantDoc) => void;
}

/** A failure as the person is told it. */
export function failureText(e: unknown, limit: number): string {
  if (e instanceof OverBudget) return `This conversation has reached its limit of $${limit.toFixed(2)}. Start a new one to go on.`;
  if (e instanceof ModelError) {
    if (e.status === 401 || e.status === 403) return 'The provider refused the key. Check it in the settings.';
    if (e.status === 402) return 'The provider says the account has no credit left.';
    if (e.status === 408) return 'The model did not answer in time — the provider may be busy. Try again in a while.';
    if (e.status === 429) return 'The provider is limiting requests just now. Try again in a minute.';
  }
  return `That did not finish: ${withoutPaths(e instanceof Error ? e.message : String(e)).slice(0, 200)}`;
}

let seq = 0;

export interface Choices { readonly question: string; readonly options: readonly string[] }

export function useAgent(o: AgentOptions) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [spent, setSpent] = useState(0);
  const [choices, setChoices] = useState<Choices | null>(null);
  const session = useRef<Session | null>(null);
  const ledger = useRef(memoryLedger());
  /* The host as the program gave it, and the panel's own buttons for choices. */
  const host = useMemo<Host>(() => ({ ...o.host, choose: (question, options) => setChoices({ question, options }) }), [o.host]);

  const fresh = useCallback((): Session | null => {
    const model = o.model ?? (o.settings === null ? null : modelOf(o.settings));
    if (model === null) return null;
    seq += 1;
    return new Session({
      id: `panel-${seq}`, mode: o.mode, model, price: priceOf({ model: model.id }), host,
      ledger: ledger.current, limits: { session: o.settings?.limitUsd ?? 1 },
      ...(o.tools === undefined ? {} : { tools: o.tools }),
      onEvent: (e) => {
        if (e.kind === 'tool') setBusy(TOOL_LABELS[e.name] ?? 'Working');
        if (e.kind === 'usage') setSpent((n) => n + e.cost);
      },
    });
  }, [o.model, o.settings, o.mode, host, o.tools]);

  const ask = useCallback(async (text: string): Promise<void> => {
    const said = text.trim();
    if (said === '' || busy !== null) return;
    session.current ??= fresh();
    const s = session.current;
    if (s === null) { setLines((l) => [...l, { who: 'note', text: 'Add your API key in the settings first.' }]); return; }
    setLines((l) => [...l, { who: 'person', text: said }]);
    setChoices(null);
    setBusy('Thinking');
    try {
      if (o.openDoc !== undefined) {
        const doc = await o.openDoc();
        if (doc !== null && doc !== s.ws.doc) s.ws.open(doc, 'author');
      }
      const before = s.ws.doc;
      const done = await s.ask(said);
      setLines((l) => [...l, { who: 'agent', text: done.text || 'Done.' }]);
      const after = s.ws.doc;
      if (o.onChanged !== undefined && after !== null && after !== before) o.onChanged(after);
    } catch (e) {
      setLines((l) => [...l, { who: 'note', text: failureText(e, o.settings?.limitUsd ?? 1) }]);
    } finally {
      setBusy(null);
    }
  }, [busy, fresh, o]);

  const restart = useCallback(() => {
    session.current = null;
    ledger.current = memoryLedger();
    setLines([]);
    setSpent(0);
    setChoices(null);
  }, []);

  return { lines, busy, spent, choices, ask, restart };
}
