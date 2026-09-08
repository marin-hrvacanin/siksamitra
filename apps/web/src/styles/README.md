# The app's styles

One file per concern, because a single stylesheet is how v1 reached 169 KB of
rules nobody could reason about. The module gate holds each of these under 400
lines; when one approaches it, that is the signal to split again rather than to
raise the limit.

| file | what it styles |
| --- | --- |
| `base.css` | the reset and the app's grid: toolbar / canvas / status |
| `ribbon.css` | the ribbon row, its groups, and the overflow popover |
| `controls.css` | buttons, selects, the segmented control |
| `canvas.css` | the flow column, the desk, a page, the measuring probe |
| `popover.css` | the appearance menu |
| `backstage.css` | the File view: the backstage, its lists, and the account |
| `dialog.css` | the guard — the one modal, asked before work is thrown away |
| `document.css` | **the page**: type, hierarchy, indents, translations |
| `status.css` | the status bar and what it sheds when narrow |
| `diagnostics.css` | states that should be visible rather than silent |

Every value resolves to a token from `@siksamitra/tokens`. `check:literals`
scans these files and fails the build on a literal colour, face or size, so the
drift that produced v1's stylesheet cannot start here.
