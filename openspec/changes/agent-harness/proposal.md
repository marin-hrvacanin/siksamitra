# The agent harness — one, for every place śikṣāmitra runs

## Why

The owner wants to hand work to an agent the way he hands it to a person: ask
for a text, have it found, marked, checked and delivered. He asked for it in
the Word add-in first, then in the desktop app, then for a Telegram bot other
people can use. Three programs that each grow their own agent would be three
agents to be wrong in (rule 1), so there is ONE harness and each program is a
thin host around it.

## What he asked for, in his words (2026-10-01)

Kept here so it is not lost between sessions. Every line is a requirement.

- **One centralized harness.** "Same harness for the extension, desktop app
  and in the future for that telegram bot." "It should be modular." Individual
  sessions per person; the harness is shared, the sessions are not.
- **Modes.** "Working for siksamitra document/word and also working for the
  web for export." — a DOCUMENT mode that works on the open document (Word or
  the app), and a DELIVERY mode that produces a finished document from a
  request.
- **The Telegram bot**, hosted on his VPS, "with some global spending limit":
  - only people on a list of allowed users may use it;
  - a person "simply sends the message", e.g. *"I want this particular sūkta,
    the version from this particular veda"*;
  - and gets back, **almost always a PDF**; a `.docx` or a `.smdoc` only when
    explicitly asked for; or a web document **for upload to the VedaUnion
    website** — that one named as such ("VedaUnion website upload"), because
    it is used only internally.
- **A key the person brings.** Paste an API key; provider-agnostic (OpenAI,
  DeepSeek, others). The first one tested is **DeepSeek v4.1 Flash**
  (`deepseek-flash`), with a key he provides.
- **Whose key is whose.** "The key will be only for the telegram bot running
  on my server. For the users of the Word add-in and the desktop app, they will
  have their own. This key is never shared anywhere, only here for testing and
  for my server." So the owner's key lives in `.env` (gitignored) and is read
  only by the bot and the tests; nothing that is built for anyone else — the
  web bundle, the add-in, the desktop app — may contain it, and a gate checks
  the built bundles for it. A person using the add-in or the app pastes their
  own key, kept on their own machine.
- **Cheap and token-efficient, like opencode.** Server-side prompt caching
  actually hit (a stable prefix, tools and instructions first, the changing
  part last); no document pasted whole when a range will do.
- **Subagents, and adversarial passes for verification** — one agent's result
  checked by another that is trying to find it wrong.
- **Editing done intelligently**: the agent works on the document through the
  same model and the same edit commands a person's key press runs
  (`@siksamitra/edit`, `@siksamitra/engine`), never a parallel implementation
  (rule 1, and memory "no duplicate code").
- **Its own instance of the software.** "The agentic harness should also as
  its base use the same engine that is used by the desktop app, add-in, and so
  on... So it's just like it's using its own instance of the software... So
  it's greatly deterministic, but can manually fix, adjust, write, titles,
  etc. also research in depth to find the most reliable and accurate
  version." The agent's tools are the headless SDK's commands
  (`packages/cli`), which call the same `apply`, `rerun` and exporters a key
  press calls. "So never same code twice... Clean, modular."
- From the first request (earlier the same day): find the **most authentic
  online version** of a text; **verify** it with agents checking each other;
  add **dictionary metadata** to words; "pretty much everything apart from the
  audio"; and "completely 100% confident, proper, semi-deterministic — as
  repeatable and accurate as possible".
- **Done means verified end to end** — "let me know once the AI harness is
  complete and verified working perfectly, end to end."

## What changes

- A new package, `packages/agent`: the loop, the tools, the providers, the
  budget, the sessions — no DOM, no Office, no Node built-ins, so a browser
  panel, the desktop app and a Node server all run the same code.
- Hosts, each a thin adapter: the Word add-in panel (an *Agent* tab), the
  desktop app, and `apps/bot` (Telegram, Node, his VPS).
- Delivery through the exporters that already exist (`packages/interop`):
  PDF, Word, `.smdoc`, and the VedaUnion upload format (`.vuchant`,
  `docs/INTERCHANGE.md`).

## What it does not do

- It does not mark text itself. The śikṣā rules are the engine's; the agent
  calls them. A model's opinion of where a holding goes is never written.
- It does not invent a text. A text it delivers comes from a source it names,
  or from the corpus; where it cannot find one it says so.
