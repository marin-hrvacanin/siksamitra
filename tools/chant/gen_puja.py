# -*- coding: utf-8 -*-
"""
Build `client/public/chants/puja-vidhi.json` — the interactive-reader source for
the Pūjā Vidhi manual (the sixteen-step pūjā + its preparatory and concluding
prayers + the Saṅkaṭanāśana Gaṇeśa Stotram).

WHY THIS SCRIPT EXISTS
----------------------
Holdings + anusvāra + visarga come from `gen_marks.mark()` (the saṅkalpa
marking engine — docs/AUTHORING-SANKALPA.md §2), generated offline, never
hand-typed. `deva`/`tel`/`tam` are derived per syllable with
`indic_transliteration` (AUTHORING-CHANTS §0.5).

**WHICH SOURCES COUNT** — the owner has ruled, and this supersedes anything a
research pass proposes:

  AUTHORITATIVE
    · his class deck (`puja.pptx`, transcribed) — this IS the rite, and nothing
      overrides it; where a source differs, report the difference, never
      "correct" the deck
    · *Purna Vidya: Pūjā & Prayers* (Arsha Vidya / Swami Dayananda)
    · the Pūjāvidhiḥ of Śrī Sathya Sai Loka Seva Veda Gurukulam, Muddenahalli
      (accented, Taittirīya, uses the gum) — obtained from its priests
    · Veda Union's own published material: the sādhana (v9.1.13), the sādhana
      decks under `server/resources/`, and the site's own marked documents.
      For any Rudram verse, take the text and the marks from VU's own Śrī
      Rudram, which lives in the PDFs attached to that document rather than in
      its body: `/library/sri-rudram-iast.pdf` and `-devanagari.pdf`, plus
      three svāhākāra (homa) versions. Do not re-derive Rudram marks.
    · primary Sanskrit with a locus you can check (Purāṇa, Upaniṣad, Saṁhitā,
      Āgama, Smṛti), verifiable in GRETIL or a printed edition

  A POINTER ONLY, NEVER THE CLAIM
    · modern monographs and paddhati compilations. Gudrun Bühnemann's *Pūjā: A
      Study in Smārta Ritual* (1988) is the one this manual leaned on hardest:
      she is a Western academic describing MAHARASHTRIAN practice. Where her
      footnote quotes primary Sanskrit, cite the TEXT; where she writes in her
      own voice, the claim has no source. Two claims shipped on her unfootnoted
      sentences and both had to be pulled.

  NEVER
    · forum threads, stotra aggregator sites, blogs, temple-marketing pages.
      Three separate errors reached readers this way.

A caution learned the hard way: ABSENCE from one witness is not evidence. The
fuller naivedya was deleted because a word did not occur in Bühnemann — and the
Muddenahalli gurukulam prints it in full.

**Svara** is a second, separate register decision. This is Purāṇic / stotra
material, not accented Vedic saṃhitā text, so its svara is a CONVENTION placed
on fixed syllable positions of a half-verse (see `SVARA_POS` below) — sanctioned
by the owner, and applied ONLY to the verses tagged `meter=` in the content
table. The prose / āgamic offering formulae are a different register and ship
with **no svara** this round; their traditional contour is still to come from
the owner, and adding it is a one-line change here plus a re-run.

The IAST below is written in its **underlying** form (an un-assimilated `ṁ`, an
un-sandhied `ḥ`) so that `gen_marks` derives the homorganic nasal and the
visarga variant itself and paints them in the change colour — exactly as
`/sankalpa` does. Vowel sandhi that the marking engine does not model
(`aḥ` → `o`, `a` + `a` → `ā`) is written already-applied, as in the source.

`gen_marks` assimilates the anusvāra **only before a stop**; before a VOWEL a
word-final -m stays plain `m` (it is never anusvāra there), and that case is
finished off here by `_anusvara_before_vowel()` — otherwise the three scripts
disagree (Devanāgarī/Telugu print the anusvāra sign, Tamil prints ம்).

Run with the Śikṣāmitra venv python (needs `indic_transliteration`):

    "D:/Projects/siksamitra/.venv/Scripts/python.exe" tools/chant/gen_puja.py
    "D:/Projects/siksamitra/.venv/Scripts/python.exe" tools/chant/gen_puja.py --surfaces
"""
import io
import json
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from gen_marks import mark                                        # noqa: E402
from tokens import ANUSVARA_FIXES, derive, line_tokens             # noqa: E402
from puja_words import GLOSS, OVERRIDES                            # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "..", "..", "client", "public", "chants", "puja-vidhi.json")


# --------------------------------------------------------------------------
# variable slots
# --------------------------------------------------------------------------
# The pūjā is deity-neutral: wherever `deva` stands in a mantra it is a SLOT for
# the deity being worshipped. The reader fills it from one document-level choice
# (shared/src/chant.ts `ChantSlot`, shared/src/sankalpa.ts `deitySlotTokens`),
# so choosing Gaṇeśa re-voices every mantra that names the deity.
#
# The line is marked WHOLE first, so the slot word carries exactly the marks it
# would have had in situ; only then is that one word wrapped as a slot. The
# replacement forms are marked in isolation, so — as everywhere else in this
# pipeline — sandhi is not assimilated across the slot boundary
# (docs/AUTHORING-SANKALPA.md §2).
def slotify(tokens, text, word, name):
    """Wrap the word-run matching `word` in an already-marked line as a slot."""
    words = [w for w in text.replace("|", " ").split() if w]
    if word not in words:
        raise SystemExit(f"slot word {word!r} not in {text!r}")
    target = words.index(word)
    out, run, wi = [], [], 0

    def flush():
        nonlocal run, wi
        if not run:
            return
        if wi == target:
            out.append({"t": "slot", "name": name, "tokens": run})
        else:
            out.extend(run)
        run = []
        wi += 1

    for tk in tokens:
        if tk["t"] == "syl":
            run.append(tk)
        else:
            flush()
            out.append(tk)
    flush()
    if not any(t["t"] == "slot" for t in out):
        raise SystemExit(f"slot {word!r} not placed in {text!r}")
    return out


# --------------------------------------------------------------------------
# ATTESTED svara — accent carried in the source line itself
# --------------------------------------------------------------------------
# Genuinely Vedic saṃhitā text may only ever carry the accent of an accented
# source (AUTHORING-CHANTS §3.1). The positional convention below is for
# Purāṇic / stotra material and may NEVER be applied to it.
#
# So an accented source line is written here with the accent ON the letter, in
# Veda Union's own three code points (docs/MARKING-RULES.md §1):
#
#     U+0331 ◌̱  anudātta      U+030D ◌̍  svarita      U+030E ◌̎  dīrgha-svarita
#
# `strip_accents()` lifts them off before the line enters the marking pipeline
# (which knows nothing about svara) and records which SYLLABLE each belonged to.
# A syllable is a vowel nucleus, and `gen_marks.parse_letters` cuts on exactly
# that rule, so counting nuclei here and counting `syl` tokens afterwards give
# the same index — which is what lets the accent be re-attached to the right
# letter after anusvāra/visarga sandhi has moved things around.
#
# An accent mark written after a CONSONANT (`yaddevānāṁ̎`, `āyū̍ṁṣi`) belongs to
# the syllable that consonant closes, i.e. the most recent nucleus at or before
# it — which is the same rule in both cases, so there is only one.
ACCENTS = {"̱": "anudatta", "̍": "svarita", "̎": "dirgha-svarita"}
ATTESTED = "attested"


def strip_accents(line):
    """(clean line, {nucleus index: svara}) — the accent as DATA, never derived."""
    from gen_marks import parse_letters, is_vowel
    clean, marks = [], {}
    at = []                       # accent(s) attached to the char just written
    pending = []
    for ch in line:
        if ch in ACCENTS:
            if not clean:
                raise SystemExit(f"accent with no letter before it: {line!r}")
            pending.append((len(clean) - 1, ACCENTS[ch]))
            continue
        clean.append(ch)
    at = pending
    text = "".join(clean)
    if not at:
        return text, {}
    # Walk the clean text the way the syllabifier does, counting nuclei and
    # remembering which character offsets belong to which nucleus.
    owner = {}                    # char offset -> nucleus index
    nucleus = -1
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == " " or ch == "|":
            owner[i] = nucleus
            i += 1
            continue
        two = text[i:i + 2]
        letter = two if len(parse_letters(two)) == 1 and len(two) == 2 else ch
        if is_vowel(letter):
            nucleus += 1
        for k in range(len(letter)):
            owner[i + k] = nucleus
        i += len(letter)
    for off, svara in at:
        n = owner.get(off, -1)
        if n < 0:
            raise SystemExit(f"accent before the first vowel of {line!r}")
        marks[n] = svara
    return text, marks


def apply_attested(tokens, marks, offset=0):
    """Attach the recorded accents to the vowel of the right syllable.

    Returns how many syllables this token run contributed, so a multi-line verse
    can keep counting."""
    n = offset
    for tk in tokens:
        if tk["t"] != "syl":
            continue
        svara = marks.get(n - offset)
        if svara:
            for u in tk["units"]:
                if u["c"] in VOWEL_C:
                    u["svara"] = svara
                    break
            else:
                raise SystemExit(f"no vowel to accent in {tk['iast']!r}")
        n += 1
    return n - offset


def verse_tokens(lines, num=None, slot=None):
    """`slot` = (word, name): that word becomes a variable slot in every line
    of the verse that contains it."""
    toks = []
    for i, ln in enumerate(lines):
        if i:
            toks.append({"t": "br"})
        ln, acc = strip_accents(ln)
        lt = line_tokens(ln)
        if acc:
            apply_attested(lt, acc)
        if slot and slot[0] in ln.replace("|", " ").split():
            lt = slotify(lt, ln, slot[0], slot[1])
        toks.extend(lt)
    if num:
        toks.append({"t": "num", "s": num})
        toks.append({"t": "danda", "s": "॥"})
    return toks


# --------------------------------------------------------------------------
# svara — placed BY HAND, by the owner's positional convention
# --------------------------------------------------------------------------
# Purāṇic / stotra ślokas are chanted "as if Vedic": the svara is a metrical
# CONVENTION on fixed syllable positions, not an accent derived from an accented
# source. The two position sets below are the owner's, verified against his own
# marked Lalitā Sahasranāma text. udātta is unmarked (no `svara` key).
#
#   anuṣṭubh — per 16-syllable HALF-VERSE: svarita 2, 4, 8, 14 · anudātta 6, 9, 11
#   triṣṭubh — per 11-syllable PĀDA:       svarita 2, 4, 8, 11 · anudātta 6, 9
#
# A syllable is a VOWEL NUCLEUS: hyphens are orthographic and neither add nor
# reset a count (cida-gni = ci·da·gni); a consonant cluster is one nucleus
# (mbhu, nda, jñi, kṣu, ñca each count once). gen_marks' syllabifier already
# cuts on exactly that rule, so a `syl` token == one nucleus.
#
# NEVER blanket-apply: `āsanaṁ samarpayāmi` also counts 8 syllables but is a
# prose offering formula, not a metre. Only the verses explicitly tagged
# `meter=` below are marked, and a segment whose count does not match is left
# unmarked and reported.
#
# `meter=VEDIC` is a HARD REFUSAL, not a "didn't fit". Genuinely Vedic text
# (here Kaṭha Upaniṣad 2.2.15 = Muṇḍaka 2.2.10) may only ever carry its ATTESTED
# accent from an accented source — AUTHORING-CHANTS §3.1 forbids inventing svara
# for it by convention. Tagging it VEDIC means no re-lineation of its pādas can
# ever make the positional pattern apply by accident.
VEDIC = "vedic"
SVARA_POS = {
    "anustubh": (16, {2: "svarita", 4: "svarita", 6: "anudatta", 8: "svarita",
                      9: "anudatta", 11: "anudatta", 14: "svarita"}),
    "tristubh": (11, {2: "svarita", 4: "svarita", 6: "anudatta", 8: "svarita",
                      9: "anudatta", 11: "svarita"}),
}
VOWEL_C = {"a", "ā", "i", "ī", "u", "ū", "e", "o",
           "ṛ", "ṝ", "ḷ", "ḹ", "ai", "au"}
PRANAVA = ("oṁ", "oṃ")


def _segments(tokens, skip_lead_om):
    """Half-verses / pādas: runs of `syl` tokens delimited by `br` and `danda`."""
    segs, cur = [], []
    for tk in tokens:
        if tk["t"] == "syl":
            cur.append(tk)
        elif tk["t"] == "slot":
            cur.extend(sy for sy in tk["tokens"] if sy["t"] == "syl")
        elif tk["t"] in ("br", "danda"):
            if cur:
                segs.append(cur)
            cur = []
    if cur:
        segs.append(cur)
    # The praṇava stands OUTSIDE the metre — a leading `oṁ` would make a
    # 16-syllable hemistich count 17 and match nothing.
    if skip_lead_om and segs and segs[0] and segs[0][0]["iast"] in PRANAVA:
        segs[0] = segs[0][1:]
        if not segs[0]:
            segs.pop(0)
    return segs


def apply_svara(tokens, meter, skip_lead_om=False):
    """Mark in place. Returns [(segment_no, nuclei, marked?), …] for the report."""
    if meter == VEDIC:
        # Attested accent only — never the positional convention. Measure and
        # report, mark nothing, whatever the counts come out to be.
        return [(i + 1, len(seg), False)
                for i, seg in enumerate(_segments(tokens, skip_lead_om))]
    expect, positions = SVARA_POS[meter]
    segs = _segments(tokens, skip_lead_om)
    fits = [len(seg) == expect for seg in segs]
    out = [(i + 1, len(seg), fits[i]) for i, seg in enumerate(segs)]
    # ALL-OR-NOTHING per verse. If any half-verse / pāda does not scan to the
    # expected nucleus count, the pattern is not forced anywhere in that verse —
    # a half-marked śloka would read as a bug. The misfit is reported instead.
    if not all(fits):
        return out
    for seg in segs:
        for pos, name in positions.items():
            for u in seg[pos - 1]["units"]:
                if u["c"] in VOWEL_C:
                    u["svara"] = name
                    break
    return out


def surfaces_of(tokens):
    """Word surfaces = maximal runs of `syl` tokens (== ChantReader.chunkVerse).

    A variable slot counts as exactly ONE word, whatever it is filled with — the
    reader chunks it the same way, so the per-word grammar table stays aligned
    no matter which deity the reader has chosen."""
    out, cur = [], []
    for tk in tokens:
        if tk["t"] == "syl":
            cur.append("".join(u["c"] for u in tk["units"]))
            continue
        if cur:
            out.append("".join(cur))
            cur = []
        if tk["t"] == "slot":
            out.append("".join("".join(u["c"] for u in sy["units"])
                               for sy in tk["tokens"] if sy["t"] == "syl"))
    if cur:
        out.append("".join(cur))
    return out


# --------------------------------------------------------------------------
# the content — sections in the deck's order
#   V(id, [lines], translation, n=None, num=None)
# `translation` == "" means the owner's source gives none (never invented).
# --------------------------------------------------------------------------
def V(vid, lines, tr="", n=None, num=None, meter=None, skip_om=False, slot=None,
      bracket=False, fig=None, ins=None, src=None):
    """`meter` is the REGISTER classification — the single place the decision to
    place svara lives.

      None         prose / āgamic formula: holdings + anusvāra + visarga only,
                   no svara (the traditional contour for that register is still
                   to be supplied by the owner; a one-line change here + re-run)
      "anustubh" / "tristubh"
                   Purāṇic / stotra śloka: the positional convention, applied
                   all-or-nothing per verse
      VEDIC        attested accent only — the convention may NEVER be applied

    `slot=(word, name)` turns that word into a variable slot the reader fills
    from a document-level choice — see `slotify`.

    `bracket=True` prints the verse inside square brackets — the editorial
    convention for a line that belongs to the section but stands outside its
    canonical unit. See the nāmāvalī note in `SECTIONS`.

    `src` is where THIS mantra's words come from, when a step holds several
    mantras from several loci — the three vibhūti mantras are Taittirīya Saṁhitā,
    Taittirīya Āraṇyaka and Atharvaśira Upaniṣad, and a single section source
    could only run them together in prose. One authentic source per verse, and
    never the same fact twice: what the section says is what ASSIGNS the mantra
    to that step, which is a different claim.

    `ins` is a direction belonging to THIS mantra rather than to the step —
    emitted as an instruction item immediately before the verse. A long step is
    not one instruction followed by a wall of text: naivedya sprinkles, then
    rings, then offers at the feet, and each direction has to stand where its
    own mantra is.

    `fig` is a drawing of THIS mantra rather than of the step as a whole — it is
    emitted as a figure ITEM standing immediately before the verse, because
    position in the item list is the format's only ordering mechanism. A step
    whose last offering has its own object (the tāmbūla plate, the añjali of
    flowers) needs this: `S(figure=…)` can only illustrate the step's opening.
    """
    assert meter in (None, VEDIC, ATTESTED) or meter in SVARA_POS, meter
    return {"id": vid, "lines": lines, "tr": tr, "n": n, "num": num,
            "meter": meter, "skip_om": skip_om, "slot": slot,
            "bracket": bracket, "fig": fig, "ins": ins, "src": src}


def S(sid, label, source, verses, module=None, figure=None, notes=(),
      embed=None):
    """One step.

    `label` stays authored in the one string the deck itself uses,
    `"<n> · <title> — <direction>"`, and is SPLIT mechanically by
    `split_label()` into the step number, the step's name and its `do`
    instruction (docs/DOCUMENT-COMPOSITION.md §7.2). The split is asserted to
    reassemble byte for byte, so a 30-way prose edit stays a verified
    transformation rather than a retype.

    `module` marks a section the READER composes in place (the saṅkalpa —
    shared/src/chant.ts `ChantSectionModule`): the document says where the step
    stands and what it is; the verses are supplied at render time from the day's
    pañcāṅga and the reader's chosen deity, and are spliced into this same
    section, so the whole rite stays ONE document in ONE reader.

    `figure` is a drawing OF THE DIRECTION — the two render as one card, which
    is the only pairing mechanism and the only thing that can restack on a
    phone. `notes` are further instructions (a fact about the step, a permitted
    substitution), rendered after the mantra.

    `embed` is text authored in ANOTHER document, rendered inside this step
    (shared/src/chant.ts `ChantEmbed`). It is the mechanism this manual was
    always waiting for at the nāmāvalī: the names of a deity are a document in
    their own right, and copying them in would give the platform two sources of
    truth for one text. The step keeps its number, title and directions whatever
    happens to the target, so a failure costs the mantra and never the step.
    """
    d = {"id": sid, "label": label, "source": source, "verses": verses,
         "figure": figure, "notes": list(notes)}
    if module:
        d["module"] = module
    if embed:
        d["embed"] = embed
    return d


def EMB(doc_path, title, select=None, instructions=(), fallback=None,
        module=None):
    """An embed item's payload.

    `doc_path` names ONE document. `module` names a RULE for picking one at
    render time — `namavali` asks `shared/src/namavali.ts` which garland belongs
    to the deity this reader has chosen, the same way the saṅkalpa section is
    composed from the reader's own choices. Use the module whenever the right
    document depends on something the reader has already told us: authoring one
    section per deity is what this replaced, and it could not be added to
    without also editing an "everyone else" list that had to keep partitioning
    the deity list exactly.

    `select` is the `#section..#section` / `#section/verse..#section/verse`
    syntax `parseChantSelect` reads. Leave it out to embed the WHOLE document —
    which for a nāmāvalī is what you want: its dhyāna belongs to it."""
    assert bool(doc_path) != bool(module), "an embed names a doc OR a module"
    # `doc` is FETCHED VERBATIM by the reader (`fetch(versioned(docPath))` in
    # ChantReader), so it is a PATH, not a slug. A bare slug 404s and degrades
    # to the "could not be fetched just now" placeholder — a read-time discovery
    # of an authoring mistake, which is the one thing the embed design forbids.
    # Caught here instead: `mantra-pushpam` shipped once and the owner saw it.
    if doc_path:
        assert doc_path.startswith("/chants/") and doc_path.endswith(".json"), (
            "embed doc must be a chant PATH like '/chants/<slug>.json', got %r"
            % (doc_path,))
    e = {"src": ({"doc": doc_path} if doc_path else {"module": module}),
         "title": {"en": title}}
    if select:
        e["select"] = select
    if instructions:
        e["instructions"] = list(instructions)
    # The FLOOR under every embed is a labelled placeholder plus a link to the
    # document itself, so a reader who cannot fetch it is still told what is
    # missing and where it lives. An `instruction` fallback adds what to do
    # meanwhile — here, the deck's own sentence.
    if fallback:
        e["fallback"] = fallback
    return e


def I(text, kind="do", applies_to=None):
    """A direction: English chrome, never recitable text. It carries no tokens,
    so there is no path from one into the mark renderer — and it owns no figure,
    because an illustration is a separate item of the step, not part of the
    sentence."""
    d = {"kind": kind, "text": {"en": " ".join(text.split())}}
    if applies_to:
        d["appliesTo"] = applies_to
    return d


def FIG(fid, src, alt, caption=None, **axes):
    """A figure. Four orthogonal axes — flow / size / captionAt / box; POSITION
    is the item's index in the step, never a fifth enum."""
    d = {"id": fid, "src": src, "alt": " ".join(alt.split())}
    if caption:
        d["caption"] = {"en": " ".join(caption.split())}
    d.update(axes)
    return d



