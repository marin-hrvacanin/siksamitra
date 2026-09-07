/**
 * The navigation panel — the document's own structure, down the side.
 *
 * WHAT IT IS FOR. These documents are long: Śrī Rudram is 198 verses over 36
 * parts, the pūjā manual 57 steps. Finding the fourth anuvāka by scrolling is
 * the difference between a tool and a text box, which is why Word has a
 * Navigation pane and every editor of this kind has an outline. It answers two
 * questions at once — what is in this document, and where am I in it.
 *
 * THE TREE IS THE DOCUMENT'S, not a second model of it. Parts, steps and
 * verses come from `blockRefs`, the same list the renderer draws and the
 * paginator measures, so an outline entry cannot exist without a block or
 * point at one that moved. That is the rule that keeps a navigator honest.
 *
 * WHERE AM I is read from the scroller, not from the caret: you scroll to look
 * at something long before you click in it, and an outline that only followed
 * the caret would sit still while you read.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { recitationText } from '@siksamitra/format';
import type { ChantDoc, ChantToken } from '@siksamitra/format';
import { Icon } from '../ui/Icon.js';
import { blockId } from '../views/DocumentBlocks.js';

export interface OutlineNode {
  readonly id: string;
  /** The block to scroll to. */
  readonly blockId: string;
  readonly label: string;
  /** A verse's opening words, cut short — what a person actually recognises. */
  readonly incipit?: string;
  readonly kind: 'part' | 'section' | 'verse';
  readonly children: readonly OutlineNode[];
}

/**
 * A verse's opening words.
 *
 * Enough to recognise it and no more: about thirty characters, cut at a word
 * so a row never ends mid-syllable, with an ellipsis to say there is more.
 */
function incipitOf(verse: { tokens: readonly ChantToken[] }): string {
  const text = recitationText(verse.tokens, 'iast').replace(/\s+/g, ' ').trim();
  if (text.length <= 30) return text;
  const cut = text.slice(0, 30);
  const space = cut.lastIndexOf(' ');
  return `${(space > 12 ? cut.slice(0, space) : cut).trim()}…`;
}

/**
 * The document as a tree.
 *
 * Two levels of heading and then verses: a part groups sections, a section
 * holds verses. A document with no parts (most chants) gets sections at the
 * top, rather than one empty part wrapping everything.
 */
export function outlineOf(doc: ChantDoc): readonly OutlineNode[] {
  const roots: OutlineNode[] = [];
  let part: { node: OutlineNode; children: OutlineNode[] } | null = null;

  for (const section of doc.sections) {
    /*
     * A section with NO part ends the run. `part` names the run of numbering a
     * step belongs to, so a step that names none is not in the previous one —
     * and nesting it there put an untitled section under a part it has nothing
     * to do with, where nobody would look for it.
     */
    if (section.part === undefined) part = null;
    else if (section.part !== part?.node.label) {
      const children: OutlineNode[] = [];
      const node: OutlineNode = {
        id: `part:${section.id}`,
        blockId: blockId.part(section.id),
        label: section.part,
        kind: 'part',
        children,
      };
      part = { node, children };
      roots.push(node);
    }
    const title = section.title ?? section.label;
    const verses: OutlineNode[] = section.verses.map((v, i) => ({
      id: `verse:${section.id}:${v.id}`,
      blockId: blockId.verse(section.id, v.id),
      /*
       * THE NUMBER AND THE WORDS. A column of bare numerals says nothing about
       * a document — you cannot find the verse you remember by its index. The
       * incipit is how every index of chanted text has ever worked, and it is
       * what makes the panel a navigator rather than a counter.
       */
      label: v.n != null && v.n !== '' ? `${v.n}` : `${i + 1}`,
      incipit: incipitOf(v),
      kind: 'verse',
      children: [],
    }));
    const node: OutlineNode = {
      id: `section:${section.id}`,
      blockId: title === undefined || title === ''
        ? blockId.verse(section.id, section.verses[0]?.id ?? '')
        : blockId.heading(section.id),
      label: title === undefined || title === '' ? '(untitled)' : title,
      kind: 'section',
      children: verses,
    };
    if (part === null) roots.push(node);
    else part.children.push(node);
  }
  return roots;
}

