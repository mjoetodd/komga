package org.gotson.komga.domain.service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import io.github.oshai.kotlinlogging.KotlinLogging
import org.gotson.komga.domain.model.Book
import org.springframework.stereotype.Service
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.exists
import kotlin.io.path.nameWithoutExtension

private val logger = KotlinLogging.logger {}

/**
 * Locates the cast-list sidecar for a book on disk: `<book basename>.cast.json`
 * next to the book file. The file is generated externally alongside the
 * prebuilt audiobook (see gen_audiobook_multivoice.py); Komga only indexes
 * and serves it.
 */
@Service
class CastService {
  private val objectMapper = ObjectMapper()

  fun findForBook(book: Book): Path? {
    val bookPath = book.path
    val parent = bookPath.parent ?: return null
    val json = parent.resolve("${bookPath.nameWithoutExtension}.cast.json")
    return if (json.exists()) json else null
  }

  fun readCast(path: Path): JsonNode? =
    try {
      Files.newInputStream(path).use { objectMapper.readTree(it) }
    } catch (e: Exception) {
      logger.warn(e) { "Could not parse cast sidecar: $path" }
      null
    }
}
