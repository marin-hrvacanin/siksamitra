/**
 * What is kept between sessions, and what is thrown away.
 *
 * Every one of these is about a way a stored credential goes wrong: it outlives
 * its usefulness, it belongs to a different server, it was written by a
 * different version, or the store simply refuses to work — which a private
 * browsing window does, by throwing rather than by returning null.
 */
import { describe, expect, it } from 'vitest';
import { emptySignedIn, load, save, weakVault, type Stored } from '../vault.js';
import { MAY, can, describeRole } from '../abilities.js';

const ORIGIN = 'https://vedaunion.org';
const later = (ms: number) => new Date(Date.now() + ms).toISOString();

const stored = (over: Partial<Stored> = {}): Stored => ({
  token: 't'.repeat(43),
  email: 'a@b.c',
  name: 'A Person',
  role: 'editor',
  expiresAt: later(86_400_000),
  origin: ORIGIN,
  ...over,
});

/** A store that behaves like a real one, plus one that refuses to. */
function fakeStore(): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void } {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}
const refusingStore = {
  getItem: () => { throw new Error('site data is blocked'); },
  setItem: () => { throw new Error('site data is blocked'); },
  removeItem: () => { throw new Error('site data is blocked'); },
};

describe('keeping a session', () => {
  it('comes back after a restart', async () => {
    const vault = weakVault(fakeStore());
    await save(vault, stored());
    const back = await load(vault, ORIGIN);
    expect(back?.email).toBe('a@b.c');
    expect(back?.role).toBe('editor');
  });

  it('keeps the minimum and nothing more', async () => {
    /* Never a password — there is none — and never the permission list, which
       is asked for again on start-up so a role changed on the platform takes
       effect here rather than being remembered from a month ago. */
    const store = fakeStore();
    await save(weakVault(store), stored());
    const raw = store.getItem('siksamitra.account.v1') ?? '';
    expect(raw).not.toContain('permissions');
    expect(raw).not.toContain('password');
    expect(Object.keys(JSON.parse(raw) as object).sort())
      .toEqual(['email', 'expiresAt', 'name', 'origin', 'role', 'token']);
  });

  it('drops a session that has certainly ended, without asking the server', async () => {
    const vault = weakVault(fakeStore());
    await save(vault, stored({ expiresAt: later(-1000) }));
    expect(await load(vault, ORIGIN)).toBeNull();
  });

  it('drops a token minted by a different server', async () => {
    /* A staging token must never be presented to production. */
    const vault = weakVault(fakeStore());
    await save(vault, stored({ origin: 'http://localhost:3001' }));
    expect(await load(vault, ORIGIN)).toBeNull();
  });

  it('drops nonsense rather than trusting it', async () => {
    const store = fakeStore();
    const vault = weakVault(store);
    for (const junk of ['', 'not json', '[]', '{}', '{"token":"short"}', 'null']) {
      store.setItem('siksamitra.account.v1', junk);
      expect(await load(vault, ORIGIN), junk).toBeNull();
    }
  });

  it('survives a store that refuses to work at all', async () => {
    /* A private window throws rather than returning null, and a program that
       will not start because it cannot remember a login is a bad program. */
    const vault = weakVault(refusingStore);
    await expect(save(vault, stored())).resolves.toBeUndefined();
    await expect(load(vault, ORIGIN)).resolves.toBeNull();
    await expect(vault.clear()).resolves.toBeUndefined();
  });

  it('can hold nothing at all, and says so', async () => {
    const vault = emptySignedIn();
    await save(vault, stored());
    expect((await load(vault, ORIGIN))?.email).toBe('a@b.c');
    await vault.clear();
    expect(await load(vault, ORIGIN)).toBeNull();
    expect(vault.describe()).toContain('signed out when this window closes');
  });

  it('describes the weak store as weak, out loud', async () => {
    /* The File view prints this. Nobody should have to read the source to
       find out where their credential is. */
    expect(weakVault(fakeStore()).describe()).toContain('any script on the page can read');
  });
});

describe('what an account may do', () => {
  const account = (permissions: string[]) => ({ permissions });

  it('answers no for everyone when nobody is signed in', () => {
    for (const ability of Object.keys(MAY) as (keyof typeof MAY)[]) {
      expect(can(null, ability), ability).toBe(false);
    }
  });

  it('maps this program’s words onto the permission the server checks', () => {
    expect(can(account(['documents.publish']), 'publish')).toBe(true);
    expect(can(account(['documents.create']), 'publish')).toBe(false);
    expect(can(account(['media.upload']), 'upload-audio')).toBe(true);
  });

  it('says why not, in words a person can act on', () => {
    for (const rule of Object.values(MAY)) {
      expect(rule.whyNot.length).toBeGreaterThan(20);
      /* No permission keys in a sentence meant for a reader. */
      expect(rule.whyNot).not.toMatch(/[a-z]+\.[a-z_]+/);
    }
  });

  it('names a role the way a person would, and prints an unknown one as itself', () => {
    expect(describeRole('admin')).toBe('Administrator');
    expect(describeRole('youth')).toBe('Youth');
    /* A role this build has not heard of is still that person's real role. */
    expect(describeRole('archivist')).toBe('archivist');
  });
});
