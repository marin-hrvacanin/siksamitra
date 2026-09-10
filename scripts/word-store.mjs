#!/usr/bin/env node
/**
 * THE APPSOURCE SUBMISSION, ASSEMBLED.
 *
 *   npm run word-addin:store        # out/appsource/
 *
 * Listing an add-in in Microsoft's store is a FORM, not a command: there is no
 * API a script can push to. So this puts everything the form asks for in one
 * folder, with the answers written out, and leaves exactly two things that
 * need the owner personally — a Partner Center account with a verified
 * publisher identity, and pressing Submit.
 *
 * WHY THE ANSWERS ARE IN A FILE RATHER THAN IN A DOCUMENT SOMEWHERE. Every
 * one of them is DERIVED: the manifest comes from
 * `apps/word-addin/manifest.xml`, the version from `package.json`, the
 * platform list from what the requirement sets actually reach, the privacy
 * answer from the fact that the add-in makes no requests. Retyping them into a
 * form once is unavoidable; keeping a second copy of them that goes stale is
 * not.
 *
 * WHAT IT DOES NOT MAKE UP. AppSource wants screenshots of the add-in IN USE,
 * which means pictures of Word's own window with the pane in it. This produces
 * the pane's own picture — that is genuinely the add-in — and says plainly
 * that the one showing Word around it has to be taken once, in Word, by a
 * person. A composed picture of an application window somebody has not seen is
 * a fabrication, whatever it is for.
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  ADDIN_HOSTS, GUIDE_URL, SITE, manifestFaults, manifestFor, manifestVersion,
} from './word-addin.mjs';

const ADDIN = 'apps/word-addin';
const OUT = 'out/appsource';
/** The store lists the PUBLISHED add-in, so that is the manifest it gets. */
const HOST = ADDIN_HOSTS.pages;

const version = manifestVersion(
  JSON.parse(readFileSync(join(ADDIN, 'package.json'), 'utf8')).version,
);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

/* ── the manifest ───────────────────────────────────────────────────────── */

const xml = manifestFor(readFileSync(join(ADDIN, 'manifest.xml'), 'utf8'), HOST, version);
const faults = manifestFaults(xml, HOST);
if (faults.length > 0) {
  throw new Error(`the manifest would be rejected:\n  - ${faults.join('\n  - ')}`);
}
writeFileSync(join(OUT, 'manifest.xml'), xml, 'utf8');

/* ── the logo the listing shows ─────────────────────────────────────────── */

/**
 * 300×300, which is what the store asks for.
 *
 * Rendered from the same SVG the desktop icons come from, at a high density
 * and then resized — the way `apps/desktop/scripts/make-icons.mjs` does it, so
 * the store's picture of the program is the program's own icon and not a
 * second drawing of it.
 */
const ICON = 'apps/desktop/scripts/icon.svg';
let logo = 'not made — sharp is not installed';
if (existsSync(ICON)) {
  try {
    const { default: sharp } = await import('sharp');
    await sharp(readFileSync(ICON), { density: 384 })
      .resize(300, 300).png().toFile(join(OUT, 'logo-300.png'));
    logo = 'logo-300.png';
  } catch (e) {
    logo = `not made — ${e instanceof Error ? e.message : String(e)}`;
  }
}

/* ── a document for Microsoft's testers ─────────────────────────────────── */

/**
 * A REAL MARKED DOCUMENT, because the validator has to try the add-in on
 * something.
 *
 * A tester who opens a blank document and presses Short sees a box and learns
 * nothing about whether the add-in works; one who opens a marked document sees
 * the pane read it. This is a corpus document through this program's own `.docx`
 * exporter — the same file `check:export:word` round-trips.
 */
