/**
 * ASKING THE PERSON TO CHOOSE — buttons, where the host has them.
 */
import { arg, params, str, type Tool } from './types.js';

export const CHOICE_TOOLS: readonly Tool[] = [
  {
    writes: false,
    needs: 'choose',
    spec: {
      name: 'offer_choices',
      description: 'Ask the person to decide between a few options — which recension, which of the texts found, which '
        + 'format — shown to them as buttons. Then end your turn with one short line; their choice is their next message.',
      parameters: params({
        question: str('The question, short.'),
        options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 8, description: 'Each a few words.' },
      }, ['question', 'options']),
    },
    async run(args, { host }) {
      const options = arg<unknown[]>(args, 'options', 'array').map(String).map((o) => o.trim()).filter((o) => o !== '');
      if (options.length < 2) throw new Error('give at least two options');
      host.choose!(arg<string>(args, 'question', 'string'), options.slice(0, 8));
      return 'shown as buttons — end your turn now with one short line; the choice comes as the person\'s next message';
    },
  },
];