/** Which block is at the top of the view. */
function useVisibleBlock(scroller: React.RefObject<HTMLElement | null>): string | null {
  const [at, setAt] = useState<string | null>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el === null) return;
    let frame = 0;
    const read = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = el.getBoundingClientRect().top;
        let best: string | null = null;
        let bestGap = Number.POSITIVE_INFINITY;
        for (const b of el.querySelectorAll<HTMLElement>('[data-block-id]')) {
          /* The measuring probe renders the whole document off-screen; taking
             its blocks would pin the outline to the first one for ever. */
          if (b.closest('.paged__probe') !== null) continue;
          const gap = b.getBoundingClientRect().top - top;
          if (gap > -40 && gap < bestGap) { bestGap = gap; best = b.dataset['blockId'] ?? null; }
        }
        setAt(best);
      });
    };
    read();
    el.addEventListener('scroll', read, { passive: true });
    return () => { el.removeEventListener('scroll', read); cancelAnimationFrame(frame); };
  }, [scroller]);
  return at;
}

function Row(
  { node, depth, current, open, onToggle, onGo }: {
    node: OutlineNode;
    depth: number;
    current: string | null;
    open: ReadonlySet<string>;
    onToggle: (id: string) => void;
    onGo: (blockId: string) => void;
  },
): ReactNode {
  const expanded = open.has(node.id);
  const hasKids = node.children.length > 0;
  const here = current === node.blockId;
  return (
    <>
      <div
        className={here ? `nav__row nav__row--${node.kind} is-here` : `nav__row nav__row--${node.kind}`}
        style={{ paddingInlineStart: `calc(var(--space-4) + ${depth} * var(--space-6))` }}
      >
        {hasKids ? (
          <button
            type="button"
            className="nav__twist"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
            onClick={() => onToggle(node.id)}
          >
            <Icon name="chevron" size="sm" className={expanded ? 'nav__caret is-open' : 'nav__caret'} />
          </button>
        ) : <span className="nav__twist" aria-hidden />}
        <button
          type="button"
          className="nav__go"
          aria-current={here ? 'true' : undefined}
          title={node.incipit === undefined ? node.label : `${node.label}  ${node.incipit}`}
          onClick={() => onGo(node.blockId)}
        >
          <span className="nav__n">{node.label}</span>
          {node.incipit !== undefined && <span className="nav__text">{node.incipit}</span>}
        </button>
      </div>
      {expanded && node.children.map((k) => (
        <Row
          key={k.id}
          node={k}
          depth={depth + 1}
          current={current}
          open={open}
          onToggle={onToggle}
          onGo={onGo}
        />
      ))}
    </>
  );
}

export function NavPanel(
  { doc, scroller, onGo, onClose, open, onOpen }: {
    doc: ChantDoc | null;
    scroller: React.RefObject<HTMLElement | null>;
    onGo: (blockId: string) => void;
    onClose: () => void;
    /**
     * WHICH ROWS ARE EXPANDED — held by the caller, on purpose.
     *
     * The panel unmounts when it is hidden, and state inside a component that
     * unmounts is state that is thrown away: opening a section, hiding the
     * panel and showing it again put every row back to closed. Where you were
     * in a document is not something a program should forget because a panel
     * was out of the way for a moment.
     */
    open: ReadonlySet<string>;
    onOpen: (next: ReadonlySet<string>) => void;
  },
): ReactNode {
  const tree = useMemo(() => (doc === null ? [] : outlineOf(doc)), [doc]);
  const current = useVisibleBlock(scroller);

  const toggle = (id: string): void => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id); else next.add(id);
    onOpen(next);
  };

  return (
    <aside className="nav" aria-label="Navigation">
      <header className="nav__head">
        <Icon name="outline" size="sm" />
        <h2 className="nav__title">Navigation</h2>
        <button
          type="button"
          className="nav__close"
          onClick={onClose}
          aria-label="Hide the navigation panel"
          title="Hide the navigation panel"
        >
          <Icon name="panel-close" size="sm" />
        </button>
      </header>
      <div className="nav__body">
        {tree.length === 0 && <p className="nav__empty">Nothing open.</p>}
        {tree.map((n) => (
          <Row
            key={n.id}
            node={n}
            depth={0}
            current={current}
            open={open}
            onToggle={toggle}
            onGo={onGo}
          />
        ))}
      </div>
    </aside>
  );
}
