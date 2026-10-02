/**
 * THE STATUS MESSAGE, AS THE OWNER ASKED FOR IT — kept, appended to, an icon
 * per kind of work and per outcome, long before it is shortened, no `/stop`,
 * and closed with how the request ended.
 */
import { describe, expect, it } from 'vitest';
import { STATUS_BUDGET, StatusLog } from '../status.js';

describe('the status of a request', () => {
  it('says each step with its own detail, its kind’s icon, and how it ended', () => {
    const log = new StatusLog();
    log.started('web_search', 'Searching the web for “gāyatrī mantra”');
    log.finished('web_search', '5 result(s)', false);
    log.started('fetch_page', 'Reading sanskritdocuments.org');
    log.finished('fetch_page', 'no Sanskrit text on it', false);
    log.started('check', 'Checking every letter against the source and every mark against the rules');
    const text = log.text();
    expect(text).toContain('✅ 🔎 Searching the web for “gāyatrī mantra” — 5 result(s)');
    expect(text).toContain('⚠️ 📖 Reading sanskritdocuments.org — no Sanskrit text on it');
    expect(text).toContain('⏳ 🔬 Checking every letter');
  });

  it('a failed step is marked so', () => {
    const log = new StatusLog();
    log.started('fetch_page', 'Reading a page');
    log.finished('fetch_page', 'did not work', true);
    expect(log.text()).toContain('❌ 📖 Reading a page — did not work');
  });

  it('shows what the agent says it is about to do, and the reviewer’s steps under it', () => {
    const log = new StatusLog();
    log.thinking('I will look for an accented Taittirīya source of the Gāyatrī.');
    log.started('review', 'A second look: is this the Gāyatrī itself?');
    log.started('read_witness', 'Reading lines 10–20 of w2', 'reviewer');
    const text = log.text();
    expect(text).toContain('💭 I will look for an accented Taittirīya source of the Gāyatrī.');
    expect(text).toContain('    ↳ ⏳ 📖 Reading lines 10–20 of w2…');
  });

  it('never names /stop, and tells the person they may write while it works', () => {
    const text = new StatusLog().text();
    expect(text).not.toContain('/stop');
    expect(text).toContain('You can write to me while I work');
  });

  it('keeps every step until the message nears Telegram’s limit, and only then lets the oldest go', () => {
    const log = new StatusLog();
    for (let i = 0; i < 20; i += 1) { log.started('web_search', `Searching the web for “query ${i}”`); log.finished('web_search', '3 result(s)', false); }
    expect(log.text()).not.toContain('earlier step');
    expect(log.text()).toContain('query 0');
    for (let i = 20; i < 200; i += 1) { log.started('web_search', `Searching the web for “query ${i}”`); log.finished('web_search', '3 result(s)', false); }
    const text = log.text();
    expect(text.length).toBeLessThanOrEqual(STATUS_BUDGET);
    expect(text).toMatch(/… \d+ earlier step\(s\)/);
    expect(text).toContain('query 199');
  });

  it('is closed, not deleted, when the request ends — with how it ended', () => {
    const log = new StatusLog();
    log.started('deliver', 'Preparing the PDF');
    log.finished('deliver', 'ready', false);
    log.end('answered', 72_000);
    const text = log.text();
    expect(text).toContain('✅ 📄 Preparing the PDF — ready');
    expect(text).toContain('✅ Done in 1 min 12 s.');
    expect(text).not.toContain('You can write to me');
    const stopped = new StatusLog();
    stopped.end('stopped', 4_000);
    expect(stopped.text()).toContain('⏹️ Stopped, as you asked, after 4 s.');
  });
});
