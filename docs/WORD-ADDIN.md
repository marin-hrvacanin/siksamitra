# śikṣāmitra inside Microsoft Word

What the add-in is, how to run it, how to install it, how it is tested, and
what it takes to get it into Microsoft's store. For what it does to a document
— the styles, the marks, what Word can and cannot represent — read
`apps/word-addin/src/model/paragraph.ts`, which is where that is written down.

---

## What it is, physically

An Office add-in is **a web page Word loads over HTTPS, plus an XML manifest
naming its URLs.** There is no server, no installer and no binary. So:

- **publishing it** is copying a folder somewhere with a certificate;
- **installing it** is putting the manifest where Word looks;
- **updating it** is replacing the files in that folder.

The folder is `apps/word-addin/dist` plus one manifest, assembled by
`scripts/word-publish.mjs`. 257 kB, eight files.

---

## The three hosts

`scripts/word-addin.mjs` holds them as data — the base URL, the `<Id>` Word
keys the add-in by, and the display name. One manifest
(`apps/word-addin/manifest.xml`, the localhost one, because that is what
`office-addin-debugging` and `office-addin-manifest` want) and the published
ones are derived from it by substitution.

| host | serves from | for |
| --- | --- | --- |
| `local` | `https://localhost:3000` | development, and anybody who would rather nothing left the machine |
| `pages` | `https://marin-hrvacanin.github.io/siksamitra/word-extension` | everybody; published with the landing page |
| `vedaunion` | `https://vedaunion.org/siksamitra/word-extension` | the same folder, uploaded there |

**Each host has its own GUID.** Word keys an installed add-in by that id, so
two manifests sharing one would be the same add-in: installing the local build
would silently replace the published one and the Home-tab button would point
at whichever was registered last. With separate ids both can be installed at
once, which is what developing the add-in on the machine you also use it on
actually needs.

The substitution is **textual, not an XML rewrite**. `CT_OfficeApp` is a schema
sequence and Word reports a violation of it as an add-in that does nothing —
no error, no warning, no pane. Any library that pretty-prints or reorders the
file is a silent failure.

---

## Commands

```bash
npm run check:word-addin      # typecheck, build, and assemble all three folders
npm run word-addin:publish    # out/word-extension for GitHub Pages
npm run word-addin:publish -- --host vedaunion --out out/vu
npm run word-addin:validate   # Microsoft's own validator, over all three (needs the network)

npm run word-addin:certs      # once: a local certificate authority (Windows asks you to confirm)
npm run word-addin:serve      # https://localhost:3000, loopback only, over the BUILT folder
npm run word-addin:install                    # sideload the published one
npm run word-addin:install -- --host local    # sideload the local one
npm run word-addin:install -- --list
npm run word-addin:install -- --uninstall

npm run check:word:live       # the whole add-in against a real Word, over COM
```

`npm run -w @siksamitra/word-addin dev` is Vite over the SOURCE, for editing
the pane. `word-addin:serve` is the BUILT folder — the same bytes that get
uploaded — which is what makes "it works locally" mean "it works published".

---

## Installing it, by hand

There is no installer. Word looks in places, and putting the manifest in one
of those places **is** the installation. `scripts/word-catalog.mjs` holds the
paths; `npm run word-addin:install` does all of it.

**Windows.** A folder registered as a trusted catalog under
`HKCU\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs`: a subkey named with
a GUID, holding `Id` (the same GUID), `Url` (the folder) and `Flags` (a DWORD
`1`, meaning show it in the menu). `Flags` as a string leaves the folder
registered and invisible, with nothing written anywhere to say why. Restart
Word, then **Insert → My Add-ins → Shared Folder**.

**macOS.** No registry and no catalog: drop the manifest into
`~/Library/Containers/com.microsoft.Word/Data/Documents/wef` and restart Word.

**Word on the web.** Home → Add-ins → Upload My Add-in, and give it the
manifest.

**A whole organisation.** A Microsoft 365 administrator deploys it from the
admin centre's *Integrated apps* page with the same manifest, to everybody or
to a group. Nobody installs anything. This is the route that does not need the
store, and for an organisation it is better than the store.

The catalog folder is under `%LOCALAPPDATA%`, not in the checkout, because a
registration outlives a clone: a catalog pointing at a folder that has been
moved or renamed is an add-in that vanishes from Word's menu with no
explanation.

---

## The certificate, for the local host

`office-addin-dev-certs install` writes a local certificate authority and asks
Windows to trust it — one dialog, once. Office refuses a task pane over `http`
in development as much as in production, and reports the refusal as a blank
pane.

