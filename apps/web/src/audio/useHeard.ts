/**
 * CAN THE DOCUMENT'S RECITATION ACTUALLY BE HEARD?
 *
 * A document can name a recording that is not there: Durgā Sūktam's clips
 * live under `/tests/durga-suktam/audio/`, which the development server
 * serves and the desktop app does not ship. The dock used to appear for any
 * document that named clips, and so sat at the foot of the window empty, with
 * buttons that did nothing — the owner: "the audio bar IS appearing but it's
 * empty". It appears only once the first clip has loaded far enough to have a
 * length.
 */
import { useEffect, useState } from 'react';

export function useHeard(src: string | null): boolean {
  const [heard, setHeard] = useState(false);
  useEffect(() => {
    setHeard(false);
    if (src === null || typeof Audio === 'undefined') return undefined;
    const probe = new Audio();
    probe.preload = 'metadata';
    const yes = (): void => setHeard(true);
    const no = (): void => setHeard(false);
    probe.addEventListener('loadedmetadata', yes);
    probe.addEventListener('error', no);
    probe.src = src;
    return () => {
      probe.removeEventListener('loadedmetadata', yes);
      probe.removeEventListener('error', no);
      probe.removeAttribute('src');
      probe.load();
    };
  }, [src]);
  return heard;
}
