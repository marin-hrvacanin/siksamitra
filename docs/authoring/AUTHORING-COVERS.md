# Authoring YouTube covers (and publishing a class video)

This is the repeatable recipe for turning a Veda Union teaching (a sūkta / chant
class) into a published YouTube video with an on-brand cover. It has two halves:

1. **Generate the cover** — `tools/covers/gen_cover.py` (this is the reusable
   part; deterministic, offline).
2. **Publish** — upload the recording + set the generated cover as the thumbnail
   through the existing YouTube management surface (`/dashboard/youtube`).

Read alongside the tool reference in
[`../tools/covers/README.md`](../tools/covers/README.md).

---

## 1 · Generate the cover

### Inputs you need

- **Source art** — the document's square cover, `client/public/library/<slug>-cover.png`.
  Every seeded document has one (see `seed-documents.ts`). New teaching → give the
  document a cover first; the generator blends *that* art, so the cover is what
  makes the thumbnail feel like "the same series."
- **Title** — the teaching's name in IAST (`Puruṣa Sūktam`).
- **Optional**: Devanāgarī line, English gloss, and a **part label**.

### Part-label convention

A multi-class series is numbered; a single self-contained video is "Complete":

| Situation | `--label` |
| --- | --- |
| Class N of a live series | `Class 1`, `Class 2`, … |
| One-shot / full recitation | `Complete` |
| Full recitation split later | omit the flag, or `Full Recitation` |

The label is structural — it tells the viewer where in the series they are — so
only use it when the video really is a numbered part. Don't decorate.

### Run it

```bash
cd app/tools/covers
python -m pip install -r requirements.txt          # first time (pillow)

python gen_cover.py \
  --src ../../client/public/library/purusha-suktam-cover.png \
  --out purusha-class-1.jpg \
  --title "Puruṣa Sūktam" \
  --subtitle "The Hymn of the Cosmic Being" \
  --deva "पुरुष सूक्तम्" \
  --label "Class 1"
```

Output is `1280×720` JPG, well under YouTube's 2 MB thumbnail limit.

### Two concepts

- **`--variant a` (editorial, default)** — title left, deity right, part label as
  a gold-ruled eyebrow. Cleanest at thumbnail size; use for class videos.
- **`--variant b` (poster)** — inset gold frame, centred title, violet pill label.
  More ceremonial; use for festival / full-recitation features.

### Preview locally

`cover-preview.html` at the repo root (open it in a browser, like
`chant-preview.html`) is a control-rail viewer over every Concept × Deity × Part
combination. Regenerate its images after changing the generator:

```bash
cd app/tools/covers && python render_all.py
```

### Design notes (why it looks the way it does)

