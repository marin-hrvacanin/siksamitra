/**
 * THE SERVER AS A HOST — everything the agent can do on a machine of the
 * owner's: the library on disk, the web, every exporter. The Telegram bot and
 * a terminal run use this one host; only where a finished file goes differs.
 */
import type { Delivered, Host, Library, Research } from '@siksamitra/agent';
import type { ChantDoc } from '@siksamitra/format';
import { diskLibrary } from './library.js';
import { webResearch } from './research.js';
import { nodeExporters, type NodeExporters } from './exporters.js';

export interface NodeHost extends Host {
  readonly library: Library;
  readonly research: Research;
  readonly exporters: NodeExporters;
}

/**
 * `look`: the page it made, as a picture — given to the agent only when its
 * model takes pictures (`Model.sees`; the session decides, for every host).
 * `own`: where his own documents are (`library.ts`) — the server's data
 * directory; on his machine, `Library/bot-library/` when it is left out.
 */
export function nodeHost(root: string, deliver: (file: Delivered) => Promise<void>, own?: string): NodeHost {
  const exporters = nodeExporters();
  return {
    where: 'a Telegram chat: what you deliver is sent into the chat as a file',
    library: diskLibrary(root, own),
    research: webResearch(),
    exporters,
    deliver,
    look: (doc: ChantDoc, page: number) => exporters.look(doc, page),
  };
}
