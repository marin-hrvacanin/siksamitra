/**
 * CAN LEXICAL DRIVE OUR MARKUP?  — a spike, not a feature.
 *
 * FIRST ANSWER: NO, not the way this program draws text today. A `TextNode`
 * subclass that emitted the existing markup — a `.syl` per syllable, a `.u` per
 * letter, a `.hold` box around a run — survived the reconciler and then failed
 * everything that matters: a click on the sixth letter reported offset 1, and
 * typing two characters turned `sunavāma` into `YsX`. Lexical maps a DOM
 * position to a model offset by walking the node's own text node, and there is
 * no single text node when every letter is wrapped.
 *
 * SECOND ANSWER, measured below: keep the DOM FLAT and let the marks split the
 * text into runs. Lexical already splits a text node at every format boundary,
 * so a marked range is one element with one text node inside it — which is
 * exactly the "one box over a whole range, crossing spaces" the owner asked
 * for, and it arrives for free rather than as CSS that joins boxes back
 * together afterwards.
 *
 * The per-letter `.u` span goes. Anything that needs a single letter — a svara
 * over one vowel, a candrabindu — is its own one-character run, which Lexical
 * handles as it handles any other format.
 */
import {
  $createParagraphNode, $getRoot, $getSelection, $isRangeSelection, createEditor,
  TextNode, type EditorConfig, type SerializedTextNode, type Spread,
} from 'lexical';
import { registerRichText } from '@lexical/rich-text';
import { registerHistory, createEmptyHistoryState } from '@lexical/history';

type Marks = { hold?: 'short' | 'long'; svara?: string };

type SerializedMarked = Spread<{ marks: Marks }, SerializedTextNode>;

/**
 * A run of text carrying this program's marks.
 *
 * `createDOM` returns ONE element with the text inside it — the shape Lexical
 * needs — and the marks are classes on that element. The box, the svara stroke
 * and the colour are all CSS on the run.
 */
class MarkedTextNode extends TextNode {
  __marks: Marks;

  constructor(text: string, marks: Marks, key?: string) {
    super(text, key);
    this.__marks = marks;
  }

  static override getType(): string { return 'marked-text'; }

  static override clone(node: MarkedTextNode): MarkedTextNode {
    return new MarkedTextNode(node.__text, node.__marks, node.__key);
  }

  classes(): string {
    const out = ['run'];
    if (this.__marks.hold !== undefined) out.push('hold', `hold-${this.__marks.hold}`);
    if (this.__marks.svara !== undefined) out.push(`sv-${this.__marks.svara}`);
    return out.join(' ');
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.className = this.classes();
    return dom;
  }

  override updateDOM(prev: MarkedTextNode, dom: HTMLElement, config: EditorConfig): boolean {
    const rebuild = super.updateDOM(prev, dom, config);
    dom.className = this.classes();
    return rebuild;
  }

  setMarks(marks: Marks): this {
    const self = this.getWritable();
    self.__marks = marks;
    return self;
  }

  static override importJSON(s: SerializedMarked): MarkedTextNode {
    return new MarkedTextNode(s.text, s.marks ?? {});
  }

  override exportJSON(): SerializedMarked {
    return { ...super.exportJSON(), marks: this.__marks, type: 'marked-text', version: 1 };
  }
}

const hostEl = document.getElementById('editor') as HTMLElement;
const errors: string[] = [];
const editor = createEditor({
  namespace: 'spike',
  nodes: [MarkedTextNode],
  onError: (e) => { errors.push(String(e)); },
});
editor.setRootElement(hostEl);
registerRichText(editor);
registerHistory(editor, createEmptyHistoryState(), 300);

editor.update(() => {
  const root = $getRoot();
  root.clear();
  const p = $createParagraphNode();
  /* One run per marked range — which is what applying a holding produces. */
  p.append(new MarkedTextNode('su', {}));
  p.append(new MarkedTextNode('navā', { hold: 'long' }));
  p.append(new MarkedTextNode('ma ', {}));
  /* A Devanāgarī conjunct inside a marked run: three code points, one cluster. */
  p.append(new MarkedTextNode('क्ष्मी', { hold: 'short' }));
  root.append(p);
});

declare global {
  interface Window {
    spike: {
      errors: string[];
      text: () => string;
      selection: () => { text: string; offset: number; marked: boolean } | null;
      /** Apply a holding over the current selection, the way the button will. */
      hold: (v: 'short' | 'long') => void;
      runs: () => { text: string; cls: string }[];
    };
  }
}

window.spike = {
  errors,
  text: () => editor.getEditorState().read(() => $getRoot().getTextContent()),
  selection: () => editor.getEditorState().read(() => {
    const sel = $getSelection();
    if (!$isRangeSelection(sel)) return null;
    const node = sel.anchor.getNode();
    return {
      text: node.getTextContent(),
      offset: sel.anchor.offset,
      marked: node instanceof MarkedTextNode && node.__marks.hold !== undefined,
    };
  }),
  hold: (v) => {
    editor.update(() => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel)) return;
      /* Lexical splits the runs at the selection's edges for us; all this has
         to decide is what the resulting runs carry. */
      for (const node of sel.extract()) {
        if (node instanceof MarkedTextNode) node.setMarks({ ...node.__marks, hold: v });
      }
    });
  },
  runs: () => [...hostEl.querySelectorAll('.run')].map((e) => ({
    text: e.textContent ?? '', cls: e.className,
  })),
};