const SAMPLE = 'durga-suktam-veda-union.docx';
let sample = 'not made';
try {
  /*
   * `tsx`'s OWN ENTRY POINT, run by this node — not `npx` through a shell.
   * `execFileSync` with `shell: true` concatenates the arguments into a
   * command line without escaping them, which Node itself warns is a hazard
   * (DEP0190).
   *
   * `--out` is a DIRECTORY and `--docx` is a flag: the exporter names the file
   * after the document and the style. Passing a file name as `--out` made a
   * DIRECTORY called `sample-durga-suktam.docx`, which is the kind of mistake
   * that looks like it worked.
   */
  execFileSync(process.execPath, [
    'node_modules/tsx/dist/cli.mjs',
    '--tsconfig', 'tools/export/tsconfig.render.json',
    '--import', './tools/export/no-css.mjs',
    'tools/export/cli.mjs', 'corpus/chants/durga-suktam.json',
    '--docx', '--no-html', '--out', OUT,
  ], { stdio: 'ignore' });
  sample = existsSync(join(OUT, SAMPLE)) ? SAMPLE : 'not made — the exporter wrote nothing';
} catch (e) {
  sample = `not made — ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`;
}

/* ── the pane's own picture, if the gate has taken one ──────────────────── */

const SHOT = 'artifacts/word-pane/pane.png';
let shot = 'not here — run `npm run check:word:pane` first';
if (existsSync(SHOT)) {
  copyFileSync(SHOT, join(OUT, 'pane.png'));
  shot = 'pane.png';
}

/* ── the answers ────────────────────────────────────────────────────────── */

