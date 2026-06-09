# Data Model: Single-Copy Audio

## Audio library entry (single source of truth) — `SiksamitraEditor.audioLibrary[]`
| Field | Meaning |
|-------|---------|
| `id` | stable audio id (matches every attachment's `data-audio-id`) |
| `label` | display label |
| `src` | base64 data URI — **the one copy of the bytes** |
| `duration` | seconds |
| `size` | approx bytes |
| (`startTime`/`endTime`) | legacy single-region defaults (unchanged) |

## Audio attachment (blot DOM) — `.ql-audio-attachment`
| Attribute | In live (de-duplicated) DOM | In serialized (inflated) output |
|-----------|-----------------------------|---------------------------------|
| `data-audio-id` | ✅ reference | ✅ |
| `data-audio-label`, `data-start-time`, `data-end-time`, `data-fade-in`, `data-fade-out`, `data-confidence`, `data-duration`, `data-size` | ✅ region metadata | ✅ |
| `data-audio-src` | ❌ removed (dedupe) | ✅ injected from library |
| child `<audio src>` | ❌ empty | ✅ injected from library |

`value(node)` resolves src: `node.dataset.audioSrc || <audio src> || resolveAudioSrc(data-audio-id)`.

## Serializable content
`getSerializableHTML()` → clone of `quill.root` with `data-audio-src` + `<audio src>` injected per
attachment from `resolveAudioSrc(id)` (only when the clone lacks them). Used by every save/export/preview
path. Live DOM unchanged.

## Operations
- `resolveAudioSrc(id)` → `audioLibrary.find(a => a.id === id)?.src || ''`.
- `_dedupeAudioInDOM()` → ∀ attachment: hoist bytes → library (if id missing), then remove
  `data-audio-src` and clear `<audio src>`. Idempotent; runs in `refreshAudioAttachments()`.
- `_getPlaybackAudioBuffer` cache: `Map<audioId, AudioBuffer>` (decode once, reuse).
