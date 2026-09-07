# The landing page

`marin-hrvacanin.github.io/siksamitra` — one file, no build step, no third
party. Edit `index.html` and push; `.github/workflows/pages.yml` deploys it.

## Why the download links can be hard-coded

They point at `releases/latest/download/<fixed name>`, which GitHub redirects
to whatever the newest release calls that name. `.github/workflows/release.yml`
renames every installer to a fixed name before uploading it, precisely so this
page never has to know a version number:

| link | built by |
| --- | --- |
| `siksamitra-windows-setup.exe` | `windows-latest`, NSIS |
| `siksamitra-windows.msi` | `windows-latest`, WiX |
| `siksamitra-macos-apple-silicon.dmg` | `macos-14` |
| `siksamitra-macos-intel.dmg` | `macos-13` |
| `siksamitra-linux.AppImage` | `ubuntu-22.04` |
| `siksamitra-linux.deb` | `ubuntu-22.04` |

A platform whose build failed simply has no asset of that name, and its link
404s rather than serving the wrong thing.

## The screenshots

Real, and taken by driving the program — never mocked up:

```bash
npm run dev
CHROME=<path> node tools/walkthrough.mjs --out shots
```

`?chrome=native&os=windows` is what puts the custom title bar on a screenshot
taken in a browser. Retake them when the window changes; a landing page showing
last year's toolbar is worse than one showing none.

## Fonts

`fonts/` holds four EB Garamond and four Inter files from `assets/fonts`, under
the SIL OFL. Self-hosted rather than fetched, because this page's subject is
diacritics and a face that is missing substitutes silently — and because a
landing page should not tell a third party who is reading it.