**It expires in 30 days.** `word-addin:serve` prints how many days are left and
refuses to start once it has gone, because a pane that loaded yesterday and is
blank today, with no error anywhere in Word, is exactly this.

The server binds `127.0.0.1` only. It is a developer's laptop on hotel and
conference networks, the manifest says `localhost`, and the certificate is
valid for nothing else.

---

## How it is tested

Rule 13: every tier that can see it.

| tier | what it holds |
| --- | --- |
| unit | `scripts/__tests__/word-addin.test.mjs` — the manifest every host gets, and the five faults that produce a blank pane rather than an error. `word-catalog.test.mjs` — the registry values, including `Flags` being a DWORD. `word-serve.test.mjs` — eight attempts to escape the served folder. `apps/word-addin/src/model/__tests__/setup.test.ts` — the style vocabulary, and that the specimen USES every style rather than merely defining it. |
| integration | `apps/word-addin/src/model/__tests__/round-trip.test.ts` — a paragraph out and back. |
| component | `tests/component/word-pane.test.ts` — what a person sees: the buttons, the document group, the confirmation on the destructive button, and that document text is displayed and never interpreted. |
| security | `tests/security/word-addin.test.ts` — OOXML injection through document text, and what the inserted package is not allowed to contain. |
| live | `npm run check:word:live` — the whole thing against a real Word, over COM. |

**The live gate is where the real faults were.** Four of them, three silent,
two corrupting the owner's own file. It is not in `npm run check` because it
needs Word installed, and it skips loudly rather than passing when there is
none — the same arrangement as the browser gates.

What it establishes that nothing else can:

1. a fresh Word document has none of the custom styles — so the pane's
   detection is answering a real question;
2. the specimen puts every one of them in (Word merges the styles an insertion
   USES, and says nothing about the rest);
3. they survive the specimen being deleted, which is the whole basis of
   *Add the styles*;
4. a marked line comes back out of Word as itself, and Word resolved it to his
   mantra style at his 16 pt;
5. **his own document is not damaged** — his real file, opened read-only, its
   mantra lines written back exactly as the add-in would and read out of Word
   again, letter for letter;
6. Word and our reader agree how many paragraphs there are, which
   `writeDocument` depends on.

`WORD_WRITE_MODE=whole` reproduces the paragraph-eating fault, so arm 6 can be
seen failing.

**A save cannot be driven from an invisible Word** on this machine: `SaveAs2`
blocks indefinitely — measured at eighteen minutes on 100% of a core, with no
dialog anywhere — and every variant blocks the same way. The gate therefore
does what the add-in does: insert, read back, never save. That is the more
faithful test in any case; Word's own save fidelity is measured by
`check:export:word`.

---

## Getting it into AppSource

The store is a **submission**, not a script, and two steps need the owner
personally. Everything else is done.

**Done:**

- the manifest passes `office-addin-manifest validate` — Microsoft's own
  acceptance-test service — for all three hosts, with no warnings;
- it reaches seven platforms: Word on Windows (2019+ and Microsoft 365), Word
  on Mac (2016+, 2019+, Microsoft 365), Word on the web, Word on iPad;
- the icons exist at 16, 32 and 80 px and are served over HTTPS from the
  published host;
- `<SupportUrl>`, `<GetStarted>` and the localisable strings are filled in;
- the add-in does not collect, transmit or store anything: it is a static page
  and every operation is local to the open document. That is the answer to the
  privacy questions in the submission form, and it is true rather than
  convenient.

**What only the owner can do:**

1. **A Microsoft Partner Center account with a verified publisher identity.**
   Individual or company, with an identity check behind it. This is the long
   pole: verification takes days, sometimes longer, and cannot be delegated.
2. **Press Submit.** The listing needs a name, a summary, a description,
   screenshots (1366×768), a 300×300 logo, a support URL, a privacy-policy URL
   and a terms-of-use URL. The last two want pages on a domain — the landing
   page can carry both.

Then Microsoft validates the add-in on every platform the manifest claims,
which is why claiming only what the requirement sets actually reach matters:
`WordApi 1.3`, and nothing higher.

**Until then it is not unavailable.** Anybody can install it from the manifest
in three steps, and an organisation can deploy it to everyone centrally
without the store at all. The store is discovery, not access.

---

## What Word cannot represent

Read `apps/word-addin/src/model/carry.ts`. In short: a Word run carries ONE
character style, so a letter that is both boxed and substituted needs a
combined style of its own, and a marking with no Word equivalent is reported
in the pane rather than dropped quietly.

And what the add-in refuses: a paragraph carrying text the reader cannot place
— an inline comment, for instance — is not written back at all, because
writing it would delete that text. The pane says so and disables nothing else.
