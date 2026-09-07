/**
 * The `.smdoc` container — three flavours, one of which the v1 spec misnames.
 *
 * A v1 document is four magic bytes and a compressed JSON payload:
 *
 *   `SMDI`  the current format. The spec calls it "LZMA"; the payload actually
 *           begins `fd 37 7a 58 5a 00`, which is an **XZ stream** (LZMA2 in a
 *           container with CRCs). Measured on the owner's own Library, not
 *           taken from the spec — a decoder written to the spec would have
 *           failed on every current file.
 *   `SMDC`  the legacy format: raw zlib.
 *   neither the payload IS the JSON, from before either was added.
 *
 * DECOMPRESSION IS INJECTED. `zlib` comes from `fflate`, which this package
 * already carries; XZ needs a decoder this program does not contain, so it is
 * a capability the caller supplies. That is not ceremony: the CLI can use a
 * WASM decoder, the desktop shell can use Rust's, and the format logic stays
 * pure and testable with neither. A consumer that never opens an `SMDI` file
 * needs no decoder at all.
 */
import { unzlibSync } from 'fflate';

export type SmdocFlavour = 'xz' | 'zlib' | 'json';

/** A decoder for the one container this package cannot open on its own. */
export interface SmdocInflate {
  xz: (bytes: Uint8Array) => Promise<Uint8Array>;
}

export class SmdocError extends Error {
  constructor(message: string, readonly flavour?: SmdocFlavour) {
    super(message);
    this.name = 'SmdocError';
  }
}

const magic = (bytes: Uint8Array): string =>
  String.fromCharCode(...bytes.subarray(0, 4));

/** Which container this is, from its first four bytes. */
export function smdocFlavour(bytes: Uint8Array): SmdocFlavour {
  const head = magic(bytes);
  if (head === 'SMDI') return 'xz';
  if (head === 'SMDC') return 'zlib';
  return 'json';
}

/**
 * Refuse a payload that would decompress to something absurd.
 *
 * The same reasoning as the `.vuchant` limits: a hostile file is cheap to make
 * and this one is opened by double-clicking. Puruṣa Sūktam is the largest real
 * document at 39 MB compressed and ~52 MB of content, almost all of it base64
 * audio, so the ceiling is set above that and well below "exhausts memory".
 */
export const SMDOC_LIMITS = {
  fileBytes: 256 * 1024 * 1024,
  jsonBytes: 512 * 1024 * 1024,
} as const;

/** What a v1 document holds, before any of it is interpreted. */
export interface SmdocFile {
  version?: number;
  /** The `innerHTML` of Quill's `.ql-editor`. Presentation-coupled by design. */
  content?: string;
  meta?: { title?: string; created?: number; modified?: number; author?: string };
  styles?: unknown;
  audio?: { attachments?: { id?: string; label?: string; src?: string; startTime?: number; endTime?: number | null }[] };
}

/**
 * Read a `.smdoc` into its JSON, decompressing as the magic bytes require.
 *
 * Everything here is a REFUSAL rather than a guess: a wrong magic, a payload
 * that will not decompress, JSON that is not an object, a `content` that is not
 * a string. A v1 file is the owner's own work and a half-read one is worse than
 * an error.
 */
export async function readSmdoc(
  bytes: Uint8Array,
  inflate?: SmdocInflate,
): Promise<SmdocFile> {
  if (bytes.byteLength > SMDOC_LIMITS.fileBytes) {
    throw new SmdocError(
      `the file is ${bytes.byteLength} bytes, over the ${SMDOC_LIMITS.fileBytes} limit`,
    );
  }

  const flavour = smdocFlavour(bytes);
  let json: Uint8Array;

  if (flavour === 'json') {
    json = bytes;
  } else if (flavour === 'zlib') {
    try {
      json = unzlibSync(bytes.subarray(4));
    } catch (e) {
      throw new SmdocError(`the zlib payload would not decompress: ${String(e)}`, flavour);
    }
  } else {
    if (inflate === undefined) {
      throw new SmdocError(
        'this is an SMDI file, whose payload is an XZ stream. Pass an `xz` '
        + 'decoder — `xzInflate` in this package uses a WASM one, and the '
        + 'desktop shell can use the platform\'s.',
        flavour,
      );
    }
    try {
      json = await inflate.xz(bytes.subarray(4));
    } catch (e) {
      throw new SmdocError(`the XZ payload would not decompress: ${String(e)}`, flavour);
    }
  }

  if (json.byteLength > SMDOC_LIMITS.jsonBytes) {
    throw new SmdocError(
      `the payload decompresses to ${json.byteLength} bytes, over the limit`,
      flavour,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(json));
  } catch (e) {
    throw new SmdocError(`the payload is not JSON: ${String(e)}`, flavour);
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new SmdocError('the payload is not a JSON object', flavour);
  }

  const file = parsed as SmdocFile;
  if (typeof file.content !== 'string') {
    throw new SmdocError('the document has no `content` string', flavour);
  }
  return file;
}
