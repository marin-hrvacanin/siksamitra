/**
 * The script registry — where writing systems are looked up by id.
 *
 * The built-in modules register themselves at import. A host may add or replace
 * one at run time, which is what a plug-in needs and a release does not.
 *
 * There is no `ScriptKey` union here. Code that needs to know what exists asks
 * the registry; code that meets an unknown id reports it by name. A closed
 * union can do neither, and a program that accepts documents from elsewhere has
 * to do both.
 */

import { NUCLEUS_IDS, PHONEME_INVENTORY } from './phonemes.js';
import type { ScriptId, ScriptModule } from './module.js';
import { DEVA } from './scripts/deva.js';
import { IAST } from './scripts/iast.js';
import { ITRANS } from './scripts/itrans.js';
import { TAM } from './scripts/tam.js';
import { TEL } from './scripts/tel.js';

const REGISTRY = new Map<ScriptId, ScriptModule>();

/**
 * Anything derived from a module's tables, so a replacement cannot be served
 * from a stale computation.
 *
 * This exists because the first version did not have it. `registerScript`
 * advertised replacement as a feature while the collision cache in
 * `lossless.ts` kept answering from the module it had first seen: the forward
 * transliterator picked up new Tamil forms and `selectorFor` did not, which in
 * lossless mode is not a stale report but silent corruption — the decoder
 * indexes a group ordinal that no longer describes the registered module.
 */
const INVALIDATORS: ((id: ScriptId) => void)[] = [];

export function onScriptReplaced(fn: (id: ScriptId) => void): void {
  INVALIDATORS.push(fn);
}

export class ScriptModuleError extends Error {}

/**
 * Check a module before it can be used.
 *
 * `Record<PhonemeId, …>` with an open key type imposes no completeness
 * obligation whatsoever, so a half-filled table compiles clean. What it does at
 * run time is worse than failing: the transliterator's gap fallback emits the
 * phoneme id, which is spelled in Latin, so an incomplete Kannada module
 * produces Kannada with Latin letters embedded in it and says nothing.
 *
 * "Adding a script costs one module" is only a safe claim if the module is
 * checkable. This is that check.
 */
export function validateScriptModule(module: ScriptModule): void {
  const problems: string[] = [];

  const missingLetters = PHONEME_INVENTORY
    .filter((p) => !(p.id in module.letters))
    .map((p) => p.id);
  if (missingLetters.length > 0) {
    problems.push(`no entry for ${missingLetters.length} phoneme(s): ${missingLetters.join(' ')}`
      + ' (use null for a sound this script cannot write)');
  }

  if (module.kind === 'abugida') {
    if (module.signs === undefined) {
      problems.push('an abugida needs `signs`: consonants carry an inherent vowel');
    } else {
      const missingSigns = NUCLEUS_IDS.filter((id) => !(id in module.signs!));
      if (missingSigns.length > 0) {
        problems.push(`no vowel sign for: ${missingSigns.join(' ')}`);
      }
    }
    if (module.virama === '') {
      problems.push('an abugida needs a virama to suppress the inherent vowel');
    }
  }

  for (const id of Object.keys(module.approximations ?? {})) {
    if (module.letters[id] !== null) {
      problems.push(`"${id}" has an approximation but is not a gap`
        + ' — an approximation is only for a sound the script cannot write');
    }
  }

  if (problems.length > 0) {
    throw new ScriptModuleError(
      `script "${module.id}" is not usable:\n  - ${problems.join('\n  - ')}`,
    );
  }
}

/**
 * Add a script, or replace one already registered.
 *
 * Replacing is allowed on purpose: a host with better Tamil forms than the ones
 * shipped here should be able to install them without forking the engine.
 */
export function registerScript(module: ScriptModule): void {
  validateScriptModule(module);
  REGISTRY.set(module.id, module);
  for (const invalidate of INVALIDATORS) invalidate(module.id);
}

/** The module for an id, or `undefined` if nothing is registered under it. */
export function getScript(id: ScriptId): ScriptModule | undefined {
  return REGISTRY.get(id);
}

/**
 * The module for an id, or a thrown error naming what was asked for and what
 * exists — a message a person can act on, rather than `undefined` propagating
 * into a blank glyph.
 *
 * Call this at a document boundary, where the failure can be reported. Deep in
 * a render loop it becomes a crash on a document that names a script this build
 * happens to lack, and the requirement there is to report the script and render
 * the others.
 */
export function requireScript(id: ScriptId): ScriptModule {
  const found = REGISTRY.get(id);
  if (found === undefined) {
    throw new Error(
      `unknown script "${id}" — registered: ${[...REGISTRY.keys()].sort().join(', ')}`,
    );
  }
  return found;
}

export function isRegistered(id: ScriptId): boolean {
  return REGISTRY.has(id);
}

/**
 * Split a document's declared scripts into those this build can render and
 * those it cannot.
 *
 * The unknown ones are to be REPORTED by name and the rest rendered. That is
 * the required behaviour, and having it in one place is what stops each surface
 * inventing its own answer — or, as before, throwing.
 */
export function partitionScripts(
  declared: readonly ScriptId[],
): { known: ScriptId[]; unknown: ScriptId[] } {
  const known: ScriptId[] = [];
  const unknown: ScriptId[] = [];
  for (const id of declared) (REGISTRY.has(id) ? known : unknown).push(id);
  return { known, unknown };
}

/** Every registered script, in registration order. */
export function registeredScripts(): readonly ScriptModule[] {
  return [...REGISTRY.values()];
}

export function registeredScriptIds(): readonly ScriptId[] {
  return [...REGISTRY.keys()];
}

/**
 * Those a document may be AUTHORED in.
 *
 * Both conditions are load-bearing. `reversible` means what the author typed
 * can be recovered; `verified` means someone who reads the script has checked
 * its forms. Offering an unreviewed script as an authoring surface publishes
 * unchecked output as if it were the author's intent.
 */
export function authorableScripts(): readonly ScriptModule[] {
  return [...REGISTRY.values()].filter((s) => s.reversible && s.verified);
}

/**
 * Those whose forms a reader has actually reviewed.
 *
 * The gates measure these and report the rest as unverified. Tamil sits outside
 * this set by the owner's own statement, and saying so every run beats a green
 * tick over forms nobody has read.
 */
export function verifiedScripts(): readonly ScriptModule[] {
  return [...REGISTRY.values()].filter((s) => s.verified);
}

for (const module of [IAST, DEVA, TEL, TAM, ITRANS]) registerScript(module);
