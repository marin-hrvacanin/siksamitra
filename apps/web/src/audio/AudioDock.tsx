/**
 * THE STRIP UNDER THE DOCUMENT: the take, and where you are in it.
 *
 * A row of the window rather than a floating player, so it never covers the
 * last line of the page — which is exactly the line somebody is looking at
 * when they are listening to the end of a verse.
 *
 * Two rows, and the split is by what they are for. The WAVEFORM is authoring:
 * it is only there once a take has been opened, because there is nothing to
 * draw and nothing to drag before that. The BAR is listening, and it is there
 * whenever a document has audio at all — most documents in the corpus have a
 * mapping and no take on this machine.
 */
import { useEffect, type ReactNode } from 'react';
import { AudioBar } from '../shell/AudioGroup.js';
import { Waveform } from './Waveform.js';
import { seamSays, type Mapping } from './useMapping.js';
import type { Recording } from './useRecording.js';

export function AudioDock(
  { audio, mapping }: { audio: Recording; mapping: Mapping },
): ReactNode {
  const says = seamSays(mapping.padas, mapping.selected);
  const { take, followPlayhead } = mapping;

  /*
   * THE STRIP FOLLOWS THE PLAYHEAD, so a boundary being listened to does not
   * walk off the edge of it. ONLY WHILE SOMETHING IS PLAYING: moving the
   * window under a hand that is dragging a boundary is how a drag misses.
   */
  useEffect(() => {
    if (take !== null && audio.playing) followPlayhead(audio.at);
  }, [take, followPlayhead, audio.playing, audio.at]);

  return (
    <div className="adock">
      {take !== null && (
        <div className="adock__wave">
          <Waveform
            take={take}
            view={mapping.view}
            seams={mapping.seams}
            kinds={mapping.kinds}
            selected={mapping.selected}
            at={audio.at}
            says={says}
            onSelect={mapping.select}
            onDrag={mapping.drag}
            onScrub={audio.seek}
          />
          {/*
            WHAT IS SELECTED, IN WORDS, beside the picture. The strip says
            which boundary is picked by drawing it thicker, and at the zoom
            where a boundary can actually be dragged there is no verse number
            anywhere on screen to say WHICH boundary that is.
          */}
          <p className="adock__say">
            {says === null
              ? `${mapping.seams.length === 0 ? 'not mapped' : `${mapping.seams.length - 1} pādas`}`
              : says}
            {mapping.selected !== null && (
              <span className="adock__kind" data-kind={mapping.kinds[mapping.selected]}>
                {KIND_SAYS[mapping.kinds[mapping.selected] ?? 'even']}
              </span>
            )}
          </p>
        </div>
      )}
      <AudioBar audio={audio} />
    </div>
  );
}

/** The three states a boundary can be in, said rather than only coloured — a
 *  colour alone is no use to anyone who cannot tell these two apart. */
const KIND_SAYS = {
  breath: 'on a breath',
  even: 'guessed',
  hand: 'placed by hand',
  edge: 'where the take begins or ends',
} as const;
