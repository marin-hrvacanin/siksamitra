/**
 * A TOOL CALL THE MODEL WROTE AS TEXT — DeepSeek's own call markup, left in
 * the message instead of in `tool_calls`.
 *
 * Measured on a real run (2026-10-02, the Gāyatrī): after twenty-four sound
 * steps the model answered with its `build_document` call written out as
 * `<｜DSML｜invoke name="build_document">…</｜DSML｜invoke>` and no call at
 * all. The loop took the markup for the answer: nothing was built, and a chat
 * would have been sent the markup as the reply. A call written that way is
 * read as the call it is, and the markup is taken out of what is shown.
 *
 * Tolerant of the bars' count and width — `｜` (U+FF5C) or `|`, one or two —
 * because the markup is the model's and not a published format.
 */
const BAR = '[｜|]+';
const OPEN = (tag: string): string => `<${BAR}DSML${BAR}\\s*${tag}`;
const CLOSE = (tag: string): string => `</${BAR}DSML${BAR}\\s*${tag}\\s*>`;
const INVOKE = new RegExp(`${OPEN('invoke')}\\s+name="([^"]+)"\\s*>([\\s\\S]*?)${CLOSE('invoke')}`, 'gu');
const PARAMETER = new RegExp(
  `${OPEN('parameter')}\\s+name="([^"]+)"(?:\\s+string="(true|false)")?\\s*>([\\s\\S]*?)${CLOSE('parameter')}`, 'gu',
);
const BLOCK = new RegExp(`${OPEN('(?:function_)?calls')}\\s*>[\\s\\S]*?(?:${CLOSE('(?:function_)?calls')}|$)`, 'gu');

export interface TextCall {
  readonly name: string;
  /** JSON, as `tool_calls[].function.arguments` would carry it. */
  readonly arguments: string;
}

/** The calls written into a message, and the message without them — or null. */
export function callsInText(content: string): { calls: TextCall[]; rest: string } | null {
  if (!content.includes('DSML')) return null;
  const calls: TextCall[] = [];
  for (const m of content.matchAll(INVOKE)) {
    const args: Record<string, unknown> = {};
    for (const p of m[2]!.matchAll(PARAMETER)) {
      const raw = p[3]!;
      /* `string="false"` is JSON; anything else is the text itself. */
      if (p[2] === 'false') {
        try { args[p[1]!] = JSON.parse(raw); } catch { args[p[1]!] = raw; }
      } else {
        args[p[1]!] = raw;
      }
    }
    calls.push({ name: m[1]!, arguments: JSON.stringify(args) });
  }
  if (calls.length === 0) return null;
  const rest = content.replace(BLOCK, '').replace(INVOKE, '').trim();
  return { calls, rest };
}
