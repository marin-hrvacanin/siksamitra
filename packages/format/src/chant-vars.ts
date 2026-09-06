/**
 * Document VARIABLES carried in the URL.
 *
 * A document with variables — the saṅkalpa is the first, and it will not be the
 * last — renders differently for every reader, because deity, level, gotra and
 * name are that reader's own. That is right when you are reciting it and wrong
 * when you are SENDING it: a link has to arrive looking the way its sender saw
 * it, or the sender has no way to show anyone anything.
 *
 * So variables travel as query parameters, namespaced `v.` so they can never
 * collide with the reader's own display params (`s`, `s2`, `m`, `v` — script,
 * secondary script, mode, verse; AUTHORING-CHANTS §5D). The prefix is what
 * makes this GENERIC: this module knows nothing about which variables exist.
 * It splits `v.deity=ganesha` into the name `deity` and the value `ganesha`,
 * and the module that owns the variables decides what is valid.
 *
 * THE PRECEDENCE RULE, and it is the whole point:
 *
 *     URL parameter  >  the reader's saved preference  >  the document default
 *
 * A shared link wins for the person opening it.
 *
 * THE NON-PERSISTENCE RULE, which is the other half of it:
 *
 *     a URL parameter applies to THAT VIEW ONLY.
 *
 * It is never written into the recipient's stored preferences. Opening someone
 * else's saṅkalpa must not silently rewrite your own deity or your own gotra —
 * that is the difference between a share link and a hijack. The parameter stops
 * applying the moment the recipient touches that control themselves, and only
 * then does their own choice persist, because that choice is theirs.
 *
 * PRIVACY. `name` and `gotra` are personal data. Putting them in a URL is fine
 * when the sender chooses to; storing them because they arrived in one is not.
 * They must stay out of any cache key, any log line and any document payload —
 * they belong in the recipient's own preferences record and nowhere else.
 */

/** Namespace for a variable parameter. Short, readable, collision-proof. */
export const CHANT_VAR_PREFIX = 'v.';

/** Longest value accepted from a URL. Free-text variables are display strings,
 *  never markup and never a payload; anything longer is not a name. */
export const CHANT_VAR_MAX = 120;

export type ChantVars = Record<string, string>;

/**
 * The `v.*` parameters of a query string, as `{ name: value }`.
 *
 * Accepts a raw `location.search`, a query string with or without the leading
 * `?`, or an already-parsed `URLSearchParams`. Empty values are dropped: an
 * empty parameter is not "set this to nothing", it is noise.
 */
export function parseChantVars(search: string | URLSearchParams | null | undefined): ChantVars {
  if (!search) return {};
  const q = typeof search === 'string' ? new URLSearchParams(search.replace(/^[?#]/, '')) : search;
  const out: ChantVars = {};
  q.forEach((value, key) => {
    if (!key.startsWith(CHANT_VAR_PREFIX)) return;
    const name = key.slice(CHANT_VAR_PREFIX.length);
    const v = value.trim();
    if (!name || !v || v.length > CHANT_VAR_MAX) return;
    out[name] = v;
  });
  return out;
}

/** `{ deity: 'ganesha' }` → `v.deity=ganesha`, skipping empty values. */
export function chantVarsToParams(vars: Record<string, string | null | undefined>): URLSearchParams {
  const q = new URLSearchParams();
  for (const name of Object.keys(vars).sort()) {
    const v = (vars[name] ?? '').trim();
    if (!v || v.length > CHANT_VAR_MAX) continue;
    q.set(CHANT_VAR_PREFIX + name, v);
  }
  return q;
}

/**
 * A shareable link: the given base URL with its existing `v.*` parameters
 * replaced by `vars`, and every other parameter left alone (the reader's own
 * `s`/`s2`/`m`/`v` survive, so the recipient also lands in the right script).
 */
export function chantVarsLink(base: string, vars: Record<string, string | null | undefined>): string {
  const hash = base.indexOf('#');
  const frag = hash >= 0 ? base.slice(hash) : '';
  const head = hash >= 0 ? base.slice(0, hash) : base;
  const cut = head.indexOf('?');
  const path = cut >= 0 ? head.slice(0, cut) : head;
  const q = new URLSearchParams(cut >= 0 ? head.slice(cut + 1) : '');
  for (const key of [...q.keys()]) if (key.startsWith(CHANT_VAR_PREFIX)) q.delete(key);
  chantVarsToParams(vars).forEach((value, key) => q.set(key, value));
  const s = q.toString();
  return `${path}${s ? `?${s}` : ''}${frag}`;
}
