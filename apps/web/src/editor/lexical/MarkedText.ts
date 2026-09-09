/**
 * A RUN OF MARKED TEXT, as a Lexical node.
 *
 * The editing surface is Lexical (see `openspec/changes/text-and-marks`), and
 * this is the one node type the document is made of. A run is a stretch over
 * which every marking is constant, so applying a holding to a selection splits
 * the runs at its edges and sets the marks on what is left inside — which is
 * `formatText`'s shape, and which is why bold's behaviour comes free.
 *
 * THE DOM IS FLAT, AND THAT IS THE WHOLE DESIGN. `createDOM` returns ONE
 * element with the text directly inside it. The spike tried the alternative —
 * a node emitting this program's per-letter markup, a `.syl` per syllable and
 * a `.u` per letter — and it failed everything that matters: a click on the
 * sixth letter reported offset 1, and typing two characters turned `sunavāma`
 * into `YsX`. Lexical maps a DOM position to a model offset through the node's
 * own text node, and there is none when every letter is wrapped.
 *
 * What a flat run costs is the per-letter span. Nothing needed it: a mark that
 * belongs to one letter is a run of one letter, and the box, the svara stroke
 * and the colour are all CSS on the run. What it buys is that a holding over
 * eleven letters is ONE element that crosses a space, instead of one box per
 * syllable with CSS joining the edges back together.
 */
import { TextNode, type EditorConfig, type LexicalNode, type NodeKey, type SerializedTextNode, type Spread } from 'lexical';
import type { RunMarks } from '@siksamitra/render';

export type SerializedMarkedText = Spread<{ marks: RunMarks }, SerializedTextNode>;

/** The classes a run wears, from its markings. One place, so nothing drifts. */
export function runClasses(marks: RunMarks): string {
  const out = ['run'];
  if (marks.hold !== undefined) out.push('hold', `hold-${marks.hold}`);
  if (marks.svara !== undefined) out.push(`sv-${marks.svara}`);
  if (marks.candra === true) out.push('is-candra');
  /* A letter the rules replaced is coloured, and it says what it replaced so a
     reader can see it without opening anything. */
  if (marks.was !== undefined) out.push('is-change');
  if (marks.plain !== undefined) out.push(marks.plain === 'fill' ? 'fill' : 'plain');
  return out.join(' ');
}

export class MarkedTextNode extends TextNode {
  __marks: RunMarks;

  constructor(text: string, marks: RunMarks = {}, key?: NodeKey) {
    super(text, key);
    this.__marks = marks;
  }

  static override getType(): string { return 'marked-text'; }

  static override clone(node: MarkedTextNode): MarkedTextNode {
    return new MarkedTextNode(node.__text, node.__marks, node.__key);
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.className = runClasses(this.__marks);
    if (this.__marks.was !== undefined) dom.dataset['was'] = this.__marks.was;
    return dom;
  }

  override updateDOM(prev: this, dom: HTMLElement, config: EditorConfig): boolean {
    const rebuild = super.updateDOM(prev, dom, config);
    dom.className = runClasses(this.__marks);
    if (this.__marks.was === undefined) delete dom.dataset['was'];
    else dom.dataset['was'] = this.__marks.was;
    return rebuild;
  }

  getMarks(): RunMarks { return this.getLatest().__marks; }

  setMarks(marks: RunMarks): this {
    const self = this.getWritable();
    self.__marks = marks;
    return self;
  }

  /**
   * Text typed at the edge of a run joins it.
   *
   * Lexical asks this to decide whether a new character belongs to the node
   * before the caret. Saying no would make every keystroke inside a holding
   * create an unmarked run, so typing in the middle of a marked word would
   * leave a hole in its box.
   */
  override canInsertTextBefore(): boolean { return true; }

  override canInsertTextAfter(): boolean { return true; }

  /**
   * Two runs may be one only when they carry the same markings.
   *
   * Lexical fuses adjacent text nodes as an optimisation. Left to itself it
   * would fuse a held run with the unheld one beside it and the box would
   * swallow letters nobody marked.
   */
  override isSimpleText(): boolean {
    return this.__type === 'marked-text' && this.__mode === 0
      && Object.keys(this.__marks).length === 0;
  }

  static override importJSON(json: SerializedMarkedText): MarkedTextNode {
    const node = new MarkedTextNode(json.text, json.marks ?? {});
    node.setFormat(json.format);
    node.setDetail(json.detail);
    node.setMode(json.mode);
    node.setStyle(json.style);
    return node;
  }

  override exportJSON(): SerializedMarkedText {
    return { ...super.exportJSON(), marks: this.__marks, type: 'marked-text', version: 1 };
  }
}

export const $createMarkedTextNode = (text: string, marks: RunMarks = {}): MarkedTextNode =>
  new MarkedTextNode(text, marks);

export const $isMarkedTextNode = (node: LexicalNode | null | undefined): node is MarkedTextNode =>
  node instanceof MarkedTextNode;
