/**
 * THE PROGRESS OF ONE REQUEST, AS TEXT — what the chat's status message says.
 *
 * Without Telegram, so it can be tested. The owner's words for it:
 *
 *   - "don't delete … just update the message, append the newest status" —
 *     the message stays when the answer comes, and says how it ended;
 *   - "the icon should depend on what he's doing … consistently … also
 *     success and failure" — `stepIcon` and `OUTCOME_ICON` in the agent;
 *   - "the message should be able to get a lot longer before the compaction
 *     of the top" — every step stays until the message nears Telegram's
 *     limit, and only then do the oldest give way;
 *   - "remove the /stop at the end … it's for non-tech people" — the command
 *     works, and the message does not name it;
 *   - what is said is what is being DONE, from each step's own detail, and
 *     the model's own one line on what it is about to do.
 */
import { OUTCOME_ICON, stepAttention, stepIcon } from '@siksamitra/agent';

/** Telegram's limit for a message is 4096; this leaves room for the edits around it. */
export const STATUS_BUDGET = 3600;

interface Line {
  readonly icon: string;
  readonly text: string;
  readonly by: 'agent' | 'reviewer';
  outcome?: string;
  state: 'running' | 'done' | 'attention' | 'failed';
}

export type Ending = 'answered' | 'stopped' | 'failed';

export class StatusLog {
  private readonly lines: Line[] = [];
  private intent: string | null = null;
  private slow = false;
  private ending: { how: Ending; ms: number } | null = null;

  /** A step began. */
  started(name: string, text: string, by: 'agent' | 'reviewer' = 'agent'): void {
    this.lines.push({ icon: stepIcon(name), text, by, state: 'running' });
    this.slow = false;
  }

  /** The last step of this kind of worker ended. */
  finished(name: string, outcome: string, failed: boolean, by: 'agent' | 'reviewer' = 'agent'): void {
    const open = [...this.lines].reverse().find((l) => l.by === by && l.state === 'running');
    if (open === undefined) return;
    open.outcome = outcome;
    open.state = failed ? 'failed' : stepAttention(name, outcome) ? 'attention' : 'done';
  }

  /** What the agent says it is about to do. */
  thinking(text: string): void { this.intent = text.replace(/\s+/g, ' ').trim(); }

  /** The person wrote while it worked. */
  noted(what: string): void {
    this.lines.push({ icon: '↪️', text: `your note: ${what.length > 120 ? `${what.slice(0, 120)}…` : what}`, by: 'agent', state: 'done' });
  }

  /** A minute with no step: the model is taking its time. */
  quiet(): void { this.slow = true; }

  /** The request is over. */
  end(how: Ending, ms: number): void { this.ending = { how, ms }; }

  private lineText(l: Line): string {
    const indent = l.by === 'reviewer' ? '    ↳ ' : '';
    if (l.state === 'running') return `${indent}⏳ ${l.icon} ${l.text}…`;
    const mark = l.state === 'failed' ? OUTCOME_ICON.failed : l.state === 'attention' ? OUTCOME_ICON.attention : OUTCOME_ICON.done;
    return `${indent}${mark} ${l.icon} ${l.text}${l.outcome === undefined || l.outcome === '' ? '' : ` — ${l.outcome}`}`;
  }

  /** The message as it stands. */
  text(): string {
    const head = this.ending === null ? '🕉️ Working on it' : null;
    const tail: string[] = [];
    if (this.ending === null) {
      if (this.intent !== null) tail.push(`💭 ${this.intent}`);
      if (this.slow) tail.push('🐢 The model is slow just now — still working.');
      tail.push('', 'You can write to me while I work, and I will take it into account.');
    } else {
      const took = this.ending.ms < 60_000
        ? `${Math.max(1, Math.round(this.ending.ms / 1000))} s`
        : `${Math.floor(this.ending.ms / 60_000)} min ${Math.round((this.ending.ms % 60_000) / 1000)} s`;
      tail.push('', this.ending.how === 'answered' ? `✅ Done in ${took}.`
        : this.ending.how === 'stopped' ? `⏹️ Stopped, as you asked, after ${took}.`
          : `❌ Something went wrong after ${took}.`);
    }
    const body = this.lines.map((l) => this.lineText(l));
    /* Every step stays until the message nears the limit; then the oldest go.
       Measured as the message will be sent, its own "earlier" line counted. */
    const message = (dropped: number): string => [
      ...(head === null ? [] : [head, '']),
      ...(dropped > 0 ? [`… ${dropped} earlier step(s)`] : []),
      ...body.slice(dropped),
      ...tail,
    ].join('\n');
    let dropped = 0;
    while (dropped < body.length - 1 && message(dropped).length > STATUS_BUDGET) dropped += 1;
    return message(dropped);
  }
}