# ---------------------------------------------------------------------------
# GAṆAPATI'S EIGHTEEN NAMES — authored here, SHIPPED AS THEIR OWN DOCUMENT.
# ---------------------------------------------------------------------------
# They used to stand inside this manual as a Gaṇeśa-only step. They are now
# `/chants/ganesha-ashtottara.json`, registered in `shared/src/namavali.ts` and
# reached through the one nāmāvalī step like every other deity's garland — so
# there is no longer a per-deity section here, and adding the next deity's
# names touches neither this file nor the reader.
#
# The TEXT is untouched: it is built by the same pipeline as every other verse
# in this file and then lifted out by `write_namavali()`, so what ships is the
# owner's reading, byte for byte, not a retype.
GANESHA_NAMAVALI = [
    S("upa-11-namavali-ganesha",
      "11a · Aṣṭādaśa nāmāvaliḥ — offer a flower with each name",
      "The sixteen-step pūjā · the eighteen names of Gaṇapati. The classical unit "
      "is the ṣoḍaśa-nāma, sixteen names ending skandapūrvaja; the bracketed 17th "
      "and 18th come from a different stream",
      [V("n-01", ["oṁ sumukhāya namaḥ |"], "Oṁ, salutations to Sumukha — the fair-faced one, also gracious and kindly disposed.", n="1"),
       V("n-02", ["oṁ ekadantāya namaḥ |"], "Oṁ, salutations to Ekadanta — the one-tusked one.", n="2"),
       V("n-03", ["oṁ kapilāya namaḥ |"], "Oṁ, salutations to Kapila — the tawny or reddish-brown one.", n="3"),
       V("n-04", ["oṁ gajakarṇakāya namaḥ |"], "Oṁ, salutations to Gajakarṇaka — the elephant-eared one.", n="4"),
       V("n-05", ["oṁ lambodarāya namaḥ |"],
         "Oṁ, salutations to Lambodara — the pot-bellied one.", n="5"),
       V("n-06", ["oṁ vikaṭāya namaḥ |"], "Oṁ, salutations to Vikaṭa — of unusual size or aspect — huge, formidable.", n="6"),
       V("n-07", ["oṁ vighnarājāya namaḥ |"], "Oṁ, salutations to Vighnarāja — the king of obstacles.", n="7"),
       V("n-08", ["oṁ vināyakāya namaḥ |"], "Oṁ, salutations to Vināyaka — the leader and guide, the remover of obstacles.", n="8"),
       V("n-09", ["oṁ dhūmraketave namaḥ |"],
         "Oṁ, salutations to Dhūmraketu — the smoke-grey-bannered one.", n="9"),
       V("n-10", ["oṁ gaṇādhyakṣāya namaḥ |"],
         "Oṁ, salutations to Gaṇādhyakṣa — overseer of the gaṇas, Śiva’s attendant hosts.", n="10"),
       V("n-11", ["oṁ bhālacandrāya namaḥ |"],
         "Oṁ, salutations to Bhālacandra — the one with the moon on his forehead.", n="11"),
       V("n-12", ["oṁ gajānanāya namaḥ |"], "Oṁ, salutations to Gajānana — the elephant-faced one.", n="12"),
       V("n-13", ["oṁ vakratuṇḍāya namaḥ |"], "Oṁ, salutations to Vakratuṇḍa — the curved-trunked one.", n="13"),
       V("n-14", ["oṁ śūrpakarṇāya namaḥ |"],
         "Oṁ, salutations to Śūrpakarṇa — the one with ears like winnowing baskets.", n="14"),
       V("n-15", ["oṁ herambāya namaḥ |"],
         "Oṁ, salutations to Heramba — a name of Gaṇeśa.", n="15"),
       V("n-16", ["oṁ skandapūrvajāya namaḥ |"],
         "Oṁ, salutations to Skandapūrvaja — the one born before Skanda.", n="16"),
       V("n-17", ["oṁ siddhivināyakāya namaḥ |"],
         "Oṁ, salutations to Siddhivināyaka — the Vināyaka of siddhi, bestower of accomplishment.",
         n="17", bracket=True),
       V("n-18", ["oṁ jñānagaṇapataye namaḥ |"],
         "Oṁ, salutations to Jñānagaṇapati — the Gaṇapati of knowledge.",
         n="18", bracket=True)]),
]

# `"<n> · <title> — <direction>"` — the shape of all 30 authored labels.
_N_RE = None


def split_label(label):
    """(n, title, do) from an authored label. Mechanical, and reversible."""
    import re
    global _N_RE
    if _N_RE is None:
        _N_RE = re.compile(r"^\d+[a-z]?$")
    n, rest = None, label
    if " · " in label:
        head, tail = label.split(" · ", 1)
        if _N_RE.match(head):
            n, rest = head, tail
    title, do = rest, None
    if " — " in rest:
        title, do = rest.split(" — ", 1)
    return n, title, do


def join_label(n, title, do):
    """The inverse of `split_label`, for the byte-for-byte assertion."""
    out = f"{n} · {title}" if n else title
    return f"{out} — {do}" if do else out


# Which run of numbering a step belongs to. Derived once here, never in the
# reader — it is why the preparatory steps count 1…7 and the upacāras restart.
def part_of(sid):
    # The stotram is an EXPANSION of upacāra 16, not a closing prayer. Left in
    # the "Closing" run it opened that part heading on the stotram, so a Gaṇeśa
    # reader saw the pūjā close one step early.
    if sid == "stotram":
        return "The sixteen upacāras"
    # `open-` sections belong to the OPENING. Without this they fell through to
    # the final return and were labelled "Closing", so the reader printed a
    # part heading "Closing" between "What you will need" and the lamp.
    # BEFORE YOU BEGIN holds the three unnumbered sections that precede the
    # rite: the conduct, the materials, and the auspicious opening. They must
    # share a part, or the reader prints a part heading between each of them —
    # and `open-` used to fall through to the final return and be labelled
    # "Closing", wedged between "What you will need" and the lamp.
    if sid.startswith("open-") or sid in ("prep-before", "prep-items"):
        return "Before you begin"
    if sid.startswith("prep-"):
        return "Preparatory steps"
    if sid.startswith("upa-"):
        return "The sixteen upacāras"
    return "Closing"


SAMARPAYAMI = "samarpayāmi"

# Figures — VU procedural art. Transparent PNGs that read by BODY COLOUR, not
# outline (an indigo contour is only 1.5:1 on the dark theme), so they carry no
# backing plate and no frame; they must read against the page in both themes.
# Each is attached to the DIRECTION it illustrates, so the two render as one
# card and restack together on a phone.
def SFIG(fid, src, alt, w=512, h=512, size="small", flow="start"):
    """A step drawing, in the one treatment they all share: transparent PNG,
    512 px on the long edge, palette-quantised, read by BODY COLOUR rather than
    outline (an indigo contour is only 1.5:1 on the dark theme), so it carries
    no backing plate and no frame and sits directly on the page ground.

    `crop` reserves the aspect box before the file loads, so a figure landing
    mid-step never pushes the mantra being read down the screen — square for the
    square drawings, `auto` (with the real intrinsic size) for the two that are
    not square."""
    return FIG(fid, src, alt,
               flow=flow, size=size, captionAt="none",
               crop="square" if w == h else "auto",
               frame="none", rounded=True, width=w, height=h)


FIG_GHANTA = FIG("fig-ghanta", "/figures/puja-vidhi/step-ghanta.png",
                 "A raised right hand gripping the handle of a brass bell, ringing it.",
                 flow="start", size="small", captionAt="none",
                 crop="square", frame="none", rounded=True, width=512, height=512)
FIG_KALASHA = FIG("fig-kalasha", "/figures/puja-vidhi/step-kalasha.png",
                  "A right palm laid over the mouth of the round-bellied brass kalaśa, with the offering spoon lying beside it.",
                  flow="start", size="small", captionAt="none",
                  crop="square", frame="none", rounded=True, width=512, height=512)
FIG_DHUPA = FIG("fig-dhupa", "/figures/puja-vidhi/step-dhupa.png",
                "Both hands raised: the right holding three lit incense sticks trailing smoke, the "
                "left ringing the bell.",
                flow="start", size="small", captionAt="none",
                crop="square", frame="none", rounded=True, width=512, height=512)

P = "/figures/puja-vidhi/"

FIG_DIPA = SFIG("fig-dipa", P + "step-dipa.png",
                "A lit brass oil lamp on a tall stand, its wick burning, with unbroken rice "
                "grains and marigold flowers lying beside it.")
# NOT WIRED, deliberately. The drawing reads as two people — a forearm from each
# edge meeting in mid-air — where ācamana is done with one's own two hands close
# to the body; and it pours into a deep cupped bowl of a palm, where the water
# has to sit so it can be sipped from the BASE OF THE THUMB, fingers together and
# the hand only slightly hollowed. The pose as drawn cannot lead to the act.
# Better no illustration than one that teaches the rite wrongly — the same call
# already made for madhuparkam and for dīpam before its own drawing existed. The
# asset stays on disk. All three unknowns are now settled and the replacement can
# be drawn to them: the LEFT hand holds the uddharaṇī (this is the one place it
# pours, because ācamana is the worshipper's own purification), the RIGHT is in
# gokarṇa, and the water is sipped from the root of the thumb.
FIG_ACAMANA = SFIG("fig-acamana", P + "step-acamana.png",
                   "A seated worshipper in profile: the left hand holds the spoon over "
                   "the plate, the right is raised to the lips to sip from the root of "
                   "the thumb.",
                   flow="end")   # on the RIGHT, as with pādyam and gandham
FIG_ANJALI = SFIG("fig-anjali", P + "step-anjali.png",
                  "Two palms pressed together, fingers upward, in añjali.")
# The mudrā the owner drew, now keyed and in the same treatment as the other
# figure plates. Wired here because the step it belongs to finally states the
# hand form the drawing shows — words and picture arrived together.
FIG_GURU = SFIG("fig-guru", P + "step-guru-dhyanam.png",
                "A seated worshipper with both hands on the crown of his head: thumb, "
                "middle and ring fingers resting on the head, the index fingers and the "
                "little fingers raised and meeting tip to tip, the arms forming a roof "
                "over the head.")
FIG_ASANA = SFIG("fig-asana", P + "step-asana.png",
                 "Drops of water falling onto a woven grass mat, with the offering spoon "
                 "lying across one corner.")
# The alt described the FIRST plate — two cupped palms — which contradicted the
# direction's "from the right hand". The plate has since been redrawn to the
# right hand offering a single flower at the feet of the mūrti, with akṣatas
# already lying on the pedestal; the alt now describes what is actually drawn.
FIG_AVAHANA = SFIG("fig-avahana", P + "step-avahana.png",
                   "A right hand holding a single marigold out to a cast-brass mūrti, with "
                   "unbroken rice lying on the pedestal at its feet.")
# One drawing for the THREE water offerings — pādya, arghya, ācamanīya — which
# are the same act three times over. Repeating it inline on each of three
# consecutive steps reads as a rendering fault, not as instruction, so it stands
# once, at the first of them, floated left as every other step drawing is.
# Floated RIGHT: at pādyam the mantra is short and the drawing is wide, so a
# left float pushed the line and broke the column. The owner asked for it on
# the right so the text reads past it cleanly.
FIG_ARGHYA = SFIG("fig-arghya", P + "step-arghya.png",
                  "A right hand tipping water from a naga-finialled copper spoon into a "
                  "shallow copper dish, before a cast-brass murti.", 512, 512,
                  flow="end")
# A GROUP figure, not a step figure. It shows all five substances, so floating
# it beside the milk mantra would read as "this is what kṣīra snāna is". It
# stands on its own line at the head of the first member — which, rendered, is
# immediately after `snānānantaram ācamanīyaṁ samarpayāmi` — and introduces the
# seven baths that follow. Rule: inline for one step, its own line for several.
FIG_PANCHAMRITA = SFIG("fig-panchamrita", P + "step-panchamrita.png",
                       "Five small brass cups in a row, holding milk, curd, ghee, honey "
                       # A 3.3:1 strip: at `small` the five cups would be 40 px
                       # across and unreadable, so this one drawing is `medium`.
                       "and sugar.", 512, 156, size="medium", flow="block")
FIG_VASTRA = SFIG("fig-vastra", P + "step-vastra.png",
                  "A folded crimson silk cloth with a gold border, and a coiled sacred "
                  "thread lying beside it.")
FIG_ABHARANA = SFIG("fig-abharana", P + "step-abharana.png",
                    "A brass plate holding two bangles, a beaded necklace with a red "
                    "pendant, and two small rings.")
# Floated RIGHT, like the water offering — the owner asked for it, and the
# gandha mantra is short enough that a left float breaks the column.
FIG_GANDHA = SFIG("fig-gandha", P + "step-gandha.png",
                  "The brow of a cast-brass mūrti, marked with a round disc of pale "
                  "sandal paste and, centred within it, a smaller round dot of "
                  "vermilion kuṅkuma.", flow="end")
FIG_PUSHPA = SFIG("fig-pushpa", P + "step-pushpa.png",
                  "A brass plate holding marigold and red flowers beside a heap of "
                  "turmeric-yellow unbroken rice.")
FIG_DIPAM = SFIG("fig-dipam", P + "step-dipam.png",
                 "Both hands raised: the right holding a lit brass oil lamp trailing "
                 "smoke, the left ringing the bell.")
FIG_NAIVEDYA = SFIG("fig-naivedya", P + "step-naivedya.png",
                    "A brass plate of freshly cooked rice with a small bowl of ghee and "
                    "two bananas, drops of water falling onto it.",
                    flow="end")   # on the RIGHT, as with pādyam, gandham, ācamanam
FIG_KARPURA = SFIG("fig-karpura", P + "step-karpura.png",
                   "A standing worshipper seen from the side, showing a lit camphor lamp "
                   "in his raised right hand to a brass mūrti facing him, the bell held "
                   "low in his left.")
FIG_TAMBULA = SFIG("fig-tambula", P + "step-tambula.png",
                   "A brass plate holding three betel leaves and three areca nuts.")
FIG_NAMASKARA = SFIG("fig-namaskara", P + "step-namaskara.png",
                     "A worshipper lying face down at full length on the ground, seen "
                     "from the side, arms stretched out beyond his head with the palms "
                     "pressed together, forehead, chest, knees and feet all touching.")
FIG_PANCANGA = SFIG("fig-pancanga", P + "step-pancanga.png",
                    "A woman kneeling in the five-limb salutation, seen from the side: "
                    "knees, both hands and forehead on the ground, the chest held clear "
                    "of it.")
FIG_MANTRAPUSHPA = SFIG("fig-mantrapushpa", P + "step-mantrapushpa.png",
                        "Two cupped hands holding a heap of marigold and rose-coloured "
                        "flowers.")

# The shared figure library, so a drawing used at several steps is declared once
# and can be addressed by id from a `{t:"figure", ref}` item.
# Both FIG_ANJALI and FIG_ASANA are back at the owner's call. An audit pass had
# unwired them as "decorative" — accurate about what they teach, wrong about
# whether he wants them. Every step that has a drawing shows one.
FIGURES = [FIG_DIPA, FIG_GURU, FIG_ANJALI, FIG_ASANA, FIG_GHANTA, FIG_KALASHA,
           FIG_AVAHANA, FIG_ARGHYA, FIG_PANCHAMRITA, FIG_VASTRA, FIG_ABHARANA,
           FIG_GANDHA, FIG_PUSHPA, FIG_DHUPA, FIG_DIPAM, FIG_NAIVEDYA,
           FIG_KARPURA, FIG_TAMBULA, FIG_MANTRAPUSHPA, FIG_ACAMANA,
           FIG_NAMASKARA, FIG_PANCANGA]

