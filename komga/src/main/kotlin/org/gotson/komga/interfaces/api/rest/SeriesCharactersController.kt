package org.gotson.komga.interfaces.api.rest

import com.fasterxml.jackson.databind.JsonNode
import io.swagger.v3.oas.annotations.Operation
import org.gotson.komga.domain.persistence.BookRepository
import org.gotson.komga.domain.persistence.SeriesRepository
import org.gotson.komga.domain.service.SeriesCharactersService
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
import kotlin.io.path.name

data class CharacterBookStatDto(
  val bookId: String? = null,
  val number: Int? = null,
  val lines: Int = 0,
  val chars: Int = 0,
)

data class SeriesCharacterDto(
  val id: String,
  val name: String,
  val aliases: List<String> = emptyList(),
  val description: String? = null,
  val traits: Map<String, String?> = emptyMap(),
  val voice: String = "",
  val voiceType: String = "standard",
  val status: String = "active",
  val mergedInto: String? = null,
  val totalLines: Int = 0,
  val totalChars: Int = 0,
  val firstBook: Int? = null,
  val books: List<CharacterBookStatDto> = emptyList(),
  val sampleLines: List<String> = emptyList(),
)

data class CharacterBookStateDto(
  val bookId: String? = null,
  val number: Int? = null,
  val file: String,
  val castState: String = "NONE",
  val hasAudiobook: Boolean = false,
  val durationSec: Double? = null,
  val reprocessCharacters: Boolean = false,
  val reprocessAudiobook: Boolean = false,
)

data class MergeSuggestionDto(
  val aId: String? = null,
  val bId: String? = null,
  val aName: String = "",
  val bName: String = "",
  val confidence: Double? = null,
  val reason: String? = null,
)

data class SeriesCharactersDto(
  val available: Boolean,
  val seriesName: String? = null,
  val generatedAt: String? = null,
  val narrator: CastMemberDto? = null,
  val characters: List<SeriesCharacterDto> = emptyList(),
  val books: List<CharacterBookStateDto> = emptyList(),
  val suggestions: List<MergeSuggestionDto> = emptyList(),
  val totalBooks: Int = 0,
  val castReadyCount: Int = 0,
  val needsAnalysisCount: Int = 0,
  val canGenerateAllAudiobooks: Boolean = false,
)

/**
 * Serves the series-level character data produced by the audiobook character
 * pipeline: the cast registry (characters, aliases, voices, per-book dialogue
 * stats), each book's analysis state, and the gating summary used by the UI
 * (audiobook generation unlocks when every book has character data).
 * Backed by the `series-characters.json` export next to the series' books.
 */
