# Authoring — the rules, and how to work them

These are the guides for making a marked text: what the marks mean, how a
chant is written, and how a document is put together for the Word file, the
PDF and the web.

**They are copies.** The originals live in the Veda Union platform
(`app/docs/` in the vedaunion repository) and that is where they are edited.
They are here because śikṣāmitra is the program that *applies* them, and an
agent working in this repository — or anyone reading it on its own, which is
the whole point of it being a separate program — should not have to have the
platform checked out to know the rules.

If a rule here disagrees with the engine, the **engine is not automatically
right**: the guides describe his own practice, which is the thing the engine
exists to reproduce. Check it against `corpus/` and the conformance gate
before changing either.

| File | What it settles |
|---|---|
| `MARKING-RULES.md` | What every mark means and when it is placed. The reference the engine implements. |
| `AUTHORING-CHANTS.md` | Writing a chant: text, structure, translation, sources, the whole shape. |
| `AUTHORING-DOCUMENTS.md` | The document around the chants — a manual, a pūjā, a course — for Word, PDF and the web. |
| `AUTHORING-SANKALPA.md` | The saṅkalpa: composed rather than transcribed, with variables. |
| `AUTHORING-COVERS.md` | Cover art and the library's own furniture. |
| `CHANT-FORMAT.md` | The document format itself, field by field. |

## Where the program's own answers are

- `specs/` — what each part of this program is required to do.
- `docs/INTERCHANGE.md` — `.smdoc` and `.vuchant`: what is in a file and how it
  stays readable by an older version.
- `docs/AGENTS.md` — how to drive this program from a command line, which is
  the shortest path from "I have a text" to "I have a marked document".

## Keeping the copies honest

    npm run check:authoring

fails if a guide here has drifted from the one in the platform repository, and
prints the diff. It is skipped, not failed, when the platform is not checked
out beside this one — a contributor with only this repository is a supported
case, and a gate that punishes them for it would just be turned off.
