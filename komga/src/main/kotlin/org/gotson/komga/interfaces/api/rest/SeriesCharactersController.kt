package org.gotson.komga.interfaces.api.rest

import com.fasterxml.jackson.databind.JsonNode
import io.swagger.v3.oas.annotations.Operation
import org.gotson.komga.domain.model.Book
import org.gotson.komga.domain.persistence.BookRepository
import org.gotson.komga.domain.persistence.SeriesRepository
import org.gotson.komga.domain.service.CharacterJobService
import org.gotson.komga.domain.service.SeriesCharactersService
import org.gotson.komga.infrastructure.jooq.main.CharacterBookStateDao
import org.gotson.komga.infrastructure.security.KomgaPrincipal
import org.gotson.komga.interfaces.api.ContentRestrictionChecker
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
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

data class CharacterJobRequest(
  val bookIds: List<String>? = null,
)

data class CharacterMarksRequest(
  val bookIds: List<String> = emptyList(),
  val reprocessCharacters: Boolean? = null,
  val reprocessAudiobook: Boolean? = null,
)

data class CharacterJobDto(
  val id: String,
  val type: String,
  val state: String,
  val phase: String? = null,
  val bookIndex: Int? = null,
  val bookCount: Int? = null,
  val detail: String? = null,
  val error: String? = null,
  val createdAt: String? = null,
)

/**
 * Serves the series-level character data produced by the audiobook character
 * pipeline, and the actions that drive it: queueing analysis and audiobook
 * jobs for the external worker, and marking books for reprocessing.
 * Read data comes from the `series-characters.json` export next to the
 * series' books; reprocessing flags live in CHARACTER_BOOK_STATE.
 */
