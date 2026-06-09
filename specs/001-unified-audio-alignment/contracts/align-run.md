# Contract: `POST /api/align/run` (the single mapping endpoint)

The one backend interface for the feature. Supersedes the tiered contract. Consumed by `dialog-audio-editor.js` `autoAlign()`.

## Request

```json
{
  "audio": "data:audio/mpeg;base64,...  | base64 string",
  "mime": "audio/mpeg",
  "model": "tiny",
  "targets": [
    {
      "index": 0,
      "text": "agnimīḷe purohitaṁ",
      "level": "line",
      "iastNormalized": "agnimīḷe purohitaṁ",
      "syllables": 8,
      "hasSvaras": true,
      "pauseAfterHint": true,
      "events": [
        { "type": "VOW_S", "matras": 1.0, "svara": null, "char": "a" },
        { "type": "NAS",   "matras": 0.5, "svara": null, "char": "g" }
      ]
    }
  ]
}
```

- **`tier` is removed.** An optional `"model"` (`"tiny"` default | `"small"`) selects the cached whisper size; it is NOT a user-facing alignment "mode" — it only trades speed/RAM for recognition quality and defaults silently.
- `targets[].events` / `hasSvaras` are now **required-if-available** (forwarded from `_buildTarget`); absence degrades gracefully to `syllables`.

## Response (200)

```json
{
  "engine": "whisper-tiny",
  "regions": [
    {
      "targetIndex": 0,
      "start": 1.234,
      "end": 3.870,
      "confidence": 0.86,
      "status": "matched",
      "breakdown": { "phonetic": 0.82, "duration": 0.79, "pause": 0.6, "prior": 0.7 }
    }
  ],
  "unassigned": [3],
  "speech_span": [0.4, 41.2],
  "summary": { "matched": 8, "warn": 1, "unassigned": 1 },
  "diagnostics": {
    "engine": "whisper-tiny",
    "transcript_tokens": 73,
    "anchors": 61,
    "silence_intervals": 9,
    "decode_ms": 220, "recognize_ms": 18400, "fuse_ms": 95
  }
}
```

### Status semantics (FR-008, FR-009)
- `matched` — confidence ≥ 0.55; region trustworthy.
- `warn` — 0.35 ≤ confidence < 0.55; needs review (surfaced, not hidden).
- `unassigned` — confidence < 0.35 or no anchors; region omitted, index listed in `unassigned`. **Never** a fabricated span.

### Degraded response (FR-014)
If recognition is unavailable, same shape with `"engine":"proportional"`, every region `status:"warn"`, low confidence, `diagnostics.degraded:true`.

### Errors
- `400` — no targets / undecodable audio.
- `500` — unexpected engine failure (frontend shows error; no silent fake regions).

## Model-management endpoints (simplified)

- `GET /api/align/model/status?model=tiny|small` → `{ model, downloaded, size_mb, cache_dir }`. (Cached tiny/small report `downloaded:true`.)
- `POST /api/align/model/download` `{ model }` → ensures a cached model present. Default path needs no download.

## Compatibility notes
- Response keeps `regions[]` with `targetIndex/start/end/confidence/status`, so the dialog's existing region-install code path is reused; only the read of `tier_used`→`engine` and removal of the tier request field change on the client.