SECTIONS = [
    # ══ preparatory steps ═════════════════════════════════════════════════
    # A step with NO mantra is legal — the composition layer exists so that a
    # step held up by its direction alone can stand in the reader instead of
    # being apologised for in the document body, which is exactly where a
    # performer, phone in hand, is not looking. No step needs it any more:
    # prāṇāyāma, the last one that did, has its passage now.
    #
    # THE LAMP IS ONE STEP, not two. The deck prints "Light a lamp." and "Offer
    # flowers chanting: <dīpajyotiḥ…>" as separate numbered lines, which left a
    # step 1 with no mantra at all beside a step 2 that was nothing but the
    # mantra. `dīpajyotiḥ paraṁ brahma` IS the lamp-lighting mantra (owner's
    # ruling), so the split was an artefact of the numbering and nothing else.
    # Merged here, and the preparatory run renumbered so it stays unbroken.
    # ══ BEFORE YOU BEGIN ═════════════════════════════════════════════════
    # Both of these are the deck's OWN slides — "Before Pūjā …" and "Items
    # Needed to Perform Pūjā" — and neither was in the manual. For a reader who
    # has never done this, they are the two most useful pages in the handout,
    # and the manual opened straight into lighting the lamp.
    #
    # They carry no mantra, which is why they are directions only. The
    # generator counts mantra-less steps rather than forbidding them.
    S("prep-before",
      "Before the pūjā — bathe, put on freshly washed clothes, and make the "
      "altar ready",
      "Preliminaries · the conduct set out before the rite begins",
      [],
      notes=[
          I("Take a bath.", kind="note"),
          I("Wear clothes that have just been washed.", kind="note"),
          I("Tie your hair.", kind="note"),
          I("Keep pets out of the room.", kind="note"),
          I("Clean the altar and remove the previous day's offerings.",
            kind="note"),
          I("Wash the vessels and the items you will use.", kind="note"),
          I("Do not eat beforehand — preferably nothing at all. No "
            "non-vegetarian food: no meat, fish or eggs, and no onion or "
            "garlic.", kind="note"),
      ]),

    S("prep-items",
      "What you will need — set everything within reach before you sit down",
      "Preliminaries · the materials the rite calls for",
      [],
      notes=[
          I("An altar, with a vigraha — an image of the deity — or a picture "
            "of the deity.", kind="note"),
          I("An oil lamp, with oil and a wick: sesame oil or ghee.",
            kind="note"),
          I("Akṣatas — unbroken rice grains, with turmeric powder added.",
            kind="note"),
          I("A pañcapātra: a vessel of water with a spoon, for offering water.",
            kind="note"),
          I("Candana, sandal paste; and kuṅkuma, vermilion.", kind="note"),
          I("Dhūpa — incense sticks; and dīpa — a small oil lamp.", kind="note"),
          I("Naivedya, the food to be offered; and puṣpa, flowers, kept on a "
            "plate.", kind="note"),
          I("A ghaṇṭā, the bell; and karpūra, camphor, with a holder to burn "
            "it in.", kind="note"),
          I("If any one of the offerings is not available, you may use akṣatas "
            "in its place. This holds throughout the rite.", kind="option"),
      ]),

    # ══ THE AUSPICIOUS BEGINNING ═════════════════════════════════════════
    # Both authorities open with these, and they agree: the Sathya Sai Veda
    # Gurukulam's Pūjāvidhiḥ p. 1, and the Veda Union sādhana (v9.1.13) under
    # "gaṇapati ca sarasvatī prārthanā mantraḥ — auspicious beginning of
    # recitation". The accents here are lifted VERBATIM from the VU sādhana,
    # which prints them; the loci are its own.
    #
    # THE GUM is authored, not derived — `gaṇapatim̐gṁ`. Our rule leaves ṁ
    # unchanged before h-, so nothing in the engine would produce it; it is a
    # Taittirīya reading and both sources print it (MARKING-RULES, the gum).
    #
    # Everything else is authored in its UNDERLYING form and left to the
    # engine: `gaṇānāṁ tvā` → gaṇānān, `kaviṁ kavīnām` → kaviṅ, `ā naḥ śṛṇvan`
    # → naś. The VU sādhana prints those same four changes, so its page is a
    # check on our derivation rather than a thing to copy.
    S("open-auspicious",
      "Auspicious beginning — invoke Gaṇapati and Sarasvatī before you begin",
      "The opening of recitation · Taittirīya Saṁhitā · as the Veda Union "
      "sādhana and the Sathya Sai Veda Gurukulam both print it",
      [V("open-ganapati",
         ["ga̱ṇānā̎ṁ tvā ga̱ṇapa̍tim̐gṁ havāmahe",
          "ka̱viṁ ka̍vī̱nāmu̍pa̱maśra̍vastamam |",
          "jye̱ṣṭha̱rāja̱ṁ brahma̍ṇāṁ brahmaṇaspata̱ |",
          "ā na̍ḥ śṛ̱ṇvannū̱tibhi̍s sīda̱ sāda̍nam ||",
          "mahāgaṇapataye̱ nama̍ḥ |"],
         "We call upon you, lord of the gaṇas — the wise one among the wise, "
         "highest in renown, eldest king of the sacred words. Hearing us, come "
         "with your help and take your seat. Salutations to Mahāgaṇapati.",
         meter=ATTESTED,
         src="Taittirīya Saṁhitā 2.3.14 · Ṛgveda 2.23.1"),
       V("open-sarasvati",
         ["pra ṇo̍ de̱vī sara̍svatī̱ vāje̍bhir vā̱jinī̍vatī |",
          "dhī̱nāma̍vi̱trya̍vatu ||",
          "vāgdevyai̱ nama̍ḥ |"],
         "May the goddess Sarasvatī, rich in strength and abounding in "
         "rewards, protect our thoughts. Salutations to the goddess of speech.",
         meter=ATTESTED,
         src="Taittirīya Saṁhitā 1.8.22 · Ṛgveda 6.61.4")]),

    S("prep-dipa",
      "1 · Dīpa-prajvālanam — light the lamp and offer flowers, chanting",
      "Preparatory steps · the first act of the pūjā · dīpajyotiḥ paraṁ brahma, "
      "the lamp-lighting verse of the pūjā paddhati",
      [V("p-dipa",
         ["oṁ dīpajyotiḥ paraṁ brahma dīpajyotiḥ janārdanaḥ |",
          "dīpo me haratu pāpaṁ dīpajyotiḥ namo'stu te ||"],
         "Oṁ. The light of the lamp is the supreme Brahman; the light of the lamp "
         "is Janārdana. May the lamp remove my wrongdoing. Salutations to you, light "
         "of the lamp.", meter="anustubh", skip_om=True)],
      figure=FIG_DIPA),

    # THE ACTION, restored. "Take a sip of water" was the whole of it, and the
    # three things a performer actually needs — where the water comes from, the
    # shape of the receiving hand, and the point on the hand it is sipped from —
    # were all missing. This is the one step where the LEFT hand pours: it is
    # the worshipper's own purification, not an offering, which is exactly the
    # exception the rite-wide direction names.
    S("prep-acamana",
      # THE DECK'S OWN WORDS: "Take a sip of water after chanting each of the
      # following mantras". The spoon and the left hand were argued from the
      # rite-wide left/right rule rather than witnessed anywhere, and the owner
      # has ruled the sipping instruction is what belongs here.
      "2a · Ācamanam — take a sip of water after chanting each mantra",
      # The hand form and the sipping point used to be attributed to the
      # Ācārendu. That attribution could not be verified and is removed: the
      # gokarṇa shape and the brahma-tīrtha are ordinary smārta practice and
      # stand on that, not on a named book nobody has checked.
      "Preparatory steps · three names of the Lord — the ācamana formula of the "
      "smārta paddhati",
      [V("p-acamana-1", ["oṁ acyutāya namaḥ |"],
         "Oṁ, salutations to Acyuta — the one who never falls from his own nature."),
       V("p-acamana-2", ["oṁ anantāya namaḥ |"],
         "Oṁ, salutations to Ananta — the endless one."),
       V("p-acamana-3", ["oṁ govindāya namaḥ |"],
         "Oṁ, salutations to Govinda.")],
      notes=[
          # THE SOURCE GIVES TWO SHAPES AND THE MANUAL USED TO MERGE THEM.
          # Ācārendu p. 97, quoting the Dyota, has the thumb bent to the middle
          # joint of the middle finger — that part is sound. But the SAME
          # book's operative prayoga at p. 117 reads `kaniṣṭhāṅguṣṭhau vitatya
          # tisro 'ṅgulīḥ saṃhatordhvāḥ` — thumb and little finger SPREAD, the
          # three fingers JOINED — which contradicts both "the index touching
          # the root of the thumb" and "the other fingers stretched".
          # The citation `Yājñavalkya-smṛti 2.6` was a MIS-CITATION and is gone.
          I("The right hand takes the shape called gokarṇa, the cow's ear, and "
            "the books do not agree on it. One description bends the tip of "
            "the thumb to the middle joint of the middle finger; another "
            "spreads the thumb and the little finger apart and holds the three "
            "middle fingers together and upright. Both leave the palm only "
            "slightly hollowed, which is what the sip needs.", kind="note"),
          # Manu 2.59, Yājñavalkya 1.19, Baudhāyana 1.5.8.15 and Viṣṇu-smṛti
          # 62.2 all say aṅguṣṭha-mūla, the ROOT OF THE THUMB, and Manu adds
          # `tale`, on the palm side. None of them says the wrist; that was
          # imprecise. The negative half has direct support in Baudhāyana's
          # `na aṅgulībhiḥ`, "not with the fingers".
          I("Sip from the brahma-tīrtha — the root of the thumb, on the palm "
            "side — not from the fingertips, which are the part of the hand "
            "kept for the deity.", kind="note"),
      ], figure=FIG_ACAMANA),

    # THE HAND FORM, restored. The step carried no instruction at all — only
    # "visualisation of one's guru", which is what the step IS, not what you do.
    # The mudrā is the owner's own, confirmed and drawn by him; it is his
    # lineage's practice and stands on that, so the source line says so rather
    # than reaching for a text that does not exist.
    S("prep-guru",
      "2b · Guru dhyānam — rest the thumb, middle and ring fingers of each hand "
      "on the crown of your head, the index and little fingers raised and "
      "meeting their opposites, so the two hands form a roof over the head",
      "Preparatory steps · the guru vandanam and the two guru ślokas · the "
      "hand form and both additions from the Veda Union sādhana",
      # ACCENTS FROM VU'S OWN ŚRĪ RUDRAM, not from our positional convention.
      # `/library/sri-rudram-iast.pdf` p. 3 prints all three of these marked —
      # the vandanam with anudātta on `bhyo`, and the two ślokas with a printed
      # accent that is NOT what our anuṣṭubh convention would place. The owner
      # sanctioned inventing svara for Purāṇic ślokas where none was published;
      # here VU has published it, so the convention gives way. `p-guru` used to
      # carry 14 invented marks and now carries VU's.
      [V("p-guru-vandanam",
         ["guṁ gurubhyo̱ namaḥ |",
          "paṁ parama gurubhyo̱ namaḥ |",
          "paṁ parameṣṭhi gurubhyo̱ namaḥ ||"],
         "Guṁ, salutations to the gurus. Paṁ, salutations to the gurus above them. "
         "Paṁ, salutations to the highest gurus of all.",
         meter=ATTESTED, src="Veda Union · Śrī Rudram, prastāvanā"),
       V("p-guru",
         ["oṁ guru̍r brahmā̍ guru̱r viṣṇu̍r gu̱rur de̱vo mahe̍śvaraḥ |",
          "guru̍s sākṣā̍t para̱ṁ brahma̍ ta̱smai śrī̱gurave̍ namaḥ ||"],
         "The guru is Brahmā, the guru is Viṣṇu, the guru is the god Maheśvara; the "
         "guru is directly the supreme Brahman. To that revered guru, salutations.",
         meter=ATTESTED, src="Veda Union · Śrī Rudram, prastāvanā"),
       # A THIRD guru verse, which VU prints under the same heading and this
       # manual did not have at all.
       V("p-guru-vande",
         ["vande̍ guru̍pada̱dvandva̍ma̱vāṅma̱nasago̍caram |",
          "rakta̍śukla̍prabhā̱miśra̍ma̱tarkya̱ṁ traipura̍m mahaḥ ||"],
         "I bow to the pair of the guru's feet, beyond the reach of speech and "
         "mind — shining with mingled red and white, the inconceivable radiance "
         "of Tripurā.",
         meter=ATTESTED, src="Veda Union · Śrī Rudram, prastāvanā"),
       # Guru śloka II, which stands directly under the first in the sādhana and
       # was missing here. The pūjā handout prints only the first.
       V("p-guru-akhanda",
         ["akhaṇḍamaṇḍalākāraṁ vyāptaṁ yena carācaram |",
          "tatpadaṁ darśitaṁ yena tasmai śrīgurave namaḥ ||"],
         "By whom all that moves and does not move is pervaded, whose form is the "
         "unbroken whole — to that guru, by whom that state was shown, salutations.",
         meter="anustubh", src="Veda Union sādhana")],
      # THE MUDRĀ NOW HAS A SOURCE. It was carried here as the owner's own
      # teaching with no text behind it. The Veda Union sādhana states it in as
      # many words — "mṛgī mudrā, assembled with both hands: three and three
      # fingers touching the top of the head, the joined index fingers and
      # joined little fingers erect in the air" — which is exactly the form the
      # direction above describes and the drawing shows. It is also where the
      # name of the mudrā comes from.
      # THE NAME IS VU'S OWN and stands on that: both the sādhana and the Śrī
      # Rudram prastāvanā call this hand the mṛgī mudrā, in those words. Worth
      # knowing that the classical loci use the name for something else — at
      # Nāradapurāṇa 1.51.54-55, Tantrāloka 15.418 and Svacchandatantra 2.287
      # mṛgī is a ONE-HANDED homa gesture, one of a triad with haṁsī and
      # sūkarī, never two-handed and never on the head. The FINGER SET is the
      # same (thumb, middle, ring); the application is not.
      notes=[I("The hand form is the mṛgī mudrā: three fingers of each hand — "
               "thumb, middle and ring — on the crown of the head, with the "
               "joined index fingers and the joined little fingers erect in "
               "the air.", kind="note")],
      figure=FIG_GURU),

    S("prep-vighneshvara",
      # FIVE TAPS is the owner's ruling, given when an audit flagged the count
      # as unsourced: the deck says only "lightly tap the temples", and the
      # number comes from his own teaching. It is not to be removed as
      # unattributed — this comment IS the attribution.
      "2c · Vighneśvara dhyānam — lightly tap the temples with the knuckles five times",
      "Preparatory steps · the dhyāna śloka of Lord Gaṇeśa",
      [V("p-vighneshvara",
         ["oṁ śuklāmbaradharaṁ viṣṇuṁ śaśivarṇaṁ caturbhujam |",
          "prasannavadanaṁ dhyāyet sarvavighnopaśāntaye ||"],
         "One should meditate on him who wears white garments, who is all-pervading, "
         "moon-hued and four-armed, and whose face is serene — for the quelling of "
         "all obstacles.", meter="anustubh", skip_om=True)]),

    # PRĀṆĀYĀMA IS NOT A MANTRA-LESS STEP. What is recited mentally is a single
    # continuous Vedic passage — the seven vyāhṛtis, the Gāyatrī and the śiras —
    # standing whole at Taittirīya Āraṇyaka 10.35, and Bṛhad-Yogi-Yājñavalkya 8.2
    # defines prāṇāyāma as exactly that: the Gāyatrī `sa-vyāhṛtiṁ sa-praṇavāṁ …
    # śirasā saha, triḥ paṭhet`. It is the SEVEN-vyāhṛti form, each with its own
    # praṇava — not the three-vyāhṛti `bhūr bhuvaḥ svaḥ`, which belongs to the
    # arghya and the naivedya.
    #
    # THE ACCENT IS ATTESTED on the Gāyatrī and the śiras, lifted from the
    # accented source line; the VYĀHṚTIS SHIP UNACCENTED ON PURPOSE — the
    # accented witnesses mark different syllables there and none is followed.
    #
    # UNDER VERIFICATION — DO NOT CORRECT `suvaḥ` to `svaḥ`, and do not drop the
    # nasal. The Taittirīya reads `suvaḥ`, and prints the praṇava's nasal before
    # a sibilant as the *gum* — `og̠ṁ suvaḥ`, `og̠ṁ satyam`. VU's marking
    # vocabulary has no separate glyph for the gum: it is the anusvāra, and the
    # engine paints it as one, so the line is written `oṁ suvaḥ` / `oṁ satyam`
    # here. (Writing `og̠ṁ` literally would be read as an anudātta on the `g`.)
    # Non-Taittirīya manuals print plain `oṁ svaḥ`; that is not this recension.
    S("prep-pranayama",
      "2d · Prāṇāyāmaḥ — while closing the right nostril with the right thumb, "
      "inhale through the left nostril, chanting mentally in the ratio 4 : 8 : 12",
      # Bṛhad-Yogi-Yājñavalkya 8.2 and Parāśara Smṛti 12.19-21 were cited here
      # for the three-fold recitation and the closing ear-touch. Neither could
      # be verified and both are removed. TA 10.35 stays: the passage really
      # does stand whole there.
      "Preparatory steps · breath control, the inner purification · the seven "
      "vyāhṛtis, the Gāyatrī and the śiras stand as one passage at Taittirīya "
      "Āraṇyaka 10.35",
      [V("p-pranayama-vyahrti",
         ["oṁ bhūḥ | oṁ bhuvaḥ | om̐gṁ suvaḥ | oṁ mahaḥ |",
          "oṁ janaḥ | oṁ tapaḥ | om̐gṁ satyam |"],
         "Oṁ, the earth. Oṁ, the mid-region. Oṁ, the heavens. Oṁ, the great. "
         "Oṁ, the world of beings. Oṁ, the world of austerity. Oṁ, the true."),
       V("p-pranayama-gayatri",
         ["oṁ tat sa̍vitu̱r vare̎ṇya̱ṁ bha̱rgo̍ de̱vasya̍ dhī̱mahi |",
          "dhiyo̱ yo na̍ḥ praco̱dayā̎t |"],
         "Oṁ. We meditate on that adorable brilliance of the divine Savitṛ; may "
         "he impel our thoughts.", meter=ATTESTED),
       V("p-pranayama-siras",
         ["oṁ āpo̱ jyotī̱ raso̱'mṛta̱ṁ brahma̱ bhūr bhuva̱s suva̱r oṁ ||"],
         "Oṁ. The waters, the light, the essence, the immortal, brahman — "
         "bhūḥ, bhuvaḥ, suvaḥ — oṁ.", meter=ATTESTED)],
      notes=[
          # Corrected by the owner, who performs it: the little finger stays
          # FREE. The earlier "ring and little fingers closing the left" came
          # from a practitioner website — a lead, not an authority — and was
          # asserted as fact. Sources differ on the variants (a five-finger form
          # for gṛhasthas, a two-finger form in the Nārada Purāṇa), so the page
          # states only what he was taught.
          I("The hand is in nāsāgra mudrā: the index and middle fingers folded "
            "into the palm, the thumb closing the right nostril and the ring "
            "finger the left, the little finger held free — one hand, "
            "alternating between them.", kind="note"),
          # Corrected. The earlier "touch the ears three times saying oṁ, oṁ,
          # oṁ — touch, do not cover" was refuted: it traces to a single
          # compiler reproduced verbatim across many devotional sites, not to
          # independent witnesses. The act is dakṣiṇa-karṇa-sparśa, the RIGHT
          # ear only, ONCE, and the right palm CLOSES it. Parāśara Smṛti
          # 12.19-21; the cover-BOTH-ears rule is Manu 2.200, a different act.
          # PARĀŚARA 12.19-21 IS THE RIGHT LOCUS BUT NOT FOR THIS OCCASION.
          # Its occasions are sneezing, spitting, tooth-remnants, untruth and
          # conversing with the fallen — prāṇāyāma is NOT among them, so
          # applying it here is an extension the text does not make. The
          # "stands in place of ācamana" reading is well supported: 12.18 lists
          # occasions requiring re-ācamana and 12.19 gives the ear-touch, with
          # sneezing in both. Manu 2.200 was cited alongside and is a category
          # error — it covers the ears against slander of the guru.
          I("At the end, close the right ear with the right palm.",
            kind="note"),
      ]),

    # 3 · Saṅkalpaḥ is not a fixed verse: it is the variable saṅkalpa module
    # (shared/src/sankalpa.ts), composed live from the reader's deity / level /
    # pañcāṅga. It is a SECTION OF THIS DOCUMENT — it stands at its own step in
    # the one reader, with the same head, the same marks and the same type as
    # every other section, and it carries no verses here because the reader
    # supplies them. See docs/AUTHORING-SANKALPA.md §5.
    # THE POSTURE, replacing the deck's one-line placeholder. What is held is
    # water, akṣatas and a flower; the right palm rests OVER the left and is
    # never interlaced; the hands rest on the right thigh near the knee, which
    # is the placement every witness satisfies — the deck's "right thigh" and
    # the knee are the two ends of the same spot, not a disagreement.
    #
    # NOT PUBLISHED, deliberately: the closed-fist variant (right fist over a
    # bowl-shaped left palm, thumb up = śiva-liṅga mudrā) is single-sourced, and
    # what becomes of the akṣatas afterwards is secondary-source only, with the
    # destination varying between a plate, the arghya-pātra and the ground.
    S("prep-sankalpa",
      # THE POSTURE IS THE OWNER'S RULING. The deck reads "Clasp your right palm
      # over the left palm holding a flower; place them on your right thigh",
      # which is ambiguous — the participle can attach to either palm — and an
      # audit read it as the LEFT hand holding the flower. He has settled it:
      # the right hand closes over what is held and turns down onto the open
      # left palm. "Not interlaced" and "near the knee" are gone as noise; the
      # water is gone because nothing holds water in a fist.
      "3 · Saṅkalpaḥ — hold akṣatas and flower petals in your right fist, turn "
      "the fist down onto your open left palm, rest both on your right thigh, "
      "and chant",
      "Preparatory steps · the statement of intent, composed for your day, "
      "place and deity",
      [],
      module={"kind": "sankalpa"},
      notes=[
          I("A flower alone is enough.", kind="option"),
          I("You are seated facing east or north. The direction is set when you "
            "sit down for the pūjā, not adjusted for the saṅkalpa.", kind="note"),
      ]),

    S("prep-asana",
      "4 · Āsana pūjā — sprinkle water on your seat",
      "Preparatory steps · worship of the earth, to purify the seat · a paddhati "
      "verse addressed to Pṛthvī, who bears the worlds and bears the worshipper",
      [V("p-asana",
         ["pṛthvi tvayā dhṛtā lokāḥ devi tvaṁ viṣṇunā dhṛtā |",
          "tvaṁ ca dhāraya māṁ devi pavitraṁ kuru cāsanam ||"],
         "O Earth, the worlds are borne by you, and you, goddess, are borne by Viṣṇu. "
         "Bear me too, O goddess, and make this seat pure.", meter="anustubh")],
      # The audit called this plate decorative and it was unwired; the owner
      # noticed it gone and wants it back, as with the añjali. It is his manual
      # and a reader who has never done this is helped by seeing every step
      # illustrated, whether or not the drawing teaches a hand position.
      figure=FIG_ASANA),

    S("prep-ghanta",
      "5 · Ghaṇṭā pūjā — ring the bell while chanting",
      "Preparatory steps · worship of the bell, to purify the atmosphere · a "
      "paddhati verse, and one that states its own purpose",
      [V("p-ghanta",
         ["āgamārthaṁ tu devānāṁ gamanārthaṁ tu rakṣasām |",
          "kurve ghaṇṭāravaṁ tatra devatāhvānalāñchanam ||"],
         "For the coming of the gods and for the going of the rākṣasas, I sound the "
         "bell here, as the sign that the deity is being invoked.", meter="anustubh")],
      # The step's name is ghaṇṭā PŪJĀ — the bell is worshipped before it is
      # sounded, which the deck's one-line direction leaves out. And the place
      # it is set down is what makes the left hand the bell hand for the rest
      # of the rite: it ends up on the left, so the left hand reaches it while
      # the right stays free for the deity. Both from Bühnemann §0.11; kept as
      # notes rather than directions, because the deck gives only the ringing.
      notes=[
          I("The bell is worshipped before it is rung: offer it sandal paste, "
            "akṣata and a flower, as you would any other object of worship.",
            kind="note"),

      ],
      figure=FIG_GHANTA),

    # The vessel is the KALAŚA, not the pañcapātra. The class deck names the
    # pañcapātram at every operation of this step; no source puts any of them
    # there. The paddhati's kalaśārādhanam has `kalaśasyopari hastaṁ nidhāya`
    # (the palm over the mouth), then `gaṅge ca yamune`, then
    # `kalaśodakena pūjā dravyāṇi… ātmānaṁ ca samprokṣya` — and the pañcapātra
    # with its uddharaṇī is the worshipper's own ācamana vessel, whose water may
    # not be offered to the deity at all. The step name and the drawing were
    # already right; only the vessel named in the direction was wrong.
    # READING NOTE, kept off the page: the smārta paddhati sprinkles the DEITY as
    # well (`devaṁ samprokṣya`); one nitya-pūjā source excludes the deity in as
    # many words. The manual keeps the two targets both agree on.
    S("prep-kalasha",
      # THE VESSEL AS THE DECK DESCRIBES IT — "filled with water and decorated
      # with sandal paste and vermilion". This was pulled once as forum-sourced;
      # the FOUR SIDES and the tulasī were the forum's, the decoration is the
      # deck's own sentence.
      "6 · Kalaśa pūjā — fill the pot with water, mark it with sandal paste and "
      "vermilion, offer flowers in it, cover it with the right palm and chant",
      "Preparatory steps · kalaśārādhanam, the worship of the pot of water, to "
      "purify all pūjā materials · gaṅge ca yamune, the paddhati verse that calls "
      "the seven rivers into the water",
      [V("p-kalasha",
         ["gaṅge ca yamune caiva godāvari sarasvati |",
          "narmade sindhu kāveri jale'smin sannidhiṁ kuru ||"],
         "O Gaṅgā and Yamunā, Godāvarī and Sarasvatī, Narmadā, Sindhu and Kāverī — "
         "be present in this water.", meter="anustubh"),
       # THE PROKṢAṆA MANTRA, added at the owner's instruction. The deck gives
       # the sprinkling but no words for it; Bühnemann §0.13 gives this step
       # verbatim in exactly this position — `(prokṣaṇa) kalaśa-śaṅkhodakena |
       # apavitraḥ pavitro vā … | ātmānaṁ prokṣya | pūjā-dravyāṇi ca
       # saṁprokṣayet` — i.e. AFTER the kalaśa is consecrated, on oneself and
       # the materials. Placed here for that reason and no other.
       #
       # ON THE ATTRIBUTION, because it is usually got wrong: the verse is
       # Garuḍa Purāṇa 1.217.1–2, verified verbatim against GRETIL. It is very
       # widely credited to the Pauṣkara Saṁhitā — no support was found for
       # that and it should not be repeated. In the Garuḍa Purāṇa itself the
       # verse opens the sandhyā-vidhi as a general self-purification, not as a
       # pūjā mantra; its use here is the paddhatis' doing, which is what the
       # note below says.
       V("p-prokshana",
         ["apavitraḥ pavitro vā sarvāvasthāṁ gato'pi vā |",
          "yaḥ smaret puṇḍarīkākṣaṁ sa bāhyābhyantaraḥ śuciḥ ||"],
         "Impure or pure, or gone into any condition whatever — one who calls the "
         "lotus-eyed one to mind is clean without and within.",
         meter="anustubh", src="Garuḍa Purāṇa 1.217.1–2",
         # THE DEITY IS THE THIRD TARGET, on the gurukulam's authority:
         # `kalaśodakena pūjā dravyāṇi saṁprokṣya, devaṁ saṁprokṣya,
         # ātmānañ ca saṁprokṣya` (Muddenahalli p. 5). The deck names only the
         # materials and oneself; this was flagged as unresolved and is now
         # resolved by the second authority.
         ins=I("Then sprinkle the kalaśa water on all the pūjā materials, on "
               "the deity and on yourself, chanting"))],
      figure=FIG_KALASHA,
      # Materials and oneself are the safe intersection of the witnesses: the
      # smārta paddhati sprinkles the deity as well (`devaṁ samprokṣya`), and
      # one nitya-pūjā source excludes the deity in as many words. Flagged, not
      # resolved — so neither reading is silently made the manual's.
      #
      # The placement note is not decoration: three printed South Indian smārta
      # paddhatis put this verse in three different places, and one omits it.
      # Saying so is the honest form, since the deck itself gives no mantra.
      # REMOVED: "candana and kuṅkuma on its four sides, flowers or tulasī in
      # the water", which the page attributed to "the paddhatis". Its only
      # witness is a web FORUM THREAD. A forum post is not a paddhati, and
      # calling it one on the page was a false attribution, not a shorthand.
      ),

    S("prep-atma",
      "7 · Ātma pūjā — fold the hands and chant",
      "Preparatory steps · worship of the Self · a paddhati verse: the body is "
      "the temple and the jīva the deity in it",
      [V("p-atma",
         ["deho devālayaḥ proktaḥ jīvo devaḥ sanātanaḥ |",
          "tyajed ajñānanirmālyaṁ so'haṁ bhāvena pūjayet ||"],
         "The body is called the temple, and the jīva the eternal deity in it. One "
         "should discard the wilted offerings that are ignorance, and worship with "
         "the awareness “I am he.”", meter="anustubh")],
      # "Fold hands and chant" is the deck's own wording for this step, so the
      # añjali belongs here. One caveat kept in the repo rather than on the
      # page: the deck never names añjali, and the HEIGHT of the joined hands —
      # chest or forehead — is unspecified in every source retrieved, so the
      # drawing's chest height is a safe default, not a sourced fact.
      figure=FIG_ANJALI),

    # ══ the sixteen upacāras ══════════════════════════════════════════════
    S("upa-01-avahanam",
      # THE DECK'S OWN TWO INSTRUCTIONS, both of which were missing: "chant a
      # śloka addressed to the deity" and "after chanting, offer at the feet".
      # It says "in hand" and does not name a hand, so neither do we.
      "1 · Āvāhanam — visualise the deity and chant a śloka addressed to it, "
      "then offer flowers and akṣatas at its feet",
      "The sixteen-step pūjā · invocation",
      [V("u-avahana-1", ["asmin bimbe śrī devaṁ dhyāyāmi |"],
         "In this image I meditate on Śrī Deva.", slot=("devaṁ", "deity")),
       V("u-avahana-2", ["asmin bimbe śrī devaṁ āvāhayāmi |"],
         "In this image I invoke Śrī Deva.", slot=("devaṁ", "deity"))],
      figure=FIG_AVAHANA),

    S("upa-02-asanam",
      "2 · Āsanam — offer flowers at the feet of the Lord",
      "The sixteen-step pūjā · the seat",
      [V("u-asanam", ["āsanaṁ " + SAMARPAYAMI + " |"],
         "I offer a seat.")]),

    S("upa-03-padyam",
      "3 · Pādyam — offer water in a cup",
      "The sixteen-step pūjā · water for washing the feet",
      [V("u-padyam", ["pādyaṁ " + SAMARPAYAMI + " |"],
         "I offer water for washing the feet.")],
      figure=FIG_ARGHYA),

    S("upa-04-arghyam",
      "4 · Arghyam — offer water in a cup",
      "The sixteen-step pūjā · water for washing the hands",
      [V("u-arghyam", ["arghyaṁ " + SAMARPAYAMI + " |"],
         "I offer water for washing the hands.")]),

    S("upa-05-acamaniyam",
      "5 · Ācamanīyam — offer water in a cup",
      "The sixteen-step pūjā · water for inner purification",
      [V("u-acamaniyam", ["ācamanīyaṁ " + SAMARPAYAMI + " |"],
         "I offer water for inner purification.")]),

    S("upa-06-madhuparkam",
      "6 · Madhuparkam — offer water, or ghee, curds, honey or sugar, in a cup",
      "The sixteen-step pūjā · the sweet — madhuparka, the honeyed welcome drink "
      "of the guest-reception sequence, offered before the bath",
      [V("u-madhuparkam", ["madhuparkaṁ " + SAMARPAYAMI + " |"],
         "I offer madhuparka — the mixture of honey and curd.")]),

    S("upa-07-snanam",
      "7 · Snānam — ring the bell with the left hand, and offer water in a cup "
      "or onto the idol",
      "The sixteen-step pūjā · the bath · the Kālikā-Purāṇa names six occasions "
      "for the bell: the bath, the incense, the lamp, the food, the ornaments and "
      "the waving of lights",
      [V("u-snanam", ["snānaṁ " + SAMARPAYAMI + " |"],
         "I offer a bath."),
       V("u-snananantaram", ["snānānantaram ācamanīyaṁ " + SAMARPAYAMI + " |"],
         "After the bath, I offer water for inner purification.",
         ins=I("offer water in a cup"))]),


    # ══ abhiṣeka — the OPTIONAL expansion of step 7 ═══════════════════════
    # Snāna with the pañcāmṛta, then fruit-water, then pure water. It is an
    # EXPANSION anchored at `upa-07-snanam`, so the sixteen upacāras keep their
    # own numbering (these take derived sub-numbers 7a…7g) and it closes into
    # the `snānānantaram ācamanīyaṁ` line the manual already has — nothing
    # existing changes. It is OFF by default, because the home pūjā this manual
    # teaches has no abhiṣeka; the temples of the same tradition do, which is
    # exactly why it is offered rather than assumed.
    #
    # SVARA HERE IS ATTESTED DATA, lifted from the accented source, never the
    # positional convention. The forms are TAITTIRĪYA — `vṛṣṇiyam`,
    # `dadhikrāvṇṇo`, `utoṣasi` — which look wrong against a Ṛgveda edition and
    # are not; that is recorded in each section's `source`.
    S("upa-07a-ksira",
      "Kṣīra snānam — pour milk over the mūrti in a thin, continuous stream",
      "Abhiṣeka · the milk bath · the mantra is addressed to Soma and asks it to "
      "swell; the paddhati sets it here, on āpyāyana — swelling, nourishing",
      # UNDER VERIFICATION — DO NOT CORRECT `vṛṣṇiyam`. It looks like the
      # Ṛgvedic `vṛṣṇyam` with an intrusive -i-, and a metrically restored
      # edition (van Nooten–Holland) prints exactly that resolution, so the
      # form may be a restoration mis-attributed to the Taittirīya rather than
      # a Taittirīya reading. Frozen as it stands until the check lands.
      [V("a-ksira",
         ["ā pyā̍yasva̱ same̍tu te vi̱śvata̍ḥ soma̱ vṛṣṇi̍yam |",
          "bhavā̱ vāja̍sya saṅga̱the ||"],
         "Swell, O Soma; may your bull-strength come to you from every side; be "
         "there at the winning of the prize.", meter=ATTESTED, src="Taittirīya Saṁhitā 3.2.5"),
       V("a-ksira-off", ["kṣīreṇa snapayāmi |"],
         "I bathe you with milk.")],
      figure=FIG_PANCHAMRITA),

    S("upa-07b-dadhi",
      "Dadhi snānam — pour curd",
      "Abhiṣeka · the curd bath · the mantra is in praise of Dadhikrāvan, the "
      "divine steed; the paddhati sets it here, on the word dadhi",
      # UNDER VERIFICATION — DO NOT CORRECT the geminate `dadhikrāvṇṇo`.
      # Taittirīya intervocalic gemination is a real phenomenon and this is
      # very likely genuine, but it is being checked with the other three.
      [V("a-dadhi",
         ["da̱dhi̱krāvṇṇo̍ akāriṣaṁ ji̱ṣṇor aśva̍sya vā̱jina̍ḥ |",
          "su̱ra̱bhi no̱ mukhā̍ kara̱t praṇa̱ āyū̍ṁṣi tāriṣat ||"],
         "I have sung of Dadhikrāvan, the conquering steed, the swift one. May he "
         "make our mouths fragrant; may he lengthen our lives.", meter=ATTESTED, src="Taittirīya Saṁhitā 7.4.19"),
       V("a-dadhi-off", ["dadhnā snapayāmi |"],
         "I bathe you with curd.")]),

    S("upa-07c-ajya",
      "Ājya snānam — pour ghee",
      "Abhiṣeka · the ghee bath · the yajus spoken over the clarified butter as it "
      "is strained — words and act the same act",
      [V("a-ajya",
         ["śu̱krama̍si̱ jyoti̍rasi̱ tejo̍'si",
          "de̱vo va̍ḥ savi̱totpu̍nā̱tvacchi̍dreṇa",
          "pa̱vitre̍ṇa̱ vaso̱ḥ sūrya̍sya ra̱śmibhi̍ḥ ||"],
         "You are the bright one, you are light, you are radiance. May the god "
         "Savitṛ purify you with a flawless strainer, with the rays of the good sun.",
         meter=ATTESTED, src="Taittirīya Saṁhitā 1.1.10"),
       V("a-ajya-off", ["ājyena snapayāmi |"],
         "I bathe you with ghee.")]),

    # READING NOTE, kept off the page: StotraNidhi prints a svarita on the ṣa of
    # `utoṣasi`; it is rejected here against the saṁhitā witnesses. See also the
    # under-verification note on `utoṣasi` itself, below.
    S("upa-07d-madhu",
      "Madhu snānam — pour honey",
      "Abhiṣeka · the honey bath · the Madhu-vidyā — sweetness asked of the winds, "
      "the rivers and the herbs; the paddhati sets it here, on madhu",
      [V("a-madhu-1",
         ["madhu̱ vātā̍ ṛtāya̱te madhu̍ kṣaranti̱ sindha̍vaḥ |",
          "mādhvī̎rnaḥ sa̱ntvoṣa̍dhīḥ ||"],
         "Sweet blow the winds for the one who keeps ṛta; sweet flow the rivers; "
         "sweet be the herbs for us.", meter=ATTESTED, src="Taittirīya Saṁhitā 4.2.9"),
       # UNDER VERIFICATION — DO NOT CORRECT `utoṣasi`. It is a locative
       # where a Ṛgveda edition reads the ablative `utoṣaso`; whether the
       # Taittirīya really has the locative here is being checked.
       V("a-madhu-2",
         ["madhu̱ nakta̍mu̱toṣasi̱ madhu̍ma̱tpārthi̍vaṁ raja̍ḥ |",
          "madhu̱ dyaura̍stu naḥ pi̱tā ||"],
         "Sweet be the night, sweet the dawn; sweet the earthly realm; sweet be "
         "Heaven, our father.", meter=ATTESTED),
       V("a-madhu-3",
         ["madhu̍mānno̱ vana̱spati̱rmadhu̍māṁ astu̱ sūrya̍ḥ |",
          "mādhvī̱rgāvo̍ bhavantu naḥ ||"],
         "Sweet for us be the forest tree, sweet be the sun; sweet be the cows for us.",
         meter=ATTESTED),
       V("a-madhu-off", ["madhunā snapayāmi |"],
         "I bathe you with honey.")]),

    # READING NOTE, kept off the page: this one is Ṛgvedic, and it is printed in
    # Taittirīya recitation dress — as a Taittirīya reciter says it inside a
    # Yajurvedic rite. That is deliberate; do not "restore" a Ṛgvedic surface.
    S("upa-07e-sarkara",
      "Śarkarā snānam — offer sugar, then gather the five into one offering",
      "Abhiṣeka · the sugar bath · the mantra is addressed to Soma — flow sweet for "
      "the divine race; the paddhati sets it here, on svādu, sweet",
      [V("a-sarkara",
         ["svā̱duḥ pa̍vasva di̱vyāya̱ janma̍ne |",
          "svā̱durindrā̍ya su̱havī̍tu̱ nāmne̎ |",
          "svā̱durmi̱trāya̱ varu̍ṇāya vā̱yave̱ |",
          "bṛha̱spata̍ye̱ madhu̍mā̱ṁ adā̎bhyaḥ ||"],
         "Flow sweet for the divine race; sweet for Indra, whose name is well "
         "invoked; sweet for Mitra, for Varuṇa, for Vāyu, for Bṛhaspati — sweet and "
         "not to be harmed.", meter=ATTESTED, src="Ṛgveda 9.85.6"),
       V("a-sarkara-off", ["śarkarayā snapayāmi |"],
         "I bathe you with sugar."),
       V("a-pancamrta", ["pañcāmṛta snānaṁ " + SAMARPAYAMI + " |"],
         "I offer the bath of the five nectars.")]),

    S("upa-07f-phalodaka",
      "Phalodaka snānam — pour the water in which fruit has been offered",
      "Abhiṣeka · the bath in fruit-water · from the Oṣadhi Sūkta, on the plants "
      "that bear fruit and those that bear none; the paddhati sets it here, on "
      "phala",
      [V("a-phalodaka",
         ["yāḥ pha̱linī̱ryā a̍pha̱lā a̍pu̱ṣpā yāśca̍ pu̱ṣpiṇī̎ḥ |",
          "bṛha̱spati̍ prasūtā̱stā no̍ muñca̱ntvaṁha̍saḥ ||"],
         "Those plants that bear fruit and those that bear none, those without "
         "flowers and those that flower — impelled by Bṛhaspati, may they free us "
         "from distress.", meter=ATTESTED, src="Taittirīya Saṁhitā 4.2.6"),
       V("a-phalodaka-off", ["phalodakena snapayāmi |"],
         "I bathe you with fruit-water.")]),

    # READING NOTE, kept off the page: the saṁhitā marking `śivatamo rasas …
    # mātaraḥ` is published here — four witnesses to two against the ritual
    # compilations' `mātaraḥ`. DO NOT normalise it to the compilations' form.
    S("upa-07g-suddhodaka",
      "Śuddhodaka snānam — finish with pure water",
      "Abhiṣeka · the pure-water bath · the Āpaḥ Sūkta, in praise of the waters — "
      "words and act about the same thing",
      [V("a-suddha-1",
         ["āpo̱ hiṣṭhā ma̍yo̱ bhuva̱stā na̍ ū̱rje da̍dhātana |",
          "ma̱he raṇā̍ya̱ cakṣa̍se ||"],
         "Waters, you are indeed bringers of well-being; set us in vigour, that we "
         "may look upon great delight.", meter=ATTESTED, src="Taittirīya Saṁhitā 7.4.19"),
       V("a-suddha-2",
         ["yo va̍ḥ śi̱vata̍mo̱ rasa̱stasya̍ bhājayate̱ha na̍ḥ |",
          "u̱śa̱tīri̍va mā̱taraḥ̍ ||"],
         "Give us a share here of that most kindly sap of yours, as mothers, eager, "
         "give of themselves.", meter=ATTESTED),
       V("a-suddha-3",
         ["tasmā̱ ara̍ṁ gamāma vo̱ yasya̱ kṣayā̍ya̱ jinva̍tha |",
          "āpo̍ ja̱naya̍thā ca naḥ ||"],
         "To him we would gladly go, for whose dwelling you quicken us — waters, and "
         "beget us anew.", meter=ATTESTED),
       V("a-suddha-off", ["śuddhodakena snapayāmi |"],
         "I bathe you with pure water.")]),

    S("upa-08-vastram",
      "8 · Vastram — offer flowers or akṣatas",
      "The sixteen-step pūjā · cloth and the sacred thread",
      [V("u-vastram", ["vastraṁ " + SAMARPAYAMI + " |"],
         "I offer clothing."),
       V("u-upavitam", ["upavītaṁ " + SAMARPAYAMI + " |"],
         "I offer the sacred thread.")],
      figure=FIG_VASTRA),

    S("upa-09-abharanam",
      "9 · Ābharaṇam — ring the bell with the left hand, and offer flowers or "
      "akṣatas",
      "The sixteen-step pūjā · ornaments",
      [V("u-abharanam", ["ābharaṇaṁ " + SAMARPAYAMI + " |"],
         "I offer ornaments.")],
      figure=FIG_ABHARANA),

    S("upa-10-gandham",
      "10 · Gandham and kuṅkumam — offer flowers, akṣatas or sandalpaste",
      "The sixteen-step pūjā · sandalpaste and vermilion",
      [V("u-gandham", ["gandhān dhārayāmi |"],
         "I apply the fragrant paste."),
       V("u-kunkumam", ["gandhasyopari haridrākuṅkumaṁ " + SAMARPAYAMI + " |"],
         "Over the fragrant paste I offer turmeric and kuṅkuma.")],
      # THE RING FINGER IS NOT SETTLED. It came from Bühnemann p. 106 in her
      # own voice with no footnote, in a book that footnotes finger rules
      # elsewhere. The texts that do rule on it disagree with her and with each
      # other: the Śāradātilaka commentary says the LITTLE finger
      # (`gandhaṁ mantrair dadyāt kaniṣṭhayā`), the Āhnika-sūtrāvalī says
      # MIDDLE + RING + THUMB tips. The ring finger IS attested — but for the
      # ūrdhvapuṇḍra on ONESELF (Viṣvaksena-saṁhitā 20.55), not for gandha on
      # the deity, for which no primary sentence was found.
      notes=[I("Apply the paste with the ring finger of the right hand.",
               kind="note"),
             I("Sandal paste, attar and rose water all belong to this step.",
               kind="note")],
      figure=FIG_GANDHA),

    # ── vibhūti — a Śaiva / smārta note, off by default and gated to Śiva ──
    # NOT a seventeenth upacāra. Four ṣoḍaśopacāra paddhatis were checked and
    # none of them has a vibhūti step: two list it as required equipment and
    # then never spend it in a numbered offering. What the Upaniṣads codify is
    # bhasma-dhāraṇa on the DEVOTEE'S OWN BODY; applying it to the liṅga is
    # customary modern practice, so no `vibhūtiṁ samarpayāmi` formula is
    # invented here — there is none to quote.
    S("upa-10a-vibhuti",
      "Vibhūti — consecrate the ash, then draw three horizontal lines",
      "Śaiva / smārta practice · bhasma-dhāraṇa, whose procedure the Kālāgnirudra "
      "and Bṛhajjābāla Upaniṣads set out · the first two mantras are a prayer for "
      "release from death and a prayer for threefold life, brought to the ash by "
      "Śaiva practice; the third speaks of the ash itself",
      [V("v-tryambakam",
         ["trya̍mbakaṁ yajāmahe suga̱ndhiṁ pu̍ṣṭi̱vardha̍nam |",
          "u̱rvā̱ru̱kami̍va̱ bandha̍nānmṛ̱tyormu̍kṣīya̱ mā'mṛtā̎t ||"],
         "We worship the three-eyed one, the fragrant, the increaser of nourishment. "
         "As a cucumber is freed from its stalk, may I be freed from death — not from "
         "the deathless.", meter=ATTESTED, src="Taittirīya Saṁhitā 1.8.6"),
       V("v-tryayusham",
         ["tryā̱yu̱ṣaṁ ja̱mada̍gneḥ ka̱śyapa̍sya tryāyu̱ṣam |",
          "yadde̱vānāṁ̎ tryāyu̱ṣaṁ tanme̍ astu tryāyu̱ṣam |"],
         "The threefold life of Jamadagni, the threefold life of Kaśyapa — whatever "
         "threefold life belongs to the gods, may that be mine.", meter=ATTESTED, src="Taittirīya Āraṇyaka, ekāgnikāṇḍa 2"),
       V("v-agniriti",
         ["agnir iti bhasma vāyur iti bhasma",
          "jalam iti bhasma sthalam iti bhasma",
          "vyometi bhasma sarvaṁ ha vā idaṁ bhasma |"],
         "Fire is ash, wind is ash, water is ash, earth is ash, space is ash — all "
         "this indeed is ash.", src="Atharvaśira Upaniṣad 5")]),

    S("upa-11-pushpam",
      "11 · Puṣpam — hold the flower between the middle and ring fingers of the "
      "right hand, and offer it",
      # Only ONE hold is described now: the take-away hold went with the
      # yesterday's-flowers note, so "both holds" no longer had a second half.
      "The sixteen-step pūjā · flowers · the Kālikā-Purāṇa gives the hold: the "
      "flower between the middle and ring fingers to offer",
      [V("u-pushpam", ["puṣpāṇi " + SAMARPAYAMI + " |"],
         "I offer flowers.")],
      # WHAT GOES TO WHICH DEITY. Properly sourced, and directly useful here
      # because the deity is configurable: Puṣpa-cintāmaṇi 2.85, quoting the
      # Yāmala, given in Sanskrit at Bühnemann fn. 493 (variant at fn. 429) —
      # `na akṣatair arcayed viṣṇuṁ na tulasyā gaṇādhipam | na dūrvayā yajed
      # deviṁ bilva-patraiś ca bhāskāram ||`
      #
      # Stated as "tulasī is not offered to Gaṇapati", NOT as "the paddhatis
      # forbid tulasī on Gaṇapati's naivedya": the verse is a rule about
      # worship materials in general, and the sources do not spell out that
      # narrower application.
      #
      # The akṣata clause sits awkwardly against the deck's own rule that
      # akṣatas may stand in for any missing offering. The deck is the rite, so
      # the note reports the tension instead of overriding it.
      notes=[
          I("Offer a whole flower rather than a petal, fresh and unspoilt.",
            kind="note"),
          I("What is offered depends on the deity. Dūrvā grass goes to "
            "Gaṇapati, tulasī to Viṣṇu, bilva leaves to Śiva.", kind="note"),
          # "akṣatas not to Viṣṇu" WAS HERE AND IS REMOVED. It came from a
          # corrupt variant of the Puṣpa-cintāmaṇi verse, and it is contested
          # at primary level: Bhāgavata Purāṇa 11.27.33 has Kṛṣṇa himself
          # naming akṣatas among the things offered to him, and Sivananda's
          # rendering carries it twice. It also sat awkwardly against the
          # deck's own permission to substitute akṣatas for anything missing.
          # A rule the primary text contradicts does not belong on the page.
          I("Do not smell a flower before offering it — the fragrance would then "
            "be yours, and it is the deity's share.", kind="caution"),
      ],
      figure=FIG_PUSHPA),

    # ONE nāmāvalī step, for every deity. The content is resolved at render
    # time from the reader's chosen deity through `shared/src/namavali.ts` —
    # the saṅkalpa's pattern, where the document says WHERE the step stands and
    # what it is, and the reader supplies what fills it. There is deliberately
    # no `select`: a nāmāvalī's dhyāna belongs to the nāmāvalī, and the reader
    # meditates on the deity being worshipped before offering the flowers.
    #
    # What this replaced: three sections and three `onlyDeity` groups whose
    # lists had to partition the fifteen deities exactly, or a reader silently
    # got two nāmāvalīs or none. Publishing the next garland is now one line in
    # the registry.
    S("upa-11-namavali",
      "11a · Nāmāvaliḥ — offer a flower with each name",
      "The sixteen-step pūjā · the names of the deity being worshipped",
      [],
      embed=EMB(None, "Nāmāvaliḥ — the names of your deity",
                module="namavali",
                fallback={"kind": "instruction",
                          "instruction": I("Chant the names of the deity you "
                                           "are worshipping — the 108, or the "
                                           "18, or the 12 — and offer a flower "
                                           "with each name.", kind="do")})),

    S("upa-12-dhupam",
      "12 · Dhūpam — show the incense to the Lord with a circular clockwise motion "
      "three times; simultaneously ring the bell with the left hand, and chant",
      "The sixteen-step pūjā · incense",
      [V("u-dhupam", ["dhūpam āghrāpayāmi |"],
         "I offer incense.")],
      figure=FIG_DHUPA),

    S("upa-13-dipam",
      "13 · Dīpam — show the lamp held in the right hand with a circular clockwise "
      "motion three times; simultaneously ring the bell with the left hand, and chant",
      "The sixteen-step pūjā · the lamp",
      [V("u-dipam", ["dīpaṁ sandarśayāmi |"],
         "I show the lamp."),
       V("u-dhupadipanantaram",
         ["dhūpadīpānantaram ācamanīyaṁ " + SAMARPAYAMI + " |"],
         "After the incense and the lamp, I offer water for inner purification.",
         ins=I("offer a spoonful of water in the cup"))],
      # Its OWN drawing. The dhūpa figure at step 12 shows incense sticks and
      # its alt text says so; showing it against "show the lamp" would be a
      # picture of the wrong object — which is why each ārati has its own.
      #
      # Where the lamp GOES afterwards is the sort of thing a first-timer has
      # no way to guess and a knowledgeable onlooker notices at once.
      # The Gāyatrī of the deity being worshipped may be chanted over the
      # waving of the lamp. It is an OPTION, not a line of the rite: which
      # Gāyatrī it is depends on the deity slot, and the manual does not carry
      # those texts — see `sarva-devata-gayatri` in the Library for them. The
      # bell in the left hand is already in the step's own direction.
      # The lamp-placement rule (ghee at the image's right, oil at its left)
      # was removed: unverified, and it read as invented.
      notes=[I("While you show the lamp and ring the bell, you may also chant "
               "the Gāyatrī of the deity you are worshipping.",
               kind="option")],
      figure=FIG_DIPAM),

    # WHAT HIS LINEAGE TEACHES, and only that. A smārta paddhati found online
    # gives a fuller naivedya — the Gāyatrī, `satyaṁ tvā ṛtena pariṣiñcāmi` as
    # the sprinkling mantra, and the `amṛtopastaraṇam` / `amṛtāpidhānam` bracket
    # around the oblations. All of it is real and most of it is Taittirīya, and
    # none of it is in Purna Vidya, which is what this manual teaches; a website
    # is a lead, not an authority. It was added and is removed again. If it ever
    # returns it returns as an OPTIONAL GROUP marked as wider smārta practice,
    # the way abhiṣeka is — never inline in the taught sequence.
    S("upa-14a-gayatri",
      "Gāyatrī — chant the Gāyatrī over the food you have set out",
      "The fuller naivedya · as the Sathya Sai Veda Gurukulam prints it",
      [V("n-gayatri",
         # ONE `oṁ`, as the gurukulam prints it (p. 8). The second one was ours.
         ["oṁ bhūr bhuva̱s suva̍ḥ |",
          "tat sa̍vitu̱r vare̎ṇya̱ṁ bha̱rgo̍ de̱vasya̍ dhī̱mahi |",
          "dhiyo̱ yo na̍ḥ praco̱dayā̎t ||"],
         "Oṁ, earth, mid-region, heaven. Oṁ. We meditate on that adorable "
         "brilliance of the divine Savitṛ; may he impel our thoughts.",
         meter=ATTESTED, src="Śrī Sathya Sai Loka Seva Veda Gurukulam, Pūjāvidhiḥ")]),

    S("upa-14b-parisecana",
      "Pariṣecanam — encircle the food with water from the spoon",
      "The fuller naivedya · as the Sathya Sai Veda Gurukulam prints it",
      [V("n-parisecana", ["satyaṁ tvartena pariṣiñcāmi |"],
         "You, the true, I encircle with the ṛta.",
         src="Śrī Sathya Sai Loka Seva Veda Gurukulam, Pūjāvidhiḥ")],
      # PLAIN HOW-TO ONLY. This note has twice been a piece of reasoning —
      # first a stale cross-reference, then a comparison of two rites. The
      # reader needs the hand, the implement and the direction. Nothing else
      # belongs on the page; the comparison lives in this comment.
      # (The deck sprinkles water OVER the food at step 14; the gurukulam
      # draws this ring AROUND the plate. Both are kept, in their own places.)
      notes=[I("Take the spoon in your right hand and pour a thin line of "
               "water clockwise all the way round the plate, ending where "
               "you began.", kind="note")]),

    S("upa-14c-upastaranam",
      "Amṛtopastaraṇam — offer a spoonful of water in the cup",
      "The fuller naivedya · as the Sathya Sai Veda Gurukulam prints it · "
      "Taittirīya Āraṇyaka 10 for the words",
      [V("n-upastaranam", ["amṛtam astu | amṛtopastaraṇam asi |"],
         "Let it be nectar. You are the underlayer of nectar.",
         src="Śrī Sathya Sai Loka Seva Veda Gurukulam, Pūjāvidhiḥ")],
      # No note. The direction on the label — "offer a spoonful of water in
      # the cup" — is the whole action. What the underlayer and the cover MEAN
      # is in the translation of the verse itself, which is where it belongs.
      ),

    # THE SPRINKLING HAS NO MANTRA, AND THAT IS A FINDING, NOT A GAP.
    # Bühnemann §2.11 (pp. 108–111): "Then the devotee sprinkles a little water
    # on the food and places a few tulasi leaves on it for purification." No
    # mantra — and, given her method, NO FOOTNOTE on that sentence, because
    # there is no text to cite. Her printed text resumes after it. Three more
    # wordless witnesses: Krishnamurthy's pañcāyatana paddhati, a North-Indian
    # karmakāṇḍa paddhati, and the deck itself.
    #
    # The decisive negative, for whoever is tempted next: `pariṣecana` /
    # `pariṣiñc` occurs ZERO times in the whole of Bühnemann. The verb is the
    # tell — a pūjā SPRINKLES ON the food; the bhojana-vidhi ENCIRCLES the
    # plate one is about to eat from. They are different rites.
    #
    # Tantric paddhatis do word it (Bṛhat-tantrasāra 2.98a: `phaḍ iti mantreṇa
    # naivedyaṁ samprokṣya… yaṁ… raṁ… vaṁ` with the dhenu-mudrā). Different
    # sampradāya; recorded here so it is not rediscovered as a missing piece.
    S("upa-14-naivedyam",
      "14 · Naivedyam — sprinkle a little water over the food with your right hand",
      "The sixteen-step pūjā · food · the oblations are Taittirīya Āraṇyaka "
      "10.90; the sixth, brahmaṇe svāhā, is the form of the bhojana tradition",
      [V("u-naivedya-prana", ["oṁ prāṇāya svāhā |"], "Oṁ, to prāṇa — the forward-moving breath — svāhā.",
         # The middle-and-ring flower hold is the Kālikā-Purāṇa's rule for
         # PUṢPA-pūjā (`madhyamānāmikāmadhye puṣpaṁ saṅgṛhya pūjayet`) and it
         # belongs at upacāra 11, where it already is. It was wrongly carried
         # over here: the deck says only "with a flower in hand", and the
         # prāṇāgnihotra has its own mudrā per oblation instead.
         ins=I("ring the bell with the left hand; with a flower in the right, "
               "sweep once from the food up towards the altar for each of the "
               "six chants"), src="Taittirīya Āraṇyaka 10.90"),
       V("u-naivedya-apana", ["oṁ apānāya svāhā |"], "Oṁ, to apāna — the downward-moving breath — svāhā."),
       V("u-naivedya-vyana", ["oṁ vyānāya svāhā |"], "Oṁ, to vyāna — the breath that pervades the body — svāhā."),
       V("u-naivedya-udana", ["oṁ udānāya svāhā |"], "Oṁ, to udāna — the upward-moving breath — svāhā."),
       V("u-naivedya-samana", ["oṁ samānāya svāhā |"], "Oṁ, to samāna — the equalising breath — svāhā."),
       # BRACKETED, AND ALWAYS CHANTED. The brackets mark it as the oblation
       # the other witnesses do not carry — the gurukulam prints five and the
       # Taittirīya passage puts a statement, not a svāhā, in this slot. It
       # stays in the rite regardless: the owner has ruled that `brahmaṇe
       # svāhā` is always said and that the count is NOT a variant, a toggle
       # or a deity-conditional. The bracket is a mark on the page, not a
       # switch in the data.
       V("u-naivedya-brahmane", ["oṁ brahmaṇe svāhā |"], "Oṁ, to Brahman, svāhā.",
         bracket=True),
       V("u-naivedyam", ["naivedyaṁ nivedayāmi |"], "I present the food offering.",
         ins=I("offer the food at the feet of the Lord while chanting")),
       ],
      # WHAT THIS STEP DELIBERATELY DOES NOT SAY, so it is not put back:
      #   · "the six chants are six oblations into the breaths" — an
      #     explanation; the sweeps are already in the instruction above.
      #   · the five finger-mudrās (index/middle/thumb for prāṇa …). That
      #     mapping is Bhāskarārāya, Tṛcabhāskara p. 121, and that alone;
      #     Kramadīpikā 4.58-59, the Prāṇāgnihotra Upaniṣad and an
      #     arcana-paddhati give incompatible sets, and Baudhāyana 2.7.12.3
      #     has the five formulae with no mudrās. What is taught here is the
      #     flower-sweep, and two hand-actions at once teaches neither.
      #   · "there are no words for this sprinkling" — a finding about the
      #     sources, not an instruction.
      #   · the caturasra maṇḍala of water under the plate — textual, absent
      #     from both the deck and the gurukulam, and not something a reader
      #     of this manual is being asked to do.
      # The owner's rule for this page: the hand, the implement, the order.
      notes=[
          I("You can offer fruit, dry fruit, nuts and ghee sweets as well. "
            "Cooked food must be cooked fresh for the offering and left "
            "untasted, and it should not have been refrigerated. After the "
            "pūjā, take it as prasāda.", kind="note"),
      ],
      figure=FIG_NAIVEDYA),

    # ══ THE FULLER NAIVEDYA — RESTORED, AND NOW PROPERLY SOURCED ═════════
    # This block was built once from a stotra website, removed as a conflation
    # with the bhojana-vidhi, and is now BACK, because the owner produced the
    # source that settles it: the Pūjāvidhiḥ of ŚRĪ SATHYA SAI LOKA SEVA VEDA
    # GURUKULAM (Muddenahalli), 9 pp., accented, Taittirīya — it uses the gum.
    # Its naivedyam section, p. 8, prints in this order:
    #
    #   oṁ bhūrbhuvassuvaḥ | … the Gāyatrī … ||
    #   satyaṁ tvartena pariṣiñcāmi | amṛtamastu | amṛtopastaraṇamasi |
    #   … <the food> samarpayāmi | oṁ prāṇāya svāhā … oṁ samānāya svāhā |
    #   madhye madhye udaka pānīyaṁ samarpayāmi | amṛtāpidhānamasi |
    #   uttarāpośanaṁ samarpayāmi | … | naivedyaṁ samarpayāmi |
    #
    # So the Gāyatrī and the pariṣecana DO belong to naivedya in this lineage.
    # The earlier verdict — "that is the eating rite, not the offering" — was
    # wrong, and rested on the absence of the word `pariṣiñc` from a
    # Maharashtrian academic monograph. Absence from one regional witness is
    # not evidence about a Taittirīya gurukulam.
    #
    # STILL AN OPTIONAL GROUP, for one reason only: it is the Sathya Sai
    # gurukulam's form, not Purna Vidya's, and the deck is what this manual
    # teaches. It is labelled as theirs rather than presented as the rite.
    #
    # THE SIX OBLATIONS ARE FIXED. The gurukulam prints five — no `brahmaṇe
    # svāhā` — and the Taittirīya passage behind them has five with a statement
    # in the sixth slot. NONE OF THAT CHANGES THIS MANUAL: the owner has ruled
    # that `oṁ brahmaṇe svāhā` is always chanted, and that the count is not to
    # become a variant, a toggle or a deity-conditional. It is one difference
    # between two traditions, recorded here and reported on the page, and the
    # reader is never asked to choose. Do not "harmonise" it.
    #
    # The gurukulam also closes with uttarāpośana and the washing of hands and
    # feet, which the deck has not; those are additive and live in the group.
    #
    # The text is transcribed from the RENDERED PAGES, not from the PDF's text
    # layer, which is corrupt — its vowel signs map to wrong letters
    # (`विष्णुः` extracts as `तवष् िः`). scratchpad/mudd/p*.png are the images.
    S("upa-14e-madhye",
      "Madhye madhye pānīyam — offer a spoonful of water in the cup",
      "The fuller naivedya · as the Sathya Sai Veda Gurukulam prints it",
      [V("n-madhye", ["madhye madhye udaka pānīyaṁ " + SAMARPAYAMI + " |"],
         "Between and between, I offer water to drink.",
         src="Śrī Sathya Sai Loka Seva Veda Gurukulam, Pūjāvidhiḥ")]),

    S("upa-14d-apidhanam",
      "Amṛtāpidhānam — offer a spoonful of water in the cup",
      "The fuller naivedya · as the Sathya Sai Veda Gurukulam prints it · "
      "Taittirīya Āraṇyaka 10 for the words",
      [V("n-apidhanam", ["amṛtāpidhānam asi |"],
         "You are the cover of nectar.",
         src="Śrī Sathya Sai Loka Seva Veda Gurukulam, Pūjāvidhiḥ")]),

    # The three units that CLOSE the gurukulam's naivedya, after the oblations.
    # Its full order on p. 8 is: Gāyatrī · pariṣecana · amṛtopastaraṇa · <the
    # food> samarpayāmi · its five svāhās · madhye madhye udaka pānīya ·
    # amṛtāpidhāna · uttarāpośana · washing the hands and the feet · ācamanīya
    # at the mouth · naivedyaṁ samarpayāmi. The deck's own svāhās stand in the
    # step above, so this group is that sequence minus the part the deck has.
    S("upa-14f-uttaraposhana",
      "Uttarāpośanam — offer a spoonful of water in the cup",
      "The fuller naivedya · as the Sathya Sai Veda Gurukulam prints it",
      [V("n-uttaraposhana", ["uttarāpośanaṁ " + SAMARPAYAMI + " |"],
         "I offer the concluding sip of water.",
         src="Śrī Sathya Sai Loka Seva Veda Gurukulam, Pūjāvidhiḥ")]),

    S("upa-14g-prakshalana",
      "Prakṣālanam — offer water three times: for the hands, then for the "
      "feet, then for sipping",
      "The fuller naivedya · as the Sathya Sai Veda Gurukulam prints it",
      [V("n-prakshalana",
         ["hastau prakṣālayāmi | pādau prakṣālayāmi |",
          "mukhe śuddhācamanīyaṁ " + SAMARPAYAMI + " |"],
         "I wash the hands; I wash the feet; at the mouth I offer pure water "
         "for sipping.",
         src="Śrī Sathya Sai Loka Seva Veda Gurukulam, Pūjāvidhiḥ")],
      ),

    # THE WATER AFTER THE FOOD, AND THE BETEL, lifted out of step 14 so the
    # gurukulam's water sequence can stand between the offering and them —
    # which is where both rites put it. The deck's own order is unchanged:
    # food, then water, then tāmbūlam. Only the section boundary moved.
    S("upa-14h-tambulam",
      "Tāmbūlam — offer a spoonful of water in the cup, then the betel",
      "The sixteen-step pūjā · what follows the food",
      [V("u-naivedyanantaram",
         ["naivedyānantaram ācamanīyaṁ " + SAMARPAYAMI + " |"],
         "After the food offering, I offer water for inner purification.",
         ins=I("offer water")),
       V("u-tambulam", ["tāmbūlaṁ " + SAMARPAYAMI + " |"],
         "I offer betel leaf.", fig=FIG_TAMBULA,
         ins=I("offer betel leaves and nuts while chanting"))],
      notes=[I("If you do not have tāmbūlam you may chant tāmbūlārtham "
               "akṣatān samarpayāmi and offer akṣatas instead.",
               kind="option")]),

    S("upa-15-karpura",
      "15 · Karpūra-nīrājanam — stand and show the camphor with a circular clockwise "
      "motion three times; simultaneously ring the bell with the left hand, and chant",
      "The sixteen-step pūjā · lighted camphor · the mantra is on the light by "
      "whose shining everything else shines — words and act about the same thing · "
      "the Śiva-Purāṇa gives the waving pattern",
      [V("u-natatra",
         ["na tatra sūryo bhāti na candratārakaṁ",
          "nemā vidyuto bhānti kuto'yam agniḥ |",
          "tam eva bhāntam anubhāti sarvaṁ",
          "tasya bhāsā sarvam idaṁ vibhāti ||"],
         "There the sun does not shine, nor the moon and stars, nor do these "
         "lightnings shine — much less this fire. Everything shines only in the wake "
         "of that shining one; by its light all this shines.", meter=VEDIC, src="Kaṭha Upaniṣad 2.2.15"),
       V("u-karpura", ["karpūranīrājanaṁ sandarśayāmi |"],
         "I show the camphor light.")],
      # Likewise: the camphor step gets a camphor drawing, not the incense one.
      # The close-up of two hands was withheld because both were RIGHT hands.
      # Redrawn as the owner proposed — a devotee before the mūrti seen from
      # the SIDE, which is what fixes it: in profile only one arm is fully seen
      # and the other reads as the far arm, so the pair cannot quietly become
      # two of the same hand. Near arm raised with the lamp = his right, the
      # hand that acts towards the deity; far arm low with the bell = his left.
      # THE COUNT, reconciled. The direction says three times and the note used
      # to say fourteen, with nothing to say how both could be true. They are
      # one act at two levels of elaboration — the class does the three circles;
      # the body-mapped pattern is the temple's fuller form. And it belongs to
      # the waving of lights ALONE: no source applies it to the incense or the
      # lamp, which is why it is attached here and nowhere else.
      notes=[I("Trace the circle upright in the air in front of the image, "
               "going clockwise.", kind="note"),
             I("Three circles is the short form. The fuller form waves the "
               "light four times at the feet, twice at the navel, once at the "
               "face, and seven times over the whole form.", kind="note"),
             # An OPTION, and it has to stay one: the ārati sung at the camphor
             # is particular to the deity and to the house that sings it, and
             # this manual does not carry those songs. Naming it as permitted is
             # the whole of what can be said without inventing a text.
             I("You may also sing the ārati of the deity you are worshipping "
               "here, after the camphor is shown.", kind="option"),
             # ORDER IS THE POINT of this one. The petals are circled round the
             # flame and given to the DEITY while the light is still the
             # deity's — before the flame is carried to the people. Stated
             # relative to that, because "before you turn it round" is the only
             # thing that fixes when it happens; the step otherwise ends at the
             # waving and a reader would put the flowers anywhere.
             I("Take a few flower petals, circle them around the flame, and "
               "offer them to the deity — do this before you carry the light "
               "round to those present.", kind="do")],
      figure=FIG_KARPURA),

    # Mantra puṣpam stands AFTER the camphor and BEFORE the vandanam: the
    # lights have been shown, and the flower-offering that closes the worship
    # follows. It is EMBEDDED, not copied — the text lives in its own document
    # (`mantra-pushpam`, Taittirīya Āraṇyaka 1.22) and is rendered here from
    # there, so there is exactly one copy of it in the Library.
    S("upa-15a-mantrapushpam",
      "15a · Mantra puṣpam — remain standing, and recite the flower of the "
      "mantra, holding flowers in the cupped hands",
      "The sixteen-step pūjā · the flower of the mantra · "
      "Taittirīya Āraṇyaka 1.22 · Aruṇapraśna 77–84",
      [],
      embed=EMB("/chants/mantra-pushpam.json", "Mantra Puṣpam",
                instructions=[
                    I("Offer the flowers at the feet of the Lord when the "
                      "recitation ends.")])),

    # THREE ACTS, not one sentence. The step used to read "continue standing and
    # offer flowers; then turn around yourself clockwise three times, and offer
    # salutation" — mantrapuṣpāñjali, pradakṣiṇā and namaskāra compressed into
    # one line, with the prostration given no form at all. Each act now stands
    # with its own mantra, the way naivedya's do.
    S("upa-16-vandanam",
      "16 · Vandanam — remain standing, and offer flowers with akṣatas in both "
      "hands, cupped",
      "The sixteen-step pūjā · salutation, circumambulation and prostration · "
      "yāni kāni ca pāpāni, the pradakṣiṇā verse of the paddhati",
      [V("u-mantrapushpanjali", ["mantrapuṣpāñjaliṁ " + SAMARPAYAMI + " |"],
         "I offer a handful of flowers with mantras.", fig=FIG_MANTRAPUSHPA,
         ins=I("take flowers with akṣatas in both hands, cupped, chant over them, "
               "and offer them at the feet of the Lord")),
       V("u-pradakshina",
         ["yāni kāni ca pāpāni janmāntarakṛtāni ca |",
          "tāni tāni praṇaśyanti pradakṣiṇaṁ pade pade ||"],
         "Whatever wrongs there are, including those done in other births — all of "
         "them are destroyed, step by step, in circumambulation.", meter="anustubh",
         # The extended right hand and bowed head were dropped on the owner's
         # instruction (2026-08): not what his lineage does. Keeping the deity
         # on your right IS the pradakṣiṇā, and that is what the direction says.
         ins=I("circle the deity three times, keeping it on your right; where "
               "there is no room to walk around, turn around yourself "
               "clockwise three times")),
       # NOT the añjali here: this step is the aṣṭāṅga namaskāra, a full
       # prostration on the ground, and a plate of joined palms held up at the
       # chest would contradict the direction printed beside it. It has its own
       # drawing instead.
       #
       # MEN ONLY: the owner's own instruction, and it stands on his lineage,
       # as the guru mudrā does. No text was retrieved either way, and the
       # women's form is NOT stated here — he did not give it and no source
       # was found, so the manual says who does this and stops there.
       V("u-namaskaram", ["pradakṣiṇanamaskārān " + SAMARPAYAMI + " |"],
         "I offer circumambulation and prostration.",
         fig=FIG_NAMASKARA,
         ins=I("prostrate with the eight limbs — forehead, chest, both hands, "
               "both knees and both feet touching the ground"))],
      # BOTH FORMS, on the owner's instruction. The contrast is the teaching:
      # eight points on the ground against five, and the CHEST is the one that
      # comes off. Both rest on his lineage — no text was retrieved for either
      # the men-only rule or the women's form, so neither is dressed in a
      # citation. The two plates are drawn facing the same way on purpose, so
      # a reader comparing them sees only the posture change.
      notes=[
          # The stotram itself is Gaṇeśa's and is gated to him; the ACT is
          # every rite's, so the direction for it stands here unconditionally.
          I("After the mantrapuṣpāñjali, chant a stotram of the deity you are "
            "worshipping, standing.", kind="note"),
          I("This full prostration is made by men only.", kind="note"),
          I("Women make the five-limb salutation instead: the two knees, the "
            "two hands and the forehead come to the ground, and the chest is "
            "held clear of it.", kind="note"),
          FIG_PANCANGA,
      ]),

    # ══ the stotram chanted at the sixteenth step ═════════════════════════
    S("stotram",
      "Saṅkaṭanāśana Gaṇeśa Stotram — chant the stotram, standing, after the "
      "mantrapuṣpāñjali",
      "Śrī Nārada Purāṇa · the twelve names of Gaṇapati",
      [V("s-uvaca", ["śrī nārada uvāca"], "Śrī Nārada said:"),
       V("s-1", ["praṇamya śirasā devaṁ gaurīputraṁ vināyakam |",
                 "bhaktāvāsaṁ smaren nityam āyuḥkāmārthasiddhaye ||"],
         "Having bowed his head to the god Vināyaka, son of Gaurī, who dwells in his "
         "devotees, one should remember him constantly, for the attainment of long "
         "life, of what he desires, and of wealth.",
         n="1", num="1", meter="anustubh"),
       V("s-2", ["prathamaṁ vakratuṇḍaṁ ca ekadantaṁ dvitīyakam |",
                 "tṛtīyaṁ kṛṣṇapiṅgākṣaṁ gajavaktraṁ caturthakam ||"],
         "First Vakratuṇḍa, and Ekadanta second; third Kṛṣṇapiṅgākṣa, and Gajavaktra "
         "fourth;",
         n="2", num="2", meter="anustubh"),
       V("s-3", ["lambodaraṁ pañcamaṁ ca ṣaṣṭhaṁ vikaṭam eva ca |",
                 "saptamaṁ vighnarājaṁ ca dhūmravarṇaṁ tathā'ṣṭamam ||"],
         "Lambodara fifth, and sixth Vikaṭa; seventh Vighnarāja, and Dhūmravarṇa "
         "eighth;",
         n="3", num="3", meter="anustubh"),
       V("s-4", ["navamaṁ bhālacandraṁ ca daśamaṁ tu vināyakam |",
                 "ekādaśaṁ gaṇapatiṁ dvādaśaṁ tu gajānanam ||"],
         "ninth Bhālacandra, and tenth Vināyaka; eleventh Gaṇapati, and twelfth "
         "Gajānana.",
         n="4", num="4", meter="anustubh"),
       V("s-5", ["dvādaśaitāni nāmāni trisandhyaṁ yaḥ paṭhen naraḥ |",
                 "na ca vighnabhayaṁ tasya sarvasiddhikaraṁ prabho ||"],
         "The man who recites these twelve names at the three junctions of the day has "
         "no fear of obstacles; this brings about every attainment, O Lord.",
         n="5", num="5", meter="anustubh"),
       V("s-6", ["vidyārthī labhate vidyāṁ dhanārthī labhate dhanam |",
                 "putrārthī labhate putrān mokṣārthī labhate gatim ||"],
         "One who wants learning gains learning, one who wants wealth gains wealth, "
         "one who wants sons gains sons, and one who wants liberation reaches that "
         "goal.",
         n="6", num="6", meter="anustubh"),
       V("s-7", ["japed gaṇapatistotraṁ ṣaḍbhiḥ māsaiḥ phalaṁ labhet |",
                 "saṁvatsareṇa siddhiṁ ca labhate nātra saṁśayaḥ ||"],
         "One should recite this hymn to Gaṇapati: in six months one obtains its "
         "fruit, and within a year one attains accomplishment — of this there is no "
         "doubt.",
         n="7", num="7", meter="anustubh"),
       V("s-8", ["aṣṭabhyo brāhmaṇebhyaḥ ca likhitvā yaḥ samarpayet |",
                 "tasya vidyā bhavet sarvā gaṇeśasya prasādataḥ ||"],
         "And whoever writes it out and presents it to eight brāhmaṇas gains all "
         "learning, through the favour of Gaṇeśa.",
         n="8", num="8", meter="anustubh"),
       V("s-colophon",
         ["|| iti śrīnāradapurāṇe",
          "saṅkaṭanāśanagaṇeśastotraṁ sampūrṇam ||"],
         "Thus ends the Saṅkaṭanāśana Gaṇeśa Stotram in the Śrī Nārada Purāṇa.")]),

    # ══ concluding prayers ════════════════════════════════════════════════
    # READING NOTE, kept off the page: the class deck reads `maheśvara` and
    # `tad astu te` where the dominant printed text has `sureśvara` and
    # `tad astu me`. The deck's reading is the one published — the manual teaches
    # what he teaches. DO NOT "correct" it to the printed text.
    S("close-kshama",
      "Kṣamā prārthanā — to seek forgiveness, one may chant",
      "Concluding prayers · asking pardon for what was wanting · the kṣamā "
      "prārthanā of the paddhati",
      [V("c-kshama",
         ["mantrahīnaṁ kriyāhīnaṁ bhaktihīnaṁ maheśvara |",
          "yat pūjitaṁ mayā deva paripūrṇaṁ tad astu te ||"],
         "O Maheśvara, whatever worship I have done — lacking in mantra, lacking in "
         "procedure, lacking in devotion — may that be complete for you.",
         meter="anustubh")]),

    # ══ THE DEITY FORMS OF THE KṢAMĀ PRĀRTHANĀ ═══════════════════════════
    # The prayer for pardon is the same prayer everywhere; what changes is
    # whom it addresses, and how many verses the tradition prints. The one
    # above is the single śloka of the pūjā material, addressed to Maheśvara.
    # The two below are VU'S OWN PUBLISHED FORMS, lifted from the pages the
    # site already serves — text, marks and all — so a reader chanting either
    # of them is chanting exactly what the sādhana and the Rudram book print:
    #
    #   Nārāyaṇa  ·  Veda Union Youth Wing sādhanā v1.0.1 IAST
    #   Devī      ·  /library/veda-union-sadhana-iast.pdf, p. 66
    #   Śiva      ·  /library/sri-rudram-iast.pdf,        p. 38
    #
    # THE MARKS ARE LIFTED, NOT DERIVED (meter=ATTESTED). VU marks these
    # ślokas on its own pages; re-deriving them by the positional convention
    # would print something subtly different from the book beside it.
    #
    # What was changed in transcription, and nothing else: VU's typographic
    # hyphens are dropped, and the nasals it spells by pronunciation (ṅ before
    # k, ñ before c, n before d, m before m) are written back as `ṁ` — which
    # is the engine's input, and it derives the pronunciation again. `yan
    # nyūnam` keeps its `n`: that is real sandhi of `yat`, not an anusvāra.
    # `imāgṁ` is authored with the gum as `imām̐gṁ`.
    #
    # THE NĀRĀYAṆA FORM IS ITS OWN PRAYER, not the others with the vocative
    # changed. Its first two verses — `yadakṣarapadabhraṣṭam` and
    # `visargabindumātrāṇi` — ask pardon for faults IN THE RECITATION ITSELF,
    # syllable, measure, visarga and anusvāra, which neither of the other two
    # forms does; and its last verse asks for protection (`rakṣa tvaṁ`) where
    # the Śiva form asks for pardon. Only its third verse is shared.
    S("close-kshama-narayana",
      "Kṣamā prārthanā · Nārāyaṇa — to seek forgiveness, one may chant this",
      "Concluding prayers · Veda Union · Youth Wing sādhanā",
      [V("ck-nara-1",
         ["yada̍kṣara̍pada̱bhraṣṭa̍ṁ mā̱trāhī̱naṁ tu ya̍d bhavet |",
          "tat sa̍rvaṁ kṣa̍myatā̱ṁ deva̍ nā̱rāya̱ṇa namo̍'stu te ||"],
         "Whatever has fallen away from its syllables and its words, whatever has "
         "lost its measure — let all of that be pardoned, Lord Nārāyaṇa; salutation "
         "to you.",
         n="1", num="1", meter=ATTESTED,
         src="Veda Union · Youth Wing sādhanā, nārāyaṇa kṣamā prārthanā"),
       V("ck-nara-2",
         ["visa̍rgabi̍ndumā̱trāṇi̍ pa̱dapā̱dākṣarā̍ṇi ca |",
          "nyūnā̍ni cā̍tiri̱ktāni̍ kṣa̱masva̱ nārā̍yaṇa ||"],
         "Visargas, anusvāras and vowel measures, words, pādas and syllables — "
         "where they were too few or too many, forgive it, Nārāyaṇa.",
         n="2", num="2", meter=ATTESTED,
         src="Veda Union · Youth Wing sādhanā, nārāyaṇa kṣamā prārthanā"),
       V("ck-nara-3",
         ["apa̍rādha̍ saha̱srāṇi̍ kri̱yante̱'harniśa̍ṁ mayā |",
          "dāso̍'yami̍ti mā̱ṁ matvā̍ kṣa̱masva̱ nārā̍yaṇa ||"],
         "Thousands of offences are committed by me, day and night. Knowing me to "
         "be your servant, forgive me, Nārāyaṇa.",
         n="3", num="3", meter=ATTESTED,
         src="Veda Union · Youth Wing sādhanā, nārāyaṇa kṣamā prārthanā"),
       V("ck-nara-4",
         ["anya̍thā śa̍raṇa̱ṁ nāsti̍ tva̱meva̱ śaraṇa̍ṁ mama |",
          "tasmā̍t kāru̍ṇya bhā̱vena̱ rakṣa tva̍ṁ nārāyaṇa ||"],
         "There is no other refuge; you alone are my refuge. Therefore, out of "
         "compassion, protect me, Nārāyaṇa.",
         n="4", num="4", meter=ATTESTED,
         src="Veda Union · Youth Wing sādhanā, nārāyaṇa kṣamā prārthanā")]),

    S("close-kshama-devi",
      "Kṣamā prārthanā · Devī — to seek forgiveness, one may chant this",
      "Concluding prayers · Veda Union · sādhana",
      [
       V("ck-devi-1",
         ["oṁ apa̍rādha̍ saha̱srāṇi̍ kri̱yante̱'harniśa̍ṁ mayā |",
          "dāso̍'yami̍ti mā̱ṁ matvā̍ kṣa̱masva̱ parame̍śvari ||"],
         "Thousands of offences are committed by me, day and night. Knowing me to be your servant, forgive me, Supreme Empress.",
         n="1", num="1", meter=ATTESTED, src="Veda Union · sādhana, kṣamā prārthanā"),
       V("ck-devi-2",
         ["āvā̍hana̍ṁ na jā̱nāmi̍ na̱ jānā̱mi visa̍rjanam |",
          "pūjā̍ṁ caiva̍ na jā̱nāmi̍ kṣa̱myatā̱ṁ parame̍śvari ||"],
         "I do not know how to invoke you, nor how to take leave of you; I do not know how to worship. Let it be pardoned, Supreme Empress.",
         n="2", num="2", meter=ATTESTED, src="Veda Union · sādhana, kṣamā prārthanā"),
       V("ck-devi-3",
         ["mantra̍hīna̍ṁ kriyā̱hīna̍ṁ bha̱ktihī̱naṁ sure̍śvari |",
          "yat pū̍jita̍m mayā̱ devi̍ pa̱ripū̱rṇaṁ tada̍stu me ||"],
         "Lacking in mantra, lacking in rite, lacking in devotion — Empress of the gods: whatever worship I have done, Devī, may that be complete.",
         n="3", num="3", meter=ATTESTED, src="Veda Union · sādhana, kṣamā prārthanā"),
       V("ck-devi-4",
         ["apa̍rādha̍ śata̱ṁ kṛtvā̍ ja̱gada̱mbeti co̍ccaret |",
          "yāṁ ga̍tiṁ sa̍mavā̱pnoti̍ na̱ tāṁ bra̱hmādaya̍s surāḥ ||"],
         "One who has committed a hundred offences has only to say Jagadambā; the goal that person then reaches, Brahmā and the gods do not reach.",
         n="4", num="4", meter=ATTESTED, src="Veda Union · sādhana, kṣamā prārthanā"),
       V("ck-devi-5",
         ["sāpa̍rādho̍'smi śa̱raṇa̍ṁ prā̱ptas tvā̱ṁ jagada̍mbike |",
          "idā̍nīma̍nuka̱mpyo'ha̍ṁ ya̱theccha̱si tathā̍ kuru ||"],
         "I am an offender, and I have come to you for refuge, Mother of the universe. Now I am one to be pitied: do as you will.",
         n="5", num="5", meter=ATTESTED, src="Veda Union · sādhana, kṣamā prārthanā"),
       V("ck-devi-6",
         ["ajñā̍nād vi̍smṛte̱r bhrāntyā̍ ya̱n nyūna̱madhika̍ṁ kṛtam |",
          "tat sa̍rvaṁ kṣa̍myatā̱ṁ devi̍ pra̱sīda̱ parame̍śvari ||"],
         "Whatever has been left undone or done to excess, through ignorance, forgetfulness or confusion — let all of it be pardoned, Devī. Be gracious, Supreme Empress.",
         n="6", num="6", meter=ATTESTED, src="Veda Union · sādhana, kṣamā prārthanā"),
       V("ck-devi-7",
         ["kāme̍śvari̍ jaga̱nmāta̍s sa̱ccidā̱nanda vi̍grahe |",
          "gṛhā̍ṇārcā̍mimā̱ṁ prītyā̍ pra̱sīda̱ parame̍śvari ||"],
         "Kāmeśvarī, Mother of the universe, whose very form is being, awareness and bliss: receive this worship with favour. Be gracious, Supreme Empress.",
         n="7", num="7", meter=ATTESTED, src="Veda Union · sādhana, kṣamā prārthanā"),
       V("ck-devi-8",
         ["guhyā̍ti gu̍hya go̱ptrī tva̍ṁ gṛ̱hāṇā̱smat kṛta̍ṁ japam |",
          "siddhi̍rbhava̍tu me̱ devi̍ tva̱t prasā̱dāt sure̍śvari ||"],
         "You are the keeper of the secret beyond secrets: accept this recitation of ours. May attainment be mine, Devī, by your grace, Empress of the gods.",
         n="8", num="8", meter=ATTESTED, src="Veda Union · sādhana, kṣamā prārthanā")]),

    S("close-kshama-shiva",
      "Kṣamā prārthanā · Śiva — to seek forgiveness, one may chant this",
      "Concluding prayers · Veda Union · Śrī Rudram",
      [
       V("ck-shiva-1",
         ["i̱mām̐gṁ ru̱drāya̍ ta̱vase̍ kapa̱rdine̎ |",
          "kṣa̱yad vī̍rāya̱ prabha̍rāmahe ma̱tim |",
          "yathā̍ na̱ś śam asa̍d dvi̱pade̱ catu̍ṣpade̱ |",
          "viśva̍ṁ pu̱ṣṭaṁ grāme̍ | a̱sminn anā̍turam ||"],
         "To Rudra the strong, the one with braided hair, who holds sway over heroes, we bring forward this thought: that there may be well-being for us, for our two-footed and our four-footed, and that everything in this village may be thriving and free of sickness.",
         n="1", num="1", meter=ATTESTED, src="Veda Union · Śrī Rudram, parameśvara kṣamā prārthanā"),
       V("ck-shiva-2",
         ["pāpo̍'haṁ pā̍paka̱rmā'ha̍ṁ pā̱pātmā̱ pāpa sa̍mbhavaḥ |",
          "trāhi̍ māṁ pā̍rvatī̱nātha̍ sa̱rvapā̱paharo̍ bhava ||"],
         "I am sin, my acts are sinful, my self is sinful, I am born of sin. Protect me, Lord of Pārvatī; be the one who takes away all sin.",
         n="2", num="2", meter=ATTESTED, src="Veda Union · Śrī Rudram, parameśvara kṣamā prārthanā"),
       V("ck-shiva-3",
         ["mantra̍hīna̍ṁ kriyā̱hīna̍ṁ bha̱ktihī̱naṁ sadā̍śiva |",
          "yat pū̍jita̍m mayā̱ deva̍ pa̱ripū̱rṇaṁ tada̍stu me ||"],
         "Lacking in mantra, lacking in rite, lacking in devotion — Sadāśiva: whatever worship I have done, Lord, may that be complete.",
         n="3", num="3", meter=ATTESTED, src="Veda Union · Śrī Rudram, parameśvara kṣamā prārthanā"),
       V("ck-shiva-4",
         ["āvā̍hana̍ṁ na jā̱nāmi̍ na̱ jānā̱mi visa̍rjanam |",
          "pūjā̍ṁ caiva̍ na jā̱nāmi̍ kṣa̱masva̱ parame̍śvara ||"],
         "I do not know how to invoke you, nor how to take leave of you; I do not know how to worship. Forgive me, Supreme Lord.",
         n="4", num="4", meter=ATTESTED, src="Veda Union · Śrī Rudram, parameśvara kṣamā prārthanā"),
       V("ck-shiva-5",
         ["apa̍rādha̍ saha̱srāṇi̍ kri̱yante̱'harniśa̍ṁ mayā |",
          "dāso̍'yami̍ti mā̱ṁ matvā̍ kṣa̱masva̱ parame̍śvara ||"],
         "Thousands of offences are committed by me, day and night. Knowing me to be your servant, forgive me, Supreme Lord.",
         n="5", num="5", meter=ATTESTED, src="Veda Union · Śrī Rudram, parameśvara kṣamā prārthanā"),
       V("ck-shiva-6",
         ["anya̍thā śa̍raṇa̱ṁ nāsti̍ tva̱meva̱ śaraṇa̍ṁ mama |",
          "tasmā̍t kāru̍ṇya bhā̱vena̍ kṣa̱masva̱ parame̍śvara ||"],
         "There is no other refuge; you alone are my refuge. Therefore, out of compassion, forgive me, Supreme Lord.",
         n="6", num="6", meter=ATTESTED, src="Veda Union · Śrī Rudram, parameśvara kṣamā prārthanā")]),

    S("close-udvasana",
      "Udvāsanam — release the deity, offering flowers and akṣatas at the altar",
      "Concluding prayers · taking leave of the deity · the udvāsana formula of "
      "the paddhati",
      [V("c-udvasana",
         # `śrī devaṁ` is written as two words here, as it is in the āvāhana
         # lines, so the deity is a SLOT: choosing Mahālakṣmī must re-voice the
         # leave-taking too. A rite that invokes Lakṣmī and then releases "deva"
         # is worse than one that names neither.
         ["asmād bimbād āvāhitaṁ śrī devaṁ",
          "yathāsthānaṁ pratiṣṭhāpayāmi |"],
         "Śrī Deva, who was invoked here, I now take from this image and "
         "establish again in his own place.", slot=("devaṁ", "deity"))]),

    S("close-samarpana",
      "Samarpaṇam — take water in the right hand and pour it out before the deity",
      "Concluding prayers · dedication of every act to the Lord",
      [V("c-samarpana",
         ["kāyena vācā manasendriyaiḥ vā",
          "buddhyātmanā vā prakṛteḥ svabhāvāt |",
          "karomi yadyat sakalaṁ parasmai",
          "nārāyaṇāyeti " + SAMARPAYAMI + " ||"],
         "Whatever I do with body, speech, mind or senses, with intellect and self, "
         "or from the natural disposition of prakṛti — all of it I offer to the "
         "supreme, to Nārāyaṇa.", meter="tristubh", src="Bhāgavata Purāṇa 11.2.36, in the recension the pūjā manuals print"),
       V("c-tatsat", ["oṁ tatsat sarvaṁ brahmārpaṇam astu"],
         "Oṁ, that is the real. May all this be an offering to Brahman.")],
      # WHAT THE DECK HAS, AND WHAT IT DOES NOT.
      #
      # The deck's closing slide is: pour the water, chant `kāyena vācā`,
      # "complete the pūjā with a salutation", "take the water, flowers and
      # naivedya as prasāda", `oṁ tatsat`. Nothing else.
      #
      # A CLOSING ĀCAMANA WAS ADDED HERE AND IS REMOVED AGAIN. Bühnemann p. 149
      # has it verbatim — "he then performs ācamana in exactly the same manner
      # as in the beginning" — and it is real, widespread smārta practice. It
      # is still a WHOLE ACT that Purna Vidya does not print, and it went in as
      # a plain direction, unmarked, in the middle of the taught sequence. That
      # is the one thing this file says never to do (see the naivedya note
      # above). If it returns it returns as an optional group, marked as wider
      # practice, the way abhiṣeka is.
      #
      # The deck's own prasāda line, and only that. The Śiva/Sūrya exception
      # that used to qualify it could not be verified and is removed.
      notes=[
          I("Then take the water, the flowers and the naivedya as prasāda from "
            "the Lord.", kind="note"),
      ]),
]


