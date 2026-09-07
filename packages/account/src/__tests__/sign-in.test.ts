/**
 * Signing in without a password, and what happens when it goes wrong.
 *
 * The transport is injected precisely so these can be written: the failures
 * worth catching are the ones a real server makes hard to produce on purpose —
 * a code that expires while somebody looks for their phone, a refusal, a
 * network that drops half way, a server that answers something this version
 * has never seen.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ORIGIN, beginSignIn, collect, poll, signOut, whoAmI,
  type Pending, type Transport,
} from '../sign-in.js';

const started = {
  deviceCode: 'a'.repeat(43),
  userCode: 'BCDF-GHJK',
  verificationUrl: 'https://vedaunion.org/link',
  verificationUrlComplete: 'https://vedaunion.org/link?code=BCDF-GHJK',
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
  intervalSeconds: 3,
};

/** A transport that answers a scripted queue, and records what it was asked. */
function scripted(replies: { status: number; body: unknown }[]): Transport & {
  calls: { url: string; body?: unknown; headers?: Record<string, string> }[];
} {
  const calls: { url: string; body?: unknown; headers?: Record<string, string> }[] = [];
  return {
    calls,
    request: async (input) => {
      calls.push({
        url: input.url,
        ...(input.body === undefined ? {} : { body: input.body }),
        ...(input.headers === undefined ? {} : { headers: input.headers }),
      });
      const next = replies.shift();
      if (next === undefined) throw new Error('the test ran out of replies');
      if (next.status === 0) throw new Error('network down');
      return next;
    },
  };
}

const pending = (over: Partial<Pending> = {}): Pending => ({ ...started, ...over });

const ok = (over: Record<string, unknown> = {}) => ({
  status: 200,
  body: {
    status: 'ok',
    token: 'z'.repeat(43),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    user: { email: 'a@b.c', name: 'A Person', role: 'editor', permissions: ['documents.publish'] },
    ...over,
  },
});

describe('asking for a code', () => {
  it('sends what is asking, so the approval page can name it', () => {
    const t = scripted([{ status: 201, body: started }]);
    return beginSignIn(t, 'śikṣāmitra on marin-laptop').then(() => {
      expect(t.calls[0]?.url).toBe(`${DEFAULT_ORIGIN}/api/auth/device`);
      expect(t.calls[0]?.body).toEqual({ client: 'śikṣāmitra on marin-laptop' });
    });
  });

  it('clamps a poll interval the server got wrong', async () => {
    /* Zero would have us asking as fast as the machine can, which is how a
       client gets itself rate-limited by the server it is talking to. */
    const fast = await beginSignIn(scripted([{ status: 201, body: { ...started, intervalSeconds: 0 } }]), 'x');
    expect(fast.intervalSeconds).toBeGreaterThanOrEqual(2);
    const slow = await beginSignIn(scripted([{ status: 201, body: { ...started, intervalSeconds: 9999 } }]), 'x');
    expect(slow.intervalSeconds).toBeLessThanOrEqual(30);
  });

  it('refuses to guess when the server sends something it does not understand', async () => {
    await expect(beginSignIn(scripted([{ status: 201, body: { hello: 1 } }]), 'x'))
      .rejects.toThrow(/does not understand/);
  });

  it('passes the server’s own words through when it says no', async () => {
    await expect(beginSignIn(
      scripted([{ status: 429, body: { message: 'Too many attempts. Please wait a little and try again.' } }]),
      'x',
    )).rejects.toThrow(/Too many attempts/);
  });
});

describe('one poll', () => {
  it('reads 202 as "not yet" rather than as a failure', async () => {
    /* The whole flow depends on this: a client that treats 202 as an error
       gives up two seconds into a sixty-second sign-in. */
    expect((await poll(scripted([{ status: 202, body: { status: 'pending' } }]), pending())).kind)
      .toBe('waiting');
  });

  it('tells refusal, expiry and a broken network apart', async () => {
    expect((await poll(scripted([{ status: 403, body: {} }]), pending())).kind).toBe('refused');
    expect((await poll(scripted([{ status: 410, body: {} }]), pending())).kind).toBe('expired');
    expect((await poll(scripted([{ status: 0, body: {} }]), pending())).kind).toBe('unreachable');
  });

  it('treats "slow down" as still waiting, not as a failure', async () => {
    expect((await poll(scripted([{ status: 429, body: {} }]), pending())).kind).toBe('waiting');
  });

  it('brings back who signed in, and what they may do', async () => {
    const out = await poll(scripted([ok()]), pending());
    expect(out.kind).toBe('signed-in');
    if (out.kind !== 'signed-in') return;
    expect(out.account.email).toBe('a@b.c');
    expect(out.account.role).toBe('editor');
    expect(out.account.permissions).toEqual(['documents.publish']);
  });

  it('falls back to the address when the account has no name', async () => {
    const out = await poll(scripted([ok({ user: { email: 'a@b.c' } })]), pending());
    expect(out.kind === 'signed-in' && out.account.name).toBe('a@b.c');
  });

  it('will not accept a 200 with no token in it', async () => {
    const out = await poll(scripted([{ status: 200, body: { status: 'ok' } }]), pending());
    expect(out.kind).toBe('unreachable');
  });
});

