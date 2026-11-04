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

/**
 * Position sync with the EPUB reader. Komga stores reading progression as a
 * Readium locator (href + progression within that resource + total
 * progression across the book); the sync map's per-segment href and
 * character ranges are the bridge between that and audio time. Character
 * totals are derived from the segments themselves (they tile the narrated
 * resources), so conversions are approximate - within a paragraph or so -
 * but round-trip consistently.
 */
export interface AudiobookLocator {
  href: string
  type: string
  locations: {
    fragments: string[]
    progression?: number
    totalProgression?: number
  }
}

interface ResourceChars {
  href: string
  chars: number
  offset: number
}

function hrefKey(href: string): string {
  let key = href
  try {
    key = decodeURIComponent(href)
  } catch {
    // keep the raw href
  }
  return key.replace(/^\/+/, '')
}

function resourceChars(segments: AudiobookSegment[]): {
  resources: ResourceChars[]
  totalChars: number
} {
  const byKey = new Map<string, ResourceChars>()
  for (const segment of segments) {
    const key = hrefKey(segment.href)
    const existing = byKey.get(key)
    if (existing) {
      existing.chars = Math.max(existing.chars, segment.charEnd)
    } else {
      byKey.set(key, { href: segment.href, chars: segment.charEnd, offset: 0 })
    }
  }
  const resources = [...byKey.values()]
  let offset = 0
  for (const resource of resources) {
    resource.offset = offset
    offset += resource.chars
  }
  return { resources, totalChars: offset }
}

function findResource(resources: ResourceChars[], href: string): ResourceChars | undefined {
  const key = hrefKey(href)
  return (
    resources.find((r) => hrefKey(r.href) === key) ??
    resources.find((r) => hrefKey(r.href).endsWith(key) || key.endsWith(hrefKey(r.href)))
  )
}

export interface AudiobookPosition {
  href: string
  type?: string
  locations?: { progression?: number | null; totalProgression?: number | null }
}

function sameResource(a: string, b: string): boolean {
  const ka = hrefKey(a)
  const kb = hrefKey(b)
  return ka === kb || ka.endsWith(`/${kb}`) || kb.endsWith(`/${ka}`)
}

/**
 * Snap a locator to the book's Readium positions grid. The server only
 * accepts progression writes whose href is one of the book's media files
 * (the sync map's bare spine names are not - Komga prefixes them, e.g.
 * "EPUB/chapter_00001.xhtml") and resolves progression by matching the
 * stored positions, so writing a position's own href and progression
 * verbatim is the reliable path.
 */
export function snapLocatorToPositions(
  locator: AudiobookLocator,
  positions: AudiobookPosition[],
): AudiobookLocator {
  const progression = locator.locations.progression
  if (progression === undefined) return locator
  const matched = positions
    .filter((p) => sameResource(p.href, locator.href) && p.locations?.progression != null)
    .sort((a, b) => (a.locations!.progression ?? 0) - (b.locations!.progression ?? 0))
  if (!matched.length) return locator
  let chosen = matched[0]!
  for (const position of matched) {
    if ((position.locations!.progression ?? 0) <= progression) chosen = position
    else break
  }
  return {
    href: chosen.href,
    type: chosen.type ?? locator.type,
    locations: {
      fragments: [],
      progression: chosen.locations!.progression ?? progression,
      totalProgression: chosen.locations!.totalProgression ?? locator.locations.totalProgression,
    },
  }
}

/** The reader locator corresponding to an audio time, at segment granularity. */
export function timeToLocator(
  segments: AudiobookSegment[],
  time: number,
  positions?: AudiobookPosition[],
): AudiobookLocator | undefined {
  const index = findSegmentIndex(segments, time)
  const segment = segments[index < 0 ? 0 : index]
  if (!segment) return undefined
  const { resources, totalChars } = resourceChars(segments)
  const resource = findResource(resources, segment.href)
  if (!resource || resource.chars <= 0 || totalChars <= 0) return undefined
  const locator: AudiobookLocator = {
    href: segment.href,
    type: 'application/xhtml+xml',
    locations: {
      fragments: [],
      progression: segment.charStart / resource.chars,
      totalProgression: (resource.offset + segment.charStart) / totalChars,
    },
  }
  return positions?.length ? snapLocatorToPositions(locator, positions) : locator
}

/** The audio time corresponding to a reader locator, or undefined if it cannot be mapped. */
export function locatorToTime(
  segments: AudiobookSegment[],
  locator: {
    href: string
    type?: string
    locations?: {
      fragments?: string[]
      progression?: number | null
      totalProgression?: number | null
    }
  },
): number | undefined {
  if (!segments.length) return undefined
  const { resources, totalChars } = resourceChars(segments)
  let charPos: number | undefined
  const resource = findResource(resources, locator.href)
  if (resource && locator.locations?.progression != null) {
    charPos = resource.offset + locator.locations.progression * resource.chars
  } else if (locator.locations?.totalProgression != null && totalChars > 0) {
    charPos = locator.locations.totalProgression * totalChars
  }
  if (charPos === undefined) return undefined
  for (const segment of segments) {
    const res = findResource(resources, segment.href)
    if (!res) continue
    const start = res.offset + segment.charStart
    const end = res.offset + segment.charEnd
    if (charPos >= start && charPos < end) return segment.start
  }
  return segments[segments.length - 1]?.start
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
