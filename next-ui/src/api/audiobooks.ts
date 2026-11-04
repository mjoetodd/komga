import { ApiBaseUrl } from '@/api/base'
import { client } from '@/generated/openapi/client.gen'
import {
  komgaGetBookPositions,
  komgaGetBookProgression,
  komgaUpdateBookProgression,
} from '@/generated/openapi/sdk.gen'
import type { R2Locator, R2Progression } from '@/generated/openapi/types.gen'
import type { AudiobookInfo } from '@/functions/audiobook'

const PROGRESSION_DEVICE: R2Progression['device'] = {
  id: 'komga-audiobook-player',
  name: 'Audiobook Player',
}

/** Stream URL for a book's prebuilt audiobook file (HTTP Range supported). */
export function audiobookFileUrl(bookId: string): string {
  return `${ApiBaseUrl.noSlash}/api/v1/books/${bookId}/audiobook/file`
}

/** Metadata + sync map for a book's prebuilt audiobook. Throws on 404. */
export async function fetchAudiobook(bookId: string): Promise<AudiobookInfo> {
  const data = await client.get({
    responseStyle: 'data',
    url: '/api/v1/books/{bookId}/audiobook',
    path: { bookId },
    // the endpoint only produces JSON; a bare Accept: */* would 500
    headers: { Accept: 'application/json' },
  })
  return data as unknown as AudiobookInfo
}

// The progression endpoint produces only this media type; asking for
// application/json gets a 406 and no progression at all.
const PROGRESSION_ACCEPT = 'application/vnd.readium.progression+json'

/** The book's stored reading progression (the EPUB reader's position), or undefined if none. */
export async function fetchProgression(bookId: string): Promise<R2Progression | undefined> {
  try {
    const data = await komgaGetBookProgression({
      path: { bookId },
      headers: { Accept: PROGRESSION_ACCEPT },
    })
    return data
  } catch {
    // no progression stored yet (404) or a transient failure: start fresh
    return undefined
  }
}

/** The book's Readium positions: the href/progression grid writes must snap to. */
export async function fetchPositions(bookId: string): Promise<R2Locator[]> {
  try {
    const data = await komgaGetBookPositions({ path: { bookId } })
    return data?.positions ?? []
  } catch {
    return []
  }
}

/** Persist a listening position as reading progression so the EPUB reader resumes there. */
export async function saveProgression(bookId: string, locator: R2Locator): Promise<boolean> {
  try {
    await komgaUpdateBookProgression({
      path: { bookId },
      body: { device: PROGRESSION_DEVICE, locator, modified: new Date() },
    })
    return true
  } catch {
    return false
  }
}
