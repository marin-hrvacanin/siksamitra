/**
 * A BLOCK THE DOCUMENT DRAWS AND THE EDITOR DOES NOT EDIT.
 *
 * A document is more than its recitation text. It has part headings, section
 * headings, instructions, translations, source lines and pictures, and every
 * one of them is a field of the DOCUMENT rather than a stretch of the text a
 * caret walks through — `section.title`, `verse.translation.en`,
 * `item.instruction.text.en`. Changing one is its own command, not a keystroke
 * in a paragraph.
 *
 * So they are `DecoratorNode`s: Lexical holds their PLACE in the tree, in the
 * document's own order, and draws them with the same components and the same
 * class names the renderer uses — while the caret walks only the verses. That
 * is the division the hand-written surface already has (nothing but a verse
 * takes an edit today); saying it in the node type means Lexical enforces it
 * instead of us remembering to.
 *
 * `createDOM` RETURNS THE REAL ELEMENT — an `<h3 class="section__title">`, not
 * a wrapper around one. A decorator's React output is rendered INTO the element
 * `createDOM` returns, so returning the element the stylesheet expects keeps
 * the markup identical to `DocumentBlocks`'s: `document.css` styles by class,
 * the page map finds `[data-block-id]`, and the browser gates find what they
 * have always found. A wrapper would have been one more box between a heading
 * and its margin.
 *
 * The one exception is a picture, which IS a whole `<figure>` drawn by the
 * render package's one component. That gets a plain host element around it,
 * and the host is what carries the block id — which is also what
 * `.fig`'s width is a percentage of.
 */
import { DecoratorNode } from 'lexical';
import type {
  EditorConfig, LexicalNode, NodeKey, SerializedLexicalNode, Spread,
} from 'lexical';
import type { ReactNode } from 'react';
import { Figure, MissingFigure } from '@siksamitra/render';
import type { ChantFigure } from '@siksamitra/format';

/** Which of the document's drawn blocks this is. */
export type DrawnKind =
  | 'part' | 'heading' | 'instruction' | 'source'
  | 'translation' | 'figure';

/** What a drawn block needs in order to be drawn. */
export interface Drawn {
  readonly kind: DrawnKind;
  /** The page map's id for this block — `blockId` in `views/blocks.ts`. */
  readonly blockId: string;
  /** The words, for every kind but a picture. */
  readonly text?: string;
  /** The picture, when the document has it. */
  readonly figure?: ChantFigure;
  /** The name a `figure` item gave and the document did not have. */
  readonly missingRef?: string;
}

export type SerializedDrawn = Spread<{ block: Drawn }, SerializedLexicalNode>;

/** The element each kind IS, and the class the stylesheet knows it by. */
const ELEMENT: Readonly<Record<DrawnKind, readonly [string, string]>> = {
  part: ['h2', 'doc__part'],
  heading: ['h3', 'section__title'],
  instruction: ['p', 'doc__instruction'],
  source: ['p', 'doc__source'],
  translation: ['p', 'doc__translation'],
  figure: ['div', 'doc__figure'],
};

export class DrawnBlockNode extends DecoratorNode<ReactNode> {
  __block: Drawn;

  static override getType(): string { return 'drawn-block'; }

  static override clone(node: DrawnBlockNode): DrawnBlockNode {
    return new DrawnBlockNode(node.__block, node.__key);
  }

  constructor(block: Drawn, key?: NodeKey) {
    super(key);
    this.__block = block;
  }

  /** What this block is, for a reader that needs the document's own answer. */
  getBlock(): Drawn { return this.__block; }

  override createDOM(_config: EditorConfig): HTMLElement {
    const [tag, className] = ELEMENT[this.__block.kind];
    const dom = document.createElement(tag);
    dom.className = className;
    dom.dataset['blockId'] = this.__block.blockId;
    /*
     * NOT EDITABLE, and said to the browser rather than only to us. Without it
     * the caret walks into a heading inside an editable column and a Backspace
     * beside it removes the element from the DOM, with the document knowing
     * nothing about either.
     */
    dom.contentEditable = 'false';
    return dom;
  }

  /** `false`: the element is never rebuilt, only what is inside it. */
  override updateDOM(prev: DrawnBlockNode): boolean {
    return prev.__block.kind !== this.__block.kind
      || prev.__block.blockId !== this.__block.blockId;
  }

  override isInline(): boolean { return false; }

  /**
   * A caret that reaches one STOPS there.
   *
   * `isIsolated` is Lexical's own answer to "this is not text": the caret
   * cannot be extended over it, it cannot be selected by a keystroke, and an
   * adjacent Backspace does not delete it. Which is exactly the rule the
   * document needs — a translation is changed by a command, not by arriving at
   * it with an arrow key.
   */
  override isIsolated(): boolean { return true; }

  override decorate(): ReactNode {
    const { kind, text, figure, missingRef, blockId } = this.__block;
    if (kind !== 'figure') return text ?? '';
    if (figure !== undefined) return <Figure fig={figure} />;
    return <MissingFigure ref_={missingRef ?? ''} blockId={blockId} />;
  }

  static override importJSON(json: SerializedDrawn): DrawnBlockNode {
    return new DrawnBlockNode(json.block);
  }

  override exportJSON(): SerializedDrawn {
    return { ...super.exportJSON(), block: this.__block };
  }
}

export const $createDrawnBlockNode = (block: Drawn): DrawnBlockNode =>
  new DrawnBlockNode(block);

export const $isDrawnBlockNode = (node: LexicalNode | null | undefined): boolean =>
  node instanceof DrawnBlockNode;
