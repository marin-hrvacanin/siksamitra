/**
 * THE AGENT, IN A PANEL — the same in the Word add-in and in the app.
 *
 * A conversation with Śrutidhara: ask for a text, or for a change to the one
 * open, and watch what it is doing; what it makes goes where the host puts
 * it — at the caret in Word, open in the app. The first time, the person adds
 * their own key, kept on this computer only (`settings.ts`).
 *
 * The program around it is the host's business (`Host` in the agent): this
 * component knows nothing of Word or of the app.
 */
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { ChantDoc } from '@siksamitra/format';
import { attachedNote, panelHtml, type Attachment, type Host, type Mode, type Model, type Thinking, type Tool } from '@siksamitra/agent';
import { DEFAULT_SETTINGS, type AgentSettings, type SettingsStore } from './settings.js';
import { useAgent } from './useAgent.js';

export interface AgentPanelProps {
  readonly host: Host;
  readonly mode: Mode;
  readonly store: SettingsStore;
  readonly model?: Model;
  readonly tools?: readonly Tool[];
  readonly openDoc?: () => Promise<ChantDoc | null>;
  readonly onChanged?: (doc: ChantDoc) => void;
  /** What the empty conversation says it can do. */
  readonly intro: string;
}

function Setup({ initial, onSave, onCancel }: {
  initial: AgentSettings | null;
  onSave: (s: AgentSettings) => void;
  onCancel?: () => void;
}): ReactNode {
  const [key, setKey] = useState(initial?.apiKey ?? '');
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? DEFAULT_SETTINGS.baseUrl);
  const [model, setModel] = useState(initial?.model ?? DEFAULT_SETTINGS.model);
  const [thinking, setThinking] = useState<Thinking>(initial?.thinking ?? DEFAULT_SETTINGS.thinking);
  const [limit, setLimit] = useState(String(initial?.limitUsd ?? DEFAULT_SETTINGS.limitUsd));
  const ok = key.trim() !== '' && baseUrl.trim() !== '' && model.trim() !== '' && Number(limit) > 0;
  return (
    <form
      className="agent-setup"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSave({ apiKey: key.trim(), baseUrl: baseUrl.trim(), model: model.trim(), thinking, limitUsd: Number(limit) });
      }}
    >
      <p className="agent-quiet">Your own API key — DeepSeek, or any provider of the same kind. It is kept on this computer only and sent nowhere but to that provider.</p>
      <label className="agent-field"><span>API key</span>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
      </label>
      <label className="agent-field"><span>Provider</span>
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} spellCheck={false} />
      </label>
      <label className="agent-field"><span>Model</span>
        <input value={model} onChange={(e) => setModel(e.target.value)} spellCheck={false} />
      </label>
      <label className="agent-field"><span>Thinking</span>
        <select value={thinking} onChange={(e) => setThinking(e.target.value as Thinking)}>
          <option value="off">off — quickest</option>
          <option value="low">low</option>
          <option value="high">high — most careful</option>
        </select>
      </label>
      <label className="agent-field"><span>Most one conversation may spend (USD)</span>
        <input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
      </label>
      <div className="agent-row">
        <button type="submit" className="agent-btn agent-btn--main" disabled={!ok}>Save</button>
        {onCancel !== undefined && <button type="button" className="agent-btn" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

/** A chosen file's bytes — by `FileReader` where a browser's `File` has no `arrayBuffer`. */
function bytesOf(f: File): Promise<Uint8Array> {
  if (typeof f.arrayBuffer === 'function') return f.arrayBuffer().then((b) => new Uint8Array(b));
  return new Promise((done, fail) => {
    const r = new FileReader();
    r.onload = () => done(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => fail(r.error ?? new Error(`“${f.name}” could not be read`));
    r.readAsArrayBuffer(f);
  });
}

export function AgentPanel(props: AgentPanelProps): ReactNode {
  const [settings, setSettings] = useState<AgentSettings | null>(() => props.store.load());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  /* Files chosen for the next message — kept by the host (`host.attachments`),
     named to the agent when it is sent, as the bot names what is sent to it. */
  const [attached, setAttached] = useState<readonly Attachment[]>([]);
  const [refused, setRefused] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const agent = useAgent({
    settings, host: props.host, mode: props.mode,
    ...(props.model === undefined ? {} : { model: props.model }),
    ...(props.tools === undefined ? {} : { tools: props.tools }),
    ...(props.openDoc === undefined ? {} : { openDoc: props.openDoc }),
    ...(props.onChanged === undefined ? {} : { onChanged: props.onChanged }),
  });
  const ready = props.model !== undefined || settings !== null;

  if (!ready || editing) {
    return (
      <div className="agent">
        <Setup
          initial={settings}
          onSave={(s) => { props.store.save(s); setSettings(s); setEditing(false); agent.restart(); }}
          {...(ready ? { onCancel: () => setEditing(false) } : {})}
        />
      </div>
    );
  }

  const send = (): void => {
    const notes = attached.map(attachedNote);
    const text = [draft.trim() === '' && notes.length > 0 ? 'Here is a file.' : draft, ...notes].join('\n');
    void agent.ask(text);
    setDraft('');
    setAttached([]);
  };
  const store = props.host.attachments;
  const attach = async (files: FileList | null): Promise<void> => {
    if (store === undefined || files === null) return;
    setRefused(null);
    for (const f of [...files]) {
      try {
        const a = await store.put(f.name, f.type, await bytesOf(f));
        setAttached((was) => (was.some((x) => x.id === a.id) ? was : [...was, a]));
      } catch (e) {
        setRefused(e instanceof Error ? e.message : String(e));
      }
    }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="agent">
      <div className="agent-bar">
        <span className="agent-quiet">{settings?.model ?? props.model?.id}{agent.spent > 0 ? ` · $${agent.spent.toFixed(3)}` : ''}</span>
        <span className="agent-row">
          <button type="button" className="agent-btn agent-btn--small" onClick={agent.restart} disabled={agent.busy !== null}>New conversation</button>
          <button type="button" className="agent-btn agent-btn--small" onClick={() => setEditing(true)} disabled={agent.busy !== null}>Settings</button>
        </span>
      </div>
      <div className="agent-log" aria-live="polite">
        {agent.lines.length === 0 && <p className="agent-quiet">{props.intro}</p>}
        {agent.lines.map((l, i) => (l.who === 'agent'
          /* Safe: every character escaped, seven tags, http(s) links only (`panelHtml`). */
          ? <div key={i} className="agent-line agent-md" data-who="agent" dangerouslySetInnerHTML={{ __html: panelHtml(l.text) }} />
          : <p key={i} className="agent-line" data-who={l.who}>{l.text}</p>))}
        {agent.busy !== null && <p className="agent-line agent-busy" data-who="note">{agent.busy}…</p>}
        {agent.choices !== null && agent.busy === null && (
          <div className="agent-choices" role="group" aria-label={agent.choices.question}>
            {agent.choices.options.map((c) => (
              <button type="button" key={c} className="agent-btn" onClick={() => { void agent.ask(c); }}>{c}</button>
            ))}
          </div>
        )}
      </div>
      <div className="agent-ask">
        {attached.length > 0 && (
          <div className="agent-row agent-attached" aria-label="Files to send">
            {attached.map((a) => (
              <button type="button" key={a.id} className="agent-btn agent-btn--small" title="Take it away"
                onClick={() => setAttached((was) => was.filter((x) => x.id !== a.id))}>
                {a.name} ✕
              </button>
            ))}
          </div>
        )}
        {refused !== null && <p className="agent-quiet" role="alert">{refused}</p>}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          rows={3}
          placeholder="Ask for a text, or paste one — Enter sends, Shift+Enter is a new line"
          disabled={agent.busy !== null}
        />
        <span className="agent-row">
          {store !== undefined && (
            <>
              <input ref={picker} type="file" multiple hidden
                accept=".docx,.smdoc,.vuchant,.pdf,.txt,.md,.html,.htm,.itx,.png,.jpg,.jpeg,.webp"
                onChange={(e) => { void attach(e.target.files); e.target.value = ''; }} />
              <button type="button" className="agent-btn" onClick={() => picker.current?.click()} disabled={agent.busy !== null}>+ File</button>
            </>
          )}
          <button type="button" className="agent-btn agent-btn--main" onClick={send}
            disabled={agent.busy !== null || (draft.trim() === '' && attached.length === 0)}>Send</button>
        </span>
      </div>
    </div>
  );
}
