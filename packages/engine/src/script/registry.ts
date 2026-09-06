/**
 * The script registry — where writing systems are looked up by id.
 *
 * The built-in modules register themselves here at import. A host may add more
 * at run time, which is what makes a script a plug-in rather than a release.
 *
 * There is no `ScriptKey` union any more. Code that needs to know what exists
 * asks the registry; code that meets an unknown id reports it by name. Both of
 * those are things a closed union cannot do, and both are things a program that
 * accepts documents from elsewhere has to do.
 */

import type { ScriptId, ScriptModule } from './module.js';
import { DEVA } from './scripts/deva.js';
import { IAST } from './scripts/iast.js';
import { ITRANS } from './scripts/itrans.js';
import { TAM } from './scripts/tam.js';
import { TEL } from './scripts/tel.js';

const REGISTRY = new Map<ScriptId, ScriptModule>();

/**
 * Add a script, or replace one already registered.
 *
 * Replacing is allowed on purpose: a host that has better Tamil forms than the
 * ones shipped here should be able to install them without forking the engine.
 */
export function registerScript(module: ScriptModule): void {
  REGISTRY.set(module.id, module);
}

/** The module for an id, or `undefined` if nothing is registered under it. */
export function getScript(id: ScriptId): ScriptModule | undefined {
  return REGISTRY.get(id);
}

/**
 * The module for an id, or a thrown error naming what was asked for and what
 * exists. A caller that cannot proceed without the script gets a message a
 * person can act on, rather than `undefined` propagating into a blank glyph.
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

/** Every registered script, in registration order. */
export function registeredScripts(): readonly ScriptModule[] {
  return [...REGISTRY.values()];
}

export function registeredScriptIds(): readonly ScriptId[] {
  return [...REGISTRY.keys()];
}

/** Those a document may be authored in — the mapping must be recoverable. */
export function authorableScripts(): readonly ScriptModule[] {
  return [...REGISTRY.values()].filter((s) => s.reversible);
}

/**
 * Those whose forms a reader has actually reviewed.
 *
 * The gates measure these and report the rest as unverified. Tamil sits outside
 * this set by the owner's own statement, and saying so every run is better than
 * a green tick over forms nobody has read.
 */
export function verifiedScripts(): readonly ScriptModule[] {
  return [...REGISTRY.values()].filter((s) => s.verified);
}

for (const module of [IAST, DEVA, TEL, TAM, ITRANS]) registerScript(module);
