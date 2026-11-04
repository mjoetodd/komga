import { client } from '@/generated/openapi/client.gen'
import type { SeriesCharacters } from '@/functions/series-characters'

/** A series' characters, book analysis states and gating summary. Throws on 404. */
export async function fetchSeriesCharacters(seriesId: string): Promise<SeriesCharacters> {
  const data = await client.get({
    responseStyle: 'data',
    url: '/api/v1/series/{seriesId}/characters',
    path: { seriesId },
    // the endpoint only produces JSON; a bare Accept: */* would 500
    headers: { Accept: 'application/json' },
  })
  return data as unknown as SeriesCharacters
}
