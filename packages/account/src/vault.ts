/**
 * WHERE THE TOKEN IS KEPT, and how honestly this program describes that.
 *
 * A session token is a bearer credential: whoever holds it is signed in. The
 * right place for one on a desktop is the operating system's own keychain —
 * Credential Manager, Keychain, libsecret — because that is the only store on
 * the machine that is encrypted with the user's login and that other programs
 * cannot simply read off disk.
 *
 * THAT IS NOT WHAT THIS DOES YET, and pretending otherwise would be the worst
 * possible outcome. Tauri's keyring plugin is not wired into this shell, so
 * the token goes where the shell can already put it, and this file's job is to
 * make WHICH place an explicit, testable decision rather than a habit:
 *
 *   - a `Vault` is injected, so the desktop shell can hand over a keychain the
 *     day it has one and nothing else changes;
 *   - `describe()` returns the truth about the store in use, and the File view
 *     prints it, so nobody has to read this file to find out;
 *   - what is written is the minimum. The token, who it belongs to, and when
 *     it stops working. Never a password — there is none — and never the
 *     permission list, which is asked for again on start-up so that a role
 *     changed on the platform takes effect here rather than being remembered
 *     from a month ago.
 *
 * `localStorage` in a browser tab is deliberately the WEAKEST case and is
 * named as such: any script on the page can read it. That is acceptable for a
 * development build served from localhost and is not acceptable anywhere else,
 * which is why `describe()` says so out loud.
 */

export interface Stored {
  readonly token: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
  /** ISO. Used to stop offering a session that has certainly gone. */
  readonly expiresAt: string;
  /** Which vedaunion this is, so a staging token never reaches production. */
  readonly origin: string;
}

export interface Vault {
  /** A word for the store, for the sentence the File view prints. */
  readonly describe: () => string;
  readonly read: () => Promise<string | null>;
  readonly write: (value: string) => Promise<void>;
  readonly clear: () => Promise<void>;
}

const KEY = 'siksamitra.account.v1';

/**
 * The browser's own storage — the fallback, and the weak one.
 *
 * Named `weak` rather than `browser` on purpose: whoever reads the call site
 * should see what they are choosing.
 */
export function weakVault(store?: {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}): Vault {
  const s = store ?? (typeof localStorage === 'undefined' ? null : localStorage);
  return {
    describe: () => 'this browser’s storage, which any script on the page can read',
    read: async () => {
      try { return s?.getItem(KEY) ?? null; } catch { return null; }
    },
    write: async (value) => {
      try { s?.setItem(KEY, value); } catch { /* private window: not fatal */ }
    },
    clear: async () => {
      try { s?.removeItem(KEY); } catch { /* not fatal */ }
    },
  };
}

/** Nothing is kept at all. Sign-in lasts as long as the window. */
export function emptySignedIn(): Vault {
  let held: string | null = null;
  return {
    describe: () => 'memory only — you will be signed out when this window closes',
    read: async () => held,
    write: async (value) => { held = value; },
    clear: async () => { held = null; },
  };
}

/**
 * Read what was kept, if it is still worth anything.
 *
 * AN EXPIRED TOKEN IS DROPPED HERE rather than being sent to the server to be
 * refused. The clock is enough to know, the server round trip is not free, and
 * a program that shows somebody as signed in while every request fails is
 * worse than one that says plainly that the session ended.
 *
 * A token for a DIFFERENT origin is dropped too: a token minted by a staging
 * server must never be presented to the production one, and somebody who has
 * changed the origin in a build has changed which account they are using.
 */
export async function load(vault: Vault, origin: string, now = Date.now): Promise<Stored | null> {
  const raw = await vault.read();
  if (raw === null || raw === '') return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const v = parsed as Partial<Stored>;
  if (typeof v.token !== 'string' || v.token.length < 16) return null;
  if (v.origin !== origin) return null;
  if (typeof v.expiresAt === 'string' && v.expiresAt !== '') {
    const when = Date.parse(v.expiresAt);
    if (Number.isFinite(when) && when <= now()) return null;
  }
  return {
    token: v.token,
    email: typeof v.email === 'string' ? v.email : '',
    name: typeof v.name === 'string' ? v.name : '',
    role: typeof v.role === 'string' ? v.role : 'student',
    expiresAt: typeof v.expiresAt === 'string' ? v.expiresAt : '',
    origin,
  };
}

export async function save(vault: Vault, value: Stored): Promise<void> {
  await vault.write(JSON.stringify(value));
}
