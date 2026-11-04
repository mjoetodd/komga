package org.gotson.komga.infrastructure.jooq.main

import org.gotson.komga.infrastructure.jooq.SplitDslDaoBase
import org.gotson.komga.jooq.main.Tables
import org.jooq.DSLContext
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component

data class CharacterBookFlags(
  val reprocessCharacters: Boolean = false,
  val reprocessAudiobook: Boolean = false,
)

@Component
class CharacterBookStateDao(
  dslRW: DSLContext,
  @Qualifier("dslContextRO") dslRO: DSLContext,
) : SplitDslDaoBase(dslRW, dslRO) {
  private val s = Tables.CHARACTER_BOOK_STATE
  private val d = Tables.CHARACTER_DISMISSED_SUGGESTION

  fun findByBookIds(bookIds: Collection<String>): Map<String, CharacterBookFlags> {
    if (bookIds.isEmpty()) return emptyMap()
    return dslRO
      .selectFrom(s)
      .where(s.BOOK_ID.`in`(bookIds))
      .fetch()
      .associate { it.bookId to CharacterBookFlags(it.reprocessCharacters, it.reprocessAudiobook) }
  }

  fun setFlags(
    bookId: String,
    reprocessCharacters: Boolean?,
    reprocessAudiobook: Boolean?,
  ) {
    val current = findByBookIds(listOf(bookId))[bookId] ?: CharacterBookFlags()
    val rc = reprocessCharacters ?: current.reprocessCharacters
    val ra = reprocessAudiobook ?: current.reprocessAudiobook
    dslRW
      .insertInto(s, s.BOOK_ID, s.REPROCESS_CHARACTERS, s.REPROCESS_AUDIOBOOK)
      .values(bookId, rc, ra)
      .onDuplicateKeyUpdate()
      .set(s.REPROCESS_CHARACTERS, rc)
      .set(s.REPROCESS_AUDIOBOOK, ra)
      .execute()
  }

  fun findDismissedPairs(seriesId: String): Set<String> =
    dslRO
      .selectFrom(d)
      .where(d.SERIES_ID.eq(seriesId))
      .fetch()
      .map { it.pairKey }
      .toSet()

  fun dismissPair(
    seriesId: String,
    pairKey: String,
  ) {
    dslRW
      .insertInto(d, d.SERIES_ID, d.PAIR_KEY)
      .values(seriesId, pairKey)
      .onDuplicateKeyIgnore()
      .execute()
  }
}
