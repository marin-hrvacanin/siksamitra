/**
 * How a document names the profile that produced its marks.
 *
 * This lives in `format`, not in `engine`, and that placement is the whole
 * boundary in miniature. A document must be able to SAY which register it
 * belongs to — that is provenance, and provenance is format data. A consumer
 * that only renders (vedaunion.org) reads the name and never the rules.
 *
 * The patch is left generic on purpose. Its shape is the engine's `Profile`,
 * and typing it concretely here would drag the entire rule model into the one
 * package the platform is allowed to depend on. The engine re-exports a
 * specialised alias, so authoring code keeps full type safety and the platform
 * keeps a dependency it can actually afford.
 */

/** The registers the corpus actually uses. Document-level vocabulary. */
export type ChantProfileKey =
  | 'taittiriya'
  | 'rigveda'
  | 'sukla-yajurveda'
  | 'smarta'
  | 'prose';

/** What a profile reference looks like in a document (01 §2.1). */
export interface ChantProfileRef<Patch = Record<string, unknown>> {
  preset?: ChantProfileKey;
  patch?: Patch;
}
