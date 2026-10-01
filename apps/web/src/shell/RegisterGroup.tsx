/**
 * WHICH RULES THE TEXT FOLLOWS — the register, named on screen at last.
 *
 * The rules are not one set and never were. A Taittirīya text and a purāṇic
 * stotra take different accents, a different anusvāra and different aids, and
 * the engine has carried five registers from the beginning. Nothing in the
 * interface ever said which one a document was under, so the answer to "what
 * decided these marks?" was: read the file.
 *
 * So this is a LARGE button that says the answer standing still, and opens the
 * five with what each one is for. Large because it is the most consequential
 * thing on the Marking tab — every mark on the page came out of it — and
 * because a person who has just opened a chant from somewhere else needs to
 * see, without asking, whether the program thinks it is Ṛgvedic.
 *
 * TWO SCOPES. A register belongs to the text it marks, never to "the
 * document" (the owner, 2026-09-30): a collection — a manual, a pūjā — has
 * its saṅkalpa in prose inside a book of Taittirīya. So the menu sets either
 * the sections that name no register of their own, or the section under the
 * caret, and says which section that is rather than making the reader guess.
 *
 * AND THE CONVENTIONS, the same four switches the Word add-in has, each with
 * what it does to a typed example (`CONVENTIONS` in the engine).
 */
import { useRef, useState, type ReactNode } from 'react';
import { CHANT_PROFILE_KEYS, CHANT_PROFILE_NOTES, type ChantProfileKey } from '@siksamitra/format';
import { CONVENTIONS } from '@siksamitra/engine';
import { conventionsOf } from '@siksamitra/edit';
import { Popover } from '@siksamitra/ui';
import { RibbonButton } from '@siksamitra/ui';
import type { Session } from '../editor/useSession.js';

export function RegisterGroup(
  { session, onNote }: { session: Session; onNote: (note: string) => void },
): ReactNode {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const [scope, setScope] = useState<'document' | 'section'>('document');

  const here = session.sectionRegister;
  const section = session.doc.sections.find((s) => s.id === session.sectionId);
  const shown = scope === 'section' ? here : session.register;
  const label = shown === null ? 'Not set' : CHANT_PROFILE_NOTES[shown].name;

  const choose = (preset: ChantProfileKey | null): void => {
    onNote(session.setRegister(scope, preset));
    setOpen(false);
  };

  return (
    <div className="rbg" ref={anchor}>
      <RibbonButton
        icon="tree"
        label={label}
        size="lg"
        title="Which register's rules produced the marks on this text"
        pressed={open}
        onClick={() => setOpen((o) => !o)}
      />
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} label="Rules">
        <div className="menu menu--wide">
          <p className="menu__lbl">These rules apply to</p>
          <div className="menu__row">
            {(['document', 'section'] as const).map((s) => (
              <button
                type="button"
                key={s}
                className={scope === s ? 'menu__seg is-on' : 'menu__seg'}
                aria-pressed={scope === s}
                onClick={() => setScope(s)}
                disabled={s === 'section' && section === undefined}
              >
                {s === 'document'
                  ? 'Sections without their own'
                  : `Only “${section?.title ?? 'this section'}”`}
              </button>
            ))}
          </div>
          {/*
            SAID, not implied. A section that names nothing follows the
            document, and a reader who cannot see that reads a blank as a
            mistake.
          */}
          {scope === 'section' && here === null && (
            <p className="menu__hint">
              This section names none of its own, so it follows the sections without their own.
            </p>
          )}

          <p className="menu__lbl menu__lbl--second">Register</p>
          {CHANT_PROFILE_KEYS.map((k) => {
            const note = CHANT_PROFILE_NOTES[k];
            return (
              <button
                type="button"
                key={k}
                className={shown === k ? 'menu__opt menu__opt--tall is-on' : 'menu__opt menu__opt--tall'}
                aria-pressed={shown === k}
                onClick={() => choose(k)}
              >
                <span className="menu__name">{note.name}</span>
                <span className="menu__note">{note.where}</span>
                <span className="menu__note">{note.what}</span>
              </button>
            );
          })}
          <button
            type="button"
            className={shown === null ? 'menu__opt is-on' : 'menu__opt'}
            aria-pressed={shown === null}
            onClick={() => choose(null)}
          >
            <span className="menu__name">Name none here</span>
            <span className="menu__note">
              {scope === 'document'
                ? 'Fall back to the program’s default, Taittirīya.'
                : 'Follow the sections without their own.'}
            </span>
          </button>

          <p className="menu__lbl menu__lbl--second">Conventions</p>
          {CONVENTIONS.map((c) => {
            const on = conventionsOf(session.doc, scope === 'section' ? section : undefined)[c.id];
            return (
              <button
                type="button"
                key={c.id}
                role="menuitemcheckbox"
                className={on ? 'menu__opt menu__opt--tall is-on' : 'menu__opt menu__opt--tall'}
                aria-checked={on}
                title={c.note}
                onClick={() => onNote(session.setConventions(scope, { [c.id]: !on }))}
              >
                <span className="menu__name">{on ? '✓ ' : ''}{c.label}</span>
                <span className="menu__note">{c.example.typed} → {c.example.marked}</span>
              </button>
            );
          })}

          {/*
            WHAT IT WILL NOT DO, before it is pressed rather than after. A
            change re-derives, and a verse copied from a marked source is
            never re-derived — that is rule zero, and the one thing someone
            choosing here might reasonably fear.
          */}
          <p className="menu__hint menu__hint--foot">
            Changing this re-marks the text. Verses copied from a marked source
            keep their own marks. Ctrl+Z puts it all back.
          </p>
        </div>
      </Popover>
    </div>
  );
}
