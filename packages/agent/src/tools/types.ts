/**
 * A TOOL, AND WHAT A HOST GIVES THE AGENT.
 *
 * A tool is a name, a schema the model fills in, and a function over the
 * workspace. It answers TEXT — short, and what the model needs to decide the
 * next step — because every character of it is read again on every later call
 * of the turn.
 *
 * THE HOST is what differs between the places the agent runs. The Word panel,
 * the desktop app and the bot on a server each say what they can do: a
 * library to look in, the web to search, the exporters that make a file, a
 * way to hand the file to the person. A tool whose capability the host lacks
 * says so instead of pretending; the modes leave such tools out.
 */
import type { ChantDoc } from '@siksamitra/format';
import type { JsonSchema, ToolSpec } from '../model.js';
import type { Workspace } from '../workspace.js';

export interface LibraryEntry {
  readonly id: string;
  readonly title: string;
  /** The śākhā or kind of text, when known. */
  readonly source?: string;
  /** `verified`: marked and checked, use as it is. `reference`: his own files. */
  readonly kind: 'verified' | 'reference';
  readonly note?: string;
}

export interface Library {
  find(query: string): Promise<readonly LibraryEntry[]>;
  load(id: string): Promise<{ readonly doc: ChantDoc; readonly kind: LibraryEntry['kind'] }>;
}

export interface SearchHit { readonly title: string; readonly url: string; readonly snippet: string }

export interface Research {
  search(query: string): Promise<readonly SearchHit[]>;
  /** A page's text, its markup removed, line by line as the page has it. */
  fetch(url: string): Promise<{ readonly title: string; readonly text: string }>;
}

export type DeliveryFormat = 'pdf' | 'docx' | 'smdoc' | 'vedaunion';

export interface Delivered {
  readonly name: string;
  readonly mime: string;
  readonly bytes: Uint8Array;
  readonly format: DeliveryFormat;
}

/** Each makes the file from the document; a host without one cannot deliver that format. */
export type Exporters = { readonly [F in DeliveryFormat]?: (doc: ChantDoc, name: string) => Promise<Delivered> };

export interface Host {
  readonly library?: Library;
  readonly research?: Research;
  readonly exporters?: Exporters;
  /** Hand a file to the person — a chat message, a download, a new Word document. */
  readonly deliver?: (file: Delivered) => Promise<void>;
}

export interface ToolContext {
  readonly ws: Workspace;
  readonly host: Host;
  /** A second agent asked to find what is wrong — see `review` in `tools/check.ts`. */
  readonly review: (task: string) => Promise<string>;
}

export interface Tool {
  readonly spec: ToolSpec;
  /** Does it change the document? A reviewer gets none that do. */
  readonly writes: boolean;
  /** Which host capability it needs, if any. */
  readonly needs?: keyof Host;
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<string>;
}

/** A tool's schema: an object of named properties, some required. */
export const params = (properties: Record<string, JsonSchema>, required: readonly string[] = []): JsonSchema => ({
  type: 'object', properties, required, additionalProperties: false,
});

export const str = (description: string): JsonSchema => ({ type: 'string', description });

/** An argument the model must have given, of the type it must be. */
export function arg<T>(args: Record<string, unknown>, name: string, type: 'string' | 'number' | 'array' | 'object'): T {
  const v = args[name];
  const is = type === 'array' ? Array.isArray(v) : type === 'object' ? (typeof v === 'object' && v !== null && !Array.isArray(v)) : typeof v === type;
  if (!is) throw new Error(`"${name}" must be a${type === 'array' || type === 'object' ? 'n' : ''} ${type}`);
  return v as T;
}

/** An argument that may be left out. */
export function opt<T>(args: Record<string, unknown>, name: string, type: 'string' | 'number' | 'array' | 'object'): T | undefined {
  return args[name] === undefined || args[name] === null ? undefined : arg<T>(args, name, type);
}
