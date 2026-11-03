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
 * Locates the prebuilt-audiobook sidecars for a book on disk:
 * `<book basename>.audio.mp3` (narration) and `<book basename>.audio.json`
 * (sync map). Files are generated externally (see docs/skunkworks) and live
 * next to the book file; Komga only indexes and serves them.
 */
@Service
class AudiobookService {
  private val objectMapper = ObjectMapper()

  data class AudiobookFiles(
    val mp3Path: Path,
    val syncMapPath: Path?,
  )

  fun findForBook(book: Book): AudiobookFiles? {
    val bookPath = book.path
    val baseName = bookPath.nameWithoutExtension
    val parent = bookPath.parent ?: return null
    val mp3 = parent.resolve("$baseName.audio.mp3")
    if (!mp3.exists()) return null
    val json = parent.resolve("$baseName.audio.json")
    return AudiobookFiles(mp3Path = mp3, syncMapPath = if (json.exists()) json else null)
  }

  fun readSyncMap(files: AudiobookFiles): JsonNode? {
    val jsonPath = files.syncMapPath ?: return null
    return try {
      Files.newInputStream(jsonPath).use { objectMapper.readTree(it) }
    } catch (e: Exception) {
      logger.warn(e) { "Could not parse audiobook sync map: $jsonPath" }
      null
    }
  }
}