# --------------------------------------------------------------------------
# per-deity VERSE variants
# --------------------------------------------------------------------------
# The unit of substitution is the WHOLE VERSE, not the substituted word.
#
# A holding and an anusvāra/visarga change-mark are decided by the NEIGHBOURING
# letters, and a saṁyukta run is not broken by a word space (MARKING-RULES
# §2.1). So the marks of the FIXED words move when the deity moves:
#
#     devaṁ dhyāyāmi          -> devan dhyāyāmi        (ṁ assimilates to n)
#     mahālakṣmīṁ dhyāyāmi    -> mahālakṣmīn dhyāyāmi  (and the holding on dh
#                                                       becomes LONG, because the
#                                                       vowel before it is ī)
#
# Splicing a pre-marked deity fragment into a pre-marked line therefore CANNOT
# be right — the join is never derived. (That was the live bug: with a deity
# chosen, `asmin bimbe śrī subrahmaṇyaṁ dhyāyāmi` shipped an unassimilated ṁ.)
#
# So each deity's verses are generated the same way every other line is: the
# deity's accusative is substituted into the PLAIN IAST first, and the whole
# line then goes through the ordinary pipeline. Marks stay offline and
# byte-deterministic; nothing is ever marked in the browser.
#
# The verse — not a one-word window — is the unit because `words[]` is indexed
# per verse under the hard invariant word-count == syl-run-count. Splicing a
# token range at runtime would force that alignment to be recomputed in the
# browser, which is exactly what the "no runtime marking engine" rule forbids.
# A verse is also provably self-contained: a daṇḍa ends a cluster run, so no
# dependency can cross a verse boundary.
DEITIES_TS = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "..", "..", "shared", "src", "sankalpa.ts")
VARIANT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "..", "..", "client", "public", "chants", "variants")
DOC_ID = "puja-vidhi"
VARIANT_INDEX_URL = f"/chants/variants/{DOC_ID}.index.json"

