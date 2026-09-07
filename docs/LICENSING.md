# Licensing — a decision still to make

śikṣāmitra is intended to be open source. **No licence has been chosen yet**,
and that is the owner's decision rather than one to be made from a repository.

Until a `LICENSE` file exists the code is, legally, all rights reserved. That is
a safe default: adding a licence later is easy, and retracting one is not.

## What the choice turns on

| | Permissive (MIT, Apache-2.0) | Weak copyleft (MPL-2.0, LGPL) | Strong copyleft (GPL-3.0, AGPL-3.0) |
| --- | --- | --- | --- |
| Someone may build a closed product on it | yes | yes, if they keep this part open | no |
| Someone may take it and not contribute back | yes | mostly | no |
| A university or company can adopt it easily | easiest | usually fine | often blocked by policy |
| Patent grant | Apache-2.0 yes, MIT no | yes | yes |

Considerations specific to this program:

- **The corpus and the marking rules are scholarship.** The rules are
  transcribed from śikṣā sources and from the owner's own practice. A licence
  governs the CODE; whether the corpus documents carry the same terms is a
  separate decision, and they may deserve a data licence (CC-BY-SA is common
  for text corpora) rather than a software one.
- **The fonts are already settled** and are not affected: all eleven families
  are SIL OFL 1.1, which permits redistribution inside an installer. Their
  notices are generated into `assets/fonts/LICENSES.md`.
- **If institutional adoption matters**, Apache-2.0 is the least friction and
  includes an explicit patent grant.
- **If it matters that improvements come back**, MPL-2.0 is the mildest form of
  that: someone must publish changes to these files, but may still link the
  program into something closed.

## To decide it

1. Put the chosen text in `LICENSE` at the repository root.
2. Add an SPDX identifier to `package.json` (`"license": "Apache-2.0"`).
3. Decide separately whether `corpus/` carries the same terms, and say so in
   `corpus/README.md`.
4. Note it in `README.md`, which currently says the question is open.

Nothing in the codebase depends on the answer, so this is not blocking.
