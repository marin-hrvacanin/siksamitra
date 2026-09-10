import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useRenderHost } from "./host.js";
import {
  CHANT_FORMAT_VERSION,
  canonicalJson,
  isEmbeddedImage,
  parseChantSelect,
  sliceChantDoc,
  type ChantDoc,
  type ChantEmbed as ChantEmbedRef,
  type ChantEmbedProblem,
  type ChantFigure,
  type ChantGroup,
  type ChantInstruction,
  type ChantInstructionKind,
  type ChantItem,
  type ChantGram,
  
  type ChantScriptKey,
  type ChantSection,
  type ChantSelection,
  type ChantSyllable,
  type ChantVariantFile,
  type ChantVariantIndex,
  type ChantToken,
  type ChantVerse,
} from "@siksamitra/format";
/* `openChantDoc`, not `normalizeChantDoc`: a stored verse is text and markings,
   and its tokens are rebuilt on open. The reader draws tokens, so it opens. */
import { openChantDoc } from "@siksamitra/engine";
import { figureItem } from "@siksamitra/format";
import { MissingFigure } from "./render/figure.js";
import {
  DEFAULT_SANKALPA_OPTIONS,
  DEITIES,
  GOTRA_PRESETS,
  KAMANAS,
  KARMAS,
  SANKALPA_DEITY_KEYS,
  SANKALPA_KAMANA_KEYS,
  SANKALPA_KARMA_KEYS,
  SANKALPA_LEVELS,
  SANKALPA_TRADITION_KEYS,
  TRADITIONS,
  composeSankalpa,
  type SankalpaDeity,
  type SankalpaKamana,
  type SankalpaKarma,
  type SankalpaLevel,
  type SankalpaTradition,
  type SankalpaOptions,
} from "./modules/sankalpa.js";
import { namavaliFor } from "./modules/namavali.js";
import type { ChantScript } from "./preferences.js";
import { ChantSettings } from "./ChantSettings";
import { resetHoldBoxes } from "./holdBox";
import { applyRate, SEG_LEAD, startAt } from "./transport.js";
// The mark drawing lives in ONE place, shared with the editor. CLAUDE.md
// forbids a second renderer for marked text; these are the primitives that
// draw a mark, lifted out verbatim (render/marks.tsx).
import {
  plainText, renderSyl as renderSylShared, sylText, toScriptDigits, wordSurface,
} from "./render/marks";
/* A picture is drawn by the one figure component, not by markup of its own. */
import { Figure } from "./render/figure.js";
import "./chant.css";
import "./figure.css";
import "./hold-join.css";

/* ==========================================================================
   Veda Union — the ONE marked-text reader.

   It renders anything that satisfies the marked-text contract in
   `shared/src/chant.ts` (script-neutral syllables built from LETTER-LEVEL units
   + typed marks + audio + translations + per-word grammar). Three kinds of
   source, one renderer:

     <ChantReader src="/chants/purusha-suktam.json" />            a whole chant
     <ChantReader src="…" select={{ from: "v-3", to: "v-5" }} />  part of one
     <ChantReader doc={composeSankalpa(...).doc} />               a composed module

   `slots` fills the variable slots a document declares (the pūjā's `deity`
   slot), so one document-level choice re-voices every mantra that names it.

   Settings are a floating gear in the corner (no top bar); they read + write the
   user's saved chant preferences, so a reader inherits the platform defaults and
   any tweak persists. Theme is inherited from the website (chant.css maps onto
   the global tokens). Embeddable in documents/classes via `embedded`.
   ========================================================================== */

type ScriptKey = ChantScriptKey;
type Syl = ChantSyllable;
type Tok = ChantToken;
type Gram = ChantGram;
type BreakPolicy = NonNullable<ChantVerse["lineBreak"]>;
type Verse = ChantVerse;
type Section = ChantSection;
type Doc = ChantDoc;

const DICT_BASE = "https://ambuda.org/tools/dictionaries/mw/";
const PREF_TO_SCRIPT: Record<ChantScript, ScriptKey> = {
  iast: "iast", devanagari: "deva", telugu: "tel", tamil: "tam",
};
const CASE_NAMES = ["", "prathamā (nom.)", "dvitīyā (acc.)", "tṛtīyā (instr.)", "caturthī (dat.)",
  "pañcamī (abl.)", "ṣaṣṭhī (gen.)", "saptamī (loc.)", "sambodhana (voc.)"];
const VACANA_NAMES: Record<string, string> = { eka: "ekavacana (sg.)", dvi: "dvivacana (du.)", bahu: "bahuvacana (pl.)" };
const GENDER_NAMES: Record<string, string> = { m: "puṁliṅga (m.)", f: "strīliṅga (f.)", n: "napuṁsaka (n.)" };
const PURUSHA_NAMES: Record<number, string> = { 3: "prathama-puruṣa (3rd)", 2: "madhyama-puruṣa (2nd)", 1: "uttama-puruṣa (1st)" };

