/**
 * The sign-in conversation, and nothing else.
 *
 * THE TRANSPORT IS INJECTED. This package does not import `fetch` and does not
 * know what a Tauri command is: it is handed something that takes a request and
 * returns a reply. That is what lets the same protocol run in the desktop
 * shell, in a browser tab and in a test with no network — and the tests are
 * the reason it matters, because the failures worth catching here are the ones
 * a real server makes hard to produce on purpose: a code that expires while
 * somebody is looking for their phone, a refusal, a server that stops
 * answering half way through.
 */

/** Where the account lives, unless a build says otherwise. */
export const DEFAULT_ORIGIN = 'https://vedaunion.org';

export interface Transport {
  /**
   * One request. Rejecting means the network failed; a non-2xx status is a
   * REPLY and must come back as one, because "not yet" is a 202 and treating
   * it as a failure is how a poller gives up two seconds in.
   */
  request(input: {
    url: string;
    method: 'GET' | 'POST';
    body?: unknown;
    headers?: Record<string, string>;
  }): Promise<{ status: number; body: unknown }>;
}

/** Who is signed in, as far as this program is concerned. */
export interface Account {
  readonly token: string;
  readonly email: string;
  readonly name: string;
  /** The role key from the platform: `student`, `teacher`, `admin`, … */
  readonly role: string;
  /** Flat permission keys — `library.publish` and the like. */
  readonly permissions: readonly string[];
  /** When the session stops being valid, as an ISO string. */
  readonly expiresAt: string;
}

export interface Pending {
  readonly deviceCode: string;
  /** What the person compares against the screen in front of them. */
  readonly userCode: string;
  readonly verificationUrl: string;
  /** The same page with the code already filled in. */
  readonly verificationUrlComplete: string;
  readonly expiresAt: string;
  readonly intervalSeconds: number;
}

export type PollOutcome =
  | { kind: 'waiting' }
  | { kind: 'signed-in'; account: Account }
  | { kind: 'refused'; why: string }
  | { kind: 'expired' }
  /** The network, not the server. Worth telling apart: one is worth retrying. */
  | { kind: 'unreachable'; why: string };

