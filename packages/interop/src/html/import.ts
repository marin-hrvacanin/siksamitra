/**
 * Reading a `.html` this program wrote back into a document.
 *
 * An export that cannot be opened again is a screenshot with extra steps, so
 * the reader is part of the format rather than a later idea. It ignores the
 * page entirely — the markup, the stylesheets, the fonts are all output — and
 * takes the document out of the `<script type="application/json">` block that
 * `exportHtml` put there.
 *
 * PARSED WITH A REGULAR EXPRESSION, ON PURPOSE. The usual objection to that is
 * that HTML is not regular, and it is not; but this reader is not reading HTML.
 * It is reading three blocks whose ids this program chose, whose content this
 * program escaped so that no `<` can occur inside them, and whose delimiters
 * are therefore unambiguous. Pulling in a DOM parser to find them would put a
 * dependency in a package the browser, the CLI and the desktop app all load, to
 * do less safely what six lines do here. What it will NOT do is read somebody
 * else's HTML: a file without the blocks is refused by name.
 *
 * The hash is CHECKED and reported, never used to decide what the document is.
 * `intact` says whether the document that came out still hashes to what the
 * manifest recorded — a hand-edited file is readable and honestly flagged,
 * rather than refused or silently trusted.
 */
import type { ChantDoc } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import { documentBytes, sha256Hex } from '../package.js';
import {
  HTML_FORMAT, HTML_SLOTS, HtmlError, fromBase64, type HtmlManifest,
} from './manifest.js';

export interface HtmlImport {
  manifest: HtmlManifest;
  doc: ChantDoc;
  assets: Record<string, Uint8Array>;
  /** Whether the document still hashes to the manifest's `docHash`. */
  intact: boolean;
  /** The hash of the document that came back, whether or not it matches. */
  docHash: string;
}

/** Is this one of ours? Cheap enough to run before reading a whole file. */
export function isSiksamitraHtml(text: string): boolean {
  return text.includes(`id="${HTML_SLOTS.document}"`);
}

function slot(text: string, id: string): string {
  const re = new RegExp(
    `<script type="application/json" id="${id}">([\\s\\S]*?)</script>`,
  );
  const found = re.exec(text);
  if (found === null) {
    throw new HtmlError(
      `not a śikṣāmitra HTML export: no "${id}" block. `
      + 'Only a file this program wrote can be opened; a page saved from a '
      + 'browser has the text but not the document.',
    );
  }
  return found[1]!;
}

function parse<T>(raw: string, what: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    throw new HtmlError(
      `the ${what} block is not valid JSON: ${e instanceof Error ? e.message : 'unknown'}`,
    );
  }
}

/** Read one back. */
export async function importHtml(text: string): Promise<HtmlImport> {
  const manifest = parse<HtmlManifest>(slot(text, HTML_SLOTS.manifest), 'manifest');
  if (manifest.format !== HTML_FORMAT) {
    throw new HtmlError(
      `unexpected format "${String(manifest.format)}" — expected ${HTML_FORMAT}`,
    );
  }

  /*
   * NORMALISED ON THE WAY IN, exactly as `readChantFile` and `unpackDocument`
   * do it. Not doing so is how a v2 document arrives with `items` missing and
   * every consumer downstream has to remember to check.
   */
  const doc = openChantDoc(parse<ChantDoc>(slot(text, HTML_SLOTS.document), 'document'));

  const encoded = parse<Record<string, string>>(slot(text, HTML_SLOTS.assets), 'assets');
  const assets: Record<string, Uint8Array> = {};
  for (const [name, b64] of Object.entries(encoded)) assets[name] = fromBase64(b64);

  const docHash = await sha256Hex(documentBytes(doc));
  return { manifest, doc, assets, docHash, intact: docHash === manifest.docHash };
}
