import { client } from '@/generated/openapi/client.gen'
import type { CharacterJob, SeriesCharacters } from '@/functions/series-characters'

const jsonHeaders = { Accept: 'application/json', 'Content-Type': 'application/json' }

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

export async function fetchCharacterJobs(seriesId: string): Promise<CharacterJob[]> {
  const data = await client.get({
    responseStyle: 'data',
    url: '/api/v1/series/{seriesId}/characters/jobs',
    path: { seriesId },
    headers: { Accept: 'application/json' },
  })
  return data as unknown as CharacterJob[]
}

export async function postAnalyzeCharacters(
  seriesId: string,
  bookIds?: string[],
): Promise<CharacterJob> {
  const data = await client.post({
    responseStyle: 'data',
    url: '/api/v1/series/{seriesId}/characters/analyze',
    path: { seriesId },
    body: { bookIds: bookIds ?? null },
    headers: jsonHeaders,
  })
  return data as unknown as CharacterJob
}

export async function postGenerateAudiobooks(
  seriesId: string,
  bookIds?: string[],
): Promise<CharacterJob> {
  const data = await client.post({
    responseStyle: 'data',
    url: '/api/v1/series/{seriesId}/characters/generate-audiobooks',
    path: { seriesId },
    body: { bookIds: bookIds ?? null },
    headers: jsonHeaders,
  })
  return data as unknown as CharacterJob
}

export async function postCharacterMarks(
  seriesId: string,
  bookIds: string[],
  marks: { reprocessCharacters?: boolean; reprocessAudiobook?: boolean },
): Promise<void> {
  await client.post({
    responseStyle: 'data',
    url: '/api/v1/series/{seriesId}/characters/marks',
    path: { seriesId },
    body: { bookIds, ...marks },
    headers: jsonHeaders,
  })
}
