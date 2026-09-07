/**
 * What jsdom does not provide that the renderer needs.
 *
 * Kept to the minimum, and each stub is a fact about the environment rather
 * than a convenience: a component test that passes because a stub returned a
 * flattering value is worse than no test.
 */
import '@testing-library/jest-dom/vitest';

// jsdom has no layout engine, so every element measures zero. Tests that care
// about measurement must supply their own numbers rather than trusting these.
if (!('ResizeObserver' in globalThis)) {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
if (!('IntersectionObserver' in globalThis)) {
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): [] { return []; }
  };
}
if (!('matchMedia' in globalThis)) {
  (globalThis as { matchMedia?: unknown }).matchMedia = (query: string) => ({
    matches: false, media: query,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, onchange: null,
    dispatchEvent: () => false,
  });
}
