/**
 * THE CONVENTIONS, SWITCHED IN A DOCUMENT OF THE APP — as the Word add-in has
 * them. The expectation is the ENGINE's reading of the document's profile,
 * and what Re-apply rules then makes of a verse.
 */
import { describe, expect, it } from 'vitest';
import { CONVENTIONS, resolveProfile } from '@siksamitra/engine';
import { emptyHistory } from '../history.js';
import { apply, newState, undo } from '../session.js';
import { conventionsOf } from '../set-conventions.js';
import { doc, section, verse } from './fixture.js';

const two = () => doc([section('s1', [verse('v-1', ['namaḥ kavaye'])]), section('s2', [verse('v-2', ['taṁ namāmi'])])]);
const defaults = Object.fromEntries(CONVENTIONS.map((c) => [c.id, c.isOn(resolveProfile([]))]));

describe('setConventions', () => {
  it('a document with none switched has the registry’s defaults', () => {
    expect(conventionsOf(two())).toEqual(defaults);
  });

  it('switched for the sections without their own: the profile says so, every other switch as it was', () => {
    const { state } = apply(newState(two()), emptyHistory(), { k: 'conventions', scope: 'document', chosen: { 'vy-aid': true } });
    expect(conventionsOf(state.doc)).toEqual({ ...defaults, 'vy-aid': true });
    expect(resolveProfile([state.doc.profile]).aids.vy).toBe(true);
  });

  it('the register it is layered on survives it', () => {
    let { state, history } = apply(newState(two()), emptyHistory(), { k: 'profile', scope: 'document', preset: 'smarta' });
    ({ state, history } = apply(state, history, { k: 'conventions', scope: 'document', chosen: { 'geminate-box': true } }));
    expect(state.doc.profile?.preset).toBe('smarta');
    expect(conventionsOf(state.doc)['geminate-box']).toBe(true);
  });

  it('for one section: that section only', () => {
    const { state } = apply(newState(two()), emptyHistory(), { k: 'conventions', scope: 'section', sectionId: 's2', chosen: { 'nasal-before-nasal': false } });
    expect(conventionsOf(state.doc, state.doc.sections[1])['nasal-before-nasal']).toBe(false);
    expect(conventionsOf(state.doc, state.doc.sections[0])['nasal-before-nasal']).toBe(true);
  });

  it('switched off again, it is off — an explicit value, not a lost one', () => {
    let { state, history } = apply(newState(two()), emptyHistory(), { k: 'conventions', scope: 'document', chosen: { 'visarga-before-velar': false } });
    expect(conventionsOf(state.doc)['visarga-before-velar']).toBe(false);
    ({ state, history } = apply(state, history, { k: 'conventions', scope: 'document', chosen: { 'visarga-before-velar': true } }));
    expect(conventionsOf(state.doc)['visarga-before-velar']).toBe(true);
  });

  it('one undo puts it back', () => {
    const start = newState(two());
    const { state, history } = apply(start, emptyHistory(), { k: 'conventions', scope: 'document', chosen: { 'vy-aid': true } });
    const back = undo(state, history);
    expect(conventionsOf(back.state.doc)).toEqual(defaults);
  });

  it('a section that does not exist is refused', () => {
    const { state } = apply(newState(two()), emptyHistory(), { k: 'conventions', scope: 'section', sectionId: 'nope', chosen: { 'vy-aid': true } });
    expect(state.refusals.length).toBeGreaterThan(0);
  });
});