interface Started {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  verificationUrlComplete: string;
  expiresAt: string;
  intervalSeconds: number;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

/**
 * Ask for a code.
 *
 * `client` is shown to the person on the approval page, so it says what this
 * is and which machine it is on — "śikṣāmitra on marin-laptop" is something a
 * person can check; "desktop client" is not.
 */
export async function beginSignIn(
  transport: Transport,
  client: string,
  origin: string = DEFAULT_ORIGIN,
): Promise<Pending> {
  const reply = await transport.request({
    url: `${origin}/api/auth/device`,
    method: 'POST',
    body: { client },
  });
  if (reply.status !== 201 && reply.status !== 200) {
    throw new Error(messageOf(reply.body, 'Veda Union would not start a sign-in just now.'));
  }
  const b = reply.body as Partial<Started>;
  if (!isObject(b) || typeof b.deviceCode !== 'string' || typeof b.userCode !== 'string') {
    throw new Error('Veda Union sent something this version does not understand.');
  }
  return {
    deviceCode: b.deviceCode,
    userCode: b.userCode,
    verificationUrl: str(b.verificationUrl, `${origin}/link`),
    verificationUrlComplete: str(b.verificationUrlComplete, `${origin}/link`),
    expiresAt: str(b.expiresAt),
    /* Clamped: a server that says zero would have us asking as fast as the
       machine can, which is how a client gets itself rate-limited. */
    intervalSeconds: Math.min(30, Math.max(2, Number(b.intervalSeconds) || 3)),
  };
}

/** One poll. The caller decides how often; see `collect` for the usual loop. */
export async function poll(
  transport: Transport,
  pending: Pending,
  origin: string = DEFAULT_ORIGIN,
): Promise<PollOutcome> {
  let reply: { status: number; body: unknown };
  try {
    reply = await transport.request({
      url: `${origin}/api/auth/device/token`,
      method: 'POST',
      body: { deviceCode: pending.deviceCode },
    });
  } catch (e) {
    return { kind: 'unreachable', why: e instanceof Error ? e.message : String(e) };
  }

  if (reply.status === 202) return { kind: 'waiting' };
  if (reply.status === 403) {
    return { kind: 'refused', why: 'Someone refused this sign-in on vedaunion.org.' };
  }
  if (reply.status === 410) return { kind: 'expired' };
  if (reply.status === 429) {
    /* Being asked to slow down is not a failure of the sign-in. Keep waiting;
       the loop in `collect` will back off. */
    return { kind: 'waiting' };
  }
  if (reply.status !== 200) {
    return { kind: 'unreachable', why: messageOf(reply.body, `Veda Union answered ${reply.status}.`) };
  }

  const b = reply.body;
  if (!isObject(b) || typeof b.token !== 'string') {
    return { kind: 'unreachable', why: 'Veda Union sent something this version does not understand.' };
  }
  const user = isObject(b.user) ? b.user : {};
  return {
    kind: 'signed-in',
    account: {
      token: b.token,
      email: str(user.email),
      name: str(user.name) || str(user.fullName) || str(user.email),
      role: str(user.role, 'student'),
      permissions: Array.isArray(user.permissions)
        ? user.permissions.filter((p): p is string => typeof p === 'string')
        : [],
      expiresAt: str(b.expiresAt),
    },
  };
}

export interface CollectOptions {
  /** Called after every poll, so a window can say "still waiting". */
  readonly onTick?: (outcome: PollOutcome) => void;
  /** Injected so a test does not really wait three seconds forty times. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Lets a person press Cancel. */
  readonly signal?: { aborted: boolean };
  readonly now?: () => number;
}

const wait = (ms: number): Promise<void> => new Promise((done) => { setTimeout(done, ms); });

/**
 * Poll until it resolves, one way or another.
 *
 * IT STOPS. Three ways: the person allows it, somebody refuses it, or the code
 * expires — and the expiry is checked against the clock as well as the
 * server's answer, so a server that goes quiet does not leave a window
 * spinning for ever. A network failure is not a stop: the laptop that went to
 * sleep mid-sign-in comes back and finds it still waiting.
 */
export async function collect(
  transport: Transport,
  pending: Pending,
  origin: string = DEFAULT_ORIGIN,
  options: CollectOptions = {},
): Promise<PollOutcome> {
  const sleep = options.sleep ?? wait;
  const now = options.now ?? Date.now;
  const deadline = Date.parse(pending.expiresAt);
  let interval = pending.intervalSeconds * 1000;

  for (;;) {
    if (options.signal?.aborted === true) return { kind: 'expired' };
    if (Number.isFinite(deadline) && now() > deadline) return { kind: 'expired' };

    const outcome = await poll(transport, pending, origin);
    options.onTick?.(outcome);

    if (outcome.kind === 'signed-in' || outcome.kind === 'refused' || outcome.kind === 'expired') {
      return outcome;
    }
    /* Backed off when the network is unhappy, and capped — a client that
       hammers a server that is already struggling is part of the problem. */
    if (outcome.kind === 'unreachable') interval = Math.min(interval * 2, 30_000);
    await sleep(interval);
  }
}

/** Who this token belongs to, and what it may do. Used on start-up. */
export async function whoAmI(
  transport: Transport,
  token: string,
  origin: string = DEFAULT_ORIGIN,
): Promise<Account | null> {
  let reply: { status: number; body: unknown };
  try {
    reply = await transport.request({
      url: `${origin}/api/me`,
      method: 'GET',
      headers: { authorization: `Bearer ${token}`, 'x-vedaunion-client': 'app' },
    });
  } catch {
    /*
     * NULL IS NOT "SIGNED OUT" HERE, and the caller must not treat it as one.
     * A person on a train has no network and is still signed in; throwing away
     * their token because a request failed would sign them out every time the
     * wifi drops. The caller keeps what it has and shows it as unverified.
     */
    return null;
  }
  if (reply.status !== 200 || !isObject(reply.body)) return null;
  const user = isObject(reply.body.user) ? reply.body.user : null;
  if (user === null) return null;
  return {
    token,
    email: str(user.email),
    name: str(user.name) || str(user.fullName) || str(user.email),
    role: str(user.role, 'student'),
    permissions: Array.isArray(reply.body.permissions)
      ? reply.body.permissions.filter((p): p is string => typeof p === 'string')
      : [],
    expiresAt: str(user.expiresAt),
  };
}

/**
 * Sign out — on the server as well as here.
 *
 * The local half always happens, even when the request fails. Somebody on a
 * train who presses "Sign out" must end up signed out on the machine in front
 * of them; the server session is destroyed when it can be reached, and expires
 * on its own if it cannot.
 */
export async function signOut(
  transport: Transport,
  token: string,
  origin: string = DEFAULT_ORIGIN,
): Promise<{ serverToo: boolean }> {
  try {
    const reply = await transport.request({
      url: `${origin}/api/auth/logout`,
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'x-vedaunion-client': 'app' },
    });
    return { serverToo: reply.status === 200 };
  } catch {
    return { serverToo: false };
  }
}

function messageOf(body: unknown, fallback: string): string {
  if (isObject(body) && typeof body.message === 'string') return body.message;
  return fallback;
}
