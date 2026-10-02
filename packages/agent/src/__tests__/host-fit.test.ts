/**
 * ONE HARNESS, AND WHAT EACH HOST MAY DO — the gate between them.
 *
 * The bot offered "this document (here)" in a Telegram chat, where there is no
 * document: every host was told the same delivery formats. What the model is
 * told it can ask for is now what the host can do, and the prompt says where
 * the person is.
 */
import { describe, expect, it } from 'vitest';
import { systemFor, toolsFor } from '../modes.js';
import type { Delivered, Host } from '../tools/types.js';

const file = async (): Promise<Delivered> => ({ name: 'x.pdf', mime: 'application/pdf', bytes: new Uint8Array(1), format: 'pdf' });

const formats = (host: Host): unknown => {
  const deliver = toolsFor('deliver', host).find((t) => t.spec.name === 'deliver');
  const schema = deliver?.spec.parameters as { properties: { format: { enum: string[] } } } | undefined;
  return schema?.properties.format.enum;
};

describe('the deliver tool, as each host has it', () => {
  it('a chat that makes files is offered the files it can make, and never "here"', () => {
    const bot: Host = { where: 'a Telegram chat', exporters: { pdf: file, docx: file, smdoc: file, vedaunion: file }, deliver: async () => undefined };
    expect(formats(bot)).toEqual(['pdf', 'docx', 'smdoc', 'vedaunion']);
    const deliver = toolsFor('deliver', bot).find((t) => t.spec.name === 'deliver')!;
    expect(deliver.spec.description).not.toMatch(/here|caret|working in/);
    expect(deliver.spec.description).toMatch(/VedaUnion website upload/);
  });

  it('a document host with no files is offered "here" alone', () => {
    const word: Host = { where: "the Word add-in's panel", place: async () => 'placed' };
    expect(formats(word)).toEqual(['here']);
  });

  it('a host with both is offered both, "here" first', () => {
    const app: Host = { place: async () => 'opened', exporters: { pdf: file }, deliver: async () => undefined };
    expect(formats(app)).toEqual(['here', 'pdf']);
  });

  it('the prompt says where the person is, and that there is no document when there is none', () => {
    const bot: Host = { where: 'a Telegram chat: what you deliver is sent into the chat as a file', exporters: { pdf: file } };
    const prompt = systemFor('deliver', bot);
    expect(prompt).toContain('You are working in a Telegram chat');
    expect(prompt).toContain('There is no document open here');
    expect(prompt).not.toContain('deliver with format "here"');
    const word = systemFor('deliver', { place: async () => 'placed' });
    expect(word).toContain('deliver with format "here"');
    expect(word).not.toContain('There is no document open here');
  });

  it('the reviewer, on any host, can deliver nothing', () => {
    const bot: Host = { exporters: { pdf: file }, place: async () => 'x' };
    expect(toolsFor('review', bot).map((t) => t.spec.name)).not.toContain('deliver');
  });
});
