/**
 * Recovering the edit from the result.
 *
 * WHY THIS EXISTS. Editing happens on the section's flat text — that is what
 * gives one continuous caret across verses — but overrides are addressed per
 * line, so rebasing needs to know what happened to each line. Threading an
 * edit description through the string surgery is possible and it is exactly the
 * kind of bookkeeping that goes wrong once and then silently misplaces marks
 * forever.
 *
 * So the surgery is done plainly, and the edit is RECOVERED afterwards by
 * comparing before with after. Two levels:
 *
 *  - `contiguousDiff` recovers the single replacement that turns one string
 *    into another. Exact for any single-line change, whether it came from a
 *    keystroke or a paste, because any single-line change *is* one contiguous
 *    replacement once the common prefix and suffix are stripped.
 *  - `alignArrays` matches lines that survived an edit to their new index,
 *    using the same prefix/suffix idea one level up, so inserting or deleting
 *    a whole line does not misalign everything after it.
 *
 * Deliberately not a diff library. Neither of these is an approximation of a
 * minimal edit script: both are exact for the shape they claim and report
 * "unmatched" for anything else, which is what a rebase needs. A heuristic
 * three-way match would sometimes place a hand-drawn box on the wrong letter,
 * and being told "re-place this mark" is much better than that.
 */

/** The one replacement that turns `before` into `after`. */
export interface Replacement {
  /** Half-open range in `before`. */
  from: number;
  to: number;
  insert: string;
}

/**
 * Strip the common prefix and suffix; what is left is the replacement.
 *
 * The prefix and suffix must not overlap — with `before = "aa"` and
 * `after = "aaa"` the common prefix is 2 and the common suffix is also 2, and
 * naive arithmetic yields a negative range. The suffix is clamped to what the
 * prefix left, which puts the insertion at the earliest position that explains
 * the change. That choice is arbitrary and consistent, and consistency is what
 * matters: the same edit must rebase the same way every time.
 */
export function contiguousDiff(before: string, after: string): Replacement | null {
  if (before === after) return null;

  let prefix = 0;
  const max = Math.min(before.length, after.length);
  while (prefix < max && before[prefix] === after[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < max - prefix
    && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) suffix += 1;

  return {
    from: prefix,
    to: before.length - suffix,
    insert: after.slice(prefix, after.length - suffix),
  };
}

/**
 * Match items that survived, by identity from both ends.
 *
 * Returns, for each index in `before`, its index in `after`, or `null` if it
 * did not survive. Items in the middle are only matched when they are equal at
 * corresponding positions counted from the same end — anything else is
 * unmatched by design (see the header).
 */
export function alignArrays<T>(
  before: readonly T[],
  after: readonly T[],
  eq: (a: T, b: T) => boolean = (a, b) => a === b,
): (number | null)[] {
  const out: (number | null)[] = before.map(() => null);

  let head = 0;
  const shortest = Math.min(before.length, after.length);
  while (head < shortest && eq(before[head]!, after[head]!)) {
    out[head] = head;
    head += 1;
  }

  let tail = 0;
  while (
    tail < shortest - head
    && eq(before[before.length - 1 - tail]!, after[after.length - 1 - tail]!)
  ) {
    out[before.length - 1 - tail] = after.length - 1 - tail;
    tail += 1;
  }

  /*
   * The middle. When both sides have the same number of unmatched items they
   * are matched positionally: that is the ordinary case of typing into one
   * line of a verse, where the line changed but no line was added or removed,
   * and refusing to match it would drop every mark on the line the author is
   * working in. When the counts differ, a line was added or removed and there
   * is no position-preserving answer — those stay unmatched.
   */
  const oldMiddle = before.length - tail - head;
  const newMiddle = after.length - tail - head;
  if (oldMiddle > 0 && oldMiddle === newMiddle) {
    for (let k = 0; k < oldMiddle; k += 1) out[head + k] = head + k;
  }

  return out;
}
