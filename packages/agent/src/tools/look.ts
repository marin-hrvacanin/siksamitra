/**
 * SEEING THE PAGE — for a model that takes images.
 *
 * The owner, 2026-10-02: "if it supports screenshots (images) natively …
 * to like 'see' selectively, like you, Claude, do … so that it feels like a
 * proper MCP, with the ability to see everything and isn't blind." DeepSeek
 * V4.1 Flash does (api-docs.deepseek.com/guides/vision): at most 1024 tokens a
 * picture, in a user message only. So `look` asks the host for one page of
 * the document as it will print, and the loop shows it to the model with the
 * next thing it reads — once, never kept in the conversation, so a session
 * does not carry its pictures from turn to turn.
 */
import { opt, params, type Tool } from './types.js';

export const LOOK_TOOLS: readonly Tool[] = [{
  writes: false,
  needs: 'look',
  spec: {
    name: 'look',
    description: 'See one page of the document as it will print, as a picture: its type, its marks, its layout. '
      + 'Use it when the person asks how something looks, or to check a page before delivering a document whose '
      + 'look matters. About a thousand tokens a page — look at what you need, not everything.',
    parameters: params({ page: { type: 'integer', description: 'Which page, from 1.' } }),
  },
  async run(args, { ws, host, show }) {
    const page = Math.max(1, Math.round(opt<number>(args, 'page', 'number') ?? 1));
    const shot = await host.look!(ws.need(), page);
    if (show === undefined) return `page ${shot.page} of ${shot.pages} could not be shown here`;
    show(shot.png, `(the program: page ${shot.page} of ${shot.pages} of the document, as it will print)`);
    return `page ${shot.page} of ${shot.pages} — shown to you as a picture with your next message`;
  },
}];
