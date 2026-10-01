# The Telegram bot — Śrutidhara

`@siksamitra_srutidhara_bot`. A person on the allowed list sends a request in
their own words — *"the Puruṣa Sūktam, as the Taittirīya has it"* — and gets
the text back, found, marked by the śikṣā rules, checked and reviewed: a PDF
unless they ask for a Word file (`.docx`), a śikṣāmitra file (`.smdoc`) or the
VedaUnion website upload (`.vuchant`).

It is the agent harness (`packages/agent`, `openspec/changes/agent-harness/`)
behind a thin Telegram adapter (`apps/bot/src/telegram.ts`); what a message
does is `apps/bot/src/bot-core.ts`, tested without Telegram.

## Where it runs

The owner's VPS, in the layout its `/srv/README.md` describes:

```
/srv/apps/siksamitra-bot/
├── docker-compose.yml   a copy of apps/bot/deploy/docker-compose.yml
├── .env                 the secrets and settings — chmod 600, root only
├── data/                the spending ledger and each chat's session (uid 1000, 700)
└── src/                 a checkout of this repository, branch `bot`
```

`deploy-git-apps` (every minute) rebuilds and restarts it whenever the `bot`
branch moves; a failed build leaves the running bot as it was. To update the
bot, move the branch: `git push origin HEAD:bot`.

## Search

Two engines, asked together and their answers merged:

- **SearXNG** — `/srv/apps/searxng`, a maintained metasearch engine, on the
  `search` network that only the bot joins (`SEARXNG_URL=http://searxng:8080`
  in the bot's `.env`). The engines' parsers are its project's to keep
  working, and a refusal by one engine is routed around.
- **Exa** — a search built for finding a particular document, through its
  public MCP endpoint, as opencode searches: no key needed, `EXA_API_KEY` in
  the `.env` for higher limits.

When both have nothing, DuckDuckGo, then Bing; a refusal by every engine is
said as one, with where to go instead.

## Its settings — `/srv/apps/siksamitra-bot/.env`

See `.env.example`. The ones that matter:

| | |
|---|---|
| `DEEPSEEK_API_KEY` | the owner's key, `siksamitra-bot` on DeepSeek |
| `AGENT_MODEL` | `deepseek-flash` (DeepSeek V4.1 Flash) |
| `TELEGRAM_BOT_TOKEN` | from BotFather |
| `BOT_ALLOWED_USERS` | who may use it: `@usernames` or numeric ids, comma-separated |
| `BOT_OWNERS` | who may send `/spent` |
| `BOT_CONTACT` | whom someone not on the list is told to write to, to be added — they get one fixed message, never the model |
| `BOT_GLOBAL_LIMIT_USD` | the whole allowance, every chat together (default 5) |
| `BOT_SESSION_LIMIT_USD` / `BOT_TURN_LIMIT_USD` | per conversation / per request (1 / 0.5) |

After changing it: `cd /srv/apps/siksamitra-bot && docker compose up -d`.

## What cannot get out

- **The key and the token** live only in that `.env`, outside the code and
  outside the image (`.dockerignore`). The model never has them — they are
  in an HTTP header, not in its context — and every reply is scrubbed of
  both, of anything shaped like either, and of the server's paths, whatever
  the model writes (`scrubbed` in `bot-core.ts`).
- **Other people** are told only that the bot is private. It answers private
  chats only; in BotFather, `/setjoingroups` is disabled.
- **The server**: the web fetcher reaches only the public internet — a private
  or link-local address is refused, directly, by name or by redirect, so the
  metadata service, the host and the other containers cannot be fetched
  (`publicUrl` in `research.ts`). The container runs as an unprivileged user
  with a read-only filesystem, no capabilities, its own network (no other
  container on it), no published port, and 1 GB of memory at most.
- **What people asked**: the log keeps one line per request — a hashed chat
  tag, the steps, the cost, the formats sent, how long — and never a word of
  the request or the answer.
- **A page that tries to instruct the model** is data: the prompt says so, and
  the tools that write cannot touch anything but the open document.

## Watching it

```bash
docker logs -f siksamitra-bot                     # one line per request
tail -f /var/log/deploy-git-apps.log              # its builds
docker exec siksamitra-bot cat /data/ledger.jsonl | wc -l
```

`/spent` in Telegram (an owner only) says what has been spent.

When DeepSeek is degraded (status.deepseek.com) a request waits up to three
minutes per try, three tries, then the person is told it failed and to try
again; nothing hangs.
