/**
 * A CALL THE MODEL WROTE AS TEXT IS STILL THE CALL.
 *
 * The case is a real one, its markup copied from the run (2026-10-02, the
 * Gāyatrī): twenty-four sound steps, then `build_document` written out in
 * DeepSeek's own markup and no `tool_calls`, which the loop took for the
 * answer — nothing built, the markup about to be sent to the chat.
 */
import { describe, expect, it } from 'vitest';
import { callsInText } from '../dsml.js';

const B = '｜｜';
const RUN = [
  "The reviewer's two points are right: the letters are the accented Taittirīya pāda, so I'll build from the library's verified witness.",
  '',
  `<${B}DSML${B} calls>`,
  `<${B}DSML${B} invoke name="build_document">`,
  `<${B}DSML${B} parameter name="description" string="true">The Gāyatrī mantra as it is recited in the Taittirīya tradition</${B}DSML${B} parameter>`,
  `<${B}DSML${B} parameter name="locus" string="true">ṛgvedasaṁhitā 3.62.10</${B}DSML${B} parameter>`,
  `<${B}DSML${B} parameter name="sections" string="false">[{"verses": [{"witness": "puja-vidhi", "at": "n-gayatri", "note": "viśvāmitraḥ ṛṣiḥ, savitā devatā, gāyatrī chandaḥ"}]}]</${B}DSML${B} parameter>`,
  `<${B}DSML${B} parameter name="source" string="true">taittiriya</${B}DSML${B} parameter>`,
  `<${B}DSML${B} parameter name="title" string="true">gāyatrī mantra</${B}DSML${B} parameter>`,
  `</${B}DSML${B} invoke>`,
  `</${B}DSML${B} calls>`,
].join('\n');

describe('a tool call written into the message', () => {
  it('is read as the call, its JSON parameters parsed and its text ones kept', () => {
    const got = callsInText(RUN)!;
    expect(got.calls.map((c) => c.name)).toEqual(['build_document']);
    const args = JSON.parse(got.calls[0]!.arguments) as Record<string, unknown>;
    expect(args.title).toBe('gāyatrī mantra');
    expect(args.source).toBe('taittiriya');
    expect(args.locus).toBe('ṛgvedasaṁhitā 3.62.10');
    expect(args.sections).toEqual([{ verses: [{ witness: 'puja-vidhi', at: 'n-gayatri', note: 'viśvāmitraḥ ṛṣiḥ, savitā devatā, gāyatrī chandaḥ' }] }]);
  });

  it('and the markup is taken out of what is shown, the model’s own words kept', () => {
    const got = callsInText(RUN)!;
    expect(got.rest).toBe("The reviewer's two points are right: the letters are the accented Taittirīya pāda, so I'll build from the library's verified witness.");
    expect(got.rest).not.toContain('DSML');
  });

  it('two calls in one message are two calls; one bar or a narrow one reads the same', () => {
    const one = '｜';
    const two = [`<${one}DSML${one}invoke name="check">`, `</${one}DSML${one}invoke>`, '<|DSML|invoke name="deliver">',
      '<|DSML|parameter name="format" string="true">pdf</|DSML|parameter>', '</|DSML|invoke>'].join('\n');
    const got = callsInText(two)!;
    expect(got.calls.map((c) => [c.name, c.arguments])).toEqual([['check', '{}'], ['deliver', '{"format":"pdf"}']]);
  });

  it('a message without the markup is left alone', () => {
    expect(callsInText('Here is the Gāyatrī, as a PDF.')).toBeNull();
    expect(callsInText('DSML is mentioned, but nothing is called.')).toBeNull();
  });
});

describe('the model layer, given such an answer', () => {
  it('hands the loop the call, and the person only the words', async () => {
    const { chatCompletions } = await import('../model.js');
    const fetch = async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: RUN } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, prompt_cache_hit_tokens: 0 },
      }),
    });
    const model = chatCompletions({ baseUrl: 'https://x', apiKey: 'k', model: 'm', fetch });
    const reply = await model.complete({ messages: [{ role: 'user', content: 'the Gāyatrī' }], tools: [] });
    expect(reply.finish).toBe('tool_calls');
    expect(reply.message.toolCalls?.map((c) => c.name)).toEqual(['build_document']);
    expect(reply.message.content).not.toContain('DSML');
  });
});