const svg = (children: ReactNode, sw = 1.5) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
);
// Solid glyphs — the play/pause icons read best filled (an outline triangle is
// hard to parse at button size); the media buttons use these, everything else
// uses the stroked `svg` helper.
const svgF = (children: ReactNode) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden>{children}</svg>
);
const I = {
  play: svgF(<path d="M7 4.98c0-.78.85-1.26 1.52-.86l11.02 6.52c.66.39.66 1.35 0 1.73L8.52 18.9c-.67.4-1.52-.09-1.52-.86V4.98Z" />),
  pause: svgF(<><rect x="6" y="4.6" width="4.3" height="14.8" rx="1.2" /><rect x="13.7" y="4.6" width="4.3" height="14.8" rx="1.2" /></>),
  gear: svg(<><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M19.622 10.395 18.525 7.745 20 6l-2-2-1.735 1.483-2.707-1.113L12.935 2H10.98l-.632 2.401-2.644 1.115L6 4 4 6l1.453 1.789-1.08 2.657L2 11v2l2.401.656 1.115 2.644L4 18l2 2 1.791-1.46 2.606 1.072L11 22h2l.605-2.387 2.65-1.098C16.697 18.831 18 20 18 20l2-2-1.484-1.751 1.098-2.651L22 12.977 22 11l-2.378-.605Z" /></>),
  prev: svg(<path d="M15 6l-6 6 6 6" />),
  next: svg(<path d="M9 6l6 6-6 6" />),
  close: svg(<path d="M6.758 17.243 12 12m5.243-5.243L12 12m0 0L6.758 6.757M12 12l5.243 5.243" />),
  more: svgF(<><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></>),
  book: svg(<><path d="M12 21V7a2 2 0 0 1 2-2h7.4c.331 0 .6.269.6.6v13.114" /><path d="M12 21V7a2 2 0 0 0-2-2H2.6a.6.6 0 0 0-.6.6v13.114" /><path d="M14 19h8M10 19H2" /><path d="M12 21a2 2 0 0 1 2-2M12 21a2 2 0 0 0-2-2" /></>),
};


type Chunk =
  | { kind: "word"; syls: Syl[]; wi: number }
  | { kind: "text"; s: string; fill?: boolean; placeholder?: boolean }
  | { kind: "sp" } | { kind: "pause"; len: "short" | "long" }
  | { kind: "bar" } | { kind: "br" } | { kind: "danda"; s: string } | { kind: "num"; s: string };

/**
 * Split a verse into rendered chunks.
 *
 * `wi` is the index into the verse's per-word grammar table. A variable SLOT
 * consumes exactly one such index however many words it renders as, and its own
 * pieces carry `wi = -1` (no grammar popover): the table describes the slot's
 * default word, not whatever the reader substituted into it.
 */
function chunkVerse(
  v: Verse,
  sc: ScriptKey,
  slots?: Record<string, ChantToken[] | undefined> | null,
): Chunk[] {
  const out: Chunk[] = []; let cur: Syl[] = []; let wi = 0;
  const flush = () => { if (cur.length) { out.push({ kind: "word", syls: cur, wi: wi++ }); cur = []; } };
  const push = (tk: Tok, inSlot: boolean) => {
    if (tk.t === "syl") { cur.push(tk); return; }
    if (inSlot) {
      if (cur.length) { out.push({ kind: "word", syls: cur, wi: -1 }); cur = []; }
    } else flush();
    switch (tk.t) {
      case "sp": out.push({ kind: "sp" }); break;
      case "pause": out.push({ kind: "pause", len: tk.len }); break;
      case "bar": out.push({ kind: "bar" }); break;
      case "br": out.push({ kind: "br" }); break;
      case "danda": out.push({ kind: "danda", s: tk.s }); break;
      case "num": out.push({ kind: "num", s: tk.s }); break;
      case "text": out.push({ kind: "text", s: plainText(tk, sc), fill: tk.fill, placeholder: tk.placeholder }); break;
      default: break;
    }
  };
  for (const tk of v.tokens) {
    if (tk.t === "slot") {
      flush();
      const repl = slots?.[tk.name];
      for (const st of (repl && repl.length ? repl : tk.tokens)) push(st, true);
      if (cur.length) { out.push({ kind: "word", syls: cur, wi: -1 }); cur = []; }
      wi++;                       // the slot stands for one source word
      continue;
    }
    push(tk, false);
  }
  flush();
  return out;
}

/** A short incipit (first ~6 syllables) of a verse in the chosen script — the
 *  label in the Contents outline, so each verse is recognisable at a glance. */
function verseIncipit(v: Verse, sc: ScriptKey): string {
  const parts: string[] = [];
  let count = 0;
  for (const tk of v.tokens) {
    if (tk.t === "syl") { parts.push(sylText(tk, sc)); if (++count >= 6) break; }
    else if (tk.t === "text") { parts.push(tk.s); }
    else if (tk.t === "slot") { for (const st of tk.tokens) if (st.t === "syl") parts.push(sylText(st, sc)); if (++count >= 6) break; }
    else if (tk.t === "sp") { if (parts.length && parts[parts.length - 1] !== " ") parts.push(" "); }
    else if ((tk.t === "danda" || tk.t === "br") && count >= 3) break;
  }
  return parts.join("").trim() + (count >= 6 ? "…" : "");
}
interface Anchor { x: number; y: number; w: number; h: number }
function rectOf(el: HTMLElement): Anchor {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}
function useWide(): boolean {
  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

export interface ChantReaderProps {
  /** URL of a marked-text JSON (the chant source-of-truth format). */
  src?: string;
  /** An already-composed marked document — a variable module such as the
   *  saṅkalpa. Takes precedence over `src`; one of the two is required. */
  doc?: ChantDoc;
  /** Render only part of the document (a section, a verse, a range). */
  select?: ChantSelection;
  /** Fill the document's variable slots, e.g. `{ deity: [...tokens] }`. */
  slots?: Record<string, ChantToken[] | undefined>;
  /** Embed inside a document/class (card look, no full-viewport height). */
  embedded?: boolean;
  /** Show the big centred title/subtitle hero. Default: !embedded. */
  showHero?: boolean;
  /** Hide the floating Contents + Settings cluster (an inline module that
   *  carries its own controls does not want a second, viewport-fixed set). */
  bareControls?: boolean;
  /** Initial view state (script / secondary / mode / verse) applied once on open.
   *  Used when the reader is opened embedded from a shareable document link
   *  (parsed by ChantEmbed from a `#chant?…` fragment). Standalone readers read
   *  the same values from the URL query instead. */
  initialParams?: { s?: string; s2?: string; m?: string; v?: string };
}

export default function ChantReader({
  src, doc: docProp, select, slots, embedded = false, showHero, bareControls = false, initialParams,
}: ChantReaderProps) {
  const { prefs, update, resolveUrl, useCoordinates } = useRenderHost();
  const c = prefs.chant;

  const primary = PREF_TO_SCRIPT[c.primaryScript];
  const secondary: ScriptKey | "none" = c.secondaryScript === "none" ? "none" : PREF_TO_SCRIPT[c.secondaryScript];
  const showMarks = c.marks;
  const mode = c.mode;
  const fontScale = c.fontScale;
  const audioSpeed = c.audioSpeed ?? 1;
  const heroVisible = showHero ?? !embedded;

  const [fetched, setFetched] = useState<Doc | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(true);

  // Holding boxes are sized from the glyph's INK (see `holdBox.ts`), which means
  // measuring in the very font `.pada` ends up using. `--pada-font` carries that
  // family list so the measurement can never drift from the stylesheet — and the
  // measurement has to be redone once the webfonts land, because the first paint
  // measures whatever fallback face was up at the time.
  const [fontStack, setFontStack] = useState("");
  const [, remeasure] = useState(0);
  useEffect(() => {
    const read = () => {
      const el = rootRef.current;
      if (!el) return;
      resetHoldBoxes();
      setFontStack(getComputedStyle(el).getPropertyValue("--pada-font").trim());
      remeasure((n) => n + 1);
    };
    read();
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (!fonts) return;
    let alive = true;
    fonts.ready.then(() => { if (alive) read(); }).catch(() => {});
    fonts.addEventListener?.("loadingdone", read);
    return () => { alive = false; fonts.removeEventListener?.("loadingdone", read); };
  }, []);

  const [currentVerseId, setCurrentVerseId] = useState<string | null>(null);

  const scrollToVerse = useCallback((vid: string) => {
    document.getElementById(`v-${vid}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrentVerseId(vid);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) setNavOpen(false);
  }, []);

  // The floating settings button is viewport-fixed (so it never scrolls away or
  // hides under the site header). When embedded in a document, only show it while
  // the reader is actually on screen — otherwise it would hover over unrelated
  // content further down the page.
  useEffect(() => {
    if (!embedded) return;
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => setInView(!!entries[0]?.isIntersecting), {
      rootMargin: "-64px 0px -20% 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [embedded]);

  // Escape closes the settings panel (unless a word popover is open — it claims
  // Escape first; the enclosing overlay only closes when nothing inner is open).
  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".wp-float, .wp-backdrop")) setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVerse, setPlayingVerse] = useState<string | null>(null);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [loop, setLoop] = useState(false);
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [pop, setPop] = useState<{ syls: Syl[]; entries?: Gram[]; anchor?: Anchor } | null>(null);

  // A `doc` prop is already materialised (a composed module); a `src` is fetched
  // once and cached by the browser. Either way the SELECTION is applied here, so
  // slicing is one pure step at the seam and every downstream index — verse ids,
  // Contents, practice cursor, audio lookup — is computed on the sliced doc.
  useEffect(() => {
    if (docProp || !src) { setFetched(null); setErr(null); return; }
    let alive = true;
    setFetched(null); setErr(null);
    fetch(resolveUrl(src))
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: Doc) => { if (alive) setFetched(d); })
      .catch((e) => { if (alive) setErr(String(e)); });
    return () => { alive = false; };
  }, [src, docProp]);

  // A `slots` prop still fills any variable slot a CALLER supplies. The deity
  // is deliberately NOT filled that way any more: a slot substitution splices a
  // fragment marked in isolation into a line marked as a whole, so the join is
  // never derived and `subrahmaṇyaṁ dhyāyāmi` shipped an unassimilated
  // anusvāra. The deity now comes from generated whole-verse variants below;
  // with no variant the reader shows the document's own base wording.
  const allSlots = useMemo(() => ({ ...slots }), [slots]);

  const raw = docProp ?? fetched;
  const fetchedOrProp = useMemo(() => (raw ? openChantDoc(raw) : null), [raw]);

  /* ---- per-deity VERSE variants ------------------------------------------
     The deity is not a word swap. Substituting it changes the marks of the
     FIXED words around it — `devaṁ dhyāyāmi` → `devan dhyāyāmi`, and after ī
     (`mahālakṣmīn dhyāyāmi`) the holding on `dh` becomes long — so a pre-marked
     fragment spliced into a pre-marked line is wrong by construction. Instead
     the generator marks the WHOLE verse per deity, offline, and the reader only
     ever REPLACES a verse object that was generated, validated and aligned
     there. Nothing is marked in the browser.

     Fallbacks, in the spirit "never a wrong form": a missing manifest, a failed
     fetch, a stale `baseHash`, or a variant that covers only some of its verses
     all fall back WHOLESALE to the document's own `deva` wording — which is
     always correct Sanskrit and always what the source says. A half-substituted
     rite would be worse than none. */
  const variantsUrl = fetchedOrProp?.variants;
  const [variantIndex, setVariantIndex] = useState<ChantVariantIndex | null>(null);
  useEffect(() => {
    if (!variantsUrl) { setVariantIndex(null); return; }
    let alive = true;
    fetch(resolveUrl(variantsUrl))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ChantVariantIndex | null) => { if (alive) setVariantIndex(d); })
      .catch(() => { if (alive) setVariantIndex(null); });
    return () => { alive = false; };
  }, [variantsUrl]);

  // The ACT of choosing is the gate, never the value (§5E rule 3). Comparing
  // against the default made Parameśvara unpickable — choosing it looked
  // identical to never having chosen, so the rite stayed at `deva`.
  const wantedDeity = prefs.sankalpa.deityChosen ? prefs.sankalpa.deity : null;
  const variantOption = variantIndex?.options.find((o) => o.key === wantedDeity) ?? null;
  const [variantVerses, setVariantVerses] = useState<Record<string, ChantVerse> | null>(null);
  useEffect(() => {
    if (!variantOption || !fetchedOrProp) { setVariantVerses(null); return; }
    let alive = true;
    setVariantVerses(null);
    const base = new Map<string, ChantVerse>();
    for (const s of fetchedOrProp.sections) for (const v of s.verses) base.set(v.id, v);
    fetch(resolveUrl(variantOption.file))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("variant fetch"))))
      .then(async (file: ChantVariantFile) => {
        const out: Record<string, ChantVerse> = {};
        for (const id of variantOption.verses) {
          const vv = file.verses?.[id];
          const b = base.get(id);
          // All-or-nothing: a missing verse, or one generated against a base
          // that has since changed, invalidates the whole variant.
          if (!vv || !b) throw new Error(`variant incomplete at ${id}`);
          if (await sha256Hex(canonicalJson(b.tokens)) !== vv.baseHash.replace(/^sha256:/, ""))
            throw new Error(`variant stale at ${id}`);
          out[id] = { ...b, tokens: vv.tokens, words: vv.words ?? b.words, translation: vv.translation ?? b.translation };
        }
        if (alive) setVariantVerses(out);
      })
      .catch(() => { if (alive) setVariantVerses(null); });
    return () => { alive = false; };
  }, [variantOption, fetchedOrProp]);


  /* ---- composed (module) sections ---------------------------------------
     A section may declare `module: { kind: 'sankalpa' }`: the document says
     WHERE it stands and what it is, and the reader composes its verses here,
     from the day's pañcāṅga plus the reader's own saṅkalpa preferences. It is
     then spliced back into the SAME section and renders exactly like every
     other one — one document, one reader. Resolution happens BEFORE slicing so
     every downstream index (verse ids, Contents, practice cursor) sees it. */
  const sk = prefs.sankalpa;
  const hasSankalpaModule = !!fetchedOrProp?.sections.some((s) => s.module?.kind === "sankalpa");
  // Does any mantra name the deity through a variable slot? Then the deity is a
  // reader-level setting for this text, whether or not it carries a saṅkalpa.
  const hasDeitySlot = useMemo(
    () => !!fetchedOrProp?.sections.some((s) =>
      s.verses.some((v) => v.tokens.some((t) => t.t === "slot" && t.name === "deity"))),
    [fetchedOrProp],
  );
  
  // `simple` needs no pañcāṅga — and that is the level the class teaches at
  // this step, so the common case makes no request at all.
  const needsCoords = hasSankalpaModule && sk.level !== "simple";
  const coords = useCoordinates(needsCoords);
  
  const skOpts = useMemo<SankalpaOptions>(
    () => ({
      level: sk.level, tradition: sk.tradition, karma: sk.karma, kamana: sk.kamana,
      deity: sk.deity, placeFrame: sk.placeFrame, gotra: sk.gotra, name: sk.name,
    }),
    [sk.level, sk.tradition, sk.karma, sk.kamana, sk.deity, sk.placeFrame, sk.gotra, sk.name],
  );
  const sankalpaVerses = useMemo(
    () => (hasSankalpaModule ? composeSankalpa(coords, skOpts).doc.sections[0]?.verses ?? [] : []),
    [hasSankalpaModule, coords, skOpts],
  );
  const source = useMemo(() => {
    if (!fetchedOrProp) return fetchedOrProp;
    if (!hasSankalpaModule && !variantVerses) return fetchedOrProp;
    const swap = (v: ChantVerse) => variantVerses?.[v.id] ?? v;
    return {
      ...fetchedOrProp,
      sections: fetchedOrProp.sections.map((s) => {
        if (s.module?.kind === "sankalpa") {
          // A composed section keeps everything the document authored ON it —
          // its direction above all. Only the VERSE items are supplied by the
          // composer, and they go exactly where the authored verse items stood,
          // so a module section is instructed like any other step.
          const composed = sankalpaVerses.map((v) => ({ t: "verse" as const, ...v }));
          const items: typeof composed[number][] | ChantItem[] = [];
          let placed = false;
          for (const it of s.items ?? []) {
            if (it.t === "verse") {
              if (!placed) { (items as ChantItem[]).push(...composed); placed = true; }
              continue;
            }
            (items as ChantItem[]).push(it);
          }
          if (!placed) (items as ChantItem[]).push(...composed);
          return { ...s, verses: sankalpaVerses, items: items as ChantItem[] };
        }
        if (!variantVerses) return s;
        return {
          ...s,
          verses: s.verses.map(swap),
          items: s.items?.map((it) => (it.t === "verse" ? { t: "verse" as const, ...swap(it) } : it)),
        };
      }),
    };
  }, [fetchedOrProp, hasSankalpaModule, sankalpaVerses, variantVerses]);

  // Callers pass `select` as an object literal; key the memo on its VALUE so a
  // re-render with an equal selection doesn't produce a new document identity
  // (which would churn every downstream memo and effect).
  const selKey = select ? JSON.stringify(select) : "";
  const doc = useMemo(
    () => (source ? sliceChantDoc(source, select) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, selKey],
  );
  const features = doc?.features;
  const showTranslation = c.translation && features?.translation !== false;
  const showGrammar = c.grammar && features?.grammar !== false;
  const showAudio = c.audio && features?.audio !== false;
  // "Focused" reading — nothing but the marked text (for chanting, not study):
  // no play controls, no translation. Tightens the verse rhythm.
  const compact = !showAudio && !showTranslation;

  /* ---- composition: directions, figures, groups ---------------------------
     `directions` is a reading preference like `marks` or `translation`.
     Focused reading is for CHANTING, so it may never silently swallow the
     ACTIONS: a person mid-pūjā who turned translation off still needs to know to
     ring the bell. Directions can be turned fully off — but only explicitly,
     never as a side effect of another toggle. */
  const directions: "all" | "actions" | "off" =
    compact && c.directions === "off" ? "actions" : c.directions;

  const docDirections = useMemo(
    () => (doc?.instructions ?? []).filter((i) => showsKind(directions, i.kind ?? "do")),
    [doc, directions],
  );
  /** Does this text HAVE any directions? A chant that carries none must not grow
   *  a control that does nothing. */
  const hasDirections = useMemo(
    () => !!doc && (
      !!doc.instructions?.length ||
      doc.sections.some((s) =>
        (s.items ?? []).some((it) => it.t === "instruction") ||
        s.verses.some((v) => !!v.instructions?.length))
    ),
    [doc],
  );
  const figureById = useMemo(() => {
    const m = new Map<string, ChantFigure>();
    for (const f of doc?.figures ?? []) m.set(f.id, f);
    return m;
  }, [doc]);

  // A group gated to particular deities is hidden entirely for anyone else —
  // including its "include" row. It is not an option they have declined.
  //
  // THIS SET IS THE VISIBLE ONES ONLY, so it must never be the set the member
  // lookup is built from: a section whose group was filtered out here would
  // then have no group at all and render UNCONDITIONALLY — the exact opposite
  // of being gated. `allGroups` below is the lookup; this is the gate.
  const allGroups = useMemo(() => doc?.groups ?? [], [doc]);
  const groups = useMemo(
    () => allGroups.filter(
      (g) => !g.onlyDeity?.length || g.onlyDeity.includes(prefs.sankalpa.deity)),
    [allGroups, prefs.sankalpa.deity],
  );
  const visibleGroupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);
  const docKey = src ?? doc?.title ?? "doc";
  const variantOf = useCallback(
    (g: ChantGroup): boolean | string => {
      const saved = c.variants?.[`${docKey}:${g.id}`];
      if (saved !== undefined) return saved;
      return g.default ?? (g.kind === "choice" ? (g.members[0] ?? false) : false);
    },
    [c.variants, docKey],
  );
  const setVariant = useCallback(
    (groupId: string, value: boolean | string) =>
      update({ chant: { variants: { ...(c.variants ?? {}), [`${docKey}:${groupId}`]: value } } }),
    [update, c.variants, docKey],
  );

  /**
   * The step rows actually rendered, in order.
   *
   * Groups are a FLAT table over the flat `sections` array, so inclusion is one
   * filter in one place and every downstream consumer (audio, deep links, the
   * practice cursor) is unchanged. An omitted group is never invisible: at its
   * anchor it leaves a single quiet "include" row, so a performer who has never
   * heard of pañcāmṛta-snāna can still find out it exists.
   *
   * An EXPANSION never renumbers the host sequence — its members take derived
   * sub-numbers from the host step's own `n` (7 → 7a, 7b, …), so a reader with
   * the expansion on and a reader with it off both see "14 · Naivedyam".
   */
  const sectionRows = useMemo(() => {
    if (!doc) return [] as SectionRow[];
    const byMember = new Map<string, ChantGroup>();
    for (const g of allGroups) for (const m of g.members) byMember.set(m, g);
    const rows: SectionRow[] = [];
    const announced = new Set<string>();
    for (const s of doc.sections) {
      const g = byMember.get(s.id);
      let n = s.n;
      if (g) {
        // Gated out for this deity: the whole block goes, quietly. No include
        // row — it is not an option this reader has declined, it is not an
        // option for them.
        if (!visibleGroupIds.has(g.id)) continue;
        const on = variantOf(g);
        // A `fixed` group is not asked about: visible means in.
        const included = g.fixed ? true
          : g.kind === "choice" ? on === s.id : on === true;
        if (!included) {
          // One quiet row per omitted group, at its first member's position.
          if (!announced.has(g.id)) { announced.add(g.id); rows.push({ kind: "include", group: g }); }
          continue;
        }
        if (g.kind === "expansion" && g.at) {
          const host = doc.sections.find((x) => x.id === g.at);
          const i = g.members.indexOf(s.id);
          if (host?.n && i >= 0) n = `${host.n}${String.fromCharCode(97 + i)}`;
        }
      }
      const eachVerse = (s.items ?? [])
        .flatMap((it) => (it.t === "instruction" ? [it.instruction] : []))
        .filter((ins) => ins.appliesTo === "each-verse" && showsKind(directions, ins.kind ?? "do"));
      rows.push({ kind: "section", s, n, eachVerse });
    }
    return rows;
  }, [doc, allGroups, visibleGroupIds, variantOf, directions]);

  /** Step-level `each-verse` directions, by section id — for practice view. */
  const eachVerseBySection = useMemo(() => {
    const out: Record<string, ChantInstruction[]> = {};
    for (const row of sectionRows) if (row.kind === "section" && row.eachVerse.length) out[row.s.id] = row.eachVerse;
    return out;
  }, [sectionRows]);

  const audioBase = doc?.audioBase ?? "/tests/purusha-suktam/audio/";
  const flatVerses = useMemo<{ v: Verse; s: Section }[]>(
    () => (doc ? doc.sections.flatMap((s) => s.verses.map((v) => ({ v, s }))) : []),
    [doc],
  );
  const audioFileFor = useCallback((v: Verse, s: Section): string | null => {
    const byV = doc?.recording?.byVerse?.[v.id]?.file;
    if (byV) return audioBase + byV;
    if (s.audio && s.verses[0]?.id === v.id) return audioBase + s.audio.file;
    return null;
  }, [doc, audioBase]);

  // Per-pāda audio: offsets (seconds within a verse clip) let us highlight the
  // pāda being sung (karaoke) and play a single pāda. From recording.byVerse[id].lines.
  const segEndRef = useRef<number | null>(null);
  const [activeSeg, setActiveSeg] = useState<{ vid: string; li: number } | null>(null);
  const linesFor = useCallback(
    (v: Verse) => doc?.recording?.byVerse?.[v.id]?.lines ?? null, [doc]);
  const sectionOf = useCallback(
    (v: Verse) => flatVerses.find((x) => x.v.id === v.id)?.s ?? null, [flatVerses]);

  const stop = useCallback(() => {
    const a = audioRef.current; if (a) { a.pause(); a.currentTime = 0; }
    segEndRef.current = null; setPlayingVerse(null); setActiveSeg(null);
  }, []);

  /* Playback rate, in ONE place.
   *
   * The symptom was a verse and a single pāda playing at different speeds, and
   * the cause was two closures each reading `audioSpeed` out of their own
   * scope: `playVerse` is rebuilt constantly (it depends on `playingVerse`) so
   * it happened to see the current speed, while `playSegment` depends only on
   * stable things and kept whatever the speed was when the reader mounted. So
   * the rate lives in a ref, which no closure can hold a stale copy of.
   *
   * WRITING it is `applyRate` in `transport.ts`, shared with the editor's
   * transport — assigning `src` resets the rate, and the reason that has to be
   * two properties rather than one is written down there. */
  const speedRef = useRef(audioSpeed);
  const applyLocalRate = useCallback(() => {
    const a = audioRef.current;
    if (a) applyRate(a, speedRef.current);
  }, []);
  useEffect(() => { speedRef.current = audioSpeed; applyLocalRate(); }, [audioSpeed, applyLocalRate]);

  /* Start at a KNOWN position, every time — `startAt` in `transport.ts`, which
   * the editor's transport uses as well. Why it is not `a.src = …;
   * a.currentTime = t; a.play()` is written down there, with the artefact that
   * measured it. The token is here because it is this component's play that is
   * being cancelled, and only this component knows when another one starts. */
  const playTokenRef = useRef(0);

  const startClip = useCallback(
    async (src: string, offset: number, segEnd: number | null, looping: boolean) => {
      const a = audioRef.current;
      if (!a) return false;
      const token = ++playTokenRef.current;
      segEndRef.current = segEnd;
      return startAt(a, {
        src,
        at: offset,
        rate: speedRef.current,
        loop: looping,
        alive: () => token === playTokenRef.current,
      });
    },
    [],
  );

  const playVerse = useCallback((v: Verse, s: Section) => {
    const audioSrc = audioFileFor(v, s);
    if (!audioSrc) return;
    if (playingVerse === v.id) { stop(); return; }
    void startClip(audioSrc, 0, null, loop && mode === "practice").then((ok) =>
      setPlayingVerse(ok ? v.id : null),
    );
  }, [audioFileFor, playingVerse, stop, loop, mode, startClip]);

  // Play a single pāda: seek to its offset in the verse clip and stop at its end.
  const playSegment = useCallback((v: Verse, li: number) => {
    const s = sectionOf(v);
    const src = s ? audioFileFor(v, s) : null; const seg = linesFor(v)?.[li];
    if (!src || !seg) return;
    void startClip(src, seg.start, seg.end, false).then((ok) => {
      if (!ok) return;
      setPlayingVerse(v.id); setActiveSeg({ vid: v.id, li });
    });
  }, [audioFileFor, linesFor, sectionOf, startClip]);

  /* Stop a single-pāda clip at its end, and track which pāda is sounding.
   *
   * This used to hang off `timeupdate` ALONE, and that is why a pāda bled the
   * first word of the next line into its tail: `timeupdate` is deliberately
   * imprecise — the spec allows 4–66 Hz and the major browsers all sit near
   * 4 Hz — so the pause landed up to ~250 ms late, every time, at every
   * boundary. At 0.37 s/syllable that is most of a syllable, and more once the
   * speed slider is above 1× because the overshoot is wall-clock. The cut data
   * was never at fault: all 301 line boundaries in the Rudram are exactly
   * touching, and decoding the audio at those bounds puts the word wholly
   * inside the NEXT line. The same lateness was also why the karaoke highlight
   * trailed the voice.
   *
   * So the tick is now driven by `requestAnimationFrame` — ~16 ms, and
   * self-correcting, so it needs no re-arming when the rate changes mid-play
   * (which is what makes a computed `setTimeout` the wrong tool here).
   *
   * `timeupdate` stays wired to the SAME tick, as the backstop for the one case
   * rAF cannot cover: rAF does not run while the tab is hidden, but the audio
   * keeps playing, so without it a pāda backgrounded mid-play would never
   * stop. One function, two callers, no second code path to drift. */
  const tick = useCallback(() => {
    const a = audioRef.current; if (!a) return;
    if (segEndRef.current != null && a.currentTime >= segEndRef.current - SEG_LEAD) {
      a.pause(); segEndRef.current = null; setPlayingVerse(null); setActiveSeg(null); return;
    }
    const vid = playingVerse; if (!vid) return;
    const segs = doc?.recording?.byVerse?.[vid]?.lines; if (!segs) return;
    const t = a.currentTime; const i = segs.findIndex((ln) => t >= ln.start && t < ln.end);
    if (i >= 0) setActiveSeg((cur) => (cur && cur.vid === vid && cur.li === i ? cur : { vid, li: i }));
  }, [playingVerse, doc]);

  // Run the tick every frame while something is playing, and only then.
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playingVerse) return;
    let live = true;
    const loop = () => { if (!live) return; tick(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      live = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playingVerse, tick]);

  const onEnded = useCallback(() => {
    const cur = playingVerse; setPlayingVerse(null); setActiveSeg(null); segEndRef.current = null;
    if (!cur) return;
    if (mode === "practice" && autoAdvance) {
      const i = flatVerses.findIndex((x) => x.v.id === cur);
      const nxt = flatVerses[i + 1];
      if (nxt) { setPracticeIdx(i + 1); setTimeout(() => playVerse(nxt.v, nxt.s), 260); }
    }
  }, [playingVerse, mode, autoAdvance, flatVerses, playVerse]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);
  useEffect(() => { stop(); }, [mode, stop]);

  /* ---- Shareable URL state (standalone reader only) ---------------------
     Read query params on mount → apply script / secondary / mode / verse, then
     keep the URL in sync via replaceState so the current view is shareable.
     SSR-guarded and additive: when embedded (in a document) we never touch the
     document's own URL. Params: s (primary), s2 (secondary), m (mode), v (verse). */
  const urlApplied = useRef(false);
  useEffect(() => {
    if (!doc || urlApplied.current || typeof window === "undefined") return;
    // Standalone reader → read the view from the URL query. Embedded reader →
    // from `initialParams` (a shareable document link, parsed by ChantEmbed).
    // Embedded with no params → nothing to apply.
    if (embedded && !initialParams) return;
    const q = embedded ? null : new URLSearchParams(window.location.search);
    const get = (k: "s" | "s2" | "m" | "v"): string | null =>
      initialParams ? initialParams[k] ?? null : q?.get(k) ?? null;
    urlApplied.current = true;
    const scripts: ChantScript[] = ["iast", "devanagari", "telugu", "tamil"];
    const patch: Partial<typeof c> = {};
    const s = get("s");
    if (s && (scripts as string[]).includes(s)) patch.primaryScript = s as ChantScript;
    const s2 = get("s2");
    if (s2 && (s2 === "none" || (scripts as string[]).includes(s2))) patch.secondaryScript = s2 as ChantScript | "none";
    const m = get("m");
    if (m === "read" || m === "practice") patch.mode = m;
    if (Object.keys(patch).length) update({ chant: patch });
    const v = get("v");
    if (v) {
      const i = flatVerses.findIndex((x) => x.v.id === v);
      if (i >= 0) {
        setPracticeIdx(i);
        setCurrentVerseId(v);
        if ((patch.mode ?? mode) === "read")
          setTimeout(() => document.getElementById(`v-${v}`)?.scrollIntoView({ block: "start" }), 60);
      }
    }
  }, [embedded, doc, flatVerses, update, c, mode, initialParams]);

  // keep the tracked verse in step with the practice cursor
  useEffect(() => {
    if (mode !== "practice") return;
    const id = flatVerses[Math.min(practiceIdx, flatVerses.length - 1)]?.v.id;
    if (id) setCurrentVerseId(id);
  }, [mode, practiceIdx, flatVerses]);

  // reflect the live view back into the URL (replaceState — no history spam)
  useEffect(() => {
    if (embedded || !doc || !urlApplied.current || typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    q.set("s", c.primaryScript);
    q.set("s2", c.secondaryScript);
    q.set("m", mode);
    if (currentVerseId) q.set("v", currentVerseId); else q.delete("v");
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q.toString()}${window.location.hash}`);
  }, [embedded, doc, c.primaryScript, c.secondaryScript, mode, currentVerseId]);

  if (err) return <div className={`chant-root${embedded ? " is-embedded" : ""}`} style={{ padding: "3rem", textAlign: "center" }}>Could not load the text.<br />{err}</div>;
  if (!doc) return <div className={`chant-root${embedded ? " is-embedded" : ""}`} style={{ padding: "4rem", textAlign: "center", color: "var(--color-ink-mute)" }}>Loading…</div>;
  // A document written for a NEWER format says so explicitly, rather than
  // half-rendering or falling into the generic "could not load" state.
  if ((doc.version ?? 2) > CHANT_FORMAT_VERSION)
    return (
      <div className={`chant-root${embedded ? " is-embedded" : ""}`} style={{ padding: "3rem", textAlign: "center" }} lang="en">
        <p style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", marginBottom: ".4rem" }}>{doc.title}</p>
        <p style={{ color: "var(--color-ink-mute)" }}>This text needs a newer version of the reader — please update the app.</p>
      </div>
    );

  const titleForm = doc.titleForms[primary === "iast" ? "iast" : primary === "deva" ? "devanagari" : primary === "tel" ? "telugu" : "tamil"] ?? doc.title;

  // The mark renderers are shared with the editor (render/marks.tsx). These
  // adapters bind the two values they used to close over — whether marks are
  // shown, and the font stack the holding box is measured against — so every
  // call site below is unchanged.
  const markOpts = { showMarks, fontStack };
  const renderSyl = (syl: Syl, sc: ScriptKey, key: number) => renderSylShared(syl, sc, key, markOpts);

  const renderPada = (v: Verse, sc: ScriptKey, isSecondary: boolean) => {
    const chunks = chunkVerse(v, sc, allSlots);
    const policy: BreakPolicy = v.lineBreak ?? doc.lineBreak ?? "source";
    const breaksAt = (k: "bar" | "danda" | "pause" | "br"): boolean =>
      policy === "none" ? false
      : policy === "pada" ? true
      : policy === "hemistich" ? (k === "danda" || k === "br")
      : k === "br";
    const groups: Chunk[][] = [[]];
    const curG = () => groups[groups.length - 1]!;
    const newG = () => { if (curG().some((c2) => c2.kind !== "sp")) groups.push([]); };
    for (const c2 of chunks) {
      if (c2.kind === "br") { if (breaksAt("br")) newG(); continue; }
      curG().push(c2);
      if ((c2.kind === "bar" && breaksAt("bar")) || (c2.kind === "danda" && breaksAt("danda")) || (c2.kind === "pause" && breaksAt("pause"))) newG();
    }
    const renderChunkEl = (c2: Chunk, key: number): ReactNode => {
      if (c2.kind === "br") return null;
      if (c2.kind === "sp") return <span key={key} className="wsp"> </span>;
      if (c2.kind === "pause") return <span key={key} className={`pause pause--${c2.len}`}>{c2.len === "long" ? "‖" : "|"}</span>;
      if (c2.kind === "bar") return <span key={key} className="bar">|</span>;
      if (c2.kind === "danda") return <span key={key} className="danda">{c2.s}</span>;
      if (c2.kind === "num") return <span key={key} className="vnum">{toScriptDigits(c2.s, sc)}</span>;
      // A PLACEHOLDER is a slot marker, not a word — "(your name)" where the
      // reciter has supplied nothing. It wears the same dotted underline as a
      // supplied fill, quieter, and it is never part of the recitation: the
      // composer already keeps it out of `lines`, so Copy never sees it.
      if (c2.kind === "text")
        return (
          <span key={key}
            className={c2.fill ? (c2.placeholder ? "fill fill--empty" : "fill") : "plain"}
            {...(c2.placeholder ? { "data-placeholder": "1" } : {})}>{c2.s}</span>
        );
      const entries = c2.wi >= 0 ? v.words?.[c2.wi]?.entries : undefined;
      // A slot's own words (wi < 0) carry no grammar — the table describes the
      // slot's default word, not what the reader substituted into it. A verse
      // with no grammar table at all (a composed module section) is likewise
      // plain: offering a popover that only says "being prepared" is worse than
      // not offering one.
      if (!showGrammar || c2.wi < 0 || !v.words?.length) {
        return (
          <span key={key} className="word is-plain">
            {c2.syls.map((syl, j) => (<Fragment key={j}>{renderSyl(syl, sc, j)}</Fragment>))}
          </span>
        );
      }
      return (
        <span key={key} className="word" role="button" tabIndex={0}
          onClick={(e) => setPop({ syls: c2.syls, entries, anchor: rectOf(e.currentTarget) })}
          onKeyDown={(e) => { if (e.key === "Enter") setPop({ syls: c2.syls, entries, anchor: rectOf(e.currentTarget) }); }}>
          {c2.syls.map((syl, j) => (<Fragment key={j}>{renderSyl(syl, sc, j)}</Fragment>))}
        </span>
      );
    };
    const lines = groups.filter((g) => g.some((c2) => c2.kind !== "sp"));
    // Per-pāda audio offsets align to these source lines (default break policy).
    const segs = !isSecondary ? linesFor(v) : null;
    return (
      <div className={`${isSecondary ? "pada-secondary" : "pada"} pada--${sc}${showMarks ? "" : " no-marks"}`}>
        {lines.map((line, li) => {
          let start = 0;
          while (start < line.length && line[start]?.kind === "sp") start++;
          const trimmed = line.slice(start);
          let lastWord = -1;
          trimmed.forEach((c2, i) => { if (c2.kind === "word") lastWord = i; });
          const head = lastWord >= 0 ? trimmed.slice(0, lastWord) : trimmed;
          const tail = lastWord >= 0 ? trimmed.slice(lastWord) : [];
          const hasSeg = !!segs?.[li];
          const isActive = activeSeg?.vid === v.id && activeSeg?.li === li;
          return (
            <div className={`pada-line${hasSeg ? " pada-line--audio" : ""}${isActive ? " is-active" : ""}`} key={li}>
              {hasSeg ? (
                <button type="button" className="pada-line__play" aria-label={`Play pāda ${li + 1}`}
                  onClick={(e) => { e.stopPropagation(); playSegment(v, li); }}>
                  {isActive && playingVerse === v.id ? I.pause : I.play}
                </button>
              ) : null}
              {head.map((c2, i) => renderChunkEl(c2, i))}
              {tail.length ? <span className="pada-tail">{tail.map((c2, i) => renderChunkEl(c2, head.length + i))}</span> : null}
            </div>
          );
        })}
      </div>
    );
  };

  /** One mantra, with its play button, scripts, translation and any direction
   *  attached to THIS mantra (`Verse.instructions`).
   *
   *  A step-level direction marked `appliesTo: "each-verse"` is NOT repeated
   *  here: printing "offer a flower with each name" under all eighteen names
   *  buries the names. It is authored once, shown once for the step in reading
   *  view — and shown on the CARD in practice view, where the step heading is
   *  not on screen and the reminder is the only thing carrying it. */
  const renderVerse = (v: Verse, s: Section, borrowed = false) => {
    const audioSrc = borrowed ? null : audioFileFor(v, s);
    const own = (v.instructions ?? []).filter((i) => showsKind(directions, i.kind ?? "do"));
    return (
      <div className={`verse${playingVerse === v.id ? " is-active" : ""}`} key={v.id} id={`v-${v.id}`}>
        <div className="verse__row">
          {showAudio ? (
            audioSrc ? (
              <button className={`verse__play${playingVerse === v.id ? " is-playing" : ""}`} aria-label="Play verse"
                onClick={() => playVerse(v, s)}>{playingVerse === v.id ? I.pause : I.play}</button>
            ) : <span className="verse__play" style={{ visibility: "hidden" }} />
          ) : null}
          <div className="verse__body">
            {renderPada(v, primary, false)}
            {secondary !== "none" ? renderPada(v, secondary, true) : null}
            {showTranslation && v.translation?.en ? (
              <div className="translation"><span className="translation__eyebrow">sense</span>{v.translation.en}</div>
            ) : null}
            {v.source ? <div className="verse__src">{v.source}</div> : null}
            {(v.figures ?? []).map((f) => <FigureView key={f.id} fig={f} />)}
            {own.map((ins, i) => <Direction key={ins.id ?? `v${i}`} ins={ins} tight />)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div ref={rootRef} className={`chant-root${embedded ? " is-embedded" : ""}${compact ? " is-compact" : ""}`} style={{ ["--fs" as string]: fontScale }}>
      <audio ref={audioRef} onEnded={onEnded} onTimeUpdate={tick}
             onLoadedMetadata={applyLocalRate} preload="none" />

      {/* Floating controls — Contents + Settings, stacked at the top-left, below
          the modal-head tray and above the document. On phones they collapse
          behind a single "⋯" button (tap to reveal the two, each with its label). */}
      {!bareControls && (!embedded || inView) && (
        <div className={`chant-controls${moreOpen ? " is-open" : ""}`}>
          <button
            type="button"
            className="chant-more"
            aria-label="Reader menu"
            aria-haspopup="true"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <span className="ic">{I.more}</span>
          </button>
          <button
            type="button"
            className="chant-nav-toggle"
            aria-label="Contents"
            aria-expanded={navOpen}
            onClick={() => { setNavOpen((v) => !v); setMoreOpen(false); }}
          >
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden><path d="M4 6h16M4 12h16M4 18h10" /></svg>
            <span className="chant-nav-toggle__label">Contents</span>
          </button>
          <button
            type="button"
            className="chant-fab"
            aria-label="Reading settings"
            aria-expanded={settingsOpen}
            onClick={() => { setSettingsOpen((v) => !v); setMoreOpen(false); }}
          >
            <span className="ic">{I.gear}</span>
            <span className="chant-fab__label">Settings</span>
          </button>
        </div>
      )}
      {navOpen ? (
        <>
          <div className="chant-nav-backdrop" onClick={() => setNavOpen(false)} />
          <nav className="chant-nav" aria-label="Contents">
            <div className="chant-nav__head">
              <span>Contents</span>
              <button className="chant-nav__x" aria-label="Close contents" onClick={() => setNavOpen(false)}>
                <span className="ic">{I.close}</span>
              </button>
            </div>
            <div className="chant-nav__body">
              <ul className="chant-nav__list">
                {sectionRows.map((row, ri) => row.kind === "include" ? (
                  <li className="chant-nav__sec chant-nav__sec--opt" key={`inc-${row.group.id}`}>
                    <button className="chant-nav__seclabel" onClick={() => setVariant(row.group.id, true)}>
                      {row.group.label.en} — optional · include
                    </button>
                  </li>
                ) : (
                  <Fragment key={row.s.id}>
                    {/* A new numbering run gets its own heading — it is why the
                        preparatory steps count 1…8 and the upacāras restart at 1. */}
                    {row.s.part && row.s.part !== partOfRow(sectionRows, ri - 1) ? (
                      <li className="chant-nav__part">{row.s.part}</li>
                    ) : null}
                  <li className="chant-nav__sec">
                    <button
                      className="chant-nav__seclabel"
                      onClick={() => {
                        const v0 = row.s.verses[0];
                        if (v0) scrollToVerse(v0.id);
                        else document.getElementById(`s-${row.s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      {row.n ? `${row.n} · ` : ""}{row.s.title}
                    </button>
                    {row.s.verses.length > 1 ? (
                      <ul className="chant-nav__verses">
                        {row.s.verses.map((v) => (
                          <li key={v.id}>
                            <button className="chant-nav__v" onClick={() => scrollToVerse(v.id)}>
                              <span className="chant-nav__vn">{v.n ? toScriptDigits(String(v.n), primary === "iast" ? "iast" : primary) : "•"}</span>
                              <span className="chant-nav__vtext">{verseIncipit(v, primary)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                  </Fragment>
                ))}
              </ul>
            </div>
          </nav>
        </>
      ) : null}

      {settingsOpen ? (
        <>
          <div className="chant-settings-backdrop" onClick={() => setSettingsOpen(false)} />
          <div className="chant-settings-pop" role="dialog" aria-label="Reading settings">
            <div className="chant-settings-pop__head">
              <span className="chant-settings-pop__title">Reading settings</span>
              <button className="chant-settings-pop__x" aria-label="Close" onClick={() => setSettingsOpen(false)}>
                <span className="ic">{I.close}</span>
              </button>
            </div>
            <ChantSettings value={c} onChange={(patch) => update({ chant: patch })} idPrefix="reader" features={features} />
            {hasDirections ? (
              <div className="chant-settings chant-settings__group">
                <div className="chant-settings__group-title">Directions</div>
                <label className="sk-field" htmlFor="reader-directions">
                  <span className="sk-label">What to show</span>
                  <select
                    id="reader-directions"
                    className="sk-input"
                    value={c.directions}
                    onChange={(e) => update({ chant: { directions: e.target.value as "all" | "actions" | "off" } })}
                  >
                    <option value="all">All — actions, notes and options</option>
                    <option value="actions">Actions only</option>
                    <option value="off">None</option>
                  </select>
                </label>
                {compact && c.directions === "off" ? (
                  <p className="chant-settings__hint">
                    Focused reading keeps the actions visible — mid-rite you still need to know to ring the bell.
                  </p>
                ) : null}
              </div>
            ) : null}
            {groups.some((g) => !g.fixed) ? (
              <div className="chant-settings chant-settings__group">
                <div className="chant-settings__group-title">Steps</div>
                <div className="chant-settings-toggles">
                  {groups.filter((g) => !g.fixed).map((g) => g.kind === "choice" ? (
                    <div key={g.id} className="sk-field">
                      <span className="sk-label">{g.label.en}</span>
                      {g.members.map((m) => (
                        <label className="vu-check-row" key={m}>
                          <input
                            type="radio"
                            name={`grp-${g.id}`}
                            checked={variantOf(g) === m}
                            onChange={() => setVariant(g.id, m)}
                          />
                          <span>{doc.sections.find((s) => s.id === m)?.title ?? m}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <label className="vu-check-row" key={g.id}>
                      <input
                        type="checkbox"
                        className="vu-check"
                        checked={variantOf(g) === true}
                        onChange={(e) => setVariant(g.id, e.target.checked)}
                      />
                      <span>
                        {g.label.en}
                        {g.note ? <span className="vu-check-note">{g.note.text.en}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {hasSankalpaModule || hasDeitySlot ? (
              <div className="chant-settings chant-settings__group">
                <div className="chant-settings__group-title">
                  {hasSankalpaModule ? "Saṅkalpa & deity" : "Deity"}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                  {hasSankalpaModule ? (
                    <label className="sk-field" htmlFor="reader-sk-level">
                      <span className="sk-label">How much to say</span>
                      <select
                        id="reader-sk-level"
                        className="sk-input"
                        value={sk.level}
                        onChange={(e) => update({ sankalpa: { level: e.target.value as SankalpaLevel } })}
                      >
                        {SANKALPA_LEVELS.map((l) => (
                          <option key={l.key} value={l.key}>{l.label}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="sk-field" htmlFor="reader-deity">
                    <span className="sk-label">Deity</span>
                    <select
                      id="reader-deity"
                      className="sk-input"
                      value={sk.deity}
                      onChange={(e) => update({ sankalpa: { deity: e.target.value as SankalpaDeity, deityChosen: true } })}
                    >
                      {SANKALPA_DEITY_KEYS.map((k) => (
                        <option key={k} value={k}>{DEITIES[k].label}</option>
                      ))}
                    </select>
                  </label>
                  {hasSankalpaModule ? (
                    <>
                      <label className="sk-field" htmlFor="reader-sk-karma">
                        <span className="sk-label">Rite</span>
                        <select
                          id="reader-sk-karma"
                          className="sk-input"
                          value={sk.karma}
                          onChange={(e) => update({ sankalpa: { karma: e.target.value as SankalpaKarma } })}
                        >
                          {SANKALPA_KARMA_KEYS.map((k) => (
                            <option key={k} value={k}>{KARMAS[k].label}</option>
                          ))}
                        </select>
                      </label>
                      {/* Everything below the short form only appears in it. The
                          simple saṅkalpa states the intent and nothing else — no
                          tradition frame, no intention, no place, no performer —
                          so offering those controls there would be offering
                          settings with no effect. */}
                      {sk.level !== "simple" ? (
                        <>
                          <label className="sk-field" htmlFor="reader-sk-kamana">
                            <span className="sk-label">Intention</span>
                            <select
                              id="reader-sk-kamana"
                              className="sk-input"
                              value={sk.kamana}
                              onChange={(e) => update({ sankalpa: { kamana: e.target.value as SankalpaKamana } })}
                            >
                              {SANKALPA_KAMANA_KEYS.map((k) => (
                                <option key={k} value={k}>{KAMANAS[k].label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="sk-field" htmlFor="reader-sk-tradition">
                            <span className="sk-label">Tradition</span>
                            <select
                              id="reader-sk-tradition"
                              className="sk-input"
                              value={sk.tradition}
                              onChange={(e) => update({ sankalpa: { tradition: e.target.value as SankalpaTradition } })}
                            >
                              {SANKALPA_TRADITION_KEYS.map((k) => (
                                <option key={k} value={k}>{TRADITIONS[k].label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="sk-field" htmlFor="reader-sk-gotra">
                            <span className="sk-label">Gotra</span>
                            <select
                              id="reader-sk-gotra"
                              className="sk-input"
                              value={GOTRA_PRESETS.some((g) => g.value === sk.gotra) ? sk.gotra : "other"}
                              onChange={(e) => update({ sankalpa: { gotra: e.target.value === "other" ? "" : e.target.value } })}
                            >
                              {GOTRA_PRESETS.map((g) => (
                                <option key={g.value} value={g.value}>
                                  {g.note ? `${g.label} — ${g.note}` : g.label}
                                </option>
                              ))}
                              <option value="other">Other…</option>
                            </select>
                            {!GOTRA_PRESETS.some((g) => g.value === sk.gotra) ? (
                              <input
                                type="text"
                                className="sk-input"
                                placeholder="your gotra (IAST)"
                                value={sk.gotra}
                                onChange={(e) => update({ sankalpa: { gotra: e.target.value } })}
                                style={{ marginTop: "0.4rem" }}
                              />
                            ) : null}
                          </label>
                          <label className="sk-field" htmlFor="reader-sk-name">
                            <span className="sk-label">Your name</span>
                            <input
                              id="reader-sk-name"
                              type="text"
                              className="sk-input"
                              placeholder="your name"
                              value={sk.name}
                              onChange={(e) => update({ sankalpa: { name: e.target.value } })}
                            />
                          </label>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
                {hasSankalpaModule && sk.level !== "simple" ? (
                  <label className="vu-check-row" style={{ marginTop: ".9rem" }}>
                    <input
                      type="checkbox"
                      className="vu-check"
                      checked={sk.placeFrame === "adapted"}
                      onChange={(e) => update({ sankalpa: { placeFrame: e.target.checked ? "adapted" : "bharata" } })}
                    />
                    <span>
                      Name my actual location
                      <span className="vu-check-note">uncheck for the classical Bhārata frame</span>
                    </span>
                  </label>
                ) : null}
                <p className="chant-settings__hint">
                  The deity you choose is named through the whole rite.
                  {hasSankalpaModule
                    ? " Gotra and name are your own — they stay in your preferences and are never written into the document. Every choice here is the same one the Saṅkalpa page uses."
                    : ""}
                </p>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {mode === "read" || features?.audio === false ? (
        <div className="chant-scroll">
          <div className="chant-doc">
            {heroVisible ? (
              <div className="chant-hero">
                <h2 className="chant-hero__title">{titleForm}</h2>
                {doc.subtitle ? <div className="chant-hero__sub">{doc.subtitle}</div> : null}
              </div>
            ) : null}
            {/* Rite-wide directions — what is not about any one step. */}
            {docDirections.length ? (
              <div className="doc-dirs">
                {docDirections.map((ins, i) => <Direction key={ins.id ?? i} ins={ins} />)}
              </div>
            ) : null}
            {sectionRows.map((row, rowIdx) =>
              row.kind === "include" ? (
                <GroupIncludeRow
                  key={`inc-${row.group.id}`}
                  group={row.group}
                  choices={row.group.kind === "choice"
                    ? row.group.members
                        .filter((m) => variantOf(row.group) !== m)
                        .map((m) => ({
                          id: m,
                          title: doc.sections.find((s) => s.id === m)?.title ?? m,
                        }))
                    : undefined}
                  onInclude={() => setVariant(row.group.id, true)}
                  onChoose={(m) => setVariant(row.group.id, m)}
                />
              ) : (
                <section className={`section${row.s.module ? " is-composed" : ""}`} key={row.s.id} id={`s-${row.s.id}`}>
                 <LazySection eager={rowIdx < 3}>
                  {row.s.n || row.s.title ? (
                    <div className="section__head">
                      <span className="section__label">
                        {row.n ? <span className="section__n">{row.n} ·</span> : null}
                        {row.s.title}
                      </span>
                      {row.s.source ? <span className="section__src">{row.s.source}</span> : null}
                      <span className="section__rule" />
                    </div>
                  ) : null}
                  {(row.s.items ?? []).map((it, ii) => {
                    if (it.t === "instruction") {
                      return showsKind(directions, it.instruction.kind ?? "do")
                        ? <Direction key={`i-${ii}`} ins={it.instruction} />
                        : null;
                    }
                    if (it.t === "figure") {
                      /* One resolution, in the format — and it NAMES the miss
                         rather than dropping it. See `figureItem`. */
                      const read = figureItem(it, figureById);
                      return read.figure !== undefined
                        ? <FigureView key={`f-${ii}`} fig={read.figure} />
                        : <MissingFigure key={`f-${ii}`} ref_={read.missingRef} />;
                    }
                    if (it.t === "embed") {
                      return (
                        <EmbedItem
                          key={`e-${ii}`}
                          embed={it.embed}
                          directions={directions}
                          deity={prefs.sankalpa.deity}
                          render={(vs) => vs.map((v) => renderVerse(v, row.s, true))}
                        />
                      );
                    }
                    const { t: _t, ...v } = it;
                    return <Fragment key={v.id}>{renderVerse(v as Verse, row.s)}</Fragment>;
                  })}
                 </LazySection>
                </section>
              ),
            )}
          </div>
        </div>
      ) : (
        <PracticeView
          entries={flatVerses} idx={practiceIdx} setIdx={setPracticeIdx}
          primary={primary} secondary={secondary} showTranslation={showTranslation}
          renderPada={renderPada} playingVerse={playingVerse} eachVerse={eachVerseBySection}
          onPlay={(v, s) => playVerse(v, s)} audioFileFor={audioFileFor}
          loop={loop} setLoop={setLoop} autoAdvance={autoAdvance} setAutoAdvance={setAutoAdvance}
          onStop={stop}
        />
      )}

      {pop ? (
        <WordPopover syls={pop.syls} entries={pop.entries} anchor={pop.anchor} primary={primary} secondary={secondary}
          onClose={() => setPop(null)} />
      ) : null}
    </div>
  );
}

/* ==========================================================================
   Directions and figures — the non-mantra layer (docs/DOCUMENT-COMPOSITION.md)

   These render in the UI face, `lang="en"`, and are NOT multiplied by `--fs`:
   the font-size slider grows mantra and translation, chrome stays put, so a
   reader who has scaled the text up for chanting gets a continuous, visible
   signal that a direction is a different kind of thing. The stronger guarantee
   is structural — an Instruction carries no tokens/units/script fields, so
   there is no path from one into `renderPada`.
   ========================================================================== */

const KIND_LABEL: Record<ChantInstructionKind, string> = {
  do: "do", note: "note", option: "option", caution: "caution",
};
const KIND_ICON: Record<ChantInstructionKind, ReactNode> = {
  // hand · dot · fork · triangle
  do: svg(<><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" /><path d="M11 11.5v-1a1.5 1.5 0 0 1 3 0V12" /><path d="M14 11.5a1.5 1.5 0 0 1 3 0V13" /><path d="M17 12.5a1.5 1.5 0 0 1 3 0V16a5 5 0 0 1-5 5h-2.5a5 5 0 0 1-3.9-1.87L5 14.5a1.7 1.7 0 0 1 2.6-2.14L8 13" /></>),
  note: svgF(<circle cx="12" cy="12" r="4" />),
  option: svg(<><path d="M6 4v4a4 4 0 0 0 4 4h8" /><path d="M6 20v-4a4 4 0 0 1 4-4" /><path d="M15 9l3 3-3 3" /></>),
  caution: svg(<><path d="M12 4.5 2.8 20h18.4L12 4.5Z" /><path d="M12 10v4.2M12 17h.01" /></>),
};

/** One rendered row of the step flow: a step, or the quiet "include" affordance
 *  standing where an omitted group would have been. */
type SectionRow =
  | { kind: "section"; s: Section; n?: string; eachVerse: ChantInstruction[] }
  | { kind: "include"; group: ChantGroup };

/** The `part` of the row before this one — used to print a numbering-run heading
 *  in the contents only when the run actually changes. */
function partOfRow(rows: SectionRow[], i: number): string | undefined {
  const r = rows[i];
  return r && r.kind === "section" ? r.s.part : undefined;
}

/** SHA-256 of a string, hex. Used only to check a variant's `baseHash` — the
 *  guard that stops a stale variant shipping a reading its own base disagrees
 *  with. Falls back to "" where SubtleCrypto is unavailable (http:), which makes
 *  the check fail closed: the base wording renders. */
async function sha256Hex(text: string): Promise<string> {
  const c = typeof crypto !== "undefined" ? crypto.subtle : undefined;
  if (!c) return "";
  const buf = await c.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Which directions the reader wants to see. */
function showsKind(pref: "all" | "actions" | "off", kind: ChantInstructionKind): boolean {
  if (pref === "off") return false;
  if (pref === "all") return true;
  return kind === "do" || kind === "caution";
}

/**
 * One figure — an illustration standing on the page as an illustration.
 *
 * No card, no plate, no frame by default: VU procedural art is transparent and
 * reads by body colour against the page ground, so a box around it defeats the
 * point. `crop` reserves the aspect box before the file loads, so a figure
 * landing mid-step never pushes the mantra being read down the screen.
 */
/**
 * Mount a section's contents only once it is near the viewport, and keep it
 * mounted thereafter.
 *
 * WHY THIS EXISTS. A marked document is enormous in nodes, not in bytes: every
 * syllable is an inline-block with a span per letter, so the pūjā manual is
 * ~10k DOM nodes and something the size of the Devī Māhātmyam would be well
 * over 100k. `content-visibility: auto` on `.section` already stops the
 * browser LAYING OUT what is off screen, but React still builds every node and
 * the DOM still holds them — which is what makes a long document slow to open
 * and jerky to scroll.
 *
 * So the placeholder carries the section's reserved height and nothing else,
 * and the real subtree is created when the reader gets within a screenful of
 * it. Mounted stays mounted: unmounting behind the scroll would thrash, lose
 * text selection, and break the browser's own scroll anchoring.
 *
 * The first few sections mount eagerly (`eager`) so the top of the document is
 * never blank while the observer catches up.
 */
function LazySection({ eager, children }: { eager: boolean; children: ReactNode }) {
  const [shown, setShown] = useState(eager);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (shown || typeof IntersectionObserver === "undefined") {
      if (!shown) setShown(true);   // no observer support: render everything
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) setShown(true); },
      { rootMargin: "150% 0px" },   // a screenful and a half ahead of the scroll
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  if (shown) return <>{children}</>;
  return <div ref={ref} className="section__placeholder" aria-hidden="true" />;
}

/**
 * A figure, drawn by the ONE figure component.
 *
 * This used to be its own `<figure>` markup — a second implementation of a
 * picture, which drifted the moment the editor's views grew one of their own.
 * All that is left here is the seam only a reader has: the HOST resolves a
 * path (the platform serves `/figures/…` with a build version on it), while a
 * picture the document carries as bytes resolves itself.
 */
function FigureView({ fig }: { fig: ChantFigure }) {
  const { resolveUrl } = useRenderHost();
  const resolve = useCallback(
    (src: string): string | null => (isEmbeddedImage(src) ? src : resolveUrl(src)),
    [resolveUrl],
  );
  return <Figure fig={fig} resolve={resolve} />;
}

/** One direction: quiet prose, and nothing around it. */
function Direction({ ins, tight = false }: { ins: ChantInstruction; tight?: boolean }) {
  const kind = ins.kind ?? "do";
  return (
    <p
      className={`dir dir--${kind}${tight ? " dir--tight" : ""}`}
      role="note"
      aria-label={KIND_LABEL[kind]}
      lang="en"
    >
      {kind === "caution" ? (
        <span className="dir__eyebrow"><span className="ic">{KIND_ICON[kind]}</span>take care</span>
      ) : null}
      <span className="dir__text">{ins.text.en}</span>
    </p>
  );
}

/* ---------- an omitted group, still discoverable --------------------------- */
/** An omitted group is never invisible: at its anchor it leaves one quiet row
 *  carrying the group's name and its note, so a performer who has never heard of
 *  pañcāmṛta-snāna can find out that it exists — and one who does not want it
 *  does not have to scroll past forty steps of it. */
function GroupIncludeRow({ group, choices, onInclude, onChoose }: {
  group: ChantGroup;
  /** For a CHOICE group: the members that are not the one being shown. A choice
   *  has no "include" — one of its members is always on — so the row offers the
   *  alternatives by name instead of a boolean. Sending `true` here would leave
   *  the group with no member selected at all, and the step would vanish. */
  choices?: { id: string; title: string }[];
  onInclude: () => void;
  onChoose?: (memberId: string) => void;
}) {
  return (
    <div className="grp-row" lang="en">
      <div className="grp-row__text">
        <span className="grp-row__label">{group.label.en}</span>
        <span className="grp-row__meta">
          {choices ? "other forms" : "optional"}{group.source ? ` · ${group.source}` : ""}
        </span>
        {group.note ? <span className="grp-row__note">{group.note.text.en}</span> : null}
      </div>
      {choices ? (
        <div className="grp-row__choices">
          {choices.map((c) => (
            <button type="button" className="grp-row__btn" key={c.id}
                    onClick={() => onChoose?.(c.id)}>
              {c.title}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="grp-row__btn" onClick={onInclude}>Include</button>
      )}
    </div>
  );
}

/* ---------- an embed, and the six ways it can be unavailable --------------- */
/**
 * Text authored elsewhere, rendered inside this step.
 *
 * Failure is isolated to the ITEM: the step keeps its number, title and
 * directions whatever happens, so a performer sees "7 · Snānam — offer water in
 * a cup" with a placeholder where the mantra should be and can carry on from
 * memory. Losing the mantra is bad; losing the step is worse.
 *
 * The six causes are not one failure. `gated` in particular is a CORRECT state
 * of the system — an entitlement boundary — so it renders as an unlock card, no
 * red and no warning icon.
 */
function EmbedItem({
  embed, directions, render, deity,
}: {
  embed: ChantEmbedRef;
  directions: "all" | "actions" | "off";
  render: (verses: ChantVerse[]) => ReactNode;
  /** The reader's chosen deity — what a `{module:'namavali'}` src resolves through. */
  deity?: SankalpaDeity;
}) {
  const { resolveUrl } = useRenderHost();
  const [verses, setVerses] = useState<ChantVerse[] | null>(null);
  const [problem, setProblem] = useState<ChantEmbedProblem | null>(null);
  const [attempt, setAttempt] = useState(0);
  // A `module` src is INDIRECTION, not a second kind of content: it names a
  // rule for picking the document rather than the document. `namavali` asks
  // the registry which garland belongs to the deity this reader has chosen —
  // so the pūjā carries one nāmāvalī step instead of one per deity, and a new
  // garland is a line in `shared/src/namavali.ts`, not a new section here.
  const moduleKind = "module" in embed.src ? embed.src.module : null;
  const registered = moduleKind === "namavali" ? namavaliFor(deity) : null;
  const docPath = "doc" in embed.src ? embed.src.doc
                : registered ? registered.doc : null;
  // Nothing published for this deity yet. Not a failure — the step still has
  // its number, its title and its direction, and says what to chant instead.
  const unpublished = moduleKind === "namavali" && !registered;

  useEffect(() => {
    let alive = true;
    setVerses(null); setProblem(null);
    const sel = parseChantSelect(embed.select);
    if (!sel) { setProblem("anchor"); return; }
    if (unpublished) return;          // handled below, without an error card
    if (!docPath) {
      // A composed module. Missing/!invalid params are an AUTHORING error, not a
      // read-time fallback, so the validator catches them before this runs.
      const params = ("module" in embed.src ? embed.src.params : undefined) ?? {};
      try {
        const composed = composeSankalpa(null, { ...DEFAULT_SANKALPA_OPTIONS, ...params } as SankalpaOptions);
        setVerses(composed.doc.sections.flatMap((s) => s.verses));
      } catch { setProblem("missing"); }
      return;
    }
    fetch(resolveUrl(docPath))
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) throw Object.assign(new Error("gated"), { cause: "gated" });
        if (r.status === 404) throw Object.assign(new Error("missing"), { cause: "missing" });
        if (!r.ok) throw Object.assign(new Error("network"), { cause: "network" });
        return r.json() as Promise<ChantDoc>;
      })
      .then((target) => {
        if (!alive) return;
        if ((target.version ?? 2) > CHANT_FORMAT_VERSION) { setProblem("version"); return; }
        const norm = openChantDoc(target);
        const sliced = sliceChantDoc(norm, sel);
        const picked = sliced.sections.flatMap((s) => s.verses);
        // `sliceChantDoc` falls back to the WHOLE document when a selection
        // matched nothing — which is right for a reader, and wrong for an
        // embed: silently pasting a whole sūkta into one step is worse than
        // saying the anchor is gone.
        const asked = !!embed.select?.trim();
        const whole = norm.sections.flatMap((s) => s.verses).length;
        if (asked && picked.length === whole) { setProblem("anchor"); return; }
        setVerses(picked);
      })
      .catch((e) => {
        if (!alive) return;
        const cause = (e as { cause?: string }).cause;
        setProblem(cause === "gated" ? "gated" : cause === "missing" ? "missing" : "network");
      });
    return () => { alive = false; };
  }, [docPath, unpublished, embed.select, embed.src, attempt]);

  const fb = embed.fallback ?? { kind: "link" as const };
  if (problem && fb.kind === "omit") return null;

  const slug = docPath?.replace(/^.*\//, "").replace(/\.json$/, "") ?? "";
  const href = slug ? `/library/${slug}#chant` : undefined;
  const dirs = (embed.instructions ?? []).filter((i) => showsKind(directions, i.kind ?? "do"));

  // The registry names the document it resolved to; the authored title is the
  // generic one on the step, and would be the wrong label on a specific garland.
  const title = registered?.title ?? embed.title.en;
  const head = (
    <div className="emb__head" lang="en">
      <span className="emb__eyebrow">from</span>
      {href ? <a className="emb__title" href={href}>{title}</a>
            : <span className="emb__title">{title}</span>}
    </div>
  );

  if (unpublished) {
    return fb.kind === "instruction" ? <Direction ins={fb.instruction} />
         : fb.kind === "inline" ? <>{fb.note ? <Direction ins={fb.note} /> : null}{render(fb.verses)}</>
         : null;
  }

  if (!problem && verses) {
    return (
      <div className="emb">
        {head}
        {dirs.map((ins, i) => <Direction key={ins.id ?? i} ins={ins} />)}
        {render(verses)}
      </div>
    );
  }

  if (!problem) return <div className="emb emb--loading">{head}<div className="emb__skeleton" aria-hidden /></div>;

  const COPY: Record<ChantEmbedProblem, string> = {
    missing: "This text could not be loaded.",
    anchor: "This text could not be loaded — the passage it points at has moved.",
    draft: "Not published yet.",
    gated: "This text is part of a members’ collection.",
    network: "This text could not be fetched just now.",
    version: "This text needs a newer version of the reader — update the app.",
  };
  return (
    <div className={`emb emb--${problem === "gated" ? "locked" : "problem"}`} lang="en">
      {head}
      <p className="emb__msg">{COPY[problem]}</p>
      {fb.kind === "instruction" ? <Direction ins={fb.instruction} /> : null}
      {fb.kind === "inline" ? (
        <>
          {fb.note ? <Direction ins={fb.note} /> : null}
          {render(fb.verses)}
        </>
      ) : null}
      <div className="emb__actions">
        {href ? <a className="emb__link" href={href}>Open {embed.title.en}</a> : null}
        {problem === "network" ? (
          <button type="button" className="emb__retry" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- practice view ------------------------------------------------- */
function PracticeView(props: {
  entries: { v: Verse; s: Section }[]; idx: number; setIdx: (n: number) => void;
  primary: ScriptKey; secondary: ScriptKey | "none"; showTranslation: boolean;
  renderPada: (v: Verse, sc: ScriptKey, secondary: boolean) => ReactNode;
  /** Step-level directions marked `each-verse`, by section id — the only kind
   *  that belongs on a memorisation card. */
  eachVerse: Record<string, ChantInstruction[]>;
  playingVerse: string | null; onPlay: (v: Verse, s: Section) => void;
  audioFileFor: (v: Verse, s: Section) => string | null;
  loop: boolean; setLoop: (b: boolean) => void; autoAdvance: boolean; setAutoAdvance: (b: boolean) => void;
  onStop: () => void;
}) {
  const { entries, idx, setIdx, primary, secondary, showTranslation, renderPada, playingVerse, onPlay, audioFileFor } = props;
  const cur = entries[Math.min(idx, entries.length - 1)];
  if (!cur) return null;
  const { v, s } = cur;
  const audioSrc = audioFileFor(v, s);
  const go = (d: number) => { props.onStop(); setIdx(Math.max(0, Math.min(entries.length - 1, idx + d))); };
  return (
    <div className="practice">
      <div className="practice__meta">{s.label} · {v.n ? `verse ${v.n}` : "—"} · {idx + 1} / {entries.length}</div>
      <div className="practice__card">
        <div>
          {renderPada(v, primary, false)}
          {secondary !== "none" ? renderPada(v, secondary, true) : null}
          {showTranslation && v.translation?.en ? <div className="translation" style={{ marginTop: "1.4rem", textAlign: "center" }}>{v.translation.en}</div> : null}
          {(props.eachVerse[s.id] ?? []).map((ins, i) => <Direction key={ins.id ?? i} ins={ins} tight />)}
        </div>
      </div>
      <div className="dotrow">
        {entries.map((e, i) => (
          <span key={e.v.id} className={`dot${i === idx ? " is-on" : ""}`} onClick={() => { props.onStop(); setIdx(i); }} />
        ))}
      </div>
      <div className="practice__controls">
        <button className="practice__nav" onClick={() => go(-1)} disabled={idx === 0} aria-label="Previous">{I.prev}</button>
        <button className="practice__play" onClick={() => (audioSrc ? onPlay(v, s) : undefined)} aria-label="Play" disabled={!audioSrc}>
          {playingVerse === v.id ? I.pause : I.play}
        </button>
        <button className="practice__nav" onClick={() => go(1)} disabled={idx >= entries.length - 1} aria-label="Next">{I.next}</button>
      </div>
      <div className="seg seg--switch" style={{ justifyContent: "center", marginTop: ".8rem" }}>
        <button aria-pressed={props.loop} onClick={() => props.setLoop(!props.loop)}>Loop</button>
        <button aria-pressed={props.autoAdvance} onClick={() => props.setAutoAdvance(!props.autoAdvance)}>Auto-advance</button>
      </div>
    </div>
  );
}

/* ---------- word popover -------------------------------------------------- */
function GramEntry({ g, script }: { g: Gram; script: ScriptKey }) {
  const iastForm = g.type === "tinanta" ? (g.root ?? g.lemma) : g.lemma;
  // Show the headword in the reader's script; the dictionary URL stays IAST.
  const form = script === "iast" ? iastForm : g.forms?.[script] ?? iastForm;
  const dictUrl = DICT_BASE + encodeURIComponent(iastForm);
  return (
    <div className="wp__entry">
      <div className="wp__lemma">
        <span className="wp__lemma-label">{g.type === "tinanta" ? "dhātu" : g.type === "subanta" ? "prātipadika" : "pada"}</span>
        <span className="wp__lemma-form">{form}</span>
        <span className={`wp__pill wp__pill--${g.type}`}>{g.type}</span>
      </div>

      {g.type === "subanta" ? (
        <dl className="wp__grid">
          {g.stem ? (<><dt>śabda / stem</dt><dd>{g.stem}</dd></>) : null}
          {g.gender ? (<><dt>liṅga</dt><dd>{GENDER_NAMES[g.gender]}</dd></>) : null}
          {g.vibhakti ? (<><dt>vibhakti</dt><dd>{g.vibhakti}. {CASE_NAMES[g.vibhakti]}</dd></>) : null}
          {g.vacana ? (<><dt>vacana</dt><dd>{VACANA_NAMES[g.vacana]}</dd></>) : null}
        </dl>
      ) : g.type === "tinanta" ? (
        <dl className="wp__grid">
          {/* No `dhātu` row here: the header two lines above already shows the
              root, and shows it in the READER'S script. Repeating it printed the
              same thing twice, in IAST even in Devanāgarī, and wrapped a `gana`
              that already reads "1 (bhvādi)" in a second pair of parentheses. */}
          {g.gana ? (<><dt>gaṇa</dt><dd>{g.gana}</dd></>) : null}
          {g.lakara ? (<><dt>lakāra</dt><dd>{g.lakara}</dd></>) : null}
          {g.purusha ? (<><dt>puruṣa</dt><dd>{PURUSHA_NAMES[g.purusha]}</dd></>) : null}
          {g.vacana ? (<><dt>vacana</dt><dd>{VACANA_NAMES[g.vacana]}</dd></>) : null}
        </dl>
      ) : null}

      <div className="wp__meaning">{g.meaning}</div>
      {g.note ? <div className="wp__note">{g.note}</div> : null}
      <a className="wp__dict" href={dictUrl} target="_blank" rel="noopener noreferrer">
        <span className="ic">{I.book}</span> Monier-Williams: <b>{g.type === "tinanta" ? (g.root ?? g.lemma) : g.lemma}</b>
      </a>
    </div>
  );
}
function WordPopover(props: {
  syls: Syl[]; entries?: Gram[]; anchor?: Anchor; primary: ScriptKey; secondary: ScriptKey | "none"; onClose: () => void;
}) {
  const { syls, entries, anchor, primary, secondary, onClose } = props;
  const wide = useWide();
  const floatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const anchored = wide && !!anchor;
  useEffect(() => {
    if (!anchored) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (floatRef.current?.contains(t) || t.closest(".word")) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [anchored, onClose]);

  const headword = wordSurface(syls, primary);
  const sub = secondary !== "none" ? wordSurface(syls, secondary) : null;

  const body = (
    <>
      <div className="wp__head">
        <div className="wp__word">{headword}</div>
        {sub ? <div className="wp__word-sec">{sub}</div> : null}
        {entries && entries.length > 1 ? <div className="wp__sandhi-note">{entries.length} words (sandhi)</div> : null}
      </div>
      {entries && entries.length ? (
        entries.map((g, i) => <GramEntry key={i} g={g} script={primary} />)
      ) : (
        <div className="wp__meaning" style={{ opacity: .7 }}>Grammatical analysis for this word is being prepared.</div>
      )}
    </>
  );

  if (anchored && anchor) {
    const W = Math.min(360, window.innerWidth - 24);
    const left = Math.max(12, Math.min(anchor.x, window.innerWidth - W - 12));
    const below = anchor.y + anchor.h < window.innerHeight * 0.55;
    const style: CSSProperties = below
      ? { left, top: anchor.y + anchor.h + 10, width: W, maxHeight: window.innerHeight - (anchor.y + anchor.h) - 22 }
      : { left, bottom: window.innerHeight - anchor.y + 10, width: W, maxHeight: anchor.y - 22 };
    return (
      <div className="wp-float" ref={floatRef} style={style} role="dialog" aria-label="Word details">
        <button className="wp-float__x" onClick={onClose} aria-label="Close">{I.close}</button>
        {body}
      </div>
    );
  }

  return (
    <div className="wp-backdrop" onClick={onClose}>
      <div className="wp" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Word details">
        <div className="wp__grip" />
        {body}
        <button className="wp__close" onClick={onClose}><span className="ic">{I.close}</span> Close</button>
      </div>
    </div>
  );
}
