import { defineQueryOptions } from '@pinia/colada'
import { fetchSeriesCharacters } from '@/api/series-characters'
import { STALE_TIME } from '@/types/time'

export const QUERY_KEYS_SERIES_CHARACTERS = {
  root: ['series-characters'] as const,
  bySeriesId: (seriesId: string) => [...QUERY_KEYS_SERIES_CHARACTERS.root, seriesId] as const,
}

export const seriesCharactersQuery = defineQueryOptions(({ seriesId }: { seriesId: string }) => ({
  key: QUERY_KEYS_SERIES_CHARACTERS.bySeriesId(seriesId),
  query: () => fetchSeriesCharacters(seriesId),
  staleTime: STALE_TIME.LONG,
}))