# Gender + the English name used in the regenerated translations. The SANSKRIT
# is not authored here — the accusative is read from the one place it is already
# authored and verified (`shared/src/sankalpa.ts` DEITIES), so the two can never
# drift apart and no ending is ever derived by this script.
DEITY_EN = {
    "parameshvara": ("Parameśvara", "his"),
    "ganesha": ("Gaṇeśa", "his"),
    "shiva": ("Sāmba-sadāśiva", "his"),
    "vishnu": ("Viṣṇu", "his"),
    "devi": ("Jagad-ambā", "her"),
    "surya": ("Sūrya", "his"),
    "hanuman": ("Hanumān", "his"),
    "lakshmi": ("Mahālakṣmī", "her"),
    "sarasvati": ("Sarasvatī", "her"),
    "durga": ("Durgā", "her"),
    "krishna": ("Kṛṣṇa", "his"),
    "rama": ("Rāma", "his"),
    "subrahmanya": ("Subrahmaṇya", "his"),
    "dattatreya": ("Dattātreya", "his"),
    "gayatri": ("Gāyatrī", "her"),
}
DEITY_GENDER = {
    "parameshvara": "m", "ganesha": "m", "shiva": "m", "vishnu": "m",
    "devi": "f", "surya": "m", "hanuman": "m", "lakshmi": "f",
    "sarasvati": "f", "durga": "f", "krishna": "m", "rama": "m",
    "subrahmanya": "m", "dattatreya": "m", "gayatri": "f",
}