@RestController
@RequestMapping(value = ["api/v1/series/{seriesId}/characters"])
class SeriesCharactersController(
  private val seriesRepository: SeriesRepository,
  private val bookRepository: BookRepository,
  private val seriesCharactersService: SeriesCharactersService,
  private val contentRestrictionChecker: ContentRestrictionChecker,
  private val characterBookStateDao: CharacterBookStateDao,
  private val characterJobService: CharacterJobService,
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
    val flags = characterBookStateDao.findByBookIds(books.map { it.id })

    val path = seriesCharactersService.findForBooks(books)
      ?: return SeriesCharactersDto(
        available = false,
        totalBooks = books.size,
        books = books.map { book ->
          val f = flags[book.id]
          CharacterBookStateDto(
            bookId = book.id,
            number = book.number,
            file = book.path.name,
            castState = "NONE",
            reprocessCharacters = f?.reprocessCharacters ?: false,
            reprocessAudiobook = f?.reprocessAudiobook ?: false,
          )
        },
        needsAnalysisCount = books.size,
      )
    val root = seriesCharactersService.readExport(path)
      ?: return SeriesCharactersDto(available = false, totalBooks = books.size)

    val exportBooks = root.path("books").map { node ->
      val file = node.path("file").asText()
      val stem = file.substringBeforeLast('.')
      val book = byFileName[file] ?: byStem[stem]
      val f = book?.let { flags[it.id] }
      CharacterBookStateDto(
        bookId = book?.id,
        number = node.path("number").takeIf { it.isNumber }?.asInt() ?: book?.number,
        file = file,
        castState = node.path("castState").takeIf { it.isTextual }?.asText() ?: "NONE",
        hasAudiobook = node.path("hasAudiobook").asBoolean(false),
        durationSec = node.path("durationSec").takeIf { it.isNumber }?.asDouble(),
        reprocessCharacters = f?.reprocessCharacters ?: false,
        reprocessAudiobook = f?.reprocessAudiobook ?: false,
      )
    }
    // Books Komga knows but the export predates (new arrivals) count as NONE,
    // which closes the series audiobook gate until analysis runs again.
    val exportedFiles = exportBooks.map { it.file }.toSet()
    val extraBooks = books.filter { it.path.name !in exportedFiles }.map { book ->
      val f = flags[book.id]
      CharacterBookStateDto(
        bookId = book.id,
        number = book.number,
        file = book.path.name,
        castState = "NONE",
        reprocessCharacters = f?.reprocessCharacters ?: false,
        reprocessAudiobook = f?.reprocessAudiobook ?: false,
      )
    }
    val allBooks = (exportBooks + extraBooks).sortedBy { it.number ?: Int.MAX_VALUE }
    val ready = allBooks.count { it.castState == "READY" }
    val dismissed = characterBookStateDao.findDismissedPairs(seriesId)

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
      suggestions = root.path("suggestions").mapNotNull { s ->
        val a = s.path("aName").asText()
        val b = s.path("bName").asText()
        if (pairKey(a, b) in dismissed) {
          null
        } else {
          MergeSuggestionDto(
            aId = s.path("aId").takeIf { it.isTextual }?.asText(),
            bId = s.path("bId").takeIf { it.isTextual }?.asText(),
            aName = a,
            bName = b,
            confidence = s.path("confidence").takeIf { it.isNumber }?.asDouble(),
            reason = s.path("reason").takeIf { it.isTextual }?.asText(),
          )
        }
      },
      totalBooks = allBooks.size,
      castReadyCount = ready,
      needsAnalysisCount = allBooks.size - ready,
      canGenerateAllAudiobooks = allBooks.isNotEmpty() && ready == allBooks.size,
    )
  }

  @PostMapping(value = ["/analyze"], produces = [MediaType.APPLICATION_JSON_VALUE])
  @Operation(summary = "Queue character analysis for the books that need it (or the given books)")
  fun analyze(
    @AuthenticationPrincipal principal: KomgaPrincipal,
    @PathVariable seriesId: String,
    @RequestBody(required = false) request: CharacterJobRequest?,
  ): CharacterJobDto {
    val (series, states, booksById) = context(principal, seriesId)
    val targets = if (!request?.bookIds.isNullOrEmpty()) {
      states.filter { it.bookId in request.bookIds }
    } else {
      states.filter { it.castState != "READY" || it.reprocessCharacters }
    }
    if (targets.isEmpty()) throw ResponseStatusException(HttpStatus.CONFLICT, "No books need character analysis")
    val jobBooks = targets.map { state ->
      CharacterJobService.JobBook(
        file = state.file,
        number = state.number,
        force = state.reprocessCharacters || (!request?.bookIds.isNullOrEmpty()),
      )
    }
    val jobId = submitJob(series, states, booksById, "analyze_series", jobBooks)
    targets.forEach { it.bookId?.let { id -> characterBookStateDao.setFlags(id, reprocessCharacters = false, reprocessAudiobook = null) } }
    return CharacterJobDto(id = jobId, type = "analyze_series", state = "queued", bookCount = jobBooks.size)
  }

  @PostMapping(value = ["/generate-audiobooks"], produces = [MediaType.APPLICATION_JSON_VALUE])
  @Operation(summary = "Queue audiobook generation; requires character data for every book in the series")
  fun generateAudiobooks(
    @AuthenticationPrincipal principal: KomgaPrincipal,
    @PathVariable seriesId: String,
    @RequestBody(required = false) request: CharacterJobRequest?,
  ): CharacterJobDto {
    val (series, states, booksById) = context(principal, seriesId)
    val explicit = !request?.bookIds.isNullOrEmpty()
    // Series-wide runs require every book analyzed; an explicit book list
    // (e.g. the book page's own generate button) only requires those books.
    val gatePool = if (explicit) states.filter { it.bookId in request.bookIds } else states
    val notReady = gatePool.count { it.castState != "READY" }
    if (notReady > 0) {
      throw ResponseStatusException(HttpStatus.CONFLICT, "$notReady book(s) still need character analysis")
    }
    val targets = if (explicit) {
      gatePool
    } else {
      states.filter { !it.hasAudiobook || it.reprocessAudiobook }
    }
    if (targets.isEmpty()) throw ResponseStatusException(HttpStatus.CONFLICT, "No books need audiobook generation")
    val jobBooks = targets.map { state ->
      CharacterJobService.JobBook(file = state.file, number = state.number, force = state.reprocessAudiobook)
    }
    val jobId = submitJob(series, states, booksById, "generate_audiobooks", jobBooks)
    targets.forEach { it.bookId?.let { id -> characterBookStateDao.setFlags(id, reprocessCharacters = null, reprocessAudiobook = false) } }
    return CharacterJobDto(id = jobId, type = "generate_audiobooks", state = "queued", bookCount = jobBooks.size)
  }

  @PostMapping(value = ["/marks"], produces = [MediaType.APPLICATION_JSON_VALUE])
  @Operation(summary = "Mark or unmark books for character / audiobook reprocessing")
  fun marks(
    @AuthenticationPrincipal principal: KomgaPrincipal,
    @PathVariable seriesId: String,
    @RequestBody request: CharacterMarksRequest,
  ): Map<String, Int> {
    contentRestrictionChecker.checkContentRestrictionSeries(principal.user, seriesId)
    seriesRepository.findByIdOrNull(seriesId) ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)
    val validIds = bookRepository.findAllBySeriesId(seriesId).map { it.id }.toSet()
    var updated = 0
    request.bookIds.filter { it in validIds }.forEach { bookId ->
      characterBookStateDao.setFlags(bookId, request.reprocessCharacters, request.reprocessAudiobook)
      updated++
    }
    return mapOf("updated" to updated)
  }

  @GetMapping(value = ["/jobs"], produces = [MediaType.APPLICATION_JSON_VALUE])
  @Operation(summary = "Recent character jobs for this series, with live status")
  fun jobs(
    @AuthenticationPrincipal principal: KomgaPrincipal,
    @PathVariable seriesId: String,
  ): List<CharacterJobDto> {
    contentRestrictionChecker.checkContentRestrictionSeries(principal.user, seriesId)
    val series = seriesRepository.findByIdOrNull(seriesId) ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)
    val slug = slugFor(seriesId, series)
    return characterJobService.recentJobsForSlug(slug).map { job ->
      val status = characterJobService.readStatus(job.path("id").asText())
      CharacterJobDto(
        id = job.path("id").asText(),
        type = job.path("type").asText(),
        state = status?.path("state")?.takeIf { it.isTextual }?.asText() ?: "queued",
        phase = status?.path("phase")?.takeIf { it.isTextual }?.asText(),
        bookIndex = status?.path("bookIndex")?.takeIf { it.isNumber }?.asInt(),
        bookCount = status?.path("bookCount")?.takeIf { it.isNumber }?.asInt()
          ?: job.path("books").size(),
        detail = status?.path("detail")?.takeIf { it.isTextual }?.asText(),
        error = status?.path("error")?.takeIf { it.isTextual }?.asText(),
        createdAt = job.path("createdAt").takeIf { it.isTextual }?.asText(),
      )
    }
  }

  private data class Ctx(
    val series: org.gotson.komga.domain.model.Series,
    val states: List<CharacterBookStateDto>,
    val booksById: Map<String, Book>,
  )

  private fun context(
    principal: KomgaPrincipal,
    seriesId: String,
  ): Ctx {
    // reuse the GET assembly for states by calling the read path pieces directly
    val dto = getSeriesCharacters(principal, seriesId)
    val series = seriesRepository.findByIdOrNull(seriesId)!!
    val booksById = bookRepository.findAllBySeriesId(seriesId).associateBy { it.id }
    return Ctx(series, dto.books, booksById)
  }

  private fun slugFor(
    seriesId: String,
    series: org.gotson.komga.domain.model.Series,
  ): String {
    val books = bookRepository.findAllBySeriesId(seriesId)
    val path = seriesCharactersService.findForBooks(books)
    val exportSlug = path?.let { seriesCharactersService.readExport(it) }
      ?.path("seriesSlug")?.takeIf { it.isTextual }?.asText()
    return exportSlug ?: characterJobService.slugify(series.name)
  }

  private fun submitJob(
    series: org.gotson.komga.domain.model.Series,
    states: List<CharacterBookStateDto>,
    booksById: Map<String, Book>,
    type: String,
    jobBooks: List<CharacterJobService.JobBook>,
  ): String {
    if (!characterJobService.isAvailable()) {
      throw ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Character worker is not connected")
    }
    val firstBook = states.firstOrNull()?.bookId?.let { booksById[it] }
      ?: throw ResponseStatusException(HttpStatus.CONFLICT, "Series has no books")
    val hostDir = firstBook.path.parent?.let { characterJobService.hostSeriesDir(it) }
      ?: throw ResponseStatusException(HttpStatus.CONFLICT, "Series folder is not in a worker-visible library root")
    return characterJobService.submit(
      type = type,
      seriesSlug = slugFor(series.id, series),
      seriesName = series.name,
      seriesDirHost = hostDir,
      books = jobBooks,
    )
  }

  private fun character(
    node: JsonNode,
    byStem: Map<String, Book>,
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

  companion object {
    fun pairKey(
      a: String,
      b: String,
    ): String = listOf(a.lowercase(), b.lowercase()).sorted().joinToString("|")
  }
}
