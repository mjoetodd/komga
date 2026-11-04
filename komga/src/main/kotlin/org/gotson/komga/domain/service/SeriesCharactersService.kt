package org.gotson.komga.domain.service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import io.github.oshai.kotlinlogging.KotlinLogging
import org.gotson.komga.domain.model.Book
import org.springframework.stereotype.Service
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.exists

private val logger = KotlinLogging.logger {}

/**
 * Locates the series-level characters export for a series on disk:
 * `series-characters.json` in the folder of the series' books. The file is
 * generated externally by the audiobook character pipeline
 * (build_series_export.py) from the series cast registry, per-book cast
 * sidecars and aligned speaker data; Komga only reads and serves it.
 */
@Service
class SeriesCharactersService {
  private val objectMapper = ObjectMapper()

  fun findForBooks(books: Collection<Book>): Path? {
    val sorted = books.sortedBy { it.number }
    for (book in sorted) {
      val parent = book.path.parent ?: continue
      val json = parent.resolve("series-characters.json")
      if (json.exists()) return json
    }
    return null
  }

  fun readExport(path: Path): JsonNode? =
    try {
      Files.newInputStream(path).use { objectMapper.readTree(it) }
    } catch (e: Exception) {
      logger.warn(e) { "Could not parse series characters export: $path" }
      null
    }
}
