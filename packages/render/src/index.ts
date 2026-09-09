/**
 * `@siksamitra/render` — the ONE renderer.
 *
 * Tokens in, marked text out: on screen, in the editor, and on paper. This is
 * the second and last package vedaunion.org depends on, and the reason it is
 * shared rather than reimplemented is the rule the whole of v2 turns on — two
 * renderers is a disagreement with no arbiter.
 *
 * Nothing here derives a mark. Everything here draws one that a document
 * already carries.
 *
 * The host contract (`RenderHostProvider`) is how an embedder supplies the
 * things a renderer cannot know: where preferences live, how to resolve an
 * asset URL, and whether the day's coordinates are available.
 *
 * Stylesheets ship beside the code and are imported by path, because a mark is
 * geometry and the geometry is generated:
 *
 *   import '@siksamitra/render/mark-geometry.css';
 *   import '@siksamitra/render/chant.css';
 *   import '@siksamitra/render/print.css';
 */

// ── the host contract ───────────────────────────────────────────────────────
export { RenderHostProvider, useRenderHost, useMemoryHost } from './host.js';
export type { RenderHost, HostCoordinates } from './host.js';

// ── reading preferences ─────────────────────────────────────────────────────
export {
  ChantScript, ChantSecondaryScript, ChantPreferences, SankalpaPreferences,
  RenderPreferences, DEFAULT_RENDER_PREFERENCES,
} from './preferences.js';

// ── variable modules (composed at render time, not stored) ──────────────────
export * from './modules/sankalpa.js';
export * from './modules/namavali.js';

// ── the surfaces ────────────────────────────────────────────────────────────
export { default as ChantReader } from './ChantReader.js';
export { ChantEmbed } from './ChantEmbed.js';
export { ChantSettings } from './ChantSettings.js';

// ── playing a mapping, the same way in the reader and in the editor ─────────
export { applyRate, SEG_LEAD, startAt } from './transport.js';
export type { StartAt } from './transport.js';

// ── the primitives the editor renders with ──────────────────────────────────
export { renderSyl, toScriptDigits } from './render/marks.js';
export { holdJoins } from './render/hold-joins.js';
export type { HoldJoin } from './render/hold-joins.js';
export type { ScriptKey } from './render/marks.js';

// ── mark palettes, generated from the one token source ──────────────────────
export * from './theme/marks.js';

/*
 * Text and markings, as the runs that draw them — the one shape the page and
 * the editing surface share. See `openspec/changes/text-and-marks`.
 */
export { toLines, toRuns } from './runs.js';
export type { Run, RunMarks } from './runs.js';
