import { defineMessages, type MessageDescriptor } from 'vue-intl'

export const BookPosterSourceValues = [
  'BOOK',
  'SERIES',
] as const

export type BookPosterSource = (typeof BookPosterSourceValues)[number]

export const bookPosterSourceMessages: Record<BookPosterSource, MessageDescriptor> = defineMessages({
  BOOK: {
    description: 'Book poster source: BOOK',
    defaultMessage: "Each book's own cover",
    id: 'enum.BookPosterSource.BOOK',
  },
  SERIES: {
    description: 'Book poster source: SERIES',
    defaultMessage: 'Series cover',
    id: 'enum.BookPosterSource.SERIES',
  },
})
