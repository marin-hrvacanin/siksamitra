# śikṣāmitra over MCP — the engine's tools in any harness

The bot's agent and a harness such as Claude Code or opencode differ in two
ways: the model that drives them, and what the model is allowed to do. The
harness is not ours to write twice (CLAUDE.md rule 16). What is ours is what no
harness can know — so that is what is served here, over the
[Model Context Protocol](https://modelcontextprotocol.io):

- his **library** (`Library/bot-library/` on his machine) and the verified corpus;
- the **web sources** and how to read them: `fetch_page` says what kind of page
  it is, `read_witness` shows Devanāgarī in IAST as the program reads it;
- the **builder**, which holds every letter of a verse to the lines of its
  witness, and lets whole words of a source that are no part of the text be
  left out and listed;
- the **śikṣā rules**, the **proof** (the whole document as it will print, and
  what a proofreader finds on it), the **check**, and a **second reader** with
  the `.env` key's reviewer model;
- his **house style**, his documents as **examples**, the **look** of a page,
  and the **exporters** — PDF, Word, `.smdoc`, the VedaUnion package.

The same tools, the same order of work (the server's `instructions` are the
bot's own method), and the same gates: a file is not made while the check
finds an error, nor before a second reading has been answered.

## Start it

```bash
npm run --silent mcp        # stdio; nothing but the protocol on stdout
```

It reads `.env` (the key for the second reader), and writes a file it delivers
to `out/mcp/` (`SIKSAMITRA_OUT` to change it).

## Claude Code

A project server, in `.mcp.json` at the repository's root:

```json
{
  "mcpServers": {
    "siksamitra": {
      "command": "node",
      "args": ["node_modules/tsx/dist/cli.mjs", "--tsconfig", "tools/export/tsconfig.render.json",
               "--import", "./tools/export/no-css.mjs", "apps/bot/src/mcp.ts"]
    }
  }
}
```

## opencode / marincode

In `opencode.json`:

```json
{
  "mcp": {
    "siksamitra": {
      "type": "local",
      "command": ["node", "node_modules/tsx/dist/cli.mjs", "--tsconfig", "tools/export/tsconfig.render.json",
                  "--import", "./tools/export/no-css.mjs", "apps/bot/src/mcp.ts"],
      "enabled": true
    }
  }
}
```

Then ask as the bot is asked: "the sūryāṣṭottaraśatanāma stotram, with its
dhyāna and the mantras that come with it, as a PDF".

## What is tested

`apps/bot/src/__tests__/mcp.test.ts` drives the server as a client would, over
an in-memory transport: the method and the tools are offered, a page becomes a
file through the proof, the second reading and the check, and a tool that
fails says so as an error the client can read.
