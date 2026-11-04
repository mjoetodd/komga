import { defineQueryOptions } from '@pinia/colada'
import { fetchBookCast } from '@/api/cast'
import { STALE_TIME } from '@/types/time'

export const QUERY_KEYS_CAST = {
  root: ['cast'] as const,
  byBookId: (bookId: string) => [...QUERY_KEYS_CAST.root, bookId] as const,
}

export const castQuery = defineQueryOptions(({ bookId }: { bookId: string }) => ({
  key: QUERY_KEYS_CAST.byBookId(bookId),
  query: () => fetchBookCast(bookId),
  staleTime: STALE_TIME.LONG,
}))
