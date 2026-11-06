/** Series-level character data, served from the `series-characters.json` export. */
export interface SeriesCharacterBookStat {
  bookId?: string | null
  number?: number | null
  lines: number
  chars: number
  evidence?: string[]
}

export interface CharacterFact {
  text: string
  book?: number | null
}

export interface CharacterRelationship {
  name: string
  nature: string
  book?: number | null
}

export interface AliasCandidate {
  id: string
  name: string
  reason: string
}

export interface SeriesCharacter {
  id: string
  name: string
  aliases: string[]
  description?: string | null
  traits: Record<string, string | null>
  voice: string
  voiceType: string
  status: string
  mergedInto?: string | null
  totalLines: number
  totalChars: number
  firstBook?: number | null
  books: SeriesCharacterBookStat[]
  sampleLines: string[]
  memorySummary?: string | null
  facts?: CharacterFact[]
  relationships?: CharacterRelationship[]
  aliasCandidates?: AliasCandidate[]
}

export interface CharacterBookState {
  bookId?: string | null
  number?: number | null
  file: string
  castState: string
  hasAudiobook: boolean
  durationSec?: number | null
  reprocessCharacters: boolean
  reprocessAudiobook: boolean
}

export interface MergeSuggestion {
  aId?: string | null
  bId?: string | null
  aName: string
  bName: string
  confidence?: number | null
  reason?: string | null
}

export interface CharacterJob {
  id: string
  type: string
  state: string
  phase?: string | null
  bookIndex?: number | null
  bookCount?: number | null
  detail?: string | null
  error?: string | null
  createdAt?: string | null
  finishedAt?: string | null
  bookNumbers?: number[]
}

function jobTime(job: CharacterJob): number {
  const t = job.finishedAt ?? job.createdAt
  return t ? new Date(t).getTime() : 0
}

/**
 * The error a page should surface from a newest-first job list: the newest
 * errored job in scope, unless a job in the same scope completed after it
 * finished — a stale error must not outlive a later success. `scope`
 * narrows both sides to one book (book pages); omit it for series scope.
 * Scopes with no completions keep the plain newest-error behavior.
 */
export function displayJobError(
  jobs: CharacterJob[],
  scope?: (job: CharacterJob) => boolean,
): CharacterJob | undefined {
  const inScope = (j: CharacterJob) => !scope || scope(j)
  const failed = jobs.find((j) => j.state === 'error' && j.error && inScope(j))
  if (!failed) return undefined
  const failedAt = jobTime(failed)
  const superseded = jobs.some((j) => j.state === 'done' && inScope(j) && jobTime(j) > failedAt)
  return superseded ? undefined : failed
}

/** Friendly phase names for button status text. */
export function jobPhaseLabel(phase?: string | null): string {
  switch (phase) {
    case 'parse':
      return 'Parsing'
    case 'parse-skip':
      return 'Checking'
    case 'assign-voices':
      return 'Assigning voices'
    case 'cast-sidecar':
      return 'Writing cast'
    case 'character-memory':
      return 'Updating character memory'
    case 'export':
      return 'Finishing'
    case 'render':
      return 'Rendering'
    case 'merge':
      return 'Merging'
    default:
      return phase ? phase.charAt(0).toUpperCase() + phase.slice(1) : 'Working'
  }
}

/** The text a job's button shows while the job is queued or running. */
export function jobButtonText(job: CharacterJob): string {
  if (job.state === 'queued') return 'In Queue'
  let text = jobPhaseLabel(job.phase)
  if (job.bookIndex != null && job.bookCount && job.bookCount > 1) {
    text += ` — book ${job.bookIndex} of ${job.bookCount}`
  } else if (job.detail) {
    text += ` — ${job.detail.replace(/^book /, '')}`
  }
  return text
}

export interface SeriesCharacters {
  available: boolean
  seriesName?: string | null
  generatedAt?: string | null
  narrator?: {
    id: string
    name: string
    voice: string
    voiceType: string
  } | null
  characters: SeriesCharacter[]
  books: CharacterBookState[]
  suggestions: MergeSuggestion[]
  totalBooks: number
  castReadyCount: number
  needsAnalysisCount: number
  canGenerateAllAudiobooks: boolean
}
