package org.gotson.komga.interfaces.api.rest

import io.swagger.v3.oas.annotations.Operation
import org.gotson.komga.domain.persistence.BookRepository
import org.gotson.komga.domain.service.AudiobookService
import org.gotson.komga.infrastructure.security.KomgaPrincipal
import org.gotson.komga.interfaces.api.ContentRestrictionChecker
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody
import java.nio.ByteBuffer
import java.nio.file.Files

data class AudiobookSegmentDto(
  val i: Int,
  val href: String,
  val charStart: Int,
  val charEnd: Int,
  val start: Double,
  val end: Double,
  val text: String,
)

data class AudiobookDto(
  val available: Boolean,
  val voice: String? = null,
  val model: String? = null,
  val rate: Double? = null,
  val segmentMode: String? = null,
  val durationSec: Double? = null,
  val generatedAt: String? = null,
  val segments: List<AudiobookSegmentDto> = emptyList(),
)

/**
 * Serves prebuilt audiobooks: narration generated ahead of time and stored as
 * sidecars next to the book file (`<book>.audio.mp3` + `<book>.audio.json`
 * sync map). The reader plays the file and follows the sync map, instead of
 * synthesizing speech in real time.
 */
@RestController
@RequestMapping(value = ["api/v1/books/{bookId}/audiobook"], produces = [MediaType.ALL_VALUE])
class AudiobookController(
  private val bookRepository: BookRepository,
  private val audiobookService: AudiobookService,
  private val contentRestrictionChecker: ContentRestrictionChecker,
) {
  private fun audiobookFiles(
    principal: KomgaPrincipal,
    bookId: String,
  ): AudiobookService.AudiobookFiles {
    contentRestrictionChecker.checkContentRestrictionBook(principal.user, bookId)
    val book = bookRepository.findByIdOrNull(bookId) ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)
    return audiobookService.findForBook(book) ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "No audiobook for this book")
  }

  @GetMapping
  @Operation(summary = "Get a book's prebuilt audiobook metadata and sync map")
  fun getAudiobook(
    @AuthenticationPrincipal principal: KomgaPrincipal,
    @PathVariable bookId: String,
  ): AudiobookDto {
    val files = audiobookFiles(principal, bookId)
    val syncMap = audiobookService.readSyncMap(files)
      ?: return AudiobookDto(available = true)

    val segments =
      syncMap.path("segments").map { seg ->
        AudiobookSegmentDto(
          i = seg.path("i").asInt(),
          href = seg.path("href").asText(),
          charStart = seg.path("charStart").asInt(),
          charEnd = seg.path("charEnd").asInt(),
          start = seg.path("start").asDouble(),
          end = seg.path("end").asDouble(),
          text = seg.path("text").asText(),
        )
      }

    return AudiobookDto(
      available = true,
      voice = syncMap.path("voice").takeIf { it.isTextual }?.asText(),
      model = syncMap.path("model").takeIf { it.isTextual }?.asText(),
      rate = syncMap.path("rate").takeIf { it.isNumber }?.asDouble(),
      segmentMode = syncMap.path("segmentMode").takeIf { it.isTextual }?.asText(),
      durationSec = syncMap.path("durationSec").takeIf { it.isNumber }?.asDouble(),
      generatedAt = syncMap.path("generatedAt").takeIf { it.isTextual }?.asText(),
      segments = segments,
    )
  }

  @GetMapping("file")
  @Operation(summary = "Stream a book's prebuilt audiobook file (HTTP Range supported for seeking)")
  fun getAudiobookFile(
    @AuthenticationPrincipal principal: KomgaPrincipal,
    @PathVariable bookId: String,
    @RequestHeader(value = HttpHeaders.RANGE, required = false) range: String?,
  ): ResponseEntity<StreamingResponseBody> {
    val files = audiobookFiles(principal, bookId)
    val mp3 = files.mp3Path
    val length = Files.size(mp3)

    var start = 0L
    var end = length - 1
    var partial = false

    if (!range.isNullOrBlank() && range.startsWith("bytes=")) {
      val spec = range.removePrefix("bytes=").substringBefore(',').trim()
      val dash = spec.indexOf('-')
      if (dash >= 0) {
        val startText = spec.substring(0, dash)
        val endText = spec.substring(dash + 1)
        try {
          if (startText.isNotEmpty()) {
            start = startText.toLong()
            end = if (endText.isNotEmpty()) minOf(endText.toLong(), length - 1) else length - 1
          } else {
            // suffix range: last N bytes
            val suffix = endText.toLong()
            start = maxOf(0L, length - suffix)
            end = length - 1
          }
          if (start >= length || start > end) {
            return ResponseEntity
              .status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
              .header(HttpHeaders.CONTENT_RANGE, "bytes */$length")
              .body(StreamingResponseBody { })
          }
          partial = true
        } catch (e: NumberFormatException) {
          start = 0L
          end = length - 1
          partial = false
        }
      }
    }

    val rangeStart = start
    val rangeEnd = end
    val body = StreamingResponseBody { out ->
      Files.newByteChannel(mp3).use { channel ->
        channel.position(rangeStart)
        var remaining = rangeEnd - rangeStart + 1
        val buffer = ByteBuffer.allocate(64 * 1024)
        while (remaining > 0) {
          buffer.clear()
          buffer.limit(minOf(buffer.capacity().toLong(), remaining).toInt())
          val read = channel.read(buffer)
          if (read == -1) break
          out.write(buffer.array(), 0, read)
          remaining -= read
        }
      }
    }

    val headers = HttpHeaders()
    headers.contentType = MediaType("audio", "mpeg")
    headers.set(HttpHeaders.ACCEPT_RANGES, "bytes")
    headers.contentLength = rangeEnd - rangeStart + 1
    if (partial) {
      headers.set(HttpHeaders.CONTENT_RANGE, "bytes $rangeStart-$rangeEnd/$length")
    }

    return ResponseEntity
      .status(if (partial) HttpStatus.PARTIAL_CONTENT else HttpStatus.OK)
      .headers(headers)
      .body(body)
  }
}
