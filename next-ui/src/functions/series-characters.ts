/** Series-level character data, served from the `series-characters.json` export. */
export interface SeriesCharacterBookStat {
  bookId?: string | null
  number?: number | null
  lines: number
  chars: number
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
