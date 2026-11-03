/**
 * Prebuilt audiobooks: narration generated ahead of time, stored as sidecars
 * next to the book file and served by the backend with an exact sync map
 * (see /api/v1/books/{bookId}/audiobook). The standalone player plays the
 * single audio file and follows the sync map segment by segment.
 */
export interface AudiobookSegment {
  i: number
  href: string
  charStart: number
  charEnd: number
  start: number
  end: number
  text: string
}

export interface AudiobookInfo {
  available: boolean
  voice?: string | null
  model?: string | null
  rate?: number | null
  segmentMode?: string | null
  durationSec?: number | null
  generatedAt?: string | null
  segments: AudiobookSegment[]
}

/**
 * Index of the segment playing at the given time: the last segment that has
 * already started, or -1 when playback has not reached the first segment.
 */
export function findSegmentIndex(segments: AudiobookSegment[], time: number): number {
  let lo = 0
  let hi = segments.length - 1
  let result = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const segment = segments[mid]
    if (!segment) break
    if (segment.start <= time) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return result
}

/** Playback position as m:ss, or h:mm:ss past an hour. */
export function formatPlaybackTime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const ss = String(secs).padStart(2, '0')
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`
  return `${minutes}:${ss}`
}