# The base wording each translation is templated from. A variant regenerates the
# translation as well as the tokens: "his own place" is wrong for Mahālakṣmī.
TRANSLATIONS = {
    "u-avahana-1": "In this image I meditate on Śrī {name}.",
    "u-avahana-2": "In this image I invoke Śrī {name}.",
    "c-udvasana": ("Śrī {name}, who was invoked here, I now take from this image "
                   "and establish again in {pronoun} own place."),
}


def read_deities():
    """The authored deity table, read from `shared/src/sankalpa.ts`.

    Declension is AUTHORED DATA and lives in exactly one place. This parses it
    rather than copying it, so a corrected accusative can never be corrected in
    only one of the two files."""
    import re
    src = io.open(DEITIES_TS, encoding="utf-8").read()
    block = re.search(r"export const DEITIES[^=]*=\s*\{(.*?)\n\};", src, re.S)
    if not block:
        raise SystemExit("could not find DEITIES in shared/src/sankalpa.ts")
    out = {}
    row = re.compile(
        r"^\s*(\w+):\s*\{\s*key:\s*'([^']+)',\s*label:\s*'([^']+)',\s*"
        r"iast:\s*'([^']+)',\s*deva:\s*'[^']*',\s*"
        r"acc:\s*\{\s*iast:\s*'([^']+)'", re.M)
    for m in row.finditer(block.group(1)):
        key, label, stem, acc = m.group(2), m.group(3), m.group(4), m.group(5)
        out[key] = {"key": key, "label": label, "stem": stem, "acc": acc}
    if len(out) < 10:
        raise SystemExit(f"only parsed {len(out)} deities from sankalpa.ts")
    return out


