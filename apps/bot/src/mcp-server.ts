/**
 * ŚIKṢĀMITRA OVER THE MODEL CONTEXT PROTOCOL — the engine's tools, for any harness.
 *
 * The owner (2026-10-02): "it should be a proper harness, just like the one I
 * am using with you … Why are we reinventing the wheel … Maybe for the
 * siksamitra engine, like an SDK or an MCP". The harness is not ours to
 * write twice (CLAUDE.md rule 16): Claude Code, opencode — his marincode —
 * Claude Desktop, any MCP client, already decide for themselves what to read,
 * what to look at and what to change. What is ours is what they cannot know:
 * his library, the scholarly sources and how to read them, a builder that
 * holds every letter to its witness, the śikṣā rules, the proof, the check, a
 * second reader, his house style, the exporters and the look of his page.
 * Those are served here — the very tools the bot's agent has, over one
 * workspace — so a document any of them makes is held to exactly what the
 * bot's is, and goes out through the same gates.
 *
 * `mcpServer` is the server; `mcp.ts` gives it a machine's host and stdio.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { systemFor, toolsFor, withoutPaths, type Host, type Session, type ToolContext } from '@siksamitra/agent';

/** Bytes as base64, for a picture in a tool's answer. */
const base64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

/**
 * The server over a session's workspace. `session` keeps the document and its
 * witnesses between calls, and reads a document a second time with its
 * reviewer's model; `host` is what the tools may do on this machine.
 */
export function mcpServer(o: { readonly session: Session; readonly host: Host; readonly version: string }): Server {
  const tools = toolsFor('deliver', o.host);
  const byName = new Map(tools.map((t) => [t.spec.name, t]));
  /* What the bot's agent is told, the method and the rules, is how a client
     is told to use these tools: the same order, the same gates. */
  const server = new Server(
    { name: 'siksamitra', version: o.version },
    { capabilities: { tools: {} }, instructions: systemFor('deliver', o.host) },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.spec.name,
      description: t.spec.description,
      inputSchema: t.spec.parameters as { type: 'object'; properties?: Record<string, object>; required?: string[] },
    })),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = byName.get(req.params.name);
    if (tool === undefined) return { content: [{ type: 'text' as const, text: `there is no tool "${req.params.name}"` }], isError: true };
    /* A page the tool shows (`look`, `view_attachment`) comes back as a picture beside its answer. */
    const shown: { data: string; mimeType: string }[] = [];
    const ctx: ToolContext = {
      ws: o.session.ws,
      host: o.host,
      review: (task) => o.session.secondReading(task),
      show: (image, _caption, mime = 'image/png') => { shown.push({ data: base64(image), mimeType: mime }); },
    };
    try {
      const text = await tool.run((req.params.arguments ?? {}) as Record<string, unknown>, ctx);
      return { content: [{ type: 'text' as const, text }, ...shown.map((s) => ({ type: 'image' as const, ...s }))] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `error: ${withoutPaths(e instanceof Error ? e.message : String(e))}` }], isError: true };
    }
  });
  return server;
}
