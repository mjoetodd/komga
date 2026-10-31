package org.gotson.komga.interfaces.api.rest.dto

import org.gotson.komga.domain.model.Library

enum class BookPosterSourceDto {
  BOOK,
  SERIES,
}

fun Library.BookPosterSource.toDto() =
  when (this) {
    Library.BookPosterSource.BOOK -> BookPosterSourceDto.BOOK
    Library.BookPosterSource.SERIES -> BookPosterSourceDto.SERIES
  }

fun BookPosterSourceDto.toDomain() =
  when (this) {
    BookPosterSourceDto.BOOK -> Library.BookPosterSource.BOOK
    BookPosterSourceDto.SERIES -> Library.BookPosterSource.SERIES
  }
