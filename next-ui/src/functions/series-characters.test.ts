import { describe, expect, test } from 'vitest'
import { type CharacterJob, displayJobError } from '@/functions/series-characters'

function job(partial: Partial<CharacterJob>): CharacterJob {
  return { id: 'j', type: 'generate_audiobooks', state: 'done', ...partial }
}

const T1 = '2026-11-05T10:50:00Z'
const T2 = '2026-11-05T11:22:00Z'
const T3 = '2026-11-05T12:00:00Z'

describe('displayJobError', () => {
  // Acceptance 1 (book 253 replay): an errored regenerate followed by a
  // completed regenerate for the same book must not surface the error.
  test('suppresses an error superseded by a later completion in scope', () => {
    const jobs = [
      job({ id: 'done', state: 'done', finishedAt: T2, bookNumbers: [253] }),
      job({ id: 'err', state: 'error', error: 'boom', finishedAt: T1, bookNumbers: [253] }),
    ]
    const scope = (j: CharacterJob) => j.bookNumbers?.includes(253) ?? false
    expect(displayJobError(jobs, scope)).toBeUndefined()
    expect(displayJobError(jobs)).toBeUndefined()
  })

  // Acceptance 2 (fresh failure): an error newer than any completion shows.
  test('shows an error that is newer than every completion', () => {
    const jobs = [
      job({ id: 'err', state: 'error', error: 'boom', finishedAt: T3, bookNumbers: [253] }),
      job({ id: 'done', state: 'done', finishedAt: T2, bookNumbers: [253] }),
    ]
    expect(displayJobError(jobs)?.id).toBe('err')
  })

  // Acceptance 3 (series scope): suppression applies at series level too,
  // and only there — a completion for a different book does not hide a
  // book-scoped error.
  test('a completion for another book does not supersede a book error', () => {
    const jobs = [
      job({ id: 'done-other', state: 'done', finishedAt: T2, bookNumbers: [7] }),
      job({ id: 'err', state: 'error', error: 'boom', finishedAt: T1, bookNumbers: [253] }),
    ]
    const scope253 = (j: CharacterJob) => j.bookNumbers?.includes(253) ?? false
    expect(displayJobError(jobs, scope253)?.id).toBe('err')
    // series scope: the newer completion does supersede
    expect(displayJobError(jobs)).toBeUndefined()
  })

  test('no completions keeps the newest error (fallback behavior)', () => {
    const jobs = [
      job({ id: 'err2', state: 'error', error: 'newer', finishedAt: T2 }),
      job({ id: 'err1', state: 'error', error: 'older', finishedAt: T1 }),
    ]
    expect(displayJobError(jobs)?.id).toBe('err2')
  })

  test('falls back to createdAt when finishedAt is missing', () => {
    const jobs = [
      job({ id: 'done', state: 'done', createdAt: T2 }),
      job({ id: 'err', state: 'error', error: 'boom', createdAt: T1 }),
    ]
    expect(displayJobError(jobs)).toBeUndefined()
  })

  test('no errored job returns undefined', () => {
    expect(displayJobError([job({ state: 'done', finishedAt: T1 })])).toBeUndefined()
    expect(displayJobError([])).toBeUndefined()
  })
})