describe('waiting for the person', () => {
  const nowait = { sleep: async () => undefined };

  it('keeps asking while the answer is "not yet"', async () => {
    const t = scripted([
      { status: 202, body: {} }, { status: 202, body: {} }, ok(),
    ]);
    const out = await collect(t, pending(), DEFAULT_ORIGIN, nowait);
    expect(out.kind).toBe('signed-in');
    expect(t.calls).toHaveLength(3);
  });

  it('stops when somebody refuses', async () => {
    const out = await collect(scripted([{ status: 202, body: {} }, { status: 403, body: {} }]),
      pending(), DEFAULT_ORIGIN, nowait);
    expect(out.kind).toBe('refused');
  });

  it('stops on the clock, even if the server has gone quiet', async () => {
    /* A server that stops answering must not leave a window spinning for
       ever — the code's own expiry is checked here as well. */
    let clock = Date.now();
    const out = await collect(
      scripted([{ status: 202, body: {} }, { status: 202, body: {} }]),
      pending({ expiresAt: new Date(clock + 5_000).toISOString() }),
      DEFAULT_ORIGIN,
      { sleep: async () => { clock += 4_000; }, now: () => clock },
    );
    expect(out.kind).toBe('expired');
  });

  it('survives the wifi dropping mid-sign-in', async () => {
    /* The laptop that went to sleep comes back and finds it still waiting.
       A network failure is not an answer. */
    const t = scripted([{ status: 0, body: {} }, { status: 0, body: {} }, ok()]);
    const out = await collect(t, pending(), DEFAULT_ORIGIN, nowait);
    expect(out.kind).toBe('signed-in');
  });

  it('backs off when the network is unhappy, and caps the back-off', async () => {
    const waits: number[] = [];
    await collect(
      scripted([{ status: 0, body: {} }, { status: 0, body: {} }, { status: 0, body: {} }, ok()]),
      pending(),
      DEFAULT_ORIGIN,
      { sleep: async (ms) => { waits.push(ms); } },
    );
    expect(waits[0]).toBe(6_000);
    expect(waits[1]).toBe(12_000);
    expect(Math.max(...waits)).toBeLessThanOrEqual(30_000);
  });

  it('can be cancelled by the person', async () => {
    const signal = { aborted: false };
    const t = scripted([{ status: 202, body: {} }, { status: 202, body: {} }, ok()]);
    const out = await collect(t, pending(), DEFAULT_ORIGIN, {
      sleep: async () => { signal.aborted = true; },
      signal,
    });
    expect(out.kind).toBe('expired');
    expect(t.calls).toHaveLength(1);
  });

  it('reports every tick, so a window can say what is happening', async () => {
    const seen: string[] = [];
    await collect(scripted([{ status: 202, body: {} }, ok()]), pending(), DEFAULT_ORIGIN, {
      ...nowait,
      onTick: (o) => seen.push(o.kind),
    });
    expect(seen).toEqual(['waiting', 'signed-in']);
  });
});

describe('on start-up, and on the way out', () => {
  it('asks who the kept token belongs to, as the app not as a browser', async () => {
    const t = scripted([{
      status: 200,
      body: { user: { email: 'a@b.c', role: 'mentor' }, permissions: ['documents.create'] },
    }]);
    const who = await whoAmI(t, 'tok');
    expect(who?.role).toBe('mentor');
    expect(who?.permissions).toEqual(['documents.create']);
    expect(t.calls[0]?.headers?.authorization).toBe('Bearer tok');
  });

  it('answers null when there is no network — which is NOT "signed out"', async () => {
    /* A person on a train is still signed in. The caller keeps the token and
       shows it as unverified; throwing it away here would sign them out every
       time the wifi drops. */
    expect(await whoAmI(scripted([{ status: 0, body: {} }]), 'tok')).toBeNull();
  });

  it('signs out locally even when the server cannot be told', async () => {
    expect(await signOut(scripted([{ status: 0, body: {} }]), 'tok')).toEqual({ serverToo: false });
    expect(await signOut(scripted([{ status: 200, body: { ok: true } }]), 'tok'))
      .toEqual({ serverToo: true });
  });
});

describe('the origin', () => {
  it('is honoured everywhere, so a staging build never talks to production', async () => {
    const t = scripted([{ status: 201, body: started }, { status: 202, body: {} }]);
    await beginSignIn(t, 'x', 'http://localhost:3001');
    await poll(t, pending(), 'http://localhost:3001');
    for (const call of t.calls) expect(call.url.startsWith('http://localhost:3001')).toBe(true);
  });

  it('defaults to vedaunion.org and not to something local', () => {
    /* A shipped build that quietly points at a developer's machine would fail
       for everyone in a way nobody could diagnose. */
    expect(DEFAULT_ORIGIN).toBe('https://vedaunion.org');
    expect(vi.isMockFunction(() => 0)).toBe(false);
  });
});