@RestController
@RequestMapping(value = ["api/v1/series/{seriesId}/characters"])
class SeriesCharactersController(
  private val seriesRepository: SeriesRepository,
  private val bookRepository: BookRepository,
  private val seriesCharactersService: SeriesCharactersService,
  private val contentRestrictionChecker: ContentRestrictionChecker,
) {
  // produces must name JSON explicitly (same converter quirk as the
  // audiobook/cast endpoints: a bare Accept: */* would otherwise 500)
  @GetMapping(produces = [MediaType.APPLICATION_JSON_VALUE])
  @Operation(summary = "Get a series' characters, book analysis states and gating summary")
  fun getSeriesCharacters(
    @AuthenticationPrincipal principal: KomgaPrincipal,
    @PathVariable seriesId: String,
  ): SeriesCharactersDto {
    contentRestrictionChecker.checkContentRestrictionSeries(principal.user, seriesId)
    seriesRepository.findByIdOrNull(seriesId) ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)
    val books = bookRepository.findAllBySeriesId(seriesId).sortedBy { it.number }
    val byFileName = books.associateBy { it.path.name }
    val byStem = books.associateBy { it.path.fileName.toString().substringBeforeLast('.') }

    val path = seriesCharactersService.findForBooks(books)
      ?: return SeriesCharactersDto(available = false, totalBooks = books.size)
    val root = seriesCharactersService.readExport(path)
      ?: return SeriesCharactersDto(available = false, totalBooks = books.size)

    val exportBooks = root.path("books").map { node ->
      val file = node.path("file").asText()
      val stem = file.substringBeforeLast('.')
      val book = byFileName[file] ?: byStem[stem]
      CharacterBookStateDto(
        bookId = book?.id,
        number = node.path("number").takeIf { it.isNumber }?.asInt() ?: book?.number,
        file = file,
        castState = node.path("castState").takeIf { it.isTextual }?.asText() ?: "NONE",
        hasAudiobook = node.path("hasAudiobook").asBoolean(false),
        durationSec = node.path("durationSec").takeIf { it.isNumber }?.asDouble(),
      )
    }
    // Books Komga knows but the export predates (new arrivals) count as NONE,
    // which closes the series audiobook gate until analysis runs again.
    val exportedFiles = exportBooks.map { it.file }.toSet()
    val extraBooks = books.filter { it.path.name !in exportedFiles }.map { book ->
      CharacterBookStateDto(bookId = book.id, number = book.number, file = book.path.name, castState = "NONE")
    }
    val allBooks = (exportBooks + extraBooks).sortedBy { it.number ?: Int.MAX_VALUE }
    val ready = allBooks.count { it.castState == "READY" }

    return SeriesCharactersDto(
      available = true,
      seriesName = root.path("series").takeIf { it.isTextual }?.asText(),
      generatedAt = root.path("generatedAt").takeIf { it.isTextual }?.asText(),
      narrator = root.path("narrator").takeIf { it.isObject }?.let { n ->
        CastMemberDto(
          id = "NARRATOR",
          name = n.path("name").takeIf { it.isTextual }?.asText() ?: "Narrator",
          voice = n.path("voice").asText(),
          voiceType = n.path("voiceType").takeIf { it.isTextual }?.asText() ?: "standard",
        )
      },
      characters = root.path("characters").map { c -> character(c, byStem) },
      books = allBooks,
      suggestions = root.path("suggestions").map { s ->
        MergeSuggestionDto(
          aId = s.path("aId").takeIf { it.isTextual }?.asText(),
          bId = s.path("bId").takeIf { it.isTextual }?.asText(),
          aName = s.path("aName").asText(),
          bName = s.path("bName").asText(),
          confidence = s.path("confidence").takeIf { it.isNumber }?.asDouble(),
          reason = s.path("reason").takeIf { it.isTextual }?.asText(),
        )
      },
      totalBooks = allBooks.size,
      castReadyCount = ready,
      needsAnalysisCount = allBooks.size - ready,
      canGenerateAllAudiobooks = allBooks.isNotEmpty() && ready == allBooks.size,
    )
  }

  private fun character(
    node: JsonNode,
    byStem: Map<String, org.gotson.komga.domain.model.Book>,
  ): SeriesCharacterDto =
    SeriesCharacterDto(
      id = node.path("id").asText(),
      name = node.path("name").asText(),
      aliases = node.path("aliases").map { it.asText() },
      description = node.path("description").takeIf { it.isTextual }?.asText(),
      traits = node.path("traits").takeIf { it.isObject }?.let { t ->
        t.fields().asSequence().associate { (k, v) -> k to v.takeIf { it.isTextual }?.asText() }
      } ?: emptyMap(),
      voice = node.path("voice").asText(),
      voiceType = node.path("voiceType").takeIf { it.isTextual }?.asText() ?: "standard",
      status = node.path("status").takeIf { it.isTextual }?.asText() ?: "active",
      mergedInto = node.path("mergedInto").takeIf { it.isTextual }?.asText(),
      totalLines = node.path("totalLines").asInt(0),
      totalChars = node.path("totalChars").asInt(0),
      firstBook = node.path("firstBook").takeIf { it.isNumber }?.asInt(),
      books = node.path("books").map { b ->
        val stem = b.path("stem").asText()
        CharacterBookStatDto(
          bookId = byStem[stem]?.id,
          number = b.path("number").takeIf { it.isNumber }?.asInt(),
          lines = b.path("lines").asInt(0),
          chars = b.path("chars").asInt(0),
        )
      },
      sampleLines = node.path("sampleLines").map { it.asText() },
    )
}
