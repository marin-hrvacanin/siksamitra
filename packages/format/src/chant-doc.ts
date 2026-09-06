/**
 * The chant-document API contract — Zod first, types derived.
 *
 * One definition per shape, so the client's type and the server's validation
 * cannot drift apart. See specs/chant-editor/05-PLATFORM.md §3.2 and
 * 06-SINGLE-SOURCE.md §3.4.
 */
import { z } from 'zod';

export const ChantDocStatus = z.enum(['draft', 'review', 'published', 'archived']);
export type ChantDocStatus = z.infer<typeof ChantDocStatus>;

export const ChantDocVisibility = z.enum(['public', 'members']);
export type ChantDocVisibility = z.infer<typeof ChantDocVisibility>;

/**
 * One row of the section index the manifest carries.
 *
 * The editor's outline is built from this, so a 1.73 MB document shows its
 * whole structure without loading a single section's text.
 */
export const ChantSectionIndexEntry = z.object({
  id: z.string().min(1),
  /** The step number AS PRINTED — "7", "3a". */
  n: z.string().optional(),
  title: z.string(),
  /** Which run of numbering this step belongs to. */
  part: z.string().optional(),
  verseCount: z.number().int().nonnegative(),
  syllables: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  /** sha256 of the section's JSON — the If-Match token for a write. */
  hash: z.string(),
});
export type ChantSectionIndexEntry = z.infer<typeof ChantSectionIndexEntry>;

/**
 * Everything about a document EXCEPT its sections' contents.
 *
 * Deliberately permissive on the composition fields (`groups`, `figures`,
 * `instructions`, `titleForms`): they are validated structurally by the
 * engine's own validator, which has the domain rules, rather than twice with
 * two definitions that could disagree.
 */
export const ChantDocManifest = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  source: z.string().nullish(),
  titleForms: z.record(z.string()).default({}),
  audioBase: z.string().optional(),
  lineBreak: z.enum(['source', 'hemistich', 'pada', 'none']).optional(),
  features: z
    .object({
      audio: z.boolean().optional(),
      grammar: z.boolean().optional(),
      translation: z.boolean().optional(),
    })
    .optional(),
  version: z.number().int().optional(),
  instructions: z.array(z.unknown()).optional(),
  figures: z.array(z.unknown()).optional(),
  groups: z.array(z.unknown()).optional(),
  variants: z.string().optional(),
  /** The engine parametrization (01 §2.1). */
  profile: z.unknown().optional(),
  /** Rule-zero overrides (01 §2.4). */
  overrides: z.array(z.unknown()).optional(),
  /**
   * The recording's cut, keyed by VERSE ID across the whole document — one take
   * usually covers a section, and the reader reads it per verse to drive the
   * per-pāda highlight and the play-this-line button. Because the key space is
   * the document's and not a section's, an editor writing one section's timings
   * must MERGE rather than replace.
   */
  recording: z
    .object({
      byVerse: z.record(
        z.object({
          file: z.string(),
          duration: z.union([z.string(), z.number()]).nullish(),
          label: z.string().nullish(),
          lines: z.array(z.object({ start: z.number(), end: z.number() })).optional(),
        }),
      ),
    })
    .optional(),
  /** The section index — order matters. */
  sections: z.array(ChantSectionIndexEntry),
});
export type ChantDocManifest = z.infer<typeof ChantDocManifest>;

/** Creating a document. Sections may be supplied whole, or added after. */
export const ChantDocInput = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'lowercase ASCII and hyphens only')
    .optional(),
  title: z.string().min(1).max(250),
  subtitle: z.string().max(300).optional(),
  source: z.string().max(500).nullish(),
  status: ChantDocStatus.optional(),
  visibility: ChantDocVisibility.optional(),
  /** Link to the Library page this text belongs to. */
  documentId: z.number().int().positive().nullish(),
  profile: z.unknown().optional(),
  /** Whole sections, as authored. Each is a `ChantSection`. */
  sections: z.array(z.unknown()).optional(),
  /** Seed from one of the shipped chants — the fastest way to start. */
  copyFrom: z.string().max(120).optional(),
});
export type ChantDocInput = z.infer<typeof ChantDocInput>;

