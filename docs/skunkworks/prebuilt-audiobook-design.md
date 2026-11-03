# Prebuilt Audiobooks for Komga — Skunkworks Design

Joe's ask (2026-11-03): today TTS is real-time — EpubReader extracts text,
Komga proxies each segment to Phonon (`/api/v1/tts/speak`), and timing is
*estimated*. Instead: **pre-build the audiobook**, have Komga **index and
store the reference alongside the book**, then **play it back in sync with
the EPUB** while reading.

## Why (measured, not theoretical)

- Phonon is a **single synthesis slot** — realtime playback already hit
  its 429 `server_busy` hard enough that PR #3 needed retry logic.
- Timing today is a ~160 wpm estimate rescaled onto real duration; it
  drifts, worst in paragraph mode. A prebuilt file can carry an **exact**
  sync map.
- Probe (2026-11-03, NASty, voice Russell): one 14-word sentence →
  MP3 **64 kbps / 24 kHz mono**, 32,448 bytes ≈ **4.06 s of audio,
  synthesized in 0.57 s (~7× realtime)**. A ~41-minute chapter
  (God Eater ch.1 = 6,099 words) ≈ **~4–6 min to generate, ~19 MB**.
- Storage math: 64 kbps = **28.8 MB/hour** → generation must be
  **opt-in per book**, never library-wide by default.

## The format: audiobook sidecars

Next to each book file, two files:

```
<book basename>.audio.mp3    — concatenated narration (MP3 frames from
                               Phonon share encoder settings, so plain
                               concatenation plays as one file)
<book basename>.audio.json   — the sync map + provenance
```

Sync map (v1):

```json
{
  "version": 1,
  "bookFile": "The God Eater #0001.epub",
  "voice": "Russell", "model": "", "rate": 1.0,
  "segmentMode": "smart",
  "generatedAt": "2026-11-03T19:52:00Z",
  "durationSec": 2436.4,
  "segments": [
    { "i": 0, "href": "EPUB/chapter_00001.xhtml",
      "start": 0.00, "end": 4.06,
      "charStart": 0, "charEnd": 68,
      "text": "The city burned quietly that night…" }
  ]
}
```

- Segment = the same unit the reader already speaks (sentence / smart
  chunk), produced by the **same segmentation rules** as
  `functions/tts/text-extractor.ts` (Intl.Segmenter + punctuation rules).
- `start`/`end` are **exact**: accumulated from each synthesized chunk's
  real MP3 duration (CBR 64 kbps → bytes×8/64000, refined by frame parse).
- `href` + `charStart`/`charEnd` anchor the segment inside its spine
  item's extracted flat text; `text` is a snippet for resilient
  re-matching if client/server extraction ever drifts.

## Indexing in Komga (use the sidecar system that already exists)

Komga already has `Sidecar` (BOOK/SERIES × ARTWORK/METADATA),
`FileSystemScanner` sidecar prefiltering, and `SidecarBookConsumer`.

1. `Sidecar.Type` gains `AUDIO` (or a dedicated consumer path if upstream
   enum churn is a concern — decide in-slice).
2. `AudiobookSidecarConsumer`: prefilter `*.audio.mp3` / `*.audio.json`,
   basename match like existing consumers.
3. Scan stores the reference (book id → audio file URL + sync-map URL,
   duration, voice) — a small table or book-adjacent record; **the audio
   bytes never enter the DB** (the Komf cover-blob lesson).
4. REST, next to `TtsController`:
   - `GET /api/v1/books/{id}/audiobook` → metadata + sync map.
   - `GET /api/v1/books/{id}/audiobook/file` → MP3 stream **with HTTP
     Range support** (seeking is a hard requirement).

## Playback + sync in EpubReader (classic webui, where TTS lives)

When a book has an audiobook, `TtsPlaybackBar` gains an **Audiobook
mode** alongside realtime TTS:

- One `<audio>` element; `timeupdate` → binary-search the sync map →
  segment → reconstruct its DOM range via the existing
  TextExtractor mappings for the current spine item →
  **reuse `TTSHighlighter`** (CSS Custom Highlight API) unchanged.
- Audio crosses into the next spine item → reader navigates to it
  (follow-along). Reader turns a page / taps a paragraph → seek to that
  segment's `start` (tap-to-seek from the segment list the controller
  already maintains).
- Reading position (`Locator` href + `totalProgression`, already
  tracked) maps to the nearest segment on play-from-here.
- Existing hard-won rules carry over: **playbackRate is the single
  speed owner** (never re-render at speed), sleep timer and Media
  Session controls from PR #3 work as-is on the audio element.
- Fallback is free: no sidecar → today's realtime TTS, untouched.

## Generation (the pre-build) — two routes, staged

**Route A — external builder (prototype first).** A standalone script
(the `lncrawl_publish.py` pattern) run on NASty: parse the EPUB spine,
segment per XHTML item, call Phonon directly (serial — respect the
single slot), concatenate, emit both sidecars next to the book, trigger
a Komga scan. Zero risk to Komga core; proves sync quality end-to-end.

**Route B — in-Komga task (hardening, later).** `Task.GenerateBookAudiobook`
in the existing task queue (follows AnalyzeBook / GenerateBookThumbnail),
server-side EPUB text extraction via the WebPub/spine machinery Komga
already has, a "Generate audiobook" action on the book, progress via the
task system. Needs library folders **writable** by Komga and a Kotlin
port of the segmentation rules — the real cost of this route.

Recommendation: **A to prove it, B when it's loved.** Sidecar format is
identical either way, so nothing is thrown away.

## Slices

- **P0 — timing proof (no Komga changes):** external generator for ONE
  test chapter (God Eater #0001 — new, not protected), first N segments
  + full-chapter run; a throwaway harness page that plays the MP3 and
  highlights the EPUB text from the sync map. Validates: extraction
  parity, duration bookkeeping, highlight anchoring.
- **P1 — Komga indexes + serves:** sidecar consumer, book reference,
  the two REST endpoints with Range streaming.
- **P2 — reader sync:** Audiobook mode in the playback bar (highlight,
  follow-along, tap-to-seek, play-from-here).
- **P3 — generate from Komga:** Route B task + book action; voice
  picker reuses `/api/v1/tts/voices`.

## Open risks / notes

- Extraction parity (server script vs reader's DOM extraction) is THE
  risk; snippet-anchored re-matching is the mitigation, P0 measures it.
- Komga mounts: audiobook sidecars live in library folders — check
  write access before Route B; Route A writes from outside anyway.
- CBZ/comics: this design is EPUB-only, same as TTS today. For
  per-chapter light novels (one EPUB = one chapter) it maps 1:1 —
  series-level listening = "play next book", which EpubReader already
  has (`nextBook()`).
- Re-Birth and Regressor's Tale are protected — never prototype on them.
