# The Lexical spike

Run it:

```
npx esbuild tools/spike-lexical/spike.tsx --bundle --format=esm \
  --outfile=tools/spike-lexical/spike.js --loader:.tsx=tsx
cp apps/web/public/fonts/noto-serif-devanagari-devanagari-400-normal.woff2 tools/spike-lexical/
CHROME=<path> node tools/spike-lexical/run.mjs
```

`spike.js` and the font are build products and are not committed.

It exists to answer one question before the editing surface was rewritten on
Lexical: can a custom node emit this program's markup and keep selection sane?
The answer, measured, is in `openspec/changes/text-and-marks/design.md` under
"What the spike settled" — no for per-letter markup, yes for flat runs.

Keep it. When Lexical is upgraded, this is the cheapest way to find out whether
the assumptions it rests on still hold.