- The background colour is **sampled from the source art's own edge**, so the art
  dissolves into the canvas with no visible seam (the art's parchment == the
  cover's parchment).
- Type + mark use the brand tokens from `client/src/index.css`: vellum ground,
  ink `#2a1b47`, violet `#5e3fa0`, gold `#b58e4a`; Cormorant Garamond display,
  Hanken Grotesk label, Noto Serif Devanagari.
- The mark is the **Ājña chakra disc only** (no ring text), cropped from the
  official emblem by `extract_chakra.py`.
- Titles/labels/Devanāgarī are sized for **legibility at small sizes**; the
  English gloss is deliberately secondary (readable only at larger views).

---

## 2 · Publish to YouTube

Cover generation is standalone; publishing uses the platform's existing YouTube
management (channel must be connected — see the YouTube Advanced sub-page).

1. **Dashboard → YouTube → Upload** (`/dashboard/youtube`, needs `youtube.manage`).
   Pick the recording, fill title/description, then set the **thumbnail** to the
   generated JPG via the Thumbnail picker (`components/youtube/ThumbnailPicker`).
2. **Playlist** — assign the video to the series playlist (one playlist per
   teaching, e.g. *Puruṣa Sūktam — Classes*) via the Playlist assignment control.
3. **Publish.** The resumable upload + thumbnail set + playlist insert go through
   `server/src/lib/youtube/uploader.ts` and `routes/youtube.ts`; quota is tracked
   per Pacific day.

### Title / description conventions

Keep titles consistent so a series reads as a series:

```
Title:   Puruṣa Sūktam — Class 1 | Veda Union
         Puruṣa Sūktam — Complete | Veda Union

Description:
  <one-line teaching summary>

  Puruṣa Sūktam — the hymn of the Cosmic Being (Ṛgveda 10.90).
  Recited and taught by Veda Union.

  Series playlist: <link>
  Text & word-by-word: https://vedaunion.org/library/purusha-suktam
  Learn to chant: https://vedaunion.org

  #VedaUnion #PurushaSuktam #VedicChanting
```

Match the on-site title (IAST) exactly; keep the part marker (`| First Class
(Ślokas a–b)` / `| Complete Class`) so covers and titles agree. Model the copy on
existing uploads (e.g. the *Bhāgya Sūktam Classes* playlist): a one-paragraph
intro then a short "Key themes in this session" bullet list.

---

## Worked examples (the two seed uploads)

### Puruṣa Sūktam — Class 1 (a multi-class series → gets a playlist)

- **Cover:** `--label "Class 1" --variant a`
- **Playlist:** `Puruṣa Sūktam Classes` (create it; this is its first video)
- **Title:** `Puruṣa Sūktam | First Class (Ślokas 1–18)`
- **Description:**

  > In this first class, we begin the Puruṣa Sūktam (Ṛgveda 10.90), the great hymn
  > of the Cosmic Being from whom all creation pours forth. We chant ślokas 1 to 18
  > with correct svara and holdings, and unfold their meaning together. Key themes
  > in this session are:
  > • The Cosmic Person: the thousand-headed Puruṣa who pervades the earth on every side.
  > • Sacrifice as Creation: the yajña of the devas from which the worlds, the Vedas and all beings are born.
  > • The Fourfold Order: how the varṇas arise from the very body of the Puruṣa.
  > • From One to All: the vision of the one Reality expressed as the whole of manifestation.
  >
  > Text & word-by-word: https://vedaunion.org/library/purusha-suktam
  > #VedaUnion #PurushaSuktam #VedicChanting

### Durgā Sūktam — Complete (single self-contained class → no playlist)

- **Cover:** `--label "Complete" --variant a`
- **Playlist:** none
- **Title:** `Durgā Sūktam | Complete Class`
- **Description:**

  > In this complete class, we chant and explore the Durgā Sūktam, the invocation of
  > the Goddess as the fierce, radiant fire who carries us safely across every
  > difficulty (durga). We learn the full recitation with correct svara and holdings.
  > Key themes in this session are:
  > • Agni as the Goddess: invoking Jātavedas, the fire that knows all beings, as Durgā herself.
  > • Crossing Over: the prayer to be ferried across the ocean of troubles, as a boat crosses water.
  > • Protective Fire: her fierce, purifying grace against all that obstructs.
  > • Refuge and Surrender: taking shelter in the Goddess for well-being, health and peace.
  >
  > Text & word-by-word: https://vedaunion.org/library/durga-suktam
  > #VedaUnion #DurgaSuktam #VedicChanting

**Publish both** in Dashboard → YouTube → Upload: attach the mp4, paste the title +
description above, set the thumbnail to the matching `*-cover.jpg` from Downloads,
and (Puruṣa only) create + assign the `Puruṣa Sūktam Classes` playlist.

---

## 3 · Step illustrations (the figure plates in a manual)

The Pūjā Vidhi manual's figures are generated by `image-gen/gen-covers.py` (a
sibling of this repo, **not** tracked here) and keyed to transparent RGBA by
`image-gen/key-steps.py`. They cost real money per attempt. The rules below were
each paid for with a wrong plate that shipped; do not rediscover them.

**Hand chirality — the rule that was inverted for eight rounds.** Looking at the
**back** of a **right** hand with the fingers pointing **up**, the thumb is on
the **left**; seen **palm-on**, it is on the **right**. The generator asserted
the opposite for eight rounds, so every "mirrored hand" rejection in that period
was diagnosed backwards and at least one correct plate was thrown away.

**Never fix an arm by naming its hand — fix it by its shoulder.** "The right
hand sips" fails, because the model draws a plausible hand on whichever arm it
already routed. "The arm that rises to the mouth grows from the NEAR shoulder
and is drawn in front of the torso; the other crosses from behind" works. Give
the follow-the-arm-back test explicitly.

**A side view fixes a two-hands problem.** `step-karpura` twice came back with
two right hands, because in a symmetrical two-hand close-up nothing forces them
to differ. Drawn from the side, one arm is near and one is far, and the pair
cannot silently become the same hand twice.

**Prefer a reference image to prose, and keep the prose thin.** `step-acamana`
landed in four images once the owner's photographs carried the pose;
`step-guru-dhyanam` had cost fourteen while being described in paragraphs of
finger geometry. When a plate is wrong, add **one thin correction on top** of
the copy instruction — never another paragraph. Fourteen stacked, mutually
contradicting spec blocks for one drawing is the failure mode to watch for.

**Every constraint needs a test the model can apply by looking.** Geometric
rules ("the palm faces the viewer") are checked wrongly by everyone, including
the reviewer. Physical ones are not: *if that hand could not hold a spoonful of
water without spilling it, the plate is wrong.* That single sentence fixed
ācamanam after a spec had spent three rounds insisting the hand be flat.

**Check the plate against the step's own words before shipping.** The ācamanam
spec ordered a flat, uncupped hand while the manual's text for the same step
prescribed *gokarṇa*, "the palm only slightly hollowed". Nobody compared them,
so the drawing contradicted the instruction printed beside it.

**Verify the key, not just the drawing.** `key-steps.py` reports `soft-edge px`.
A clean cut is ~20–30 k; a plate whose green ground is mottled rather than flat
reports several hundred thousand and lands as a grey wash over the whole
background. Re-key with `--key auto --lo 55 --hi 110` and look at the
`-proof-light.png` before installing.

**Wiring is a separate step from drawing.** A figure can be defined in
`gen_puja.py` and never attached to a section; `fig-acamana` and `fig-karpura`
both sat unused for weeks. After regenerating, assert that every id in
`figures[]` appears in some section's items.
