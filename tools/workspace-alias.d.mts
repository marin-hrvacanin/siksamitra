/**
 * Types for `workspace-alias.mjs`.
 *
 * The helper is `.mjs` because `tools/` is plain ESM and the two vite configs
 * are TypeScript; this is what lets the TypeScript side import it without
 * `any`. The add-in's `tsconfig` type-checks its own vite config, which is how
 * the missing declaration was caught.
 */

/** Every workspace package's exported subpaths, resolved to source, longest key first. */
export declare function workspaceAliases(): Record<string, string>;