def _plain_words(line):
    """The WORDS of a source line, exactly as `gen_marks` counts them (a run of
    `|` is a pause, not a word) — so a word index here is the same index
    `surfaces_of` produces."""
    from gen_marks import norm
    return [p for p in norm(line).split(" ") if p and not set(p) <= set("|")]


def slot_verses():
    """Every verse of the manual that carries a variable slot, with its section."""
    out = []
    for s in SECTIONS:
        for v in s["verses"]:
            if v["slot"]:
                out.append((s["id"], v))
    return out


def _deity_entries(rec, pieces):
    """Grammar rows for the deity's own surface(s).

    A hyphenated name (`sāmba-sadāśiva`, `mahā-lakṣmī`) becomes two words once
    `gen_marks.norm` turns the hyphen into a space, so each piece gets its own
    row and the last one carries the case."""
    from puja_words import oth, sub
    name = DEITY_EN[rec["key"]][0]
    lemma = rec["stem"].replace("-", "")
    rows = []
    for i, _piece in enumerate(pieces):
        last = i == len(pieces) - 1
        if last:
            rows.append([sub(lemma, f"{name} — the deity being worshipped",
                             DEITY_GENDER[rec["key"]], 2, "eka",
                             note="the deity chosen for this pūjā, in the accusative")])
        else:
            rows.append([oth(rec["stem"].split("-")[i],
                             f"first member of the compound {rec['stem']}")])
    return rows


def variant_verse(vid, v, rec):
    """One verse, regenerated with this deity substituted into the plain IAST."""
    from puja_words import GLOSS, OVERRIDES
    slot_word = v["slot"][0]
    acc = rec["acc"].replace("ṃ", "ṁ")
    pieces = _plain_words(acc)
    lines = [ln.replace(slot_word, acc) for ln in v["lines"]]
    toks = verse_tokens(lines, v["num"], slot=None)
    if v["meter"]:
        apply_svara(toks, v["meter"], v["skip_om"])

    # Where the deity's own words land, so their grammar rows can be supplied.
    base_words = _plain_words(" ".join(v["lines"]))
    if slot_word not in base_words:
        raise SystemExit(f"{vid}: slot word {slot_word!r} not in the source line")
    start = base_words.index(slot_word)
    entries_for_deity = _deity_entries(rec, pieces)

    surf = surfaces_of(toks)
    words = []
    for i, w in enumerate(surf):
        if start <= i < start + len(pieces):
            words.append({"surface": w, "entries": entries_for_deity[i - start]})
            continue
        entries = OVERRIDES.get((vid, i)) or GLOSS.get(w)
        if entries is None:
            raise SystemExit(f"{vid} [{rec['key']}]: no grammar entry for {w!r}")
        words.append({"surface": w, "entries": entries})

    name, pronoun = DEITY_EN[rec["key"]]
    out = {"tokens": toks, "words": words}
    tpl = TRANSLATIONS.get(vid)
    if tpl:
        out["translation"] = {"en": tpl.format(name=name, pronoun=pronoun)}
    return out


def base_hash(verse):
    """Staleness guard: the hash of the BASE verse a variant was generated
    against. Edit a line in this file and forget to regenerate, and the build
    fails instead of shipping a manual whose default and variant readings
    disagree."""
    import hashlib
    # Compact + sorted, so the browser can reproduce it byte for byte with a
    # canonical JSON.stringify (no spaces, keys sorted).
    payload = json.dumps(verse["tokens"], ensure_ascii=False, sort_keys=True,
                         separators=(",", ":"))
    return "sha256:" + hashlib.sha256(payload.encode("utf-8")).hexdigest()


def build_variants(doc):
    """Per-deity variant files + the manifest. Returns (index, files)."""
    deities = read_deities()
    base_by_id = {v["id"]: v for s in doc["sections"] for v in s["verses"]}
    targets = slot_verses()
    if not targets:
        raise SystemExit("no slot-bearing verses — nothing to vary")

    options, files = [], {}
    for key in sorted(deities):
        rec = deities[key]
        if key not in DEITY_EN:
            raise SystemExit(f"deity {key!r} has no English name/pronoun here")
        verses = {}
        for _sid, v in targets:
            vid = v["id"]
            built = variant_verse(vid, v, rec)
            built["baseHash"] = base_hash(base_by_id[vid])
            verses[vid] = built
            # The invariant the base file holds itself to, held here too.
            runs = len(surfaces_of(built["tokens"]))
            assert runs == len(built["words"]), \
                f"{vid} [{key}]: {runs} runs vs {len(built['words'])} words"
        d_deva, d_tel, d_tam = derive(rec["stem"].replace("-", ""))
        files[key] = {
            "format": "vedaunion.chant.variant",
            "version": 1,
            "doc": DOC_ID,
            "slot": "deity",
            "value": key,
            "generator": "tools/chant/gen_puja.py --variants",
            "verses": verses,
        }
        options.append({
            "key": key,
            "label": rec["label"],
            "iast": rec["stem"],
            "labelForms": {"deva": d_deva, "telugu": d_tel, "tamil": d_tam},
            "file": f"/chants/variants/{DOC_ID}.{key}.json",
            "verses": sorted(verses),
        })
    index = {
        "format": "vedaunion.chant.variants",
        "version": 1,
        "doc": DOC_ID,
        "slot": "deity",
        "default": "deva",
        "options": options,
    }
    return index, files


