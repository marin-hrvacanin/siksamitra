/**
 * WHERE THE TEXTS ARE — the editions table, as the model is told it.
 *
 * A real run (nīla sūktam, 2026-10-02) guessed an address that does not exist
 * and built nothing; the whole taittirīya saṁhitā was one file it never read.
 */
import { describe, expect, it } from 'vitest';
import { EDITIONS } from '../editions.js';
import { systemFor } from '../modes.js';
import type { Host } from '../tools/types.js';

const host = { where: 'a Telegram chat', research: { search: async () => [], fetch: async () => ({ title: '', text: '' }) } } as unknown as Host;

describe('the editions the prompt names', () => {
  it('every one of them, its address whole', () => {
    const prompt = systemFor('deliver', host);
    for (const e of EDITIONS) expect(prompt, e.work).toContain(e.url);
  });

  it('the whole taittirīya saṁhitā is one file, not one a kāṇḍa', () => {
    const ts = EDITIONS.find((e) => e.work === 'taittirīya saṁhitā')!;
    expect(ts.url).toBe('https://sanskritdocuments.org/doc_veda/taittirIyasamhitA.html');
    expect(EDITIONS.some((e) => /taitsamhita[2-7]/.test(e.url))).toBe(false);
  });

  it('every address is https, and none is guessed twice', () => {
    expect(EDITIONS.every((e) => e.url.startsWith('https://'))).toBe(true);
    expect(new Set(EDITIONS.map((e) => e.url)).size).toBe(EDITIONS.length);
  });
});
