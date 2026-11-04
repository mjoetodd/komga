import { describe, expect, test } from 'vitest'
import {
  type AudiobookSegment,
  findSegmentIndex,
  formatPlaybackTime,
  locatorToTime,
  timeToLocator,
} from '@/functions/audiobook'

function segment(i: number, start: number, end: number): AudiobookSegment {
  return { i, href: 'chapter.xhtml', charStart: 0, charEnd: 0, start, end, text: `segment ${i}` }
}

function located(
  i: number,
  href: string,
  charStart: number,
  charEnd: number,
  start: number,
): AudiobookSegment {
  return { i, href, charStart, charEnd, start, end: start + 10, text: `segment ${i}` }
}

// two resources of 100 chars each, two 50-char segments per resource
const book = [
  located(0, 'a.xhtml', 0, 50, 0),
  located(1, 'a.xhtml', 50, 100, 10),
  located(2, 'b.xhtml', 0, 50, 20),
  located(3, 'b.xhtml', 50, 100, 30),
]

const segments = [segment(0, 0, 10), segment(1, 10, 25), segment(2, 25, 40)]

describe('findSegmentIndex', () => {
  test('empty list', () => {
    expect(findSegmentIndex([], 5)).toBe(-1)
  })

  test('before the first segment', () => {
    expect(findSegmentIndex([segment(0, 3, 9)], 1)).toBe(-1)
  })

  test('inside segments and on boundaries', () => {
    expect(findSegmentIndex(segments, 0)).toBe(0)
    expect(findSegmentIndex(segments, 9.99)).toBe(0)
    expect(findSegmentIndex(segments, 10)).toBe(1)
    expect(findSegmentIndex(segments, 24)).toBe(1)
    expect(findSegmentIndex(segments, 25)).toBe(2)
  })

  test('after the last segment stays on it', () => {
    expect(findSegmentIndex(segments, 400)).toBe(2)
  })
})

describe('formatPlaybackTime', () => {
  test('zero and invalid values', () => {
    expect(formatPlaybackTime(0)).toBe('0:00')
    expect(formatPlaybackTime(-5)).toBe('0:00')
    expect(formatPlaybackTime(Number.NaN)).toBe('0:00')
  })

  test('minutes and seconds', () => {
    expect(formatPlaybackTime(65)).toBe('1:05')
    expect(formatPlaybackTime(599.9)).toBe('9:59')
  })

  test('hours', () => {
    expect(formatPlaybackTime(3661)).toBe('1:01:01')
    expect(formatPlaybackTime(1812.648)).toBe('30:12')
  })
})

describe('timeToLocator / locatorToTime', () => {
  test('maps times to progression within and across resources', () => {
    expect(timeToLocator(book, 5)?.locations.progression).toBe(0)
    expect(timeToLocator(book, 15)?.locations.progression).toBe(0.5)
    const second = timeToLocator(book, 25)
    expect(second?.href).toBe('b.xhtml')
    expect(second?.locations.progression).toBe(0)
    expect(second?.locations.totalProgression).toBe(0.5)
    expect(timeToLocator(book, 35)?.locations.totalProgression).toBe(0.75)
  })

  test('maps locators back to segment starts', () => {
    expect(
      locatorToTime(book, {
        href: 'a.xhtml',
        type: 'application/xhtml+xml',
        locations: { fragments: [], progression: 0.6 },
      }),
    ).toBe(10)
    expect(
      locatorToTime(book, {
        href: 'b.xhtml',
        type: 'application/xhtml+xml',
        locations: { fragments: [], progression: 0.1 },
      }),
    ).toBe(20)
  })

  test('round-trips', () => {
    const locator = timeToLocator(book, 25)
    expect(locator && locatorToTime(book, locator)).toBe(20)
  })

  test('falls back to totalProgression for unknown hrefs', () => {
    expect(
      locatorToTime(book, {
        href: 'missing.xhtml',
        type: 'application/xhtml+xml',
        locations: { fragments: [], totalProgression: 0.8 },
      }),
    ).toBe(30)
  })

  test('unmappable inputs', () => {
    expect(timeToLocator([], 5)).toBeUndefined()
    expect(
      locatorToTime([], {
        href: 'a.xhtml',
        type: 'application/xhtml+xml',
        locations: { fragments: [], progression: 0.5 },
      }),
    ).toBeUndefined()
    expect(
      locatorToTime(book, {
        href: 'missing.xhtml',
        type: 'application/xhtml+xml',
        locations: { fragments: [] },
      }),
    ).toBeUndefined()
  })
})
