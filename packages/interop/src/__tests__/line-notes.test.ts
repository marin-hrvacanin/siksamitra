/**
 * A NOTE THAT ENDS A LINE — found, and put back where it was.
 *
 * His `…ṛṣiḥ । svarabhakti` and `…aravāvahai । saha is with anudātta!`: 665
 * notes in the six reference documents, every one at the end of a line, and
 * every such line once refused because writing it would delete the note.
 */
import { describe, expect, it } from 'vitest';
import { wordRun as run, readParagraphs, mergeRuns } from '../docx-read.js';
import { lineNotes, withLineNotes } from '../word/line-notes.js';

const P = (inner: string): string => `<w:p><w:pPr><w:pStyle w:val="Translit"/></w:pPr>${inner}</w:p>`;
const R = (t: string): string => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;
const BR = '<w:r><w:br/></w:r>';
const back = (xml: string): string[] => mergeRuns(readParagraphs(xml).flatMap((p) => p.runs))
  .map((r) => `${r.rStyle ?? '-'}${r.superscript ? '^' : ''}:${r.text}`);

describe('finding the notes', () => {
  it('one ending the paragraph, with the space before it', () => {
    const { notes, stray } = lineNotes([run('ṛṣiḥ । '), run('svarabhakti', 'Comment')]);
    expect(stray).toBe(false);
    expect(notes).toEqual([{ line: 0, lead: ' ', runs: [run('svarabhakti', 'Comment')] }]);
  });
  it('one ending a pāda, before a line break — it belongs to THAT line', () => {
    const { notes } = lineNotes([run('agne । '), run('svarabhakti', 'Comment'), run('\nīḷe')]);
    expect(notes).toEqual([{ line: 0, lead: ' ', runs: [run('svarabhakti', 'Comment')] }]);
  });
  it('on the second line, counted by its line breaks', () => {
    const { notes } = lineNotes([run('agne\nīḷe '), run('83', 'Comment'), run('rd', 'Comment', true)]);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.line).toBe(1);
    expect(notes[0]!.runs).toHaveLength(2);
  });
  it('a note made of several runs keeps all of them, the blanks between included', () => {
    const { notes } = lineNotes([run('x । '), run('83', 'Comment'), run(' '), run('sūkta', 'Comment')]);
    expect(notes[0]!.runs.map((r) => r.text)).toEqual(['83', ' ', 'sūkta']);
  });
  it('a line holding ONLY a note', () => {
    const { notes, stray } = lineNotes([run('(anuṣṭup chandaḥ)', 'Comment')]);
    expect(stray).toBe(false);
    expect(notes).toEqual([{ line: 0, lead: '', runs: [run('(anuṣṭup chandaḥ)', 'Comment')] }]);
  });
  it('a Comment INSIDE a line is stray — there is no sure place to put it back', () => {
    expect(lineNotes([run('agne '), run('(TS 1.1)', 'Comment'), run(' īḷe')]).stray).toBe(true);
  });
  it('and a line with no Comment has no notes', () => {
    expect(lineNotes([run('agnim īḷe', null), run('ḷ', 'Holding')])).toEqual({ notes: [], stray: false });
  });
});

describe('putting them back', () => {
  it('at the end of the line they ended, after the writer\'s runs', () => {
    const notes = lineNotes([run('agne । '), run('svarabhakti', 'Comment'), run('\nīḷe')]).notes;
    const xml = withLineNotes(P(R('agne ।') + BR + R('īḷe')), notes);
    expect(back(xml)).toEqual(['-:agne । ', 'Comment:svarabhakti', '-:\nīḷe']);
  });
  it('run for run — a raised part of a note stays raised', () => {
    const notes = lineNotes([run('x । '), run('83', 'Comment'), run('rd', 'Comment', true)]).notes;
    expect(back(withLineNotes(P(R('x ।')), notes))).toEqual(['-:x । ', 'Comment:83', 'Comment^:rd']);
  });
  it('a note whose line is gone goes at the end, moved rather than lost', () => {
    const xml = withLineNotes(P(R('agne')), [{ line: 3, lead: ' ', runs: [run('n', 'Comment')] }]);
    expect(back(xml)).toEqual(['-:agne ', 'Comment:n']);
  });
  it('no notes is the identity', () => {
    const xml = P(R('agne'));
    expect(withLineNotes(xml, [])).toBe(xml);
  });
  it('and a round trip — find, remove, write, put back — gives the same runs', () => {
    const his = [run('ṛṣiḥ । '), run('svarabhakti', 'Comment'), run('\ndaśa '), run('bramha', 'Comment')];
    const { notes } = lineNotes(his);
    const xml = withLineNotes(P(R('ṛṣiḥ ।') + BR + R('daśa')), notes);
    expect(back(xml)).toEqual(back(P(his.map((r) => (r.rStyle === null
      ? R(r.text).replace('\n', '</w:t></w:r><w:r><w:br/></w:r><w:r><w:t xml:space="preserve">')
      : `<w:r><w:rPr><w:rStyle w:val="Comment"/></w:rPr><w:t xml:space="preserve">${r.text}</w:t></w:r>`)).join(''))));
  });
});
