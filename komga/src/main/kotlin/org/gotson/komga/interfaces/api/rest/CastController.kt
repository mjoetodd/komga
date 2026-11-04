package org.gotson.komga.interfaces.api.rest

import com.fasterxml.jackson.databind.JsonNode
import io.swagger.v3.oas.annotations.Operation
import org.gotson.komga.domain.persistence.BookRepository
import org.gotson.komga.domain.service.CastService
import org.gotson.komga.infrastructure.security.KomgaPrincipal
import org.gotson.komga.interfaces.api.ContentRestrictionChecker
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

data class CastMemberDto(
  val id: String,
  val name: String,
  val description: String? = null,
  val voice: String,
  val voiceType: String,
  val dialogueSegments: Int = 0,
  val dialogueChars: Int = 0,
)

data class CastDto(
  val available: Boolean,
  val series: String? = null,
  val narrator: CastMemberDto? = null,
  val cast: List<CastMemberDto> = emptyList(),
)

/**
 * Serves a book's voice cast: the narrator and characters of its prebuilt
 * multi-voice audiobook, with the voice each one uses. The data comes from a
 * `<book>.cast.json` sidecar generated next to the book file.
 */
@RestController
@RequestMapping(value = ["api/v1/books/{bookId}/cast"])
class CastController(
  private val bookRepository: BookRepository,
  private val castService: CastService,
  private val contentRestrictionChecker: ContentRestrictionChecker,
) {
  // produces must name JSON explicitly (same converter quirk as the
  // audiobook endpoint: a bare Accept: */* would otherwise 500)
  @GetMapping(produces = [MediaType.APPLICATION_JSON_VALUE])
  @Operation(summary = "Get a book's audiobook voice cast")
  fun getCast(
    @AuthenticationPrincipal principal: KomgaPrincipal,
    @PathVariable bookId: String,
  ): CastDto {
    contentRestrictionChecker.checkContentRestrictionBook(principal.user, bookId)
    val book = bookRepository.findByIdOrNull(bookId) ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)
    val path = castService.findForBook(book) ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "No cast for this book")
    val root = castService.readCast(path) ?: return CastDto(available = true)

    return CastDto(
      available = true,
      series = root.path("series").takeIf { it.isTextual }?.asText(),
      narrator = root.path("narrator").takeIf { it.isObject }?.let { member(it, "NARRATOR") },
      cast = root.path("cast").map { member(it, it.path("id").asText()) },
    )
  }

  private fun member(
    node: JsonNode,
    fallbackId: String,
  ): CastMemberDto =
    CastMemberDto(
      id = node.path("id").takeIf { it.isTextual }?.asText() ?: fallbackId,
      name = node.path("name").asText(),
      description = node.path("description").takeIf { it.isTextual }?.asText(),
      voice = node.path("voice").asText(),
      voiceType = node.path("voiceType").takeIf { it.isTextual }?.asText() ?: "standard",
      dialogueSegments = node.path("dialogueSegments").asInt(0),
      dialogueChars = node.path("dialogueChars").asInt(0),
    )
}
