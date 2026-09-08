/**
 * THE AUDIO TAB — a recitation beside its text.
 *
 * Two things happen here and they are different work, so they are different
 * groups. LISTENING is transport: play, the verse under the caret, a pāda on
 * its own, a loop and a speed — everything somebody learning a chant reaches
 * for. MAPPING is authoring: taking a take and working out which second is
 * which pāda, once, so that everything in the first group has something to
 * play.
 *
 * The tab appears whether or not the document has a recording, because "this
 * one has no audio yet" is exactly the state from which somebody adds it, and
 * hiding the tab hides the way in.
 */
import { useRef, type ReactNode } from 'react';
import type { ChantDoc } from '@siksamitra/format';
import { Icon } from '../ui/Icon.js';
import { RibbonButton, RibbonStack } from './RibbonButton.js';
import type { Recording } from '../audio/useRecording.js';
import { NUDGE, type Mapping } from '../audio/useMapping.js';

/** The speeds worth having. Slower for learning; nothing faster than natural. */
const SPEEDS = [0.5, 0.65, 0.8, 1] as const;

export function TransportGroup(
  { audio, at }: {
    audio: Recording;
    /** Where the caret is — the verse and the line it is on. */
    at: { verseId: string; line: number } | null;
  },
): ReactNode {
  return (
    <div className="rbg" role="group" aria-label="Play">
      <RibbonButton
        icon={audio.playing ? 'pause' : 'play'}
        label={audio.playing ? 'Pause' : 'Play'}
        size="lg"
        title={audio.playing ? 'Pause' : 'Play the recitation'}
        accel="Space"
        onClick={() => (audio.playing ? audio.pause() : audio.playAll())}
      />
      {/*
        THE VERSE AND THE LINE ARE BOTH HERE, and the line is the one somebody
        learning a chant reaches for: a pāda is a breath, it is the unit a
        recitation is taught in, and it is what the mapping exists to address.
        The caret already says which one.
      */}
      <RibbonStack columns={2}>
        <RibbonButton
          icon="play-verse"
          label="This verse"
          title="Play the verse the caret is in"
          disabled={at === null}
          onClick={() => { if (at !== null) audio.playVerse(at.verseId); }}
        />
        <RibbonButton
          icon="play"
          label="This line"
          title="Play the pāda the caret is on"
          disabled={at === null}
          onClick={() => { if (at !== null) audio.playPada(at.verseId, at.line); }}
        />
        <RibbonButton
          icon="loop"
          label="Loop"
          title="Repeat what is playing"
          pressed={audio.loop}
          onClick={() => audio.setLoop(!audio.loop)}
        />
        <RibbonButton
          icon="stop"
          label="Stop"
          title="Stop, and go back to the beginning"
          onClick={() => { audio.pause(); audio.seek(0); }}
        />
      </RibbonStack>
    </div>
  );
}

export function SpeedGroup({ audio }: { audio: Recording }): ReactNode {
  return (
    <div className="rbg" role="group" aria-label="Speed">
      <RibbonStack columns={2}>
        {SPEEDS.map((s) => (
          <RibbonButton
            key={s}
            label={s === 1 ? 'Natural' : `${s}×`}
            title={s === 1 ? 'The recording as it was sung' : `${s} of the recorded speed`}
            pressed={audio.rate === s}
            onClick={() => audio.setRate(s)}
          />
        ))}
      </RibbonStack>
    </div>
  );
}

export function MappingGroup(
  { doc, audio, mapping }: {
    doc: ChantDoc | null;
    audio: Recording;
    mapping: Mapping;
  },
): ReactNode {
  const pick = useRef<HTMLInputElement>(null);
  const mapped = Object.keys(doc?.recording?.byVerse ?? {}).length;

  return (
    <div className="rbg" role="group" aria-label="Mapping">
      {/*
        A FILE INPUT, hidden behind a real button. The browser gives no other
        way to read a file off the disk, and its own button cannot be made to
        look like anything else in this window.

        `audio/*` and not a list of extensions: the browser decodes whatever it
        decodes, which is more formats than this program could name, and a
        filter that guesses wrong hides the file somebody came to open.
      */}
      <input
        type="file"
        accept="audio/*"
        ref={pick}
        className="u-offscreen"
        onChange={(e) => {
          const file = e.target.files?.[0];
          /* Cleared so choosing the SAME file twice fires a change again —
             which is what somebody does after re-recording a take. */
          e.target.value = '';
          if (file === undefined) return;
          /* Two things want it and each reads it its own way: the transport
             plays it through a blob URL, the mapper decodes it to 8 kHz mono
             samples. One choice, both told. */
          void audio.open(file);
          void mapping.attach(file);
        }}
      />
      <RibbonButton
        icon="open"
        label="Open take"
        size="lg"
        title="Choose a recording from this computer"
        disabled={mapping.busy !== null}
        onClick={() => pick.current?.click()}
      />
      <RibbonStack>
        <RibbonButton
          icon="auto-keep"
          label="Map it"
          title={mapping.take === null
            ? 'Open a recording first'
            : 'Work out which second of the recording is which pāda'}
          disabled={mapping.take === null || mapping.busy !== null}
          onClick={() => { void mapping.align(); }}
        />
        {/*
          A READOUT, not a disabled button. A greyed-out control says "you may
          not press this"; this is a fact about the document and there was
          never anything to press.

          It says the GUESSES as well as the count, because that number is the
          work left: the command line prints them with a `?` and they are the
          two or three boundaries anybody actually has to look at.
        */}
        <p className="rbn__read" title="What this document already says about its audio">
          <Icon name="waveform" size="md" />
          <span>{mapped === 0 ? 'Not mapped yet' : `${mapped} verses mapped`}</span>
        </p>
        <p className="rbn__read" aria-live="polite">
          <Icon name={mapping.busy === null ? 'check' : 'history'} size="md" />
          <span>
            {mapping.busy
              ?? (mapping.take === null
                ? 'no take open'
                : `${mapping.guesses} boundary(s) guessed`)}
          </span>
        </p>
      </RibbonStack>
    </div>
  );
}