const listing = `# śikṣāmitra for Word — the AppSource listing

Everything the Partner Center form asks for. Generated by
\`npm run word-addin:store\`; do not edit this file, edit what it reads.

Manifest version **${version}**, add-in id **${HOST.id}**, served from
**${HOST.base}**.

## Files in this folder

| file | what it is |
| --- | --- |
| \`manifest.xml\` | the package to upload. \`npm run word-addin:validate\` passes it |
| \`${logo}\` | the 300×300 logo the listing shows |
| \`${shot}\` | the task pane's own picture, taken from the published page |
| \`${sample}\` | a marked document for the validator to try it on |

## Name and descriptions

**Name** (30 characters max)

    śikṣāmitra

**Short description** (100 characters max)

    Mark Vedic recitation in Word: holdings, accents, pauses — by rule, in
    your own document.

**Long description**

    śikṣāmitra marks Vedic and classical Sanskrit text for recitation, inside
    the Word document you already have.

    Put the caret in a line and the pane reads it. Press Short or Long to box
    a held syllable; the box Word draws is a character border, drawn by Word
    itself rather than a picture of one. Accents, the reading aids and the
    pauses work the same way, and every mark is a Word style you can see in
    the Styles pane, restyle, and apply by hand afterwards.

    It reads what is already marked. A document marked by hand years ago is
    transcribed as it stands — the marks come from the styles that are there
    and are never recomputed behind your back. If the pane meets something it
    cannot account for, it says so and refuses to write rather than lose it.

    The rules run when you ask for them. Choose a register — Taittirīya,
    Ṛgveda, Śukla Yajurveda, smārta or prose — and run them over the selection
    or the whole document. Marks you placed by hand are kept unless you say
    otherwise, and the pane reports any it could not carry.

    A blank document is set up in one press: "Add the styles" puts the whole
    vocabulary in and leaves nothing visible behind, or "Insert a specimen"
    puts in a short block using each style with its name beside it, to read
    once and delete.

    Nothing leaves your machine. The pane is a static page with no server
    behind it: no account, no sign-in, no analytics, and your text is never
    transmitted or stored anywhere.

    śikṣāmitra is also a desktop program for Windows, macOS and Linux, which
    reads and writes the same documents. Both are free.

## URLs

| field | value |
| --- | --- |
| Support | ${SITE}/#word |
| Privacy policy | ${SITE}/privacy.html |
| Terms of use | ${SITE}/terms.html |
| Help / learn more | ${GUIDE_URL} |
| Source | https://github.com/marin-hrvacanin/siksamitra |

## Category and audience

- **Category:** Productivity — Document management. (Second choice: Education.)
- **Industry:** Education, or Other. There is no "religious text" industry.
- **Languages:** English (the pane's own interface). The text it marks is
  Sanskrit in IAST, but the add-in's interface is English only, so declare
  English and nothing else — declaring a language the pane is not translated
  into is a validation failure.
- **Products:** Word.
- **Free**, with no in-app purchase, no licence key and no trial. There is
  nothing to buy and no account to make.

## Platforms the manifest actually reaches

Microsoft's own validator reports these, from the requirement sets in the
manifest (\`WordApi 1.3\`, and nothing higher). Claim exactly these and no
more — the store tests every platform a manifest claims.

- Word on Windows (2019 or later, and Microsoft 365)
- Word on Mac (2016 or later, 2019 or later, and Microsoft 365)
- Word on the web
- Word on iPad

## Notes for the validator

Write these into the "Testing instructions" box. Without them a tester opens a
blank document, sees five groups of buttons that all appear to do nothing
useful, and fails the submission.

    No account, no sign-in and no licence key. Nothing to configure.

    1. Open the attached sample document (${sample}). It is a marked Vedic
       text: the green boxes are held syllables, the red marks are accents.
    2. Open the pane: Home tab → śikṣāmitra → Marking.
    3. Put the caret in one of the mantra lines. The pane says where the
       caret is and how long the line is.
    4. Select two or three letters and press "Short". A thin box is drawn
       round them. Press "Short" again to take it off.
    5. Press "Long" instead for a thicker box. The two differ only in stroke
       weight, which is deliberate — that is the notation.
    6. Select a letter and press "Anudātta". A small mark appears under it.
    7. In a NEW, empty document, the "This document" group says the document
       has none of the styles. Press "Add the styles": nothing visible
       happens and the line then says all sixteen are in. Press "Insert a
       specimen" to see each style named. The specimen can be deleted; the
       styles stay.
    8. "Run over the document" asks before it acts — press it twice. It
       rewrites every mantra line in the file, which is why.

    The add-in makes no network requests of its own. It reads the paragraph
    with Word's getOoxml and writes it back with insertOoxml, both WordApi 1.1;
    Range.getRange is 1.3. Nothing is sent anywhere and nothing is stored.

## Privacy and data handling answers

- **Does the add-in collect personal data?** No.
- **Does it transmit data off the device?** No. The task pane is fetched from
  a static host; after that every operation is between the pane and the open
  document.
- **Does it use cookies or local storage?** No.
- **Does it require an account?** No.
- **Third-party services?** Only \`office.js\` from Microsoft's own CDN, which
  every Office add-in loads and which Microsoft requires be referenced from
  production rather than pinned.

## What still needs the owner

1. **A Partner Center account with a verified publisher identity.** Individual
   or company; there is an identity check behind it and it takes days. It
   cannot be delegated.
2. **One screenshot of the add-in in Word**, 1366×768: Word's window with the
   sample document open and the pane beside it. \`pane.png\` here is the pane
   itself, taken from the published page, and it is a true picture of the
   add-in — but it does not show Word around it, and a composed picture of an
   application window would be a fabrication.
3. **Decide the licence.** \`package.json\` says \`UNLICENSED\` while the
   landing page says the program is open and free. The form asks; pick one and
   make the two agree.

Until all of that is done the add-in is not unavailable — anybody can install
it from the manifest in three steps, and an organisation can deploy it to
everyone centrally from the Microsoft 365 admin centre without the store at
all. See \`docs/WORD-ADDIN.md\`.
`;

writeFileSync(join(OUT, 'LISTING.md'), listing, 'utf8');

console.log(`\n  the AppSource submission, in ${OUT}/\n`);
console.log(`  manifest.xml   ${HOST.base}  (version ${version})`);
console.log(`  logo           ${logo}`);
console.log(`  pane picture   ${shot}`);
console.log(`  sample         ${sample}`);
console.log('  LISTING.md     every field the form asks for\n');
console.log('  Two things still need you: a verified Partner Center identity,');
console.log('  and one screenshot of the pane inside Word. LISTING.md says why.\n');
