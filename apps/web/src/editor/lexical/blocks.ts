/**
 * A VERSE AND A PĀDA, as Lexical blocks.
 *
 * `MarkedText.ts` is the one node the TEXT is made of; these are the two the
 * structure is made of. Together they are the whole document tree:
 *
 *   VerseNode          one verse, carrying its id
 *     PadaNode         one recitation line — a breath
 *       MarkedTextNode one run over which every marking is constant
 *
 * WHY A PĀDA IS A BLOCK AND NOT A LINE BREAK. Lexical's block model already
 * knows how to put a caret at the start of one, select across two, and split
 * one with Enter — and `insertNewAfter` below is the whole of "Enter makes a
 * new pāda". Expressing a pāda as a `<br>` inside one block would mean
 * reimplementing every one of those, which is what the hand-written surface
 * does today in about 1,800 lines. The document's own model agrees: a pāda is
 * a `br` TOKEN between syllables, but it is a metrical line — a unit of the
 * text, not a consequence of the column width.
 *
 * WHY `data-line` IS RENUMBERED RATHER THAN STORED. It is a pāda's INDEX among
 * its siblings, so it changes when a pāda is added or removed anywhere above
 * it — and a value stored on the node would be right at the moment it was
 * created and wrong forever after. `renumberPadas` runs on the update that
 * changed the tree. The audio highlight and the pagination both address a line
 * by that attribute, so it has to be true rather than nearly true.
 */
import {
  $applyNodeReplacement,
  $createParagraphNode,
  ElementNode,
  type DOMConversionMap,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type RangeSelection,
  type SerializedElementNode,
  type Spread,
} from 'lexical';

export type SerializedVerse = Spread<{ verseId: string }, SerializedElementNode>;

/* ── a pāda: one recitation line ─────────────────────────────────────────── */

export class PadaNode extends ElementNode {
  static override getType(): string { return 'pada'; }

  static override clone(node: PadaNode): PadaNode { return new PadaNode(node.__key); }

  override createDOM(): HTMLElement {
    const dom = document.createElement('div');
    dom.className = 'pada';
    dom.dataset['line'] = String(this.getIndexWithinParent());
    return dom;
  }

  /**
   * `false`: the element is never rebuilt, only its children change.
   *
   * Returning `true` would throw away the DOM node on every keystroke, and
   * with it the browser's own selection inside it — which is the caret.
   */
  override updateDOM(): boolean { return false; }

  /**
   * ENTER, and this is the point of the whole exercise.
   *
   * Lexical calls this on the block the caret is in and puts the caret in what
   * comes back. There is no arithmetic here, no source map and no DOM
   * position: the framework moves the caret, because the framework knows where
   * it put the text. The hand-written surface computed a model address, mapped
   * it through a source map to a letter, found that letter's DOM node and
   * called `setBaseAndExtent` — four steps, each able to be off by one, and
   * one of them was.
   */
  override insertNewAfter(_selection: RangeSelection, restoreSelection = true): PadaNode {
    const pada = $createPadaNode();
    this.insertAfter(pada, restoreSelection);
    return pada;
  }

  /**
   * Backspace at the very start of a pāda joins it to the one above.
   *
   * `true` means "I handled it": the default would remove the block and leave
   * its text parentless. Joining is what a person means by deleting a line
   * break, and it is what Lexical's own `collapseAtStart` contract is for.
   */
  override collapseAtStart(): boolean {
    const previous = this.getPreviousSibling<ElementNode>();
    /* The first pāda of a verse has nothing above it inside the verse, and
       joining across a verse boundary is a different act — one the document
       has to be told about, because a verse id would disappear. */
    if (previous === null || !$isPadaNode(previous)) return false;
    for (const child of this.getChildren()) previous.append(child);
    this.remove();
    return true;
  }

  /** A pāda is never empty for long: an empty one still holds a caret. */
  override canBeEmpty(): boolean { return true; }

  static override importJSON(): PadaNode { return $createPadaNode(); }

  override exportJSON(): SerializedElementNode {
    return { ...super.exportJSON(), type: 'pada', version: 1 };
  }

  static override importDOM(): DOMConversionMap | null { return null; }
}

export const $createPadaNode = (): PadaNode => $applyNodeReplacement(new PadaNode());

export const $isPadaNode = (node: LexicalNode | null | undefined): node is PadaNode =>
  node instanceof PadaNode;

/* ── a verse: the thing a recording, a translation and an id belong to ───── */

export class VerseNode extends ElementNode {
  __verseId: string;

  constructor(verseId: string, key?: NodeKey) {
    super(key);
    this.__verseId = verseId;
  }

  static override getType(): string { return 'verse'; }

  static override clone(node: VerseNode): VerseNode {
    return new VerseNode(node.__verseId, node.__key);
  }

  override createDOM(_config: EditorConfig): HTMLElement {
    const dom = document.createElement('div');
    dom.className = 'verse';
    dom.dataset['verse'] = this.__verseId;
    return dom;
  }

  override updateDOM(prev: VerseNode, dom: HTMLElement): boolean {
    if (prev.__verseId !== this.__verseId) dom.dataset['verse'] = this.__verseId;
    return false;
  }

  getVerseId(): string { return this.getLatest().__verseId; }

  /**
   * ENTER AT THE END OF A VERSE STARTS THE NEXT ONE — but not from here.
   *
   * A pāda handles Enter, so this is reached only when the caret is in a verse
   * with no pāda at all, which the tree does not produce. Returning a
   * paragraph rather than a verse is deliberate: minting a verse id is the
   * DOCUMENT's business (`replaceRange` decides identity from the edit's
   * range, and a recording is keyed on it), so the surface must not invent one.
   * The bridge turns a stray paragraph into a verse when it writes back.
   */
  override insertNewAfter(_selection: RangeSelection, restoreSelection = true): LexicalNode {
    const next = $createParagraphNode();
    this.insertAfter(next, restoreSelection);
    return next;
  }

  override canBeEmpty(): boolean { return false; }

  static override importJSON(json: SerializedVerse): VerseNode {
    return $createVerseNode(json.verseId);
  }

  override exportJSON(): SerializedVerse {
    return { ...super.exportJSON(), verseId: this.__verseId, type: 'verse', version: 1 };
  }

  static override importDOM(): DOMConversionMap | null { return null; }
}

export const $createVerseNode = (verseId: string): VerseNode =>
  $applyNodeReplacement(new VerseNode(verseId));

export const $isVerseNode = (node: LexicalNode | null | undefined): node is VerseNode =>
  node instanceof VerseNode;

/* ── keeping `data-line` true ────────────────────────────────────────────── */

/**
 * Renumber every pāda's `data-line` from its place among its siblings.
 *
 * Registered as an update listener rather than done in `updateDOM`, because
 * `updateDOM` is called for a node that CHANGED and a pāda's index changes
 * when a DIFFERENT one is inserted above it. The audio highlight and the
 * pagination both address a line by this attribute.
 */
export function renumberPadas(editor: LexicalEditor): () => void {
  return editor.registerUpdateListener(({ editorState, dirtyElements }) => {
    if (dirtyElements.size === 0) return;
    editorState.read(() => {
      const root = editor.getRootElement();
      if (root === null) return;
      for (const verse of root.querySelectorAll<HTMLElement>('.verse')) {
        const padas = [...verse.children].filter((c) => c.classList.contains('pada'));
        for (const [i, pada] of padas.entries()) {
          const want = String(i);
          if ((pada as HTMLElement).dataset['line'] !== want) {
            (pada as HTMLElement).dataset['line'] = want;
          }
        }
      }
    });
  });
}
