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
 * `vision`: the model takes images, so the agent may `look` at the page it made
 * (DeepSeek V4.1 Flash does — `config.ts`).
 */
export function nodeHost(root: string, deliver: (file: Delivered) => Promise<void>, vision = false): NodeHost {
  const exporters = nodeExporters();
  return {
    where: 'a Telegram chat: what you deliver is sent into the chat as a file',
    library: diskLibrary(root),
    research: webResearch(),
    exporters,
    deliver,
    ...(vision ? { look: (doc: ChantDoc, page: number) => exporters.look(doc, page) } : {}),
  };
}
