import { client } from '@/generated/openapi/client.gen'
import type { BookCast } from '@/functions/cast'

/** A book's audiobook voice cast (from its cast sidecar). Throws on 404. */
export async function fetchBookCast(bookId: string): Promise<BookCast> {
  const data = await client.get({
    responseStyle: 'data',
    url: '/api/v1/books/{bookId}/cast',
    path: { bookId },
    // the endpoint only produces JSON; a bare Accept: */* would 500
    headers: { Accept: 'application/json' },
  })
  return data as unknown as BookCast
}
