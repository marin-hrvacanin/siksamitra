/**
 * THE PERSON'S OWN KEY, KEPT ON THEIR OWN MACHINE.
 *
 * A person using the Word add-in or the app brings their own key; the
 * owner's is the bot's alone and is never in anything built for anyone else.
 * So the key lives where the person is — this webview's storage, on this
 * computer — and goes nowhere but to the provider they chose, in the request
 * header. It is not in the document, not in the add-in's settings that travel
 * with a file, and not sent to us.
 */
import { PRICES, chatCompletions, deepseek, type Model, type Price, type Thinking } from '@siksamitra/agent';

export interface AgentSettings {
  /** `https://api.deepseek.com`, or any provider speaking the chat-completions protocol. */
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey: string;
  readonly thinking: Thinking;
  /** The most one conversation may spend, in US dollars. */
  readonly limitUsd: number;
}

export const DEFAULT_SETTINGS: Omit<AgentSettings, 'apiKey'> = {
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
  thinking: 'high',
  limitUsd: 1,
};

export interface SettingsStore {
  load(): AgentSettings | null;
  save(s: AgentSettings): void;
  clear(): void;
}

/** In this webview's own storage — which can be absent or refuse, and then nothing is kept. */
export function localSettings(key = 'siksamitra.agent'): SettingsStore {
  const storage = (): Storage | null => {
    try { return globalThis.localStorage ?? null; } catch { return null; }
  };
  return {
    load() {
      try {
        const raw = storage()?.getItem(key);
        if (raw == null) return null;
        const s = JSON.parse(raw) as Partial<AgentSettings>;
        if (typeof s.apiKey !== 'string' || s.apiKey === '') return null;
        return { ...DEFAULT_SETTINGS, ...s } as AgentSettings;
      } catch { return null; }
    },
    save(s) { try { storage()?.setItem(key, JSON.stringify(s)); } catch { /* nowhere to keep it: asked again next time */ } },
    clear() { try { storage()?.removeItem(key); } catch { /* nothing kept */ } },
  };
}

/** The model the settings name. */
export function modelOf(s: AgentSettings): Model {
  return s.baseUrl.includes('deepseek.com')
    ? deepseek({ apiKey: s.apiKey, model: s.model, thinking: s.thinking, baseUrl: s.baseUrl })
    : chatCompletions({ baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.model });
}

/** What it costs — the known price, or DeepSeek Flash's for a model the table does not know. */
export const priceOf = (s: Pick<AgentSettings, 'model'>): Price => PRICES[s.model] ?? PRICES['deepseek-flash']!;
