import { ApiBaseUrl } from '@/api/base'
import { client } from '@/generated/openapi/client.gen'
import { komgaGetBookProgression, komgaUpdateBookProgression } from '@/generated/openapi/sdk.gen'
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

/** The book's stored reading progression (the EPUB reader's position), or undefined if none. */
export async function fetchProgression(bookId: string): Promise<R2Progression | undefined> {
  try {
    const data = await komgaGetBookProgression({
      path: { bookId },
      headers: { Accept: 'application/json' },
    })
    return data as R2Progression
  } catch {
    // no progression stored yet (404) or a transient failure: start fresh
    return undefined
  }
}

/** Persist a listening position as reading progression so the EPUB reader resumes there. */
export async function saveProgression(bookId: string, locator: R2Locator): Promise<void> {
  await komgaUpdateBookProgression({
    path: { bookId },
    body: { device: PROGRESSION_DEVICE, locator, modified: new Date() },
    throwOnError: false,
  })
}
