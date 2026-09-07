/**
 * THE ACCOUNT, in the window.
 *
 * `@siksamitra/account` holds the protocol and knows nothing about React or
 * about fetch. This is the other half: it supplies a transport, keeps the
 * token where the shell can keep it, and turns the conversation into four
 * states the File view can draw.
 *
 * THE PROGRAM WORKS SIGNED OUT, and that is not a courtesy. Marking a text,
 * exporting a Word file, mapping a recording — all of it happens on this
 * machine, to files this person already has. An editor that demanded an
 * account to open a document would be a worse program for no gain. The account
 * is for the things that genuinely involve Veda Union, and for nothing else.
 *
 * A SESSION THAT CANNOT BE CHECKED IS NOT A SESSION THAT ENDED. On start-up
 * the token is verified, and a network failure leaves it in place, marked
 * unverified: somebody on a train is still signed in, and signing them out
 * every time the wifi drops would teach them to distrust the whole feature.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_ORIGIN, beginSignIn, collect, load, save, signOut, weakVault, whoAmI,
  type Account, type Pending, type Transport, type Vault,
} from '@siksamitra/account';

export type AccountState =
  | { kind: 'signed-out' }
  /** A code is showing and we are waiting for the person to approve it. */
  | { kind: 'linking'; pending: Pending }
  | { kind: 'signed-in'; account: Account; verified: boolean }
  | { kind: 'busy' };

export interface AccountApi {
  readonly state: AccountState;
  /** Where the credential is kept, in words, for the File view to print. */
  readonly where: string;
  readonly origin: string;
  /** Start a sign-in. Returns the code, or throws with something to show. */
  readonly signIn: () => Promise<void>;
  readonly cancel: () => void;
  readonly signOut: () => Promise<void>;
  /** The last thing that went wrong, for the panel to show. */
  readonly problem: string | null;
}

/** `fetch`, shaped the way the protocol wants it. */
const http: Transport = {
  request: async ({ url, method, body, headers }) => {
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    /* A non-2xx is a REPLY, not a throw: "not yet" is a 202, and a client that
       treats it as a failure gives up two seconds into a sign-in. */
    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = text === '' ? null : JSON.parse(text); } catch { parsed = null; }
    return { status: res.status, body: parsed };
  },
};

/**
 * What the approval page will call this.
 *
 * A person is being asked to trust something, and "desktop client" is not
 * something anybody can check. The program and, where the platform tells us,
 * the machine — so the sentence on the page is one a person can agree or
 * disagree with.
 */
function whatIsAsking(): string {
  const platform = typeof navigator === 'undefined' ? '' : navigator.platform;
  return platform === '' ? 'śikṣāmitra' : `śikṣāmitra on ${platform}`;
}

export function useAccount(
  origin: string = DEFAULT_ORIGIN,
  given?: Vault,
): AccountApi {
  /*
   * THE VAULT IS MADE ONCE, and this line is the whole reason the window
   * froze.
   *
   * It was a default argument — `vault: Vault = weakVault()` — which JavaScript
   * evaluates on EVERY call, so every render produced a new object. The
   * start-up effect below depends on the vault, so a new object meant the
   * effect ran again, which set state, which rendered, which made another
   * vault: a loop with no exit, at whatever speed the machine could manage.
   * The window did not crash — it was busy for ever, which looks exactly like
   * a freeze and is much harder to read from the outside.
   *
   * A ref rather than `useMemo`: `useMemo` is a hint and is allowed to
   * recompute. This must not, ever.
   */
  const held = useRef<Vault | null>(null);
  if (held.current === null) held.current = given ?? weakVault();
  const vault = held.current;

  const [state, setState] = useState<AccountState>({ kind: 'busy' });
  const [problem, setProblem] = useState<string | null>(null);
  const abort = useRef<{ aborted: boolean }>({ aborted: false });

  /* On start-up: is what we kept still good? */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const kept = await load(vault, origin);
      if (!alive) return;
      if (kept === null) { setState({ kind: 'signed-out' }); return; }

      const checked = await whoAmI(http, kept.token, origin);
      if (!alive) return;
      if (checked !== null) {
        setState({ kind: 'signed-in', account: checked, verified: true });
        return;
      }
      /* Unverified rather than gone — see the note at the top of this file. */
      setState({
        kind: 'signed-in',
        verified: false,
        account: {
          token: kept.token,
          email: kept.email,
          name: kept.name,
          role: kept.role,
          permissions: [],
          expiresAt: kept.expiresAt,
        },
      });
    })();
    return () => { alive = false; };
  }, [origin, vault]);

  const signIn = useCallback(async () => {
    setProblem(null);
    abort.current = { aborted: false };
    const signal = abort.current;
    let pending: Pending;
    try {
      pending = await beginSignIn(http, whatIsAsking(), origin);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
      setState({ kind: 'signed-out' });
      return;
    }
    setState({ kind: 'linking', pending });

    const outcome = await collect(http, pending, origin, { signal });
    if (signal.aborted) return;

    if (outcome.kind === 'signed-in') {
      await save(vault, {
        token: outcome.account.token,
        email: outcome.account.email,
        name: outcome.account.name,
        role: outcome.account.role,
        expiresAt: outcome.account.expiresAt,
        origin,
      });
      setState({ kind: 'signed-in', account: outcome.account, verified: true });
      return;
    }
    setProblem(
      outcome.kind === 'refused'
        ? 'That sign-in was refused on vedaunion.org.'
        : outcome.kind === 'expired'
          ? 'The code ran out. Ask for a new one.'
          : 'Could not reach Veda Union.',
    );
    setState({ kind: 'signed-out' });
  }, [origin, vault]);

  const cancel = useCallback(() => {
    abort.current.aborted = true;
    setProblem(null);
    setState({ kind: 'signed-out' });
  }, []);

  const out = useCallback(async () => {
    const token = state.kind === 'signed-in' ? state.account.token : null;
    /* Locally FIRST and unconditionally. Somebody who presses this on a train
       must end up signed out on the machine in front of them. */
    await vault.clear();
    setState({ kind: 'signed-out' });
    setProblem(null);
    if (token !== null) await signOut(http, token, origin);
  }, [state, origin, vault]);

  return { state, where: vault.describe(), origin, signIn, cancel, signOut: out, problem };
}
