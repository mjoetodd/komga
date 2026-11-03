import { describe, expect, test } from 'vitest'
import { type AudiobookSegment, findSegmentIndex, formatPlaybackTime } from '@/functions/audiobook'

function segment(i: number, start: number, end: number): AudiobookSegment {
  return { i, href: 'chapter.xhtml', charStart: 0, charEnd: 0, start, end, text: `segment ${i}` }
}

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
