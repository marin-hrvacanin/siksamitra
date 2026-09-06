import type { ChantFeatures } from "@siksamitra/format";
import type { ChantPreferences, ChantScript, ChantSecondaryScript } from "./preferences.js";

/**
 * Reusable, controlled chant-rendering controls. One source of truth for BOTH
 * the platform settings (Profile → Preferences, bound to the account prefs) and
 * the embeddable chant container's floating settings panel (bound to a per-view
 * override). Pass the current `value` and an `onChange` that receives a partial
 * patch; the caller decides where it's persisted.
 */

const SCRIPTS: { value: ChantScript; label: string }[] = [
  { value: "iast", label: "IAST (Roman)" },
  { value: "devanagari", label: "Devanāgarī" },
  { value: "telugu", label: "Telugu" },
  { value: "tamil", label: "Tamil" },
];
const SECONDARY: { value: ChantSecondaryScript; label: string }[] = [
  { value: "none", label: "None" },
  ...SCRIPTS,
];
const FONT_SIZES: { value: number; label: string }[] = [
  { value: 0.9, label: "Small" },
  { value: 1, label: "Normal" },
  { value: 1.15, label: "Large" },
  { value: 1.3, label: "Extra large" },
];

function nearestFont(scale: number): number {
  return FONT_SIZES.reduce((a, b) => (Math.abs(b.value - scale) < Math.abs(a.value - scale) ? b : a)).value;
}

/**
 * The speed stops. A range input positions its value LINEARLY, so on the old
 * 0.5–2 continuous slider `1×` sat at (1−0.5)/(2−0.5) = 33% of the track while
 * the `1×` label underneath sat at 50% — the thumb and its own label disagreed
 * by a sixth of the width, which is what made the control feel broken.
 *
 * Eleven discrete stops with `1×` in the middle fixes it at the source: index 5
 * of 10 is exactly 50%, so the three labels (0.5× / 1× / 2×) land on the values
 * they name. Discrete also means every stop is a clean one-decimal number, so
 * the read-out is exact rather than 1.2999999, and it is far easier to hit `1×`
 * with a thumb on a phone than it was to land on it in a continuous range.
 */
const SPEEDS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.2, 1.4, 1.6, 1.8, 2] as const;

/** Nearest stop to a stored value — a preference saved by the older continuous
 *  slider (1.3, say) must still show the thumb in the right place. */
function speedIndex(v: number): number {
  let best = 0;
  for (let i = 1; i < SPEEDS.length; i++) {
    if (Math.abs(SPEEDS[i]! - v) < Math.abs(SPEEDS[best]! - v)) best = i;
  }
  return best;
}

export function ChantSettings({
  value,
  onChange,
  idPrefix = "chant",
  features,
}: {
  value: ChantPreferences;
  onChange: (patch: Partial<ChantPreferences>) => void;
  idPrefix?: string;
  features?: ChantFeatures;
}) {
  const id = (k: string) => `${idPrefix}-${k}`;
  const canAudio = features?.audio !== false;
  const canGrammar = features?.grammar !== false;
  const canTranslation = features?.translation !== false;
  return (
    <div className="chant-settings">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        <label className="sk-field" htmlFor={id("primary")}>
          <span className="sk-label">Primary script</span>
          <select
            id={id("primary")}
            className="sk-input"
            value={value.primaryScript}
            onChange={(e) => onChange({ primaryScript: e.target.value as ChantScript })}
          >
            {SCRIPTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>

        <label className="sk-field" htmlFor={id("secondary")}>
          <span className="sk-label">Secondary script</span>
          <select
            id={id("secondary")}
            className="sk-input"
            value={value.secondaryScript}
            onChange={(e) => onChange({ secondaryScript: e.target.value as ChantSecondaryScript })}
          >
            {SECONDARY.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>

        <label className="sk-field" htmlFor={id("size")}>
          <span className="sk-label">Text size</span>
          <select
            id={id("size")}
            className="sk-input"
            value={nearestFont(value.fontScale)}
            onChange={(e) => onChange({ fontScale: Number(e.target.value) })}
          >
            {FONT_SIZES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>

        {canAudio ? (
        <label className="sk-field" htmlFor={id("mode")}>
          <span className="sk-label">Mode</span>
          <select
            id={id("mode")}
            className="sk-input"
            value={value.mode}
            onChange={(e) => onChange({ mode: e.target.value as ChantPreferences["mode"] })}
          >
            <option value="read">Read</option>
            <option value="practice">Practice (hide translation)</option>
          </select>
        </label>
        ) : null}
      </div>

      {canAudio ? (
      <label className="sk-field chant-speed" htmlFor={id("speed")}>
        <span className="sk-label">
          Audio speed
          <span className="chant-speed__val">{(value.audioSpeed ?? 1).toFixed(1)}×</span>
        </span>
        <input
          id={id("speed")}
          className="chant-speed__range"
          type="range"
          min={0}
          max={SPEEDS.length - 1}
          step={1}
          value={speedIndex(value.audioSpeed ?? 1)}
          onChange={(e) => onChange({ audioSpeed: SPEEDS[Number(e.target.value)] ?? 1 })}
          aria-label="Audio playback speed"
          aria-valuetext={`${(value.audioSpeed ?? 1).toFixed(1)}×`}
        />
        <span className="chant-speed__ticks" aria-hidden>
          <span>0.5×</span><span>1×</span><span>2×</span>
        </span>
      </label>
      ) : null}

      <div className="chant-settings-toggles">
        <label className="vu-check-row">
          <input
            type="checkbox"
            className="vu-check"
            checked={value.marks}
            onChange={(e) => onChange({ marks: e.target.checked })}
          />
          <span>Recitation marks <span className="vu-check-note">svara, holdings, anusvāra</span></span>
        </label>
        {canTranslation ? (
        <label className="vu-check-row">
          <input
            type="checkbox"
            className="vu-check"
            checked={value.translation}
            onChange={(e) => onChange({ translation: e.target.checked })}
          />
          <span>Translation <span className="vu-check-note">English sense under each verse</span></span>
        </label>
        ) : null}
        {canGrammar ? (
        <label className="vu-check-row">
          <input
            type="checkbox"
            className="vu-check"
            checked={value.grammar}
            onChange={(e) => onChange({ grammar: e.target.checked })}
          />
          <span>Word grammar <span className="vu-check-note">tap a word for its parse</span></span>
        </label>
        ) : null}
        {canAudio ? (
        <label className="vu-check-row">
          <input
            type="checkbox"
            className="vu-check"
            checked={value.audio}
            onChange={(e) => onChange({ audio: e.target.checked })}
          />
          <span>Audio <span className="vu-check-note">per-verse recitation play buttons</span></span>
        </label>
        ) : null}
      </div>
    </div>
  );
}
