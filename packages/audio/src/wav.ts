/**
 * READING A WAV, and nothing else.
 *
 * WHY ONLY WAV. Decoding MP3, M4A or Opus means either a codec in this
 * repository or a binary dependency, and neither belongs in a program whose
 * job is marking text. The browser already decodes everything through
 * `AudioContext.decodeAudioData`, so the EDITOR needs none of this. It exists
 * for the command line, where there is no browser — and there the answer to a
 * compressed file is `ffmpeg`, which is one line and is already on the machine
 * of anyone working with recordings.
 *
 * So: uncompressed PCM, parsed from the RIFF chunks rather than by assuming
 * the canonical 44-byte header. Recorders put `LIST` and `fact` chunks before
 * `data` and a fixed offset reads them as audio, which sounds exactly like a
 * recording that begins with a burst of noise — and put a false silence
 * boundary at the top of every mapping.
 */

export interface Decoded {
  /** Mono, -1..1. Mapping cares about loudness over time, not about stereo. */
  readonly pcm: Float32Array;
  readonly rate: number;
  readonly channels: number;
  readonly duration: number;
}

const ascii = (view: DataView, at: number): string => String.fromCharCode(
  view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3),
);

export function decodeWav(bytes: Uint8Array): Decoded {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 12 || ascii(view, 0) !== 'RIFF' || ascii(view, 8) !== 'WAVE') {
    throw new Error('not a WAV file (no RIFF/WAVE header)');
  }

  let format = 0;
  let channels = 0;
  let rate = 0;
  let bits = 0;
  let data: { at: number; length: number } | null = null;

  let at = 12;
  while (at + 8 <= bytes.length) {
    const id = ascii(view, at);
    const size = view.getUint32(at + 4, true);
    const body = at + 8;
    if (id === 'fmt ') {
      format = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      rate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
    } else if (id === 'data') {
      data = { at: body, length: Math.min(size, bytes.length - body) };
    }
    /* Chunks are word-aligned: an odd size is followed by a pad byte, and
       ignoring it walks the reader one byte into the next chunk's id. */
    at = body + size + (size % 2);
  }

  if (data === null || channels === 0 || rate === 0) throw new Error('WAV has no audio data');
  /* 1 is integer PCM, 3 is IEEE float. 0xFFFE is WAVE_FORMAT_EXTENSIBLE,
     whose real format sits in the extension — but its sample layout is the
     same, so the bit depth is enough to read it. */
  if (format !== 1 && format !== 3 && format !== 0xfffe) {
    throw new Error(`WAV format ${format} is compressed — convert it to PCM first`);
  }

  const bytesPer = bits / 8;
  const frames = Math.floor(data.length / (bytesPer * channels));
  const pcm = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    let sum = 0;
    for (let c = 0; c < channels; c += 1) {
      const off = data.at + (i * channels + c) * bytesPer;
      sum += sampleAt(view, off, bits, format);
    }
    /* Averaged to mono. A stereo take with the voice panned to one side would
       otherwise read as half as loud on the silent channel and confuse the
       threshold. */
    pcm[i] = sum / channels;
  }
  return { pcm, rate, channels, duration: frames / rate };
}

function sampleAt(view: DataView, off: number, bits: number, format: number): number {
  if (format === 3) {
    return bits === 64 ? view.getFloat64(off, true) : view.getFloat32(off, true);
  }
  switch (bits) {
    /* 8-bit WAV is UNSIGNED, alone among the depths — a quirk of the original
       format, and reading it signed makes silence look like a square wave. */
    case 8: return (view.getUint8(off) - 128) / 128;
    case 16: return view.getInt16(off, true) / 32768;
    case 24: {
      const b0 = view.getUint8(off);
      const b1 = view.getUint8(off + 1);
      const b2 = view.getUint8(off + 2);
      const raw = (b2 << 16) | (b1 << 8) | b0;
      return (raw & 0x800000 ? raw - 0x1000000 : raw) / 8388608;
    }
    case 32: return view.getInt32(off, true) / 2147483648;
    default: throw new Error(`WAV bit depth ${bits} is not one this reads`);
  }
}