def write_variants(doc):
    index, files = build_variants(doc)
    os.makedirs(VARIANT_DIR, exist_ok=True)
    paths = []
    p = os.path.join(VARIANT_DIR, f"{DOC_ID}.index.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    paths.append(p)
    for key, payload in sorted(files.items()):
        p = os.path.join(VARIANT_DIR, f"{DOC_ID}.{key}.json")
        with open(p, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        paths.append(p)
    return index, paths


# --------------------------------------------------------------------------
def build():
    sections = []
    all_surfaces = []
    missing = {}
    register = []          # (verse id, register, per-segment nuclei, all matched?)
    for s in SECTIONS + GANESHA_NAMAVALI:
        verses = []
        for v in s["verses"]:
            toks = verse_tokens(v["lines"], v["num"], v["slot"])
            if v["bracket"]:
                # Plain `text` tokens, so the brackets carry no marks and no
                # transliteration — and, sitting outside every `syl` run, they
                # leave the word indices the grammar table aligns to untouched.
                toks = ([{"t": "text", "s": "["}] + toks + [{"t": "text", "s": "]"}])
            if v["meter"] == ATTESTED:
                # The accent came from the source line itself (`strip_accents`),
                # so there is nothing to place here — only to report.
                got = sum(1 for t in toks if t["t"] == "syl"
                          and any(u.get("svara") for u in t["units"]))
                register.append((v["id"], ATTESTED,
                                 [len(x) for x in _segments(toks, False)], got > 0))
                assert got, f"{v['id']}: tagged attested but carries no accent"
            elif v["meter"]:
                rep = apply_svara(toks, v["meter"], v["skip_om"])
                register.append((v["id"], v["meter"],
                                 [c for _, c, _ in rep], all(m for _, _, m in rep)))
            else:
                register.append((v["id"], "formula",
                                 [len(x) for x in _segments(toks, False)], None))
            surf = surfaces_of(toks)
            all_surfaces.extend(surf)
            words = []
            for i, w in enumerate(surf):
                entries = OVERRIDES.get((v["id"], i)) or GLOSS.get(w)
                if entries is None:
                    missing.setdefault(w, []).append(f"{v['id']}[{i}]")
                    entries = []
                words.append({"surface": w, "entries": entries})
            d = {"id": v["id"], "n": v["n"], "tokens": toks}
            if v["src"]:
                d["source"] = " ".join(v["src"].split())
            if v["tr"]:
                tr = " ".join(v["tr"].split())
                d["translation"] = {"en": f"[{tr}]" if v["bracket"] else tr}
            d["words"] = words
            verses.append(d)
        # The authored label is SPLIT mechanically into the number, the step's
        # own name and its `do` direction — and reassembled again below, byte
        # for byte, so the migration is verified rather than trusted.
        n, title_, do = split_label(s["label"])
        assert join_label(n, title_, do) == s["label"],             f"{s['id']}: label does not round-trip: {join_label(n, title_, do)!r}"

        # ITEMS are the canonical content, and their ORDER is the only ordering
        # mechanism: the direction first (that is what you read before you act),
        # then the mantras, then any note about the step.
        items = []
        # A figure of the step is its OWN item, standing before the direction it
        # illustrates. Two neighbours, not one component: order is what puts
        # them together, and normal flow is what stacks them on a phone.
        if s.get("figure"):
            items.append({"t": "figure", "ref": s["figure"]["id"]})
        if do:
            # `each-verse` is authored once and rendered against every verse of
            # the step — "take a sip of water after each mantra" (3 verses),
            # "offer a flower with each name" (18).
            each = "each mantra" in do or "each name" in do
            items.append({"t": "instruction",
                          "instruction": I(do, "do",
                                           applies_to="each-verse" if each else None)})
        # A drawing OF ONE MANTRA stands immediately before it. Position in the
        # item list is the only ordering mechanism the format has, so a figure
        # belonging to the last offering of a step (the tāmbūla plate, the
        # añjali of flowers) is emitted here rather than at the step's head.
        for src_v, built in zip(s["verses"], verses):
            if src_v.get("fig"):
                items.append({"t": "figure", "ref": src_v["fig"]["id"]})
            if src_v.get("ins"):
                items.append({"t": "instruction", "instruction": src_v["ins"]})
            items.append({"t": "verse", **built})
        # An EMBED stands where this step's own mantras would: after the
        # direction you read before acting, before any note about the step.
        if s.get("embed"):
            items.append({"t": "embed", "embed": s["embed"]})
        # `notes` may hold a FIGURE as well as directions, and order is kept.
        # A direction owns no figure (see I()); but a step can need a second
        # illustration further down — the women's five-limb salutation sits
        # under its own note, while the step's own plate stands at the head.
        # NB the loop variable is NOT `n` — that name holds the step NUMBER in
        # this scope, and shadowing it silently wrote a note dict into every
        # numbered step's `n` field, which is what the reader renders as "2a ·".
        for note in s["notes"]:
            if "src" in note:                 # a FIG dict, not a direction
                items.append({"t": "figure", "ref": note["id"]})
            else:
                items.append({"t": "instruction", "instruction": note})

        sec = {"id": s["id"], "n": n, "title": title_, "part": part_of(s["id"]),
               "source": s["source"], "items": items, "verses": verses}
        if s.get("module"):
            # A composed section: the reader supplies the verses (ChantReader
            # resolves `module` before it slices or renders).
            sec["module"] = s["module"]
        # A step must not be empty — but "no mantra" is now a legal step, held
        # up by its own direction (prāṇāyāma).
        assert items or sec.get("module"), f"{s['id']}: empty step"
        sections.append(sec)

    # The Gaṇapati nāmāvalī was built by the same pipeline as every other
    # verse here, and now LEAVES this document for its own — one garland, one
    # place, reached through the registry like everyone else's.
    ganesha = next(x for x in sections if x["id"] == "upa-11-namavali-ganesha")
    sections = [x for x in sections if x["id"] != "upa-11-namavali-ganesha"]

    title = "pūjā vidhi"
    tf_d, tf_t, tf_m = derive(title)
    doc = {
        "format": "vedaunion.chant",
        "version": 3,
        "id": "puja-vidhi",
        "title": title,
        "subtitle": "The sixteen-step pūjā — ṣoḍaśopacāra",
        "source": "Veda Union pūjā class · ṣoḍaśopacāra pūjā",
        "primaryScript": "iast",
        "scripts": ["iast", "devanagari", "telugu", "tamil"],
        "titleForms": {"iast": title, "devanagari": tf_d, "telugu": tf_t, "tamil": tf_m},
        "lineBreak": "source",
        # Where the per-deity verse variants live. The reader fetches this
        # manifest once, and one ~17 KB variant only when a deity other than
        # the base `deva` wording is chosen.
        "variants": VARIANT_INDEX_URL,
        # Rite-wide directions: what is not about any one step. Both of these
        # were exiled to document-body callouts because the reader had nowhere
        # to put them — and the body is not on screen at the moment they are
        # needed, which is mid-rite with the reader fullscreen.
        "instructions": [
            I("If any of the offerings is not available, you can use akṣatas "
              "instead.", kind="option"),
            # THE PRINCIPLE, stated once and only here. The right hand acts
            # towards the deity — so it is the right that holds the uddharaṇī
            # and offers pādyam, arghyam and ācamanīyam. The left pours exactly
            # once in the whole rite, at your own ācamana, which is your
            # purification and not an offering. (Owner's ruling; it settles the
            # spoon-hand question the step audit left open, and `fig-arghya`,
            # which shows the right hand at the spoon, is right as drawn.)
            I("Throughout the rite the right hand acts towards the deity and "
              "the left anchors you: the right offers, holds the spoon and "
              "pours. The left rings the bell or rests on your own heart, and "
              "it pours only once — into your own right palm at ācamanam, "
              "which is purification and not an offering.", kind="note"),
            I("What is offered is measured against your means, not against the "
              "size of the image. A leaf, a flower, a fruit, water — given with "
              "devotion, that is the offering.", kind="note"),
            I("Deva may be substituted by any other deity, such as "
              "Mahāgaṇapati, Mahāviṣṇu, Mahāsarasvatī or Mahālakṣmī. Choose the "
              "deity once, in the reader settings, and it is named throughout — "
              "in the saṅkalpa and in the mantras of invocation.", kind="note"),
        ],
        # The shared figure library: a drawing reused at several steps ships
        # once and is addressed by id.
        "figures": FIGURES,
        # Optional blocks. Both are EXPANSIONS: they anchor to an existing step
        # and take derived sub-numbers from it, so the sixteen upacāras never
        # renumber and a reader with the block on and a reader with it off both
        # see "14 · Naivedyam". Both are OFF by default, and an omitted block is
        # still visible at its anchor as a single quiet "include" row.
        "groups": [
            {
                "id": "abhisheka",
                "label": {"en": "Abhiṣekam — the bath with the five nectars"},
                "source": "Taittirīya Saṁhitā; Ṛgveda 9.85.6 for the sugar",
                "kind": "expansion",
                "at": "upa-07-snanam",
                "mode": "after",
                "members": ["upa-07a-ksira", "upa-07b-dadhi", "upa-07c-ajya",
                            "upa-07d-madhu", "upa-07e-sarkara",
                            "upa-07f-phalodaka", "upa-07g-suddhodaka"],
                "default": False,
                # The note used to promise square brackets on every mantra of
                # the block. Nothing here is bracketed, and the brackets that
                # ARE in the document mean something else (the 17th and 18th
                # names, and `brahmaṇe svāhā`). It also claimed the block
                # closes into the `snānānantaram ācamanīyaṁ` line, which it
                # cannot: `mode: "after"` puts it past that line.
                "note": I("An optional expansion of the bath: milk, curd, ghee, "
                          "honey and sugar, then fruit-water, then pure water. "
                          "Pour in a thin, continuous stream rather than a splash.",
                          kind="option"),
            },
            # THE FULLER NAIVEDYA IS NO LONGER A GROUP. The owner has ruled
            # that it is a normal part of the document, not an option — so its
            # seven sections simply stand in the array and always render, and
            # there is nothing here to switch. Their order is the gurukulam's
            # own; see the comment above them.
            # THE KṢAMĀ PRĀRTHANĀ FOLLOWS THE DEITY, and asks the reader
            # nothing. It was briefly a `choice` with a radio in the settings;
            # the owner's rule is that the menu stays as small as it can be,
            # and this decision is already made the moment the deity is
            # chosen — the prayer that addresses Nārāyaṇa belongs to a
            # Nārāyaṇa pūjā and to no other.
            #
            # So: four groups, one per form, each `fixed` (no toggle, no
            # "include" row) and gated by `onlyDeity`. Exactly one of them
            # matches any given deity, so exactly one prayer renders. THE
            # FOUR LISTS MUST PARTITION THE DEITY LIST — every key in
            # `variants/puja-vidhi.index.json` plus the default `deva` appears
            # in exactly one of them, or a reader gets two prayers or none.
            # There is an assertion on that at the foot of this file.
            #
            # Where a deity could be argued either way it stays with the form
            # the manual itself teaches rather than being assigned on a guess:
            # Gaṇeśa, Subrahmaṇya, Sūrya and Dattātreya all keep the general
            # śloka. Gāyatrī goes with the Goddess.
            {
                "id": "kshama-general",
                "label": {"en": "Kṣamā prārthanā"},
                "source": "the pūjā material",
                "kind": "optional",
                "members": ["close-kshama"],
                "default": True,
                "fixed": True,
                "onlyDeity": ["ganesha", "subrahmanya", "surya",
                              "dattatreya"],
            },
            {
                "id": "kshama-narayana",
                "label": {"en": "Kṣamā prārthanā · Nārāyaṇa"},
                "source": "Veda Union · Youth Wing sādhanā",
                "kind": "optional",
                "members": ["close-kshama-narayana"],
                "default": True,
                "fixed": True,
                "onlyDeity": ["vishnu", "krishna", "rama", "hanuman"],
            },
            {
                "id": "kshama-devi",
                "label": {"en": "Kṣamā prārthanā · Devī"},
                "source": "Veda Union · sādhana",
                "kind": "optional",
                "members": ["close-kshama-devi"],
                "default": True,
                "fixed": True,
                "onlyDeity": ["devi", "durga", "lakshmi", "sarasvati",
                              "gayatri"],
            },
            {
                "id": "kshama-shiva",
                "label": {"en": "Kṣamā prārthanā · Śiva"},
                "source": "Veda Union · Śrī Rudram",
                "kind": "optional",
                "members": ["close-kshama-shiva"],
                "default": True,
                "fixed": True,
                "onlyDeity": ["shiva", "parameshvara"],
            },
            # THE STOTRAM IS GAṆEŚA'S, so it is shown in Gaṇeśa's pūjā and
            # nowhere else. The deck says only "chant stotram" — a slot for a
            # hymn of whichever deity is being worshipped — and this manual
            # fills it with the Saṅkaṭanāśana Gaṇeśa Stotram. Printed under a
            # Śiva or a Lakṣmī pūjā that is simply the wrong hymn, so the
            # group carries `onlyDeity`, which hides it entirely (not even an
            # "include" row) for everyone else. Step 16 keeps a direction
            # telling them to chant a stotram of their own deity.
            #
            # It is DEFAULT TRUE: for Gaṇeśa it is part of the rite, not an
            # option to be discovered.
            {
                "id": "stotram",
                "label": {"en": "Saṅkaṭanāśana Gaṇeśa Stotram"},
                "source": "Śrī Nārada Purāṇa",
                "kind": "expansion",
                "at": "upa-16-vandanam",
                "mode": "after",
                "members": ["stotram"],
                "default": True,
                "fixed": True,
                "onlyDeity": ["ganesha"],
            },
            {
                "id": "vibhuti",
                "label": {"en": "Vibhūti — the sacred ash"},
                "source": "Śaiva / smārta practice",
                "kind": "expansion",
                "at": "upa-10-gandham",
                "mode": "after",
                "members": ["upa-10a-vibhuti"],
                # FIXED, like the kṣamā and the nāmāvalī: whether the ash is
                # offered follows from the deity and is not a question put to
                # the reader. That leaves abhiṣeka as the one real choice in
                # the settings — optional for everyone, being the temple's rite
                # rather than the home rite as taught.
                "default": True,
                "fixed": True,
                # Śaiva and smārta, and explicitly not Vaiṣṇava — the Vaiṣṇava
                # counterpart of the tripuṇḍra is the ūrdhvapuṇḍra. For Devī and
                # Gaṇeśa no source was found either way, so the gate names Śiva
                # only rather than guessing.
                # `parameshvara` is Śiva under another name and takes the
                # same ash; the kṣamā gate above pairs them the same way.
                "onlyDeity": ["shiva", "parameshvara"],
                "note": I("Dry ash, applied after the sandal paste.",
                          kind="option"),
            },
        ],
        "sections": sections,
    }
    return doc, all_surfaces, missing, register, ganesha


NAMAVALI_OUT = os.path.join(os.path.dirname(os.path.abspath(OUT)),
                            "ganesha-ashtottara.json")


def write_namavali(sec):
    """The Gaṇapati nāmāvalī as its own chant document.

    Lifted from the section this file already built, so the text, the marks and
    the grammar are the pipeline's own output and not a second copy that can
    drift. Registered in `shared/src/namavali.ts`; the pūjā reaches it through
    the one nāmāvalī step, exactly as it reaches Lakṣmī's."""
    title = "aṣṭādaśa nāmāvaliḥ"
    tf_d, tf_t, tf_m = derive(title)
    doc = {
        "format": "vedaunion.chant", "version": 2,
        "id": "ganesha-ashtottara",
        "title": title,
        "subtitle": "The eighteen names of Gaṇapati",
        "source": "the pūjā material · ṣoḍaśa-nāma (Gaṇeśa Purāṇa / Mudgala "
                  "tradition), with two further names",
        "primaryScript": "iast",
        "scripts": ["iast", "devanagari", "telugu", "tamil"],
        "titleForms": {"iast": title, "devanagari": tf_d, "telugu": tf_t,
                       "tamil": tf_m},
        "lineBreak": "source",
        "sections": [{
            "id": "sec-1",
            "label": "Aṣṭādaśa nāmāvaliḥ",
            "source": sec["source"],
            "verses": sec["verses"],
        }],
    }
    with open(NAMAVALI_OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"WROTE {os.path.normpath(NAMAVALI_OUT)} "
          f"({len(sec['verses'])} names)")


def main():
    doc, all_surfaces, missing, register, ganesha = build()

    if "--surfaces" in sys.argv:
        seen = {}
        for s in all_surfaces:
            seen[s] = seen.get(s, 0) + 1
        print(f"# {len(all_surfaces)} word occurrences, {len(seen)} distinct surfaces")
        for s in sorted(seen, key=lambda x: (-seen[x], x)):
            print(f"{seen[s]:3d}  {s}")
        return

    if missing:
        print(f"!! {len(missing)} surfaces have NO grammar entry:")
        for w, where in sorted(missing.items()):
            print(f"   {w:35s} {', '.join(where[:4])}")
        sys.exit(1)

    nsec = len(doc["sections"])
    nv = sum(len(s["verses"]) for s in doc["sections"])
    nw = sum(len(v["words"]) for s in doc["sections"] for v in s["verses"])
    ne = sum(len(w["entries"]) for s in doc["sections"] for v in s["verses"] for w in v["words"])
    nsyl = sum(1 for s in doc["sections"] for v in s["verses"] for t in v["tokens"] if t["t"] == "syl")

    # invariant: word count == number of syl-runs (ChantReader.chunkVerse)
    for s in doc["sections"]:
        for v in s["verses"]:
            runs = len(surfaces_of(v["tokens"]))
            assert runs == len(v["words"]), f"{v['id']}: {runs} runs vs {len(v['words'])} words"
            for w in v["words"]:
                assert w["entries"], f"{v['id']}: empty entries for {w['surface']}"
    # svara may ONLY appear on a verse classified with a positional metre —
    # never on a prose formula, and never on VEDIC (attested accent only)
    markable = {vid for vid, reg, _, _ in register if reg in SVARA_POS or reg == ATTESTED}
    for s in doc["sections"]:
        for v in s["verses"]:
            has = any(u.get("svara") for t in v["tokens"] if t["t"] == "syl"
                      for u in t["units"])
            assert not has or v["id"] in markable, f"{v['id']}: svara outside its register"

    # ---- the composition layer's own rules --------------------------------
    # V4: a direction is ENGLISH CHROME. It carries no tokens, so it can never
    # reach the mark renderer — and it must not smuggle marked text in as a
    # string either. IAST Latin is fine ("offer akṣatas"); an Indic codepoint is
    # not, because that is recitable text wearing prose clothing.
    def _instructions(node):
        if isinstance(node, dict):
            if "instruction" in node:
                yield node["instruction"]
            for vv in node.values():
                yield from _instructions(vv)
        elif isinstance(node, list):
            for vv in node:
                yield from _instructions(vv)

    INDIC = [(0x0900, 0x097F), (0x0C00, 0x0C7F), (0x0B80, 0x0BFF)]
    seen_ins = 0
    for ins in list(_instructions(doc["sections"])) + doc["instructions"]:
        txt = ins["text"]["en"]
        seen_ins += 1
        assert txt.strip(), "empty instruction"
        assert "<" not in txt, f"instruction contains markup: {txt[:40]!r}"
        for ch in txt:
            o = ord(ch)
            assert not any(lo <= o <= hi for lo, hi in INDIC),                 f"instruction has Indic text ({ch!r}): {txt[:40]!r}"
        assert "tokens" not in ins and "units" not in ins
        for k in ("deva", "tel", "tam"):
            assert k not in ins, f"instruction carries a script field: {k}"

    # V6: no two ADJACENT figure items share a ref. The same drawing on three
    # consecutive steps reads as a rendering fault, not as instruction — a
    # figure that covers a run of steps stands once, block-flow, at its head.
    fseq = [(x["id"], it.get("ref")) for x in doc["sections"]
            for it in x["items"] if it["t"] == "figure"]
    for (sa, ra), (sb, rb) in zip(fseq, fseq[1:]):
        assert ra != rb, f"figure {ra} repeated on {sa} then {sb}"

    # V5: every figure resolves on disk under client/public/, and alt is not a
    # repeat of the caption.
    figs = {f["id"]: f for f in doc["figures"]}
    for x in doc["sections"]:
        for it in x["items"]:
            if it["t"] == "figure":
                assert it.get("ref") in figs or it.get("figure"), \
                    f"{x['id']}: figure item resolves to nothing"
    pub = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "..", "..", "client", "public")
    for f in figs.values():
        for key in ("src", "srcDark"):
            if f.get(key):
                fp = os.path.join(pub, f[key].lstrip("/"))
                assert os.path.exists(fp), f"figure {f['id']}: missing {f[key]}"
        assert f["alt"].strip(), f"figure {f['id']}: empty alt"
        assert f["alt"] != (f.get("caption") or {}).get("en"),             f"figure {f['id']}: alt repeats the caption"
        if f.get("crop", "auto") == "auto":
            assert f.get("width") and f.get("height"),                 f"figure {f['id']}: crop:auto needs intrinsic width/height"

    # V3: a step is never empty — but a step with no MANTRA is legal, held up by
    # its own direction (prāṇāyāma).
    textless = [x["id"] for x in doc["sections"]
                if not x["verses"] and not x.get("module")]
    for x in doc["sections"]:
        assert x["items"] or x.get("module"), f"{x['id']}: empty step"

    # no rendered line may be long enough to wrap (AUTHORING-CHANTS §2)
    LINE_MAX = 60
    long_lines = []
    for s in doc["sections"]:
        for v in s["verses"]:
            cur = ""
            for t in v["tokens"]:
                if t["t"] == "syl":
                    cur += t["iast"]
                elif t["t"] == "sp":
                    cur += " "
                elif t["t"] in ("danda", "num"):
                    cur += t["s"]
                elif t["t"] == "br":
                    if len(cur) > LINE_MAX:
                        long_lines.append((v["id"], len(cur)))
                    cur = ""
            if len(cur) > LINE_MAX:
                long_lines.append((v["id"], len(cur)))

    # CACHE-BUST THE FIGURES BY CONTENT, before the document is written.
    # They are served with `Cache-Control: public, max-age=604800` and no
    # ETag, and every plate is REPLACED AT THE SAME FILENAME when it is
    # redrawn — so a browser that has seen the page keeps showing the OLD
    # drawing for up to a week. That is not a stale-cache annoyance: it means
    # readers being shown a picture that was withdrawn for being wrong.
    # A hash of the file's own bytes changes the URL exactly when the drawing
    # changes; unchanged plates keep their long cache life.
    import hashlib
    for _f in doc["figures"]:
        _fp = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(OUT)),
                                            "..", _f["src"].lstrip("/")))
        with open(_fp, "rb") as _fh:
            _f["src"] += "?v=" + hashlib.md5(_fh.read()).hexdigest()[:8]

    with open(OUT, "w", encoding="utf-8") as f:
        # MINIFIED, deliberately. `indent=1` made whitespace HALF the file:
        # 1920 KB pretty against 963 KB minified, and the browser parses every
        # byte of it before a single syllable renders. This file is generated
        # and never read by hand — read gen_puja.py instead.
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"WROTE {os.path.normpath(OUT)}")
    write_namavali(ganesha)

    # Per-deity verse variants, generated by the SAME pipeline (never spliced).
    vindex, vpaths = write_variants(doc)
    print(f"  variants: {len(vindex['options'])} deities, {len(vpaths)} files "
          f"-> {os.path.normpath(VARIANT_DIR)}")
    # ---- STRUCTURAL ASSERTIONS -------------------------------------------
    # Everything below shipped broken at least once, silently, past a clean
    # exit code, a passing typecheck and a passing build — because a wrong
    # VALUE in valid JSON breaks nothing until the reader renders it. These
    # are cheap; they run every time.
    #
    # 1. A step's number is a STRING. It was once a note dict, because a loop
    #    variable named `n` shadowed the step number, and the reader prints
    #    that field as the step label — so fourteen steps rendered as a blank
    #    page.
    for sec in doc["sections"]:
        n_ = sec.get("n")
        assert n_ is None or isinstance(n_, str),             f"{sec['id']}: section number is {type(n_).__name__}, not a string: {str(n_)[:60]}"

    # 2. Every figure item resolves to a figure that is actually shipped, and
    #    every shipped figure is used. An unused figure is dead weight in the
    #    JSON; a dangling ref renders as nothing at all.
    fig_ids = {f["id"] for f in doc["figures"]}
    used_figs = {it["ref"] for sec in doc["sections"]
                 for it in sec.get("items", []) if it["t"] == "figure"}
    assert not (used_figs - fig_ids), f"figure refs with no figure: {used_figs - fig_ids}"
    assert not (fig_ids - used_figs), f"figures defined but never used: {fig_ids - used_figs}"

    # 2b. Every figure FILE is in house format: 512 px on the long edge,
    #     palette-quantised. A keyed plate is 0.7-1.5 MB of RGBA, and nine of
    #     them were installed un-packed — 10.4 MB of figures on one page, which
    #     the owner felt immediately as a choppy reader. Nothing in the build
    #     would have caught it: the JSON is valid and the images render.
    #     `image-gen/pack-figures.py --inplace` is the fix.
    import struct
    for f in doc["figures"]:
        fp = os.path.join(os.path.dirname(os.path.abspath(OUT)),
                          "..", f["src"].split("?")[0].lstrip("/"))
        fp = os.path.normpath(fp)
        if not os.path.exists(fp):
            raise SystemExit(f"figure file missing: {f['src']}")
        with open(fp, "rb") as fh:
            head = fh.read(26)
        w, h = struct.unpack(">II", head[16:24])
        colour_type = head[25]                     # 3 = palette
        kb = os.path.getsize(fp) // 1024
        assert max(w, h) <= 512 and colour_type == 3, (
            f"{f['src']}: {w}x{h}, PNG colour-type {colour_type}, {kb} KB — not house "
            f"format (512 px, palette). Run image-gen/pack-figures.py --inplace")

    # 3. An optional group's members are contiguous AND sit immediately after
    #    their anchor. The fuller-naivedya group once sat three steps away, so
    #    switching it on expanded the food offering after the wrong step.
    order = [sec["id"] for sec in doc["sections"]]
    for g in doc.get("groups", []):
        mi = [order.index(m) for m in g["members"]]
        if not g.get("at"):
            # Only an EXPANSION has a host step to hang off and take its
            # sub-numbers from. A choice and a plain optional block stand on
            # their own. Contiguity is still required either way: the reader
            # walks the flat section array.
            assert g["kind"] != "expansion", \
                f"group {g['id']}: an expansion must name its anchor with `at`"
            assert mi == list(range(mi[0], mi[0] + len(mi))),                 f"group {g['id']}: members are not contiguous: {mi}"
            continue
        assert g["at"] in order, f"group {g['id']}: anchor {g['at']} is not a section"
        ai = order.index(g["at"])
        assert mi == list(range(mi[0], mi[0] + len(mi))),             f"group {g['id']}: members are not contiguous: {mi}"
        assert mi[0] == ai + 1,             f"group {g['id']}: members start at {mi[0]} but the anchor {g['at']} is at {ai} — they must follow it immediately"

    # 4. THE DEITY-GATED FIXED GROUPS MUST PARTITION THE DEITY LIST. A `fixed`
    #    group is included exactly when its `onlyDeity` matches, and the reader
    #    is never asked — so if two of them claim the same deity that reader
    #    gets both prayers, and if none claims it the step vanishes with
    #    nothing in its place. Neither failure is visible until someone opens
    #    the document as that deity.
    _idx = os.path.join(os.path.dirname(os.path.abspath(OUT)), "variants",
                        "puja-vidhi.index.json")
    with open(_idx, encoding="utf-8") as _fh:
        _index = json.load(_fh)
    # The key space is the reader's own: `prefs.sankalpa.deity` is one of
    # SANKALPA_DEITY_KEYS, fifteen keys, and `deva` — the index's `default` —
    # is NOT one of them. It names the base wording, not a deity anyone can
    # choose, so gating on it would be dead config.
    _DEITIES = {o["key"] for o in _index["options"]}
    #    The check is per SLOT, not global: the stotram is also a fixed
    #    deity-gated group, and it claiming Gaṇeśa says nothing about which
    #    kṣamā prārthanā a Gaṇeśa pūjā takes.
    for _prefix in ("kshama-", "namavali-"):
      _kshama = [g for g in doc.get("groups", []) if g["id"].startswith(_prefix)]
      if _kshama:
        _claims = {}
        for g in _kshama:
            for d in g["onlyDeity"]:
                _claims.setdefault(d, []).append(g["id"])
        _dupes = {d: ids for d, ids in _claims.items() if len(ids) > 1}
        assert not _dupes, f"deities claimed by more than one {_prefix} group: {_dupes}"
        _covered = set(_claims)
        assert _covered == _DEITIES, (
            f"the {_prefix} groups do not partition the deity list — "
            f"uncovered: {sorted(_DEITIES - _covered)}, "
            f"unknown: {sorted(_covered - _DEITIES)}")
        print(f"  {_prefix[:-1]}: {len(_kshama)} forms covering "
              f"{len(_covered)} deities, one each")

    print(f"  sections={nsec} verses={nv} syllables={nsyl} words={nw} grammar-entries={ne}")
    notr = [v["id"] for s in doc["sections"] for v in s["verses"] if "translation" not in v]
    print(f"  verses without a translation ({len(notr)}): {', '.join(notr) or '—'}")

    print(f"  ṁ → m before a vowel ({len(ANUSVARA_FIXES)}): "
          f"{', '.join(sorted(set(ANUSVARA_FIXES))) or '—'}")
    print(f"  directions={seen_ins} figures={len(figs)} "
          f"steps with no mantra ({len(textless)}): {', '.join(textless) or '—'}")
    print(f"  rendered lines over {LINE_MAX} IAST chars "
          f"({len(long_lines)}): {long_lines or '—'}")

    print("")
    print("  REGISTER CLASSIFICATION (svara)")
    for vid, reg, counts, ok in register:
        if reg == "formula":
            continue
        if reg == ATTESTED:
            print(f"   OK {vid:16s} {reg:9s} nuclei per segment: {counts}"
                  f"  (accent ATTESTED, lifted from the accented source)")
            continue
        if reg == VEDIC:
            print(f"   -- {vid:16s} {reg:9s} nuclei per segment: {counts}"
                  f"  (attested accent only — the convention may never apply)")
            continue
        flag = "OK " if ok else "!! "
        print(f"   {flag}{vid:16s} {reg:9s} nuclei per segment: {counts}")
    formulae = [vid for vid, reg, _, _ in register if reg == "formula"]
    print(f"   -- formulae, no svara this round ({len(formulae)}): {', '.join(formulae)}")


if __name__ == "__main__":
    main()
