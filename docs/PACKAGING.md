# Packaging

The goal is narrow and worth stating plainly: **someone who is not technical
downloads one file, double-clicks it, and has a working program.** No Node, no
Python, no fonts to install, no "run this first". Everything śikṣāmitra needs is
inside the installer.

## One command

```bash
npm run package
```

That runs every gate, copies the vendored fonts into the app, builds the web
bundle, wraps it in the Tauri shell, and prints what it produced with sizes.

```bash
npm run package -- --all           # every bundle format this host can make
npm run package -- --skip-checks   # only while iterating on the shell itself
```

## What each platform gets

| platform | files | how it installs |
| --- | --- | --- |
| Windows | `.exe` (NSIS), `.msi` | Double-click. Per-user by default, so no admin prompt. The WebView2 bootstrapper runs silently if the machine lacks it. |
| macOS | `.app`, `.dmg` | Open the dmg, drag to Applications. |
| Linux | `.deb`, `.AppImage` | `.deb` for Debian/Ubuntu; the AppImage runs anywhere, `chmod +x` and go. |

## Cross-compilation is not attempted

Deliberately, and this is the part people expect to work and it does not:

- **macOS must be built on macOS.** The toolchain is not redistributable, and a
  bundle also has to be **signed with an Apple Developer ID and notarised** or
  Gatekeeper *refuses to open it* — a refusal, not a warning, with no obvious
  way for the user to override.
- **Linux wants Linux.** An AppImage links against the libraries present at
  build time; building it elsewhere produces something that fails on the one
  machine that matters.
- **Windows can be built on Windows.** SmartScreen will warn on every download
  until either the binary earns reputation or it is signed with an Authenticode
  certificate.

So `npm run package` builds what the host can build and tells you what it did
not. Three machines, or three CI runners, produce three installers.

## What is inside

| | |
| --- | --- |
| the app | the same bundle `apps/web` serves — one implementation, not two |
| fonts | 11 families, 71 files, ~8 MB, all SIL OFL, in `assets/fonts` |
| icons | generated from one SVG by `npm run desktop:icons` |
| corpus | the sample documents, so the program opens something on first run |

**The fonts are the reason the installer is not tiny, and they are not
negotiable.** This program's subject is diacritics — `ṛ ṣ ṭ ḍ ṇ ḷ ḥ ṁ ś` — and
four Indic scripts. A face requested from the system and not found does not
error; it silently substitutes, and the reader never learns that the text they
are proofing is not the text they have. It is also what makes "1:1 with the
exported PDF" true: pagination measures glyphs, so the glyphs must be the same
on every machine.

## What the shell is allowed to reach

The window runs under a content-security policy that names every destination
rather than trusting the page:

```
connect-src  'self'  ipc:  http://ipc.localhost  https://vedaunion.org
```

`https://vedaunion.org` is there for the account, and for nothing else. It was
missing at first, and the symptom was worth recording: signing in failed with
a bare **"Failed to fetch"** — the browser refuses a blocked request the same
way it refuses an unreachable host, so a policy problem looks exactly like a
network problem. A build that points at a different server needs that origin
added here; a wildcard would defeat the whole file.

The server side already expected us: `tauri://localhost` and
`http://tauri.localhost` are on the platform's CORS allowlist, and the app
authenticates with a Bearer token rather than a cookie, which is why it is
exempt from the CSRF check without widening it.

## Signing, which is not done

Neither certificate can be produced from a repository, and both need the owner:

1. **Windows Authenticode.** Without it SmartScreen warns on every download.
   The program works; it looks untrusted.
2. **Apple Developer ID + notarisation.** Without it macOS refuses the app
   outright. This one is not cosmetic.
3. **An updater keypair** (`tauri signer generate`), whose private half must
   never enter the repository. The updater is configured and inactive.

Until then the download page must say what the user will see, so nobody meets a
SmartScreen panel unprepared.

## Icons

```bash
npm run desktop:icons
```

Generated from one SVG (`apps/desktop/scripts/icon.svg`) into every size the
three installers ask for. One source, because eleven hand-exported PNGs drift —
someone updates the 256 and forgets the 32, and the taskbar shows last year's
mark.

`icon.icns` is the exception: `iconutil` is macOS-only, so the generator writes
a 1024px PNG and the real `.icns` is produced on the Mac that builds the dmg.

## Continuous builds, and why the file names are fixed

`.github/workflows/release.yml` builds on `windows-latest`, `macos-14`,
`macos-13` and `ubuntu-22.04` — four runners because cross-compilation is not
attempted, and two Macs because Apple silicon and Intel are different binaries.

Every installer is **renamed before it is uploaded**:

| fixed name | from |
| --- | --- |
| `siksamitra-windows-setup.exe` | `nsis/*-setup.exe` |
| `siksamitra-windows.msi` | `msi/*.msi` |
| `siksamitra-macos-apple-silicon.dmg` | `dmg/*.dmg` on `macos-14` |
| `siksamitra-macos-intel.dmg` | `dmg/*.dmg` on `macos-13` |
| `siksamitra-linux.AppImage` | `appimage/*.AppImage` |
| `siksamitra-linux.deb` | `deb/*.deb` |

Tauri names its output after the product and the version, which changes with
every release and so cannot be linked to. GitHub's
`releases/latest/download/<name>` redirects to whatever the newest release
calls that name — so a fixed name is a permanent download URL, and the landing
page in `site/` never has to know a version number.

The matrix is deliberately **not** fail-fast, and the publishing job runs with
`always()`: a macOS runner that dies should not take a finished Windows
installer with it.

## What has actually been built

Honestly, so nobody is surprised:

- The shell, the configuration, the capability allowlist and the build script
  are written and committed.
- **No installer has been produced yet from this repository.** Tauri needs a
  Rust toolchain, which is not installed here. The equivalent shell was built
  and shipped for Windows from the platform repository, at 16 MB against
  Electron's 103 MB, which is the evidence for the choice of Tauri — not
  evidence that this branch's shell compiles.
- `apps/desktop/src-tauri/icons/` needs `npm run desktop:icons` run once, which
  needs `sharp` installed.

The first person with a Rust toolchain should run `npm run package` and record
what happened here.
