/**
 * THE REGISTERS AS OFFERED — and what each says it covers, against what the
 * corpus records each text as marked in.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CHANT_PROFILE_KEYS, CHANT_PROFILE_NOTES, READABLE_PROFILE_KEYS } from '../index.js';

describe('the registers offered', () => {
  it('are four; prose is offered nowhere, and still read where a file names it', () => {
    expect(CHANT_PROFILE_KEYS).toEqual(['taittiriya', 'rigveda', 'sukla-yajurveda', 'smarta']);
    expect(READABLE_PROFILE_KEYS).toContain('prose');
  });
  it('no register names a text the corpus records under another', () => {
    const dir = join(process.cwd(), 'corpus', 'chants');
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { title: string; profile?: { preset?: string } };
      const recorded = doc.profile?.preset;
      if (recorded === undefined) continue;
      const head = doc.title.trim().split(/\s+/)[0]!.toLowerCase();
      for (const k of CHANT_PROFILE_KEYS) {
        if (k === recorded) continue;
        expect(CHANT_PROFILE_NOTES[k].where.toLowerCase(), `${f} is ${recorded}, named under ${k}`).not.toContain(`${head} sūktam`);
      }
    }
  });
});
