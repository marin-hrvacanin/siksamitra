# Śrī Viṣṇu Sahasranāma — how the book was made (2026-10-04)

The recipe for `śrī viṣṇu sahasranāma stotram v1.0 IAST.docx/.pdf`, kept so it can be
rebuilt and the pattern reused for another sahasranāma.

1. **Sources** (fetched as witnesses through the agent's tools, `agent-bridge.ts`):
   w1 sanskritdocuments `vsahasranew.itx` (the recited vulgate, MBh 13.149) — the base;
   w2 GRETIL MBh 13 (BORI critical edition, 13.135) — checked against;
   w3 sanskritdocuments `vishnaam.itx` — the 1000 names, numbered as Śaṅkara numbers them;
   w4 infolyter — the pañcapūjā (vignanam's text).
2. **Names**: `seg.py` (+ `ovr.json`) aligns the 1000 names to the 107 verses; `g0*.txt` are
   each name's word-split form and its gloss (after Śaṅkara, R. Ananthakrishna Sastry 1901);
   `assemble.py` writes `stotram_verses.json`, every letter checked against the source.
3. **Parts**: `b1.py` (pūrvabhāga, nyāsas, dhyānas, pañcapūjā), `b2.py` (stotram), `b3.py`
   (phalaśruti) → `build_document`, `proof`, `check`, saved as `.smdoc`.
4. **Book**: `merge.ts` — his sādhanā's prastāvanā (as stored), the three parts, his puruṣa
   sūktam and nārāyaṇa sūktam v1.0, the Youth Wing nārāyaṇa kṣamā prārthanā, his śānti;
   `nyasa.py` — the nyāsa svaras as his Lalitā/Rudram/sādhanā place them (not yet a rule
   of the program); `npm run export -- … --docx`; `word-print.ps1` — Word fills the fields
   and prints the PDF.
