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

/** The speeds worth having. Slower for learning; nothing faster than natural. */
const SPEEDS = [0.5, 0.65, 0.8, 1] as const;

export function TransportGroup(
  { audio, verseId }: { audio: Recording; verseId: string | null },
): ReactNode {
  const hasVerse = verseId !== null;
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
      <RibbonStack>
        <RibbonButton
          icon="play-verse"
          label="This verse"
          title="Play the verse the caret is in"
          disabled={!hasVerse}
          onClick={() => { if (verseId !== null) audio.playVerse(verseId); }}
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
  { doc, audio, onMap, onNote }: {
    doc: ChantDoc | null;
    audio: Recording;
    /** Runs the mapping and returns what to say about it. */
    onMap: (file: File) => void;
    onNote: (note: string) => void;
  },
): ReactNode {
  const pick = useRef<HTMLInputElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const mapped = Object.keys(doc?.recording?.byVerse ?? {}).length;

  return (
    <div className="rbg" ref={anchor} role="group" aria-label="Mapping">
      {/*
        A FILE INPUT, hidden behind a real button. The browser gives no other
        way to read a file off the disk, and its own button cannot be made to
        look like anything else in this window.
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
          void audio.open(file);
          onNote(`${file.name} opened.`);
        }}
      />
      <RibbonButton
        icon="open"
        label="Open take"
        size="lg"
        title="Choose a recording from this computer"
        onClick={() => pick.current?.click()}
      />
      <RibbonStack>
        <RibbonButton
          icon="auto-keep"
          label="Map it"
          title={audio.file === null
            ? 'Open a recording first'
            : 'Work out which second of the recording is which pāda'}
          disabled={audio.file === null}
          onClick={() => { if (audio.file !== null) onMap(audio.file); }}
        />
        {/*
          A READOUT, not a disabled button. A greyed-out control says "you may
          not press this"; this is a fact about the document and there was
          never anything to press.
        */}
        <p className="rbn__read" title="What this document already says about its audio">
          <Icon name="waveform" size="md" />
          <span>{mapped === 0 ? 'Not mapped yet' : `${mapped} verses mapped`}</span>
        </p>
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