/** Patching the manifest half of a document. */
export const ChantDocPatch = z.object({
  title: z.string().min(1).max(250).optional(),
  subtitle: z.string().max(300).nullish(),
  source: z.string().max(500).nullish(),
  status: ChantDocStatus.optional(),
  visibility: ChantDocVisibility.optional(),
  documentId: z.number().int().positive().nullish(),
  profile: z.unknown().optional(),
  titleForms: z.record(z.string()).optional(),
  features: ChantDocManifest.shape.features,
  lineBreak: ChantDocManifest.shape.lineBreak,
  audioBase: z.string().optional(),
  instructions: z.array(z.unknown()).optional(),
  figures: z.array(z.unknown()).optional(),
  groups: z.array(z.unknown()).optional(),
  overrides: z.array(z.unknown()).optional(),
  recording: ChantDocManifest.shape.recording,
  revisionNote: z.string().max(255).optional(),
});
export type ChantDocPatch = z.infer<typeof ChantDocPatch>;

/**
 * Writing one section.
 *
 * `baseHash` is the optimistic-concurrency token: the hash the client last
 * read. A mismatch returns 409 WITH the current section, so the editor can
 * show a three-way diff instead of silently clobbering.
 */
export const ChantSectionWrite = z.object({
  /** A whole `ChantSection`. Validated by the engine's validator. */
  section: z.unknown(),
  sortOrder: z.number().int().nonnegative().optional(),
  baseHash: z.string().optional(),
});
export type ChantSectionWrite = z.infer<typeof ChantSectionWrite>;

export const ChantSectionReorder = z.object({
  sectionIds: z.array(z.string().min(1)).min(1),
});
export type ChantSectionReorder = z.infer<typeof ChantSectionReorder>;

/** A row in the editor's document list. No section text is read for this. */
export const ChantDocSummary = z.object({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  source: z.string().nullable(),
  status: ChantDocStatus,
  visibility: ChantDocVisibility,
  sectionCount: z.number().int(),
  verses: z.number().int(),
  syllables: z.number().int(),
  bytes: z.number().int(),
  currentRevision: z.number().int(),
  documentId: z.number().int().nullable(),
  ownerId: z.number().int().nullable(),
  /** True when the signed-in user may edit this one. */
  canEdit: z.boolean(),
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type ChantDocSummary = z.infer<typeof ChantDocSummary>;

/** What `GET /api/chants/:slug` returns: the manifest, never the sections. */
export const ChantDocHead = ChantDocSummary.extend({
  manifest: ChantDocManifest,
  profile: z.unknown().nullable(),
  engineVersion: z.string().nullable(),
  formatVersion: z.number().int(),
  /** Whether the document carries an authored source layer (01 §2.3). A
   *  document without one is TRANSCRIBED and re-deriving it is refused. */
  hasSource: z.boolean(),
});
export type ChantDocHead = z.infer<typeof ChantDocHead>;

export const ChantSectionPayload = z.object({
  sectionId: z.string(),
  sortOrder: z.number().int(),
  hash: z.string(),
  bytes: z.number().int(),
  section: z.unknown(),
  updatedAt: z.string(),
});
export type ChantSectionPayload = z.infer<typeof ChantSectionPayload>;

/** The result of a validation run — the engine's V01–V20. */
export const ChantValidationResult = z.object({
  ok: z.boolean(),
  errors: z.array(z.object({ code: z.string(), message: z.string(), at: z.string().optional() })),
  warnings: z.array(z.object({ code: z.string(), message: z.string(), at: z.string().optional() })),
});
export type ChantValidationResult = z.infer<typeof ChantValidationResult>;
