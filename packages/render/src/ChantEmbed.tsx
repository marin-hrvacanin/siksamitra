import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sliceChantDoc, type ChantDoc, type ChantSelection, type ChantToken } from "@siksamitra/format";
import ChantReader from "./ChantReader";
import { Icon } from "./ui/Icon.js";

/**
 * How a chant sits inside a document/class: an inviting "track" entry — a bold
 * play button, the title, a one-line preview of the opening and the verse count —
 * that, when tapped, opens the FULL reader in a fullscreen overlay (portaled to
 * <body>, so it's never squished by the document column). Esc / Close / the
 * backdrop dismiss it.
 */
export function ChantEmbed({
  src, title, note, select, slots,
}: {
  src: string;
  title?: string;
  note?: string;
  /** Render only part of the source — a section, some verses, or a range. */
  select?: ChantSelection;
  /** Fill the source's variable slots (see `ChantSlot` in @siksamitra/format). */
  slots?: Record<string, ChantToken[] | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<{ preview: string; verses: number } | null>(null);
  const openedOnce = useRef(false);
  const [initialParams, setInitialParams] = useState<
    { s?: string; s2?: string; m?: string; v?: string } | undefined
  >();

  // Shareable deep-link: a document URL with a "#chant" fragment opens straight
  // into the reader; "#chant?s=devanagari&m=read&v=v-3" also sets the initial
  // script / mode / verse. While the reader is open we keep the "#chant" fragment
  // in the URL. SSR-guarded and additive (only touches the hash).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hash;
    if (!h.startsWith("#chant")) return;
    const qs = h.slice("#chant".length).replace(/^[?&]/, "");
    if (qs) {
      const p = new URLSearchParams(qs);
      setInitialParams({
        s: p.get("s") ?? undefined,
        s2: p.get("s2") ?? undefined,
        m: p.get("m") ?? undefined,
        v: p.get("v") ?? undefined,
      });
    }
    setOpen(true);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (open) {
      openedOnce.current = true;
      if (!window.location.hash.startsWith("#chant"))
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#chant`);
    } else if (openedOnce.current && window.location.hash.startsWith("#chant")) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    }
  }, [open]);

  // Fetch the chant once for the preview line + verse count (also warms the
  // cache so opening the reader is instant).
  const selKey = select ? JSON.stringify(select) : "";
  useEffect(() => {
    let alive = true;
    fetch(src)
      .then((r) => (r.ok ? r.json() : null))
      .then((raw: ChantDoc | null) => {
        if (!alive || !raw) return;
        // The card describes what tapping it will actually open — so count and
        // preview the SLICE, not the whole source document.
        const d = sliceChantDoc(raw, select);
        const sections = d.sections ?? [];
        const verses = sections.reduce((n, s) => n + (s.verses?.length ?? 0), 0);
        const v0 = sections[0]?.verses?.[0];
        let preview = "";
        let syl = 0;
        for (const t of v0?.tokens ?? []) {
          if (t.t === "syl") {
            preview += t.iast;
            if (++syl >= 9) break;
          } else if (t.t === "sp") preview += " ";
          else if ((t.t === "bar" || t.t === "br" || t.t === "pause") && syl >= 5) break;
        }
        setMeta({ preview: preview.trim(), verses });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [src, selKey]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector(".wp-float, .wp-backdrop, .chant-settings-pop, .chant-settings-backdrop")) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const heading = title || "Read & recite";

  return (
    <div className="vu-chant-block">
      <button type="button" className="chant-track" onClick={() => setOpen(true)} aria-label={`Open the ${heading} reader`}>
        <span className="chant-track__play" aria-hidden>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M7 5v14l11-7z" /></svg>
        </span>
        <span className="chant-track__text">
          <span className="chant-track__eyebrow">Read &amp; recite · interactive reader</span>
          <span className="chant-track__title">{heading}</span>
          {meta?.preview ? <span className="chant-track__preview">{meta.preview}&#8230;</span> : null}
          <span className="chant-track__note">
            {note || "Recitation marks · translation · word-by-word grammar"}
            {meta ? ` · ${meta.verses} verses` : ""}
          </span>
        </span>
        <span className="chant-track__go" aria-hidden>
          <Icon name="arrow-up-right" size="1.15em" />
        </span>
      </button>

      {open &&
        createPortal(
          <div className="chant-modal" role="dialog" aria-modal="true" aria-label={heading}>
            <header className="chant-modal__head">
              <span className="chant-modal__title">{heading}</span>
              <button
                type="button"
                className="chant-modal__close"
                aria-label="Close reader"
                onClick={() => setOpen(false)}
              >
                <Icon name="xmark" size="1.15rem" />
                <span className="chant-modal__close-label">Close</span>
              </button>
            </header>
            <div className="chant-modal__body">
              <ChantReader src={src} select={select} slots={slots} embedded showHero initialParams={initialParams} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
