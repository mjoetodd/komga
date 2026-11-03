import { ApiBaseUrl } from '@/api/base'
import { client } from '@/generated/openapi/client.gen'
import type { AudiobookInfo } from '@/functions/audiobook'

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