/**
 * FIXING A BOUNDARY — the two or three the mapper had to guess.
 *
 * Everything here acts on the boundary selected in the strip under the
 * document, so there is one selection and not two. Nudging and setting from
 * the playhead exist because a boundary is a hundredth of a second and a hand
 * on a mouse is not: at the zoom where a drag is precise enough, the take
 * scrolls past faster than anybody can aim.
 */
export function BoundaryGroup(
  { audio, mapping }: { audio: Recording; mapping: Mapping },
): ReactNode {
  const picked = mapping.selected !== null;
  return (
    <div className="rbg" role="group" aria-label="Boundary">
      <RibbonButton
        icon="check"
        label="Set here"
        size="lg"
        title={picked
          ? 'Move the selected boundary to where the recitation is playing'
          : 'Pick a boundary in the strip below first'}
        disabled={!picked}
        onClick={() => mapping.setFrom(audio.at)}
      />
      <RibbonButton
        icon="find"
        label="Next guess"
        size="lg"
        title={mapping.guesses === 0
          ? 'Every boundary landed on a breath'
          : 'Go to the next boundary the mapper had to guess'}
        disabled={mapping.guesses === 0}
        onClick={() => { mapping.nextGuess(); }}
      />
      <RibbonStack columns={2}>
        <RibbonButton
          icon="nudge-back"
          label="Earlier"
          title="Move the boundary back a twentieth of a second"
          disabled={!picked}
          onClick={() => mapping.nudge(-NUDGE)}
        />
        <RibbonButton
          icon="nudge-on"
          label="Later"
          title="Move the boundary on a twentieth of a second"
          disabled={!picked}
          onClick={() => mapping.nudge(NUDGE)}
        />
        <RibbonButton
          icon="zoom-in"
          label="Closer"
          title="Show fewer seconds, so a boundary can be placed accurately"
          disabled={mapping.take === null}
          onClick={() => mapping.zoom(1)}
        />
        <RibbonButton
          icon="zoom-out"
          label="Wider"
          title="Show more of the recording"
          disabled={mapping.take === null}
          onClick={() => mapping.zoom(-1)}
        />
      </RibbonStack>
    </div>
  );
}

/** The bar under the document: where you are, and how to get elsewhere. */
export function AudioBar({ audio }: { audio: Recording }): ReactNode {
  const clock = (t: number): string => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t - m * 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  return (
    <div className="abar" role="group" aria-label="Recitation">
      <button
        type="button"
        className="abar__b"
        onClick={() => (audio.playing ? audio.pause() : audio.playAll())}
        title={audio.playing ? 'Pause' : 'Play'}
        aria-label={audio.playing ? 'Pause' : 'Play'}
      >
        <Icon name={audio.playing ? 'pause' : 'play'} size="md" />
      </button>
      <span className="abar__t">{clock(audio.at)}</span>
      <input
        className="abar__seek"
        type="range"
        min={0}
        max={Math.max(0.1, audio.duration)}
        step={0.01}
        value={audio.at}
        aria-label="Position in the recitation"
        onChange={(e) => audio.seek(Number(e.target.value))}
      />
      <span className="abar__t">{clock(audio.duration)}</span>
      {/*
        WHAT IS BEING SUNG, in words. The highlight on the page says it too,
        but only while the page is showing that verse — and a long chant is
        mostly not on screen.
      */}
      <span className="abar__now">
        {audio.sung === null
          ? (audio.name ?? 'no recording')
          : `${audio.sung.verseId} · pāda ${audio.sung.line + 1}`}
      </span>
    </div>
  );
}
