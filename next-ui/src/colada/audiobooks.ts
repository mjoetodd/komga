import { defineQueryOptions } from '@pinia/colada'
import { fetchAudiobook } from '@/api/audiobooks'
import { STALE_TIME } from '@/types/time'

export const QUERY_KEYS_AUDIOBOOKS = {
  root: ['audiobooks'] as const,
  byBookId: (bookId: string) => [...QUERY_KEYS_AUDIOBOOKS.root, bookId] as const,
}

export const audiobookQuery = defineQueryOptions(({ bookId }: { bookId: string }) => ({
  key: QUERY_KEYS_AUDIOBOOKS.byBookId(bookId),
  query: () => fetchAudiobook(bookId),
  staleTime: STALE_TIME.LONG,
}))
